// src/app/api/referrals/redeem/route.ts
//
// Indique e Ganhe — POST resgate de reward.
// Chama RPC redeem_points() que valida saldo + decrementa stock + cria
// row em point_redemptions atomicamente.
//
// Após sucesso: dispara email de confirmação.
//
// Body:
//   { reward_id: uuid }
//
// Resposta:
//   { ok: true, redemption_id: uuid, new_balance: int, reward_sku: string }
//   { ok: false, error: 'insufficient_points' | 'out_of_stock' | ... }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendRedemptionConfirmedEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    let body: { reward_id?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
    }

    const rewardId = (body.reward_id || '').trim()
    // UUID validation (simples mas eficaz)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rewardId)) {
      return NextResponse.json({ ok: false, error: 'invalid_reward_id' }, { status: 400 })
    }

    // Cliente com JWT do user (RPC usa auth.uid())
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data, error } = await supabase.rpc('redeem_points', {
      p_reward_id: rewardId,
    })

    if (error) {
      console.error('[referrals/redeem] RPC error:', error.message)
      return NextResponse.json({ ok: false, error: 'rpc_error', detail: error.message }, { status: 500 })
    }

    if (!data?.ok) {
      // Não é erro 500 — é validação (saldo, stock, etc)
      return NextResponse.json(data, { status: 400 })
    }

    // ── Dispara email de confirmação (fire & forget) ─────────────────
    try {
      const supabaseSvc = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      )

      const { data: { user } } = await supabaseSvc.auth.getUser(token)
      if (user) {
        const { data: profileData } = await supabaseSvc
          .from('users')
          .select('email, name')
          .eq('id', user.id)
          .limit(1)

        const { data: rewardData } = await supabaseSvc
          .from('rewards')
          .select('title, reward_type, reward_payload')
          .eq('id', rewardId)
          .limit(1)

        const profile = profileData?.[0]
        const reward = rewardData?.[0]

        if (profile?.email && reward) {
          // Instruções específicas por tipo de reward
          let instructions: string | undefined
          switch (reward.reward_type) {
            case 'pro_days':
              instructions = `Adicionamos ${reward.reward_payload?.days || 0} dias ao seu plano Pro. Vá em "Minha Conta" pra confirmar a nova data de expiração.`
              break
            case 'scan_credits':
              instructions = `Adicionamos ${reward.reward_payload?.credits || 0} créditos de scan IA na sua conta. Use em "Minha Coleção" → botão Scan.`
              break
            case 'separadores':
              instructions = 'Os Separadores PDF já estão liberados na sua conta. Acesse a página "Separadores" pra gerar.'
              break
            case 'physical':
              instructions = 'Prêmio físico: nosso time entra em contato em até 5 dias úteis pra confirmar endereço de entrega.'
              break
          }

          await sendRedemptionConfirmedEmail({
            to: profile.email,
            name: profile.name || '',
            rewardTitle: reward.title,
            costPoints: data.cost_points || 0,
            newBalance: data.new_balance || 0,
            redemptionId: data.redemption_id || '',
            fulfillmentInstructions: instructions,
          })
        }
      }
    } catch (emailErr: any) {
      console.error('[referrals/redeem] email error (non-blocking):', emailErr?.message)
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[referrals/redeem] unexpected:', err?.message)
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}
