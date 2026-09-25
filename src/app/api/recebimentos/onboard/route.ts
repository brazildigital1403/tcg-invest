import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { normalizarPrazo } from '@/lib/comissao'

/**
 * POST /api/recebimentos/onboard
 *
 * Cria (ou reaproveita) a conta Stripe Connect EXPRESS da PESSOA e devolve a
 * URL do onboarding hospedado. Ela preenche CPF/CNPJ, banco e KYC direto na
 * Stripe -- a Bynx nunca ve esses dados.
 *
 * ★ E O ESPELHO de /api/lojas/[id]/connect/onboard para quem nao tem loja.
 * A conta nasce no usuario, e a loja dele (se um dia existir) HERDA essa conta
 * pelo `resolverRecebedor` -- ninguem refaz cadastro por ter aberto uma loja.
 *
 * ★ QUEM PODE ATIVAR: quem anuncia (decisao do Du, 24/09/2026). O guard e ter
 * pelo menos um anuncio no ar. Nao e burocracia: conta Express e uma conta que
 * a PLATAFORMA responde por perante a Stripe, entao ela nasce ligada a alguem
 * que esta de fato vendendo, e nao a qualquer cadastro.
 *
 * ★ `business_type` NAO VAI DEFINIDO: quem escolhe e a pessoa no onboarding, e
 * `individual` com CPF e uma opcao valida no BR. Cravar aqui obrigaria CNPJ a
 * quem nao tem -- foi exatamente o que travou a GhosTCG, parada com 40
 * requisitos `past_due` por ter entrado como empresa.
 */

export async function POST(req: NextRequest) {
  try {
    const db = getServiceSupabase()
    if (!db) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })

    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Faça login.' }, { status: 401 })

    const { data: authData } = await db.auth.getUser(token)
    const uid = authData?.user?.id
    if (!uid) return NextResponse.json({ error: 'Sessão expirada. Entre de novo.' }, { status: 401 })

    const { data: linhas } = await db
      .from('users')
      .select('id, email, name, username, cep, suspended_at, stripe_connect_account_id, repasse_prazo')
      .eq('id', uid)
      .limit(1)
    const user = linhas?.[0]
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })

    if (user.suspended_at) {
      return NextResponse.json({ error: 'Sua conta está suspensa.' }, { status: 403 })
    }

    // ── Guards ───────────────────────────────────────────────────────────
    const { count: anuncios } = await db
      .from('marketplace')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('status', 'disponivel')
      .is('removido_em', null)

    if (!anuncios) {
      return NextResponse.json(
        { error: 'Anuncie pelo menos uma carta antes de ativar os recebimentos.' },
        { status: 403 }
      )
    }

    // ★ SEM CEP NAO ADIANTA ATIVAR. Quem vende de casa cota o frete pelo CEP;
    // sem ele o botao "Comprar" continuaria escondido mesmo com a conta
    // aprovada -- a pessoa faria o KYC inteiro para nada.
    if (String(user.cep || '').replace(/\D/g, '').length !== 8) {
      return NextResponse.json(
        { error: 'Informe o CEP de onde você posta antes de ativar.' },
        { status: 400 }
      )
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[recebimentos/onboard] STRIPE_SECRET_KEY ausente')
      return NextResponse.json({ error: 'Pagamentos indisponíveis no momento.' }, { status: 500 })
    }

    const apiVersion = '2025-03-31.basil' as Stripe.StripeConfig['apiVersion']
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion })
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'

    let accountId: string | null = user.stripe_connect_account_id || null

    // ─── Cria a conta Express (1x por pessoa) ───────────────────────────
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'BR',
        default_currency: 'brl',
        email: user.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: user.name || user.username || 'Vendedor Bynx',
          url: user.username ? `${base}/perfil/${user.username}` : `${base}/marketplace`,
          // MCC 5945 = Hobby, Toy and Game Shops, igual ao da loja.
          mcc: '5945',
          product_description: 'Venda de cartas colecionaveis Pokemon TCG',
        },
        metadata: { bynx_user_id: String(user.id), bynx: '1' },
      })

      accountId = account.id

      const { error: upErr } = await db
        .from('users')
        .update({
          stripe_connect_account_id: accountId,
          stripe_connect_status: 'pendente',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (upErr) {
        console.error('[recebimentos/onboard] falha ao salvar account id:', upErr.message)
        // A conta existe na Stripe e nao gravou aqui: abortar evita criar uma
        // conta orfa nova a cada clique.
        return NextResponse.json({ error: 'Erro ao salvar a conta. Tente de novo.' }, { status: 500 })
      }

      // Prazo de repasse = `delay_days`. 'weekly' nao existe no BR. Falhar aqui
      // nao quebra o onboarding: vale o default e o PATCH re-aplica depois.
      try {
        await stripe.accounts.update(accountId, {
          settings: {
            payouts: { schedule: { interval: 'daily', delay_days: normalizarPrazo(user.repasse_prazo) } },
          },
        })
      } catch (e) {
        console.warn('[recebimentos/onboard] payout schedule nao aplicado:', (e as Error)?.message)
      }
    }

    // ─── Link de onboarding (uso unico, expira) ─────────────────────────
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/recebimentos?refresh=1`,
      return_url: `${base}/recebimentos?done=1`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: link.url })
  } catch (err) {
    const msg = (err as Error)?.message || 'erro'
    console.error('[recebimentos/onboard] erro:', msg)
    return NextResponse.json({ error: `Erro ao iniciar o cadastro: ${msg}` }, { status: 500 })
  }
}
