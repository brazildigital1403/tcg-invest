// src/app/api/stripe/portal/route.ts
//
// R7-PAY Commit 2 — 30/abril/2026
//
// Cria uma Stripe Customer Portal session pra cliente gerenciar a assinatura
// (trocar plano, atualizar cartão, cancelar, ver invoices).
//
// Suporta 2 contextos:
//   - Usuário Pro: lê stripe_customer_id de users
//   - Lojista: lê stripe_customer_id de lojas (precisa lojaId no body)
//
// Auth: valida sessão Supabase via Bearer token, OU userId+email via body
//       (mesmo padrão do /api/stripe/checkout). Não usa cookies de auth pra
//       manter consistência com o resto da API.
//
// IMPORTANTE: o Customer Portal precisa estar configurado no Stripe Dashboard:
//   https://dashboard.stripe.com/test/settings/billing/portal
// Lá configura: quais features estão habilitadas (cancel, update payment, etc).

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
    const { lojaId, returnUrl } = body as { lojaId?: string; returnUrl?: string }

    // Auth via Bearer token
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    let user: any = null
    if (token) {
      const { data: { user: authUser } } = await supabaseAuth.auth.getUser(token)
      user = authUser
    }

    // Fallback: tenta pegar via cookie session (next/server) — Supabase auth
    if (!user) {
      const { data: sessionData } = await supabaseAuth.auth.getSession()
      user = sessionData.session?.user || null
    }

    if (!user) {
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
      if (loja.owner_user_id !== user.id) {
        return NextResponse.json({ error: 'Você não é dono desta loja' }, { status: 403 })
      }

      customerId = loja.stripe_customer_id || null
      defaultReturnUrl = `${APP}/minha-loja/${lojaId}/plano`
    } else {
      // Contexto Pro usuário
      const { data: userRow } = await supabase
        .from('users')
        .select('stripe_customer_id')
        .eq('id', user.id)
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
