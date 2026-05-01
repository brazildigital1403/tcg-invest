// src/app/api/stripe/checkout/route.ts
//
// R7-PAY Commit 1 — Refatoração 30/abril/2026
//
// Mudanças principais vs v1:
// - Suporte a 4 fluxos de Lojista (Pro/Premium × Mensal/Anual) com trial 14 dias
// - Reuso de stripe_customer_id quando user/loja já tem um (evita customer duplicado)
// - Validação explícita de env vars (mensagem clara em vez de erro genérico)
// - Mapa central PLAN_PRICE_MAP em vez de if/else encadeado
// - Cancel URL contextual por fluxo

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// ─── Configuração de planos ──────────────────────────────────────────────────

const SCAN_PACKAGES: Record<string, { priceEnv: string; creditos: number }> = {
  scan_basico:       { priceEnv: 'STRIPE_PRICE_SCAN_BASICO',       creditos: 5  },
  scan_popular:      { priceEnv: 'STRIPE_PRICE_SCAN_POPULAR',      creditos: 15 },
  scan_colecionador: { priceEnv: 'STRIPE_PRICE_SCAN_COLECIONADOR', creditos: 40 },
}

const PLAN_PRICE_ENV: Record<string, string> = {
  // ── Plano usuário ──
  mensal:                  'STRIPE_PRICE_MENSAL',
  anual:                   'STRIPE_PRICE_ANUAL',
  separadores:             'STRIPE_PRICE_SEPARADORES',
  // ── Plano lojista ──
  lojista_pro_mensal:      'STRIPE_PRICE_LOJISTA_PRO_MENSAL',
  lojista_pro_anual:       'STRIPE_PRICE_LOJISTA_PRO_ANUAL',
  lojista_premium_mensal:  'STRIPE_PRICE_LOJISTA_PREMIUM_MENSAL',
  lojista_premium_anual:   'STRIPE_PRICE_LOJISTA_PREMIUM_ANUAL',
}

const isLojistaPlano = (plano: string) => plano.startsWith('lojista_')
const isScanPackage  = (plano: string) => plano in SCAN_PACKAGES

const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe não configurado no servidor' }, { status: 503 })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' })
    const body = await req.json().catch(() => ({}))
    const { plano, userId, userEmail, lojaId } = body as {
      plano?: string; userId?: string; userEmail?: string; lojaId?: string
    }

    // ── Validações básicas ────────────────────────────────────────────────────
    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }
    if (!plano || typeof plano !== 'string') {
      return NextResponse.json({ error: 'Plano não informado' }, { status: 400 })
    }
    if (isLojistaPlano(plano) && !lojaId) {
      return NextResponse.json({ error: 'lojaId obrigatório para plano de loja' }, { status: 400 })
    }

    // ── Cliente Supabase (service role pra reuso de customer) ─────────────────
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // ── Reuso de stripe_customer_id ───────────────────────────────────────────
    // Se user/loja já tem customer Stripe, passamos `customer: existing_id` em vez
    // de `customer_email` — assim o Stripe não cria customer duplicado a cada
    // tentativa de checkout. Isso resolve a poluição encontrada na auditoria
    // (5 customers órfãos sem subscription).
    let existingCustomerId: string | null = null

    if (isLojistaPlano(plano) && lojaId) {
      const { data: lojaRow } = await supabase
        .from('lojas')
        .select('stripe_customer_id')
        .eq('id', lojaId)
        .limit(1)
      existingCustomerId = lojaRow?.[0]?.stripe_customer_id || null
    } else {
      const { data: userRow } = await supabase
        .from('users')
        .select('stripe_customer_id')
        .eq('id', userId)
        .limit(1)
      existingCustomerId = userRow?.[0]?.stripe_customer_id || null
    }

    const customerParam = existingCustomerId
      ? { customer: existingCustomerId }
      : { customer_email: userEmail }

    // ── Fluxo: Pacote de scan (one-time) ──────────────────────────────────────
    if (isScanPackage(plano)) {
      const pkg = SCAN_PACKAGES[plano]
      const priceId = process.env[pkg.priceEnv]
      if (!priceId) {
        console.error(`[stripe/checkout] env vazia: ${pkg.priceEnv}`)
        return NextResponse.json({ error: 'Pacote não configurado' }, { status: 503 })
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        locale: 'pt-BR',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        ...customerParam,
        metadata: { userId, plano, creditos: String(pkg.creditos) },
        success_url: `${APP}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${APP}/minha-colecao`,
      })
      return NextResponse.json({ url: session.url })
    }

    // ── Fluxo: Pro usuário, Separadores, Lojista ──────────────────────────────
    const priceEnvName = PLAN_PRICE_ENV[plano]
    if (!priceEnvName) {
      return NextResponse.json({ error: `Plano '${plano}' não reconhecido` }, { status: 400 })
    }
    const priceId = process.env[priceEnvName]
    if (!priceId) {
      console.error(`[stripe/checkout] env vazia: ${priceEnvName}`)
      return NextResponse.json({ error: 'Plano não configurado no servidor' }, { status: 503 })
    }

    const isSeparadores = plano === 'separadores'
    const mode: 'payment' | 'subscription' = isSeparadores ? 'payment' : 'subscription'

    // Cancel URL contextual: melhor UX se cliente desistir
    const cancelUrl = isLojistaPlano(plano) && lojaId
      ? `${APP}/minha-loja/${lojaId}/plano`
      : isSeparadores
        ? `${APP}/separadores`
        : `${APP}/minha-conta`

    // Metadata: SEMPRE inclui userId. Se for Lojista, inclui lojaId.
    const metadata: Record<string, string> = { userId, plano }
    if (lojaId) metadata.lojaId = lojaId

    // Trial de 14 dias APENAS para Lojista
    const subscriptionData = isLojistaPlano(plano)
      ? { subscription_data: { trial_period_days: 14 as const } }
      : {}

    const session = await stripe.checkout.sessions.create({
      mode,
      locale: 'pt-BR',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      ...customerParam,
      metadata,
      ...subscriptionData,
      success_url: `${APP}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  cancelUrl,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('[stripe/checkout] CRITICAL:', err.message, err.stack)
    return NextResponse.json({ error: 'Erro ao criar sessão de checkout' }, { status: 500 })
  }
}
