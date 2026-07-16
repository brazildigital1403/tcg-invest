import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'
import { normalizarPrazo } from '@/lib/comissao'

/**
 * POST /api/lojas/[id]/connect/onboard
 *
 * Cria (ou reaproveita) a conta Stripe Connect EXPRESS da loja e devolve a URL
 * do onboarding hospedado pela Stripe. O lojista preenche dados/banco/KYC la —
 * a Bynx NUNCA ve esses dados.
 *
 * Auth: owner da loja OU admin (autenticarOwnerOuAdmin).
 * Regra: so loja com status 'ativa' pode ativar recebimentos. A plataforma
 * responde pelas perdas de contas Express (regra da Stripe), entao nao abrimos
 * pra loja pendente/suspensa.
 *
 * Resposta: { url } -> o client redireciona.
 */

const SELECT = 'id, owner_user_id, nome, slug, email, status, stripe_connect_account_id, repasse_prazo'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params

    const auth = await autenticarOwnerOuAdmin(req, lojaId, SELECT)
    if ('error' in auth) return auth.error
    const { loja, sb } = auth

    if (loja.status !== 'ativa') {
      return NextResponse.json(
        { error: 'Sua loja precisa estar ativa para receber pagamentos.' },
        { status: 403 }
      )
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[connect/onboard] STRIPE_SECRET_KEY ausente')
      return NextResponse.json({ error: 'Pagamentos indisponiveis no momento.' }, { status: 500 })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' })
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'

    let accountId: string | null = loja.stripe_connect_account_id || null

    // ─── Cria a conta Express (1x por loja) ─────────────────────────────────
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'BR',
        default_currency: 'brl',
        email: loja.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: loja.nome,
          url: `${base}/lojas/${loja.slug}`,
          // MCC 5945 = Hobby, Toy and Game Shops
          mcc: '5945',
          product_description: 'Venda de cartas colecionaveis Pokemon TCG',
        },
        metadata: { bynx_loja_id: String(loja.id), bynx: '1' },
      })

      accountId = account.id

      const { error: upErr } = await sb
        .from('lojas')
        .update({
          stripe_connect_account_id: accountId,
          stripe_connect_status: 'pendente',
          updated_at: new Date().toISOString(),
        })
        .eq('id', lojaId)

      if (upErr) {
        console.error('[connect/onboard] falha ao salvar account id', upErr.message)
        // A conta existe na Stripe mas nao gravou: aborta pra nao criar orfa em loop.
        return NextResponse.json({ error: 'Erro ao salvar a conta. Tente de novo.' }, { status: 500 })
      }

      // Prazo de repasse (14/30 dias) = `delay_days`: e ele que honra a promessa
      // feita ao lojista ("voce recebe X dias depois da venda").
      // ATENCAO (aprendido na marra): a Stripe BR NAO aceita interval 'weekly'
      // ("The payout interval \"weekly\" is not available for merchants in BR").
      // Usamos 'daily': o repasse so acontece nos dias em que ha saldo maduro,
      // entao loja de baixo volume gera poucos repasses de qualquer jeito.
      // Falha aqui NAO quebra o onboarding: vale o default da Stripe e o PATCH
      // de /connect re-aplica depois.
      try {
        await stripe.accounts.update(accountId, {
          settings: {
            payouts: {
              schedule: {
                interval: 'daily',
                delay_days: normalizarPrazo(loja.repasse_prazo),
              },
            },
          },
        })
      } catch (e) {
        console.warn('[connect/onboard] payout schedule nao aplicado:', (e as Error)?.message)
      }
    }

    // ─── Link de onboarding (uso unico, expira) ─────────────────────────────
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/minha-loja/${lojaId}/pagamentos?refresh=1`,
      return_url: `${base}/minha-loja/${lojaId}/pagamentos?done=1`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: link.url })
  } catch (err) {
    const msg = (err as Error)?.message || 'erro'
    console.error('[connect/onboard] erro:', msg)
    return NextResponse.json({ error: `Erro ao iniciar o cadastro: ${msg}` }, { status: 500 })
  }
}
