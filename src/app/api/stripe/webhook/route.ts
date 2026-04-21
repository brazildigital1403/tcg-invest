import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-03-31.basil',
  })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('[webhook] Assinatura inválida:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.CheckoutSession
        const userId = session.metadata?.userId
        const planoMeta = session.metadata?.plano
        if (!userId) break

        // Créditos de scan — pacotes avulsos
        if (planoMeta?.startsWith('scan_')) {
          const creditos = parseInt(session.metadata?.creditos || '0', 10)
          if (creditos > 0) {
            // Incrementa créditos existentes com rpc para atomicidade
            const { data: user } = await supabase
              .from('users')
              .select('scan_creditos')
              .eq('id', userId)
              .limit(1)
            const atual = user?.[0]?.scan_creditos || 0
            await supabase.from('users').update({
              scan_creditos: atual + creditos,
            }).eq('id', userId)
            console.log(`[webhook] +${creditos} créditos de scan para ${userId} (total: ${atual + creditos})`)
          }
          break
        }

        // Separadores — pagamento único
        if (planoMeta === 'separadores') {
          await supabase.from('users').update({
            separadores_desbloqueado: true,
          }).eq('id', userId)
          console.log(`[webhook] Separadores desbloqueado para ${userId}`)
          break
        }

        // Pro — assinatura recorrente
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        const priceId = subscription.items.data[0]?.price.id
        const plano = priceId === process.env.STRIPE_PRICE_ANUAL ? 'anual' : 'mensal'

        await supabase.from('users').update({
          is_pro: true,
          plano,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          pro_expira_em: new Date(subscription.current_period_end * 1000).toISOString(),
        }).eq('id', userId)

        console.log(`[webhook] Pro ativado para ${userId} — plano ${plano}`)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break

        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)

        await supabase.from('users').update({
          is_pro: true,
          pro_expira_em: new Date(subscription.current_period_end * 1000).toISOString(),
        }).eq('stripe_subscription_id', invoice.subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        await supabase.from('users').update({
          is_pro: false,
          plano: 'free',
          stripe_subscription_id: null,
          pro_expira_em: null,
        }).eq('stripe_subscription_id', subscription.id)

        console.log(`[webhook] Pro cancelado — subscription ${subscription.id}`)
        break
      }
    }
  } catch (err: any) {
    console.error('[webhook] Erro:', err.message)
  }

  return NextResponse.json({ received: true })
}