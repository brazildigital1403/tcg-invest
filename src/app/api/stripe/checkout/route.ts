import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const SCAN_PACKAGES: Record<string, { priceEnv: string; creditos: number }> = {
  scan_basico:       { priceEnv: 'STRIPE_PRICE_SCAN_BASICO',      creditos: 5  },
  scan_popular:      { priceEnv: 'STRIPE_PRICE_SCAN_POPULAR',     creditos: 15 },
  scan_colecionador: { priceEnv: 'STRIPE_PRICE_SCAN_COLECIONADOR',creditos: 40 },
}

export async function POST(req: NextRequest) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-03-31.basil' })
    const { plano, userId, userEmail } = await req.json()

    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    // ── Créditos de scan ─────────────────────────────────────────────────────
    if (plano in SCAN_PACKAGES) {
      const pkg = SCAN_PACKAGES[plano]
      const priceId = process.env[pkg.priceEnv]
      if (!priceId) return NextResponse.json({ error: 'Produto não configurado' }, { status: 400 })

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        locale: 'pt-BR',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: userEmail,
        metadata: { userId, plano, creditos: String(pkg.creditos) },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/minha-colecao`,
      })
      return NextResponse.json({ url: session.url })
    }

    // ── Separadores / Pro ────────────────────────────────────────────────────
    const isSeparadores = plano === 'separadores'
    const priceId = plano === 'anual'
      ? process.env.STRIPE_PRICE_ANUAL
      : plano === 'separadores'
      ? process.env.STRIPE_PRICE_SEPARADORES
      : process.env.STRIPE_PRICE_MENSAL

    if (!priceId) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })

    const session = await stripe.checkout.sessions.create({
      mode: isSeparadores ? 'payment' : 'subscription',
      locale: 'pt-BR',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: userEmail,
      metadata: { userId, plano },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: isSeparadores
        ? `${process.env.NEXT_PUBLIC_APP_URL}/separadores`
        : `${process.env.NEXT_PUBLIC_APP_URL}/minha-conta`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('[stripe/checkout]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}