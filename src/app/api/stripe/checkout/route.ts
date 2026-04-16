import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-03-31.basil',
    })

    const { plano, userId, userEmail } = await req.json()

    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    const priceId = plano === 'anual'
      ? process.env.STRIPE_PRICE_ANUAL
      : process.env.STRIPE_PRICE_MENSAL

    if (!priceId) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      locale: 'pt-BR',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: userEmail,
      metadata: { userId },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/minha-conta?upgrade=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/minha-conta`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('[stripe/checkout]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}