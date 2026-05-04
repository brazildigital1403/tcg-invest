// src/app/api/stripe/checkout/route.ts
//
// S29 Security Fix #5 — userId/userEmail vêm do JWT, não do body.
//
// Antes: aceitava `userId` e `userEmail` no body sem validar JWT → atacante
// criava checkout em nome de qualquer userId, com qualquer email. Mitigado
// parcialmente pelo webhook usar metadata, mas:
//   - Permitia phishing ("ganhei Pro pra você, clica aqui")
//   - Desalinhamento entre Stripe customer (email do atacante) e DB (userId
//     da vítima)
//   - Now que está LIVE, transações fantasmas são possíveis
//
// Agora: exige Bearer token. userId = user.id do JWT. userEmail = user.email
// do JWT. Body só carrega `plano` e `lojaId` (opcional).

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

    // ── Auth: extrai user do JWT ──────────────────────────────────────────
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    const userId    = user.id
    const userEmail = user.email

    // ── Body: apenas plano + lojaId ───────────────────────────────────────
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' })
    const body = await req.json().catch(() => ({}))
    const { plano, lojaId } = body as { plano?: string; lojaId?: string }

    if (!plano || typeof plano !== 'string') {
      return NextResponse.json({ error: 'Plano não informado' }, { status: 400 })
    }
    if (isLojistaPlano(plano) && !lojaId) {
      return NextResponse.json({ error: 'lojaId obrigatório para plano de loja' }, { status: 400 })
    }

    // ── Cliente Supabase (service role) ───────────────────────────────────────
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // ── Reuso de stripe_customer_id ───────────────────────────────────────────
    let existingCustomerId: string | null = null
    let lojaTrialUsadoEm: string | null = null
    let lojaJaTemSub: boolean = false

    if (isLojistaPlano(plano) && lojaId) {
      // Validação adicional: owner check + estado da subscription
      const { data: lojaRow } = await supabase
        .from('lojas')
        .select('stripe_customer_id, stripe_subscription_id, trial_usado_em, owner_user_id')
        .eq('id', lojaId)
        .limit(1)

      const loja = lojaRow?.[0]
      if (!loja) {
        return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
      }
      if (loja.owner_user_id !== userId) {
        return NextResponse.json({ error: 'Você não é dono desta loja' }, { status: 403 })
      }

      existingCustomerId = loja.stripe_customer_id || null
      lojaTrialUsadoEm   = loja.trial_usado_em || null
      lojaJaTemSub       = !!loja.stripe_subscription_id

      // Se já tem subscription ativa → portal, não checkout
      if (lojaJaTemSub) {
        return NextResponse.json({
          error: 'Loja já tem assinatura ativa. Use o portal de gerenciamento pra trocar de plano.',
          code: 'ALREADY_SUBSCRIBED',
        }, { status: 400 })
      }
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
        // Fix Bug #7: força criação do customer mesmo em mode='payment'
        ...(existingCustomerId ? {} : { customer_creation: 'always' as const }),
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

    // Cancel URL contextual
    const cancelUrl = isLojistaPlano(plano) && lojaId
      ? `${APP}/minha-loja/${lojaId}/plano?cancelado=1`
      : isSeparadores
        ? `${APP}/separadores`
        : `${APP}/minha-conta`

    const metadata: Record<string, string> = { userId, plano }
    if (lojaId) metadata.lojaId = lojaId

    // Trial 14 dias APENAS para Lojista E SE não consumiu trial antes
    const concedeTrial = isLojistaPlano(plano) && !lojaTrialUsadoEm
    const subscriptionData = concedeTrial
      ? { subscription_data: { trial_period_days: 14 as const } }
      : {}

    // customer_creation só aplica em mode='payment'
    const customerCreationParam = (mode === 'payment' && !existingCustomerId)
      ? { customer_creation: 'always' as const }
      : {}

    const session = await stripe.checkout.sessions.create({
      mode,
      locale: 'pt-BR',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      ...customerParam,
      ...customerCreationParam,
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
