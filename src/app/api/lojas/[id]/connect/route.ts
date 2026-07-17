import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'
import { ehPrazoValido, normalizarPrazo } from '@/lib/comissao'
import { classificarConta } from '@/lib/connect-status'

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

    // Classificacao vem da lib compartilhada com o webhook account.updated —
    // se divergir, a pagina mostra um status e o banco guarda outro.
    const c = classificarConta(acc)
    const { status, charges, payouts, detalhesEnviados, pendencias } = c

    const patch: Record<string, unknown> = {
      stripe_connect_status: status,
      connect_charges_enabled: charges,
      connect_payouts_enabled: payouts,
      connect_requirements: c.requirements,
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
      disabled_reason: c.disabledReason,
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

    // ORDEM IMPORTA: a Stripe manda, o banco obedece.
    //
    // O `repasse_prazo` define a COMISSAO (14d = 4,99% / 30d = 3,99%). Se a
    // gente gravasse no banco antes e a Stripe recusasse o prazo, a loja seria
    // cobrada em 4,99% e continuaria recebendo em 30 dias — cobrar mais caro
    // entregando o prazo mais lento. Entao: aplica na Stripe primeiro e so
    // persiste se ela aceitar.
    //
    // Limite real (descoberto em producao): "You cannot lower this merchant's
    // delay below 30" — a Stripe BR impoe um piso de repasse por conta. Pra
    // conta nova o piso e 30 dias, entao o plano de 14 dias simplesmente nao
    // esta disponivel ainda. Devolvemos 409 com mensagem clara.
    const accountId: string | null = loja.stripe_connect_account_id || null
    if (accountId) {
      const stripe = stripeClient()
      if (stripe) {
        try {
          // 'daily' porque a Stripe BR nao aceita 'weekly'. O delay_days e que
          // garante o prazo prometido ao lojista.
          await stripe.accounts.update(accountId, {
            settings: {
              payouts: { schedule: { interval: 'daily', delay_days: prazo } },
            },
          })
        } catch (e) {
          const msg = (e as Error)?.message || ''
          console.warn('[connect PATCH] schedule recusado pela Stripe:', msg)
          const ehPiso = /lower this merchant's delay|delay below/i.test(msg)
          return NextResponse.json(
            {
              error: ehPiso
                ? `A Stripe ainda não libera repasse em ${prazo} dias para a sua conta. Conforme sua loja ganha histórico de vendas, esse prazo pode ser reduzido.`
                : 'Não foi possível alterar o prazo agora. Tente de novo mais tarde.',
              repasse_prazo: normalizarPrazo(loja.repasse_prazo),
            },
            { status: 409 }
          )
        }
      }
    }

    const { error: upErr } = await sb
      .from('lojas')
      .update({ repasse_prazo: prazo, updated_at: new Date().toISOString() })
      .eq('id', lojaId)

    if (upErr) {
      console.error('[connect PATCH] falha ao salvar', upErr.message)
      return NextResponse.json({ error: 'Erro ao salvar o prazo.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, repasse_prazo: prazo })
  } catch (err) {
    console.error('[connect PATCH] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
