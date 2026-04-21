import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/minha-conta`)

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-03-31.basil' })
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.payment_status !== 'paid') {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/minha-conta`)
    }

    const userId = session.metadata?.userId
    if (!userId) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/minha-conta`)

    const plano = session.metadata?.plano

    // Separadores — pagamento único
    if (plano === 'separadores') {
      await supabase.from('users').update({
        separadores_desbloqueado: true,
      }).eq('id', userId)
      console.log(`[stripe/success] Separadores desbloqueado para ${userId}`)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/separadores?desbloqueado=1`)
    }

    // Pro — assinatura recorrente
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
    const priceId = subscription.items.data[0]?.price.id
    const planoFinal = priceId === process.env.STRIPE_PRICE_ANUAL ? 'anual' : 'mensal'

    await supabase.from('users').update({
      is_pro: true,
      plano: planoFinal,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      pro_expira_em: new Date(subscription.current_period_end * 1000).toISOString(),
    }).eq('id', userId)

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/minha-conta?upgrade=success`)
  } catch (err: any) {
    console.error('[stripe/success]', err.message)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/minha-conta`)
  }
}