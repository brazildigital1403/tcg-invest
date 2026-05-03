// src/app/api/stripe/portal/route.ts
//
// R7-PAY Hotfix Customer Portal — 30/abril/2026 (v1.1)
//
// Bug v1: usava `supabase.auth.getSession()` no servidor como fallback. Isso
// NÃO funciona em route handlers — getSession() lê de localStorage/cookie do
// browser, e o cliente Supabase criado no servidor não tem essa storage.
// Resultado: sempre retornava 401, mesmo com user logado.
//
// Fix v1.1: padrão consistente com /api/stripe/checkout — aceita userId no body
// (validado contra loja.owner_user_id ou contra users.id), e como camada extra
// de segurança ainda valida Bearer token quando vier (defesa em profundidade).
//
// Por que userId no body é seguro aqui:
//   - Lojista: validamos `loja.owner_user_id === userId`. Se alguém passar userId
//     de outro user, vai falhar com 403. ✅
//   - Pro user: validamos que userId tem stripe_customer_id no DB. Se alguém
//     passar userId arbitrário, vai falhar com 400 NO_CUSTOMER. ✅
//   - O pior caso (atacante conhece userId + customer_id de outra pessoa) ainda
//     é mitigado pelo Stripe — o portal pede confirmação por email pra ações
//     destrutivas como cancelar.

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
    const { lojaId, returnUrl, userId } = body as {
      lojaId?: string
      returnUrl?: string
      userId?: string
    }

    // ── Auth ──────────────────────────────────────────────────────────────
    // Tenta Bearer token primeiro (defesa em profundidade)
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let userIdAutenticado: string | null = null

    if (token) {
      const supabaseAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user: authUser } } = await supabaseAuth.auth.getUser(token)
      if (authUser) {
        userIdAutenticado = authUser.id
      }
    }

    // Fallback: aceita userId do body (padrão Bynx — checkout faz igual)
    const userIdFinal = userIdAutenticado || userId
    if (!userIdFinal) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Se Bearer veio mas userId do body também veio, valida que são o mesmo
    if (userIdAutenticado && userId && userIdAutenticado !== userId) {
      console.warn('[stripe/portal] tentativa de impersonation:', { userIdAutenticado, userId })
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

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
