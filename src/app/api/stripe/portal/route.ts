// src/app/api/stripe/portal/route.ts
//
// Customer Portal do Stripe — v2 (30/08/2026)
//
// ★ v2: o Bearer token passou a ser OBRIGATORIO. A v1.1 aceitava `userId` no
// corpo como fallback, com a justificativa de que validar `loja.owner_user_id`
// ou a existencia de `stripe_customer_id` bastava. Nao bastava:
//
//   - `/perfil/<UUID>` e rota publica e ACEITA o UUID; a view `public_users`
//     devolve a coluna `id` pra leitura anonima. Ou seja, o UUID de qualquer
//     usuario com perfil publico e obtivel, em massa.
//   - Com esse UUID no corpo, a rota resolvia o `stripe_customer_id` da VITIMA
//     e abria o portal de cobranca dela: metodo de pagamento, historico de
//     faturas, endereco de cobranca -- e o botao de cancelar a assinatura.
//   - A mitigacao citada na v1.1 ("o Stripe pede confirmacao por email pra
//     acoes destrutivas") nao cobre a LEITURA desses dados, que ja e o
//     vazamento; e nao vale pra toda acao do portal.
//
// A v1 tinha um problema real -- `supabase.auth.getSession()` nao funciona em
// route handler, porque le storage do browser. A correcao certa era o Bearer,
// que ja estava aqui como "defesa em profundidade"; o fallback e que sobrava.
// Todos os chamadores ja enviam o header.

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe não configurado' }, { status: 503 })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' })
    const body = await req.json().catch(() => ({}))
    const { lojaId, returnUrl } = body as {
      lojaId?: string
      returnUrl?: string
    }

    // ── Auth ──────────────────────────────────────────────────────────────
    // O Bearer e a UNICA fonte de identidade aqui. `userId` no corpo e
    // deliberadamente ignorado -- ver o cabecalho do arquivo.
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user: authUser } } = await supabaseAuth.auth.getUser(token)
    if (!authUser) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const userIdFinal = authUser.id

    // ── Resolve customerId ────────────────────────────────────────────────
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    let customerId: string | null = null
    let defaultReturnUrl: string = `${APP}/minha-conta`

    if (lojaId) {
      // Contexto Lojista
      const { data: lojaRow } = await supabase
        .from('lojas')
        .select('stripe_customer_id, owner_user_id')
        .eq('id', lojaId)
        .limit(1)

      const loja = lojaRow?.[0]
      if (!loja) {
        return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
      }
      if (loja.owner_user_id !== userIdFinal) {
        return NextResponse.json({ error: 'Você não é dono desta loja' }, { status: 403 })
      }

      customerId = loja.stripe_customer_id || null
      defaultReturnUrl = `${APP}/minha-loja/${lojaId}/plano`
    } else {
      // Contexto Pro usuário
      const { data: userRow } = await supabase
        .from('users')
        .select('stripe_customer_id')
        .eq('id', userIdFinal)
        .limit(1)

      customerId = userRow?.[0]?.stripe_customer_id || null
    }

    if (!customerId) {
      return NextResponse.json({
        error: 'Você ainda não tem assinatura ativa. Faça uma compra primeiro.',
        code: 'NO_CUSTOMER',
      }, { status: 400 })
    }

    // ── Cria Portal Session ───────────────────────────────────────────────
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || defaultReturnUrl,
    })

    return NextResponse.json({ url: portalSession.url })

  } catch (err: any) {
    console.error('[stripe/portal] CRITICAL:', err.message, err.stack)

    // Erro comum: portal não configurado no Stripe Dashboard
    if (err.message?.includes('No configuration provided')) {
      return NextResponse.json({
        error: 'Customer Portal não configurado. Acesse Stripe Dashboard → Settings → Customer Portal.',
        code: 'PORTAL_NOT_CONFIGURED',
      }, { status: 503 })
    }

    return NextResponse.json({ error: 'Erro ao abrir portal' }, { status: 500 })
  }
}
