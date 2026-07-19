import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'
import { ehPrazoValido, normalizarPrazo } from '@/lib/comissao'
import { classificarConta } from '@/lib/connect-status'

/**
 * GET   /api/lojas/[id]/connect  -> le a conta na Stripe e SINCRONIZA o status
 * PATCH /api/lojas/[id]/connect  -> troca prazo de repasse / frete / modo de frete / CEP
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
 *
 * Frete: 'fixo' (valor unico da loja) ou 'calculado' (Melhor Envio por CEP no
 * checkout). No calculado o `cep` de origem e obrigatorio.
 */

const SELECT = 'id, owner_user_id, status, stripe_connect_account_id, stripe_connect_status, connect_charges_enabled, connect_payouts_enabled, repasse_prazo, frete_cents, frete_gratis_acima_cents, cep, frete_modo'

function stripeClient(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' })
}

function soDigitos(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '')
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
        frete_cents: loja.frete_cents ?? 0,
        frete_gratis_acima_cents: loja.frete_gratis_acima_cents ?? null,
        frete_modo: loja.frete_modo ?? 'fixo',
        cep: loja.cep ?? null,
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
      frete_cents: loja.frete_cents ?? 0,
      frete_gratis_acima_cents: loja.frete_gratis_acima_cents ?? null,
      frete_modo: loja.frete_modo ?? 'fixo',
      cep: loja.cep ?? null,
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
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
    }

    // PATCH parcial: a pagina manda so o que o lojista mexeu.
    const temPrazo = 'repasse_prazo' in body
    const temFrete = 'frete_cents' in body
    const temGratis = 'frete_gratis_acima_cents' in body
    const temModo = 'frete_modo' in body
    const temCep = 'cep' in body
    if (!temPrazo && !temFrete && !temGratis && !temModo && !temCep) {
      return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    // ── Frete (nao envolve a Stripe: e regra da loja) ────────────────────
    if (temFrete) {
      const f = Number(body.frete_cents)
      // Teto de R$200 e o mesmo do CHECK no banco — melhor recusar aqui com
      // mensagem boa do que deixar o Postgres estourar constraint.
      if (!Number.isInteger(f) || f < 0 || f > 20000) {
        return NextResponse.json({ error: 'Frete inválido. Use de R$ 0,00 a R$ 200,00.' }, { status: 400 })
      }
      patch.frete_cents = f
    }
    if (temGratis) {
      const g = body.frete_gratis_acima_cents
      if (g === null) patch.frete_gratis_acima_cents = null
      else {
        const gn = Number(g)
        if (!Number.isInteger(gn) || gn <= 0) {
          return NextResponse.json({ error: 'Valor inválido para frete grátis.' }, { status: 400 })
        }
        patch.frete_gratis_acima_cents = gn
      }
    }

    // ── Modo de frete + CEP de origem ────────────────────────────────────
    let modoFinal: string = loja.frete_modo || 'fixo'
    if (temModo) {
      if (body.frete_modo !== 'fixo' && body.frete_modo !== 'calculado') {
        return NextResponse.json({ error: 'Modo de frete inválido.' }, { status: 400 })
      }
      modoFinal = body.frete_modo
      patch.frete_modo = body.frete_modo
    }

    let cepFinal: string | null = loja.cep ?? null
    if (temCep) {
      const cd = soDigitos(body.cep)
      if (cd && cd.length !== 8) {
        return NextResponse.json({ error: 'CEP inválido. Use 8 dígitos.' }, { status: 400 })
      }
      cepFinal = cd || null
      patch.cep = cepFinal
    }

    // Frete calculado exige CEP de origem valido (novo ou o que ja estava).
    if (modoFinal === 'calculado' && soDigitos(cepFinal).length !== 8) {
      return NextResponse.json(
        { error: 'Para frete calculado, informe o CEP de origem (de onde você posta).' },
        { status: 400 }
      )
    }

    // ── Prazo (esse SIM depende da Stripe aceitar) ───────────────────────
    const prazo = body.repasse_prazo
    if (temPrazo && !ehPrazoValido(prazo)) {
      return NextResponse.json({ error: 'Prazo invalido. Use 14 ou 30.' }, { status: 400 })
    }
    if (temPrazo) patch.repasse_prazo = prazo

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
    if (temPrazo && accountId) {
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

    const { error: upErr } = await sb.from('lojas').update(patch).eq('id', lojaId)

    if (upErr) {
      console.error('[connect PATCH] falha ao salvar', upErr.message)
      return NextResponse.json({ error: 'Erro ao salvar as configurações.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, ...patch })
  } catch (err) {
    console.error('[connect PATCH] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
