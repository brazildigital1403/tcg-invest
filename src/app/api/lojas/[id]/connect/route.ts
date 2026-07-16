import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'
import { ehPrazoValido, normalizarPrazo } from '@/lib/comissao'

/**
 * GET   /api/lojas/[id]/connect  -> le a conta na Stripe e SINCRONIZA o status
 * PATCH /api/lojas/[id]/connect  -> troca o prazo de repasse (14 | 30 dias)
 *
 * Auth: owner da loja OU admin.
 *
 * Status derivado (stripe_connect_status):
 *   nao_iniciado -> sem conta criada
 *   pendente     -> conta criada, onboarding incompleto (faltam requirements)
 *   ativo        -> charges_enabled && payouts_enabled
 *   restrito     -> conta com pendencia/desabilitada (disabled_reason ou past_due)
 *
 * O webhook account.updated tambem sincroniza; este GET e o caminho sincrono
 * (usuario voltando do onboarding, sem esperar o webhook).
 */

const SELECT = 'id, owner_user_id, status, stripe_connect_account_id, stripe_connect_status, connect_charges_enabled, connect_payouts_enabled, repasse_prazo'

function stripeClient(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' })
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params

    const auth = await autenticarOwnerOuAdmin(req, lojaId, SELECT)
    if ('error' in auth) return auth.error
    const { loja, sb } = auth

    const accountId: string | null = loja.stripe_connect_account_id || null

    // Sem conta: devolve o estado local, sem bater na Stripe.
    if (!accountId) {
      return NextResponse.json({
        status: 'nao_iniciado',
        charges_enabled: false,
        payouts_enabled: false,
        repasse_prazo: normalizarPrazo(loja.repasse_prazo),
        pendencias: [],
      })
    }

    const stripe = stripeClient()
    if (!stripe) {
      return NextResponse.json({ error: 'Pagamentos indisponiveis no momento.' }, { status: 500 })
    }

    const acc = await stripe.accounts.retrieve(accountId)

    const charges = !!acc.charges_enabled
    const payouts = !!acc.payouts_enabled
    const req_ = acc.requirements
    const pendencias = [
      ...(req_?.currently_due || []),
      ...(req_?.past_due || []),
    ]

    // Classificacao do status. ATENCAO: conta Express recem-criada JA vem com
    // requirements.disabled_reason preenchido (o onboarding nao terminou) — se
    // olhar so pra isso, toda conta nova vira "restrito" e assusta o lojista.
    // O sinal certo de "ainda nao terminou o cadastro" e details_submitted.
    const detalhesEnviados = !!acc.details_submitted
    let status: 'pendente' | 'ativo' | 'restrito' = 'pendente'
    if (charges && payouts) status = 'ativo'
    else if (!detalhesEnviados) status = 'pendente'
    else if (req_?.disabled_reason || (req_?.past_due?.length || 0) > 0) status = 'restrito'

    const patch: Record<string, unknown> = {
      stripe_connect_status: status,
      connect_charges_enabled: charges,
      connect_payouts_enabled: payouts,
      connect_requirements: {
        currently_due: req_?.currently_due || [],
        past_due: req_?.past_due || [],
        disabled_reason: req_?.disabled_reason || null,
      },
      updated_at: new Date().toISOString(),
    }
    if (status === 'ativo' && loja.stripe_connect_status !== 'ativo') {
      patch.connect_onboarded_em = new Date().toISOString()
    }

    const { error: upErr } = await sb.from('lojas').update(patch).eq('id', lojaId)
    if (upErr) console.error('[connect GET] falha ao sincronizar', upErr.message)

    return NextResponse.json({
      status,
      charges_enabled: charges,
      payouts_enabled: payouts,
      details_submitted: detalhesEnviados,
      repasse_prazo: normalizarPrazo(loja.repasse_prazo),
      pendencias,
      disabled_reason: req_?.disabled_reason || null,
    })
  } catch (err) {
    const msg = (err as Error)?.message || 'erro'
    console.error('[connect GET] erro:', msg)
    return NextResponse.json({ error: 'Erro ao consultar a conta.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params

    const auth = await autenticarOwnerOuAdmin(req, lojaId, SELECT)
    if ('error' in auth) return auth.error
    const { loja, sb } = auth

    const body = await req.json().catch(() => null)
    const prazo = body?.repasse_prazo

    if (!ehPrazoValido(prazo)) {
      return NextResponse.json({ error: 'Prazo invalido. Use 14 ou 30.' }, { status: 400 })
    }

    const { error: upErr } = await sb
      .from('lojas')
      .update({ repasse_prazo: prazo, updated_at: new Date().toISOString() })
      .eq('id', lojaId)

    if (upErr) {
      console.error('[connect PATCH] falha', upErr.message)
      return NextResponse.json({ error: 'Erro ao salvar o prazo.' }, { status: 500 })
    }

    // Reflete na Stripe quando ja existe conta. Falha aqui nao desfaz o banco:
    // o valor local e o que manda na comissao; o schedule e re-aplicavel.
    const accountId: string | null = loja.stripe_connect_account_id || null
    if (accountId) {
      const stripe = stripeClient()
      if (stripe) {
        try {
          await stripe.accounts.update(accountId, {
            settings: {
              payouts: { schedule: { interval: 'weekly', weekly_anchor: 'monday', delay_days: prazo } },
            },
          })
        } catch (e) {
          console.warn('[connect PATCH] schedule nao aplicado:', (e as Error)?.message)
        }
      }
    }

    return NextResponse.json({ ok: true, repasse_prazo: prazo })
  } catch (err) {
    console.error('[connect PATCH] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
