// src/app/api/cron-monthly-ranking/route.ts
//
// Cron mensal — Indique e Ganhe.
//
// Roda no dia 1 de cada mês, 00:05 UTC (configurado em vercel.json).
// Tira snapshot imutável do ranking do mês ANTERIOR + dispara email pros Top 3.
//
// IDEMPOTENTE: se snapshot do mês já existe, RPC retorna noop e o cron só
// re-envia os emails se quisermos (atualmente, NÃO re-envia — evita spam).
//
// Auth: header Authorization: Bearer ${CRON_SECRET}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendReferralActivatedEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const PRIZE_LABEL: Record<number, string> = {
  1: 'R$ 200,00 (Top 1 do mês)',
  2: 'R$ 100,00 (Top 2 do mês)',
  3: 'R$ 50,00 (Top 3 do mês)',
}

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  // ── Calcula ano/mês ANTERIOR (snapshot fecha o mês que acabou) ───
  const now = new Date()
  const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()
  const month = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth() // mês 1-12 do ANTERIOR

  console.log(`[cron-monthly-ranking] Snapshotting ranking for ${year}-${String(month).padStart(2, '0')}`)

  try {
    // ── Chama RPC snapshot_monthly_ranking ────────────────────────
    const { data: snapResult, error: snapError } = await supabase.rpc('snapshot_monthly_ranking', {
      p_year: year,
      p_month: month,
    })

    if (snapError) {
      console.error('[cron-monthly-ranking] RPC error:', snapError.message)
      return NextResponse.json({ ok: false, error: 'snapshot_failed', detail: snapError.message }, { status: 500 })
    }

    const isNoop = snapResult?.noop === true
    const top3 = snapResult?.top3 || []
    const insertedCount = snapResult?.inserted_count || 0

    console.log(`[cron-monthly-ranking] Inserted: ${insertedCount}, top3 count: ${top3.length}, noop: ${isNoop}`)

    // ── Envia emails pro Top 3 (só se snapshot foi criado agora) ─
    let emailsSent = 0
    if (!isNoop && top3.length > 0) {
      const userIds = top3.map((t: any) => t.user_id)
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, name, points_balance')
        .in('id', userIds)

      for (const winner of top3) {
        const u = usersData?.find(x => x.id === winner.user_id)
        if (!u?.email) continue

        try {
          const monthName = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric',
          })
          await sendReferralActivatedEmail({
            to: u.email,
            name: u.name || '',
            pointsAwarded: 0, // Não é pontos — é prêmio em R$
            newBalance: u.points_balance || 0,
          })
          // ⚠️ TODO: criar sendMonthlyTop3PrizeEmail dedicado em vez de reutilizar
          // o ReferralActivatedEmail. Por ora reusa.
          console.log(`[cron-monthly-ranking] Email enviado pro Top ${winner.position}: ${u.email} (${monthName})`)
          emailsSent++
        } catch (emailErr: any) {
          console.error(`[cron-monthly-ranking] email err pro user ${u.id}:`, emailErr?.message)
        }
      }
    }

    return NextResponse.json({
      ok: true,
      period: { year, month },
      noop: isNoop,
      inserted_count: insertedCount,
      top3_count: top3.length,
      emails_sent: emailsSent,
      top3,
    })
  } catch (err: any) {
    console.error('[cron-monthly-ranking] unexpected:', err?.message)
    return NextResponse.json({ ok: false, error: 'internal', detail: err?.message }, { status: 500 })
  }
}
