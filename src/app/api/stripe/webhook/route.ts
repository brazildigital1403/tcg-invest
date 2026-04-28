import { NextRequest, NextResponse } from 'next/server'
import { sendPurchaseConfirmationEmail } from '@/lib/email'
import Stripe from 'stripe'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ─── Mapeamento: planoMeta → descrição amigável ─────────────────────────────

const DESCRICAO_PLANO: Record<string, string> = {
  'pro_mensal':    'Bynx Pro — assinatura mensal',
  'pro_anual':     'Bynx Pro — assinatura anual',
  'separadores':   'Separadores Customizados',
  'scan_starter':  'Pacote de Scan — Starter',
  'scan_popular':  'Pacote de Scan — Popular',
  'scan_pro':      'Pacote de Scan — Pro',
  'scan_premium':  'Pacote de Scan — Premium',
}

// ─── Helper: lê current_period_end da forma COMPATÍVEL com a API Stripe ────
//
// A partir da API 2025-03-31.basil, current_period_end e current_period_start
// foram REMOVIDOS do nível da subscription e movidos pra subscription.items.data[i].
// Esse helper tenta ambos os caminhos pra ser compatível com qualquer versão
// da API que o webhook esteja usando (configurada no Stripe Dashboard).
//
// Ref: https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): number | null {
  // Caminho novo (>= 2025-03-31.basil): item-level
  const itemEnd = subscription.items?.data?.[0]?.current_period_end as number | undefined
  if (typeof itemEnd === 'number' && Number.isFinite(itemEnd)) return itemEnd

  // Caminho antigo: subscription-level (caso webhook esteja em versão pré-2025-03-31)
  const subEnd = (subscription as any).current_period_end as number | undefined
  if (typeof subEnd === 'number' && Number.isFinite(subEnd)) return subEnd

  return null
}

// ─── Helper: cria lançamento de receita pra evento Stripe (idempotente) ─────

async function registrarReceitaStripe(
  supabase: SupabaseClient,
  params: {
    paymentIntentId: string | null | undefined
    valorTotalCentavos: number
    descricao: string
    dataCompetencia: string
    userId?: string | null
  }
): Promise<{ inserted: boolean; reason?: string }> {
  if (!params.paymentIntentId) {
    console.warn('[webhook/financeiro] Sem payment_intent_id — pulando lançamento')
    return { inserted: false, reason: 'no_payment_intent' }
  }

  const valorBruto = Math.round(params.valorTotalCentavos) / 100
  const valorLiq   = valorBruto

  const insert = {
    tipo: 'receita',
    valor_bruto: valorBruto,
    taxa: 0,
    valor_liquido: valorLiq,
    descricao: params.descricao,
    categoria: 'assinatura',
    data_competencia: params.dataCompetencia,
    data_liquidacao:  params.dataCompetencia,
    pago: false,
    recebido: true,
    fonte: 'stripe',
    stripe_payment_intent_id: params.paymentIntentId,
    user_id: params.userId || null,
    detalhes: null,
    observacao: null,
  }

  const { error } = await supabase.from('lancamentos').insert(insert)

  if (!error) return { inserted: true }
  if (error.code === '23505') {
    console.log(`[webhook/financeiro] PI ${params.paymentIntentId} já registrado (idempotente)`)
    return { inserted: false, reason: 'already_processed' }
  }

  console.error(`[webhook/financeiro] CRITICAL: erro ao inserir lançamento de PI ${params.paymentIntentId}:`, error.message)
  return { inserted: false, reason: error.message }
}

// ─── Helper: extrai payment_intent_id de uma session/invoice ────────────────

async function extrairPaymentIntentDeSession(
  stripe: Stripe,
  session: Stripe.CheckoutSession
): Promise<string | null> {
  if (session.payment_intent) {
    return typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent.id
  }

  if (session.invoice) {
    const invoiceId = typeof session.invoice === 'string' ? session.invoice : session.invoice.id
    if (!invoiceId) return null
    try {
      const invoice = await stripe.invoices.retrieve(invoiceId)
      if (invoice.payment_intent) {
        return typeof invoice.payment_intent === 'string'
          ? invoice.payment_intent
          : invoice.payment_intent.id
      }
    } catch (err) {
      console.error('[webhook] Erro ao buscar invoice:', err)
    }
  }

  return null
}

// ─── Handler principal ──────────────────────────────────────────────────────
//
// Estratégia de erros (lição da sessão 22):
// - try/catch INTERNO em cada operação que pode falhar mas não deve abortar
//   tudo (UPDATE no user, busca de subscription, lançamento financeiro)
// - Logs com [webhook] CRITICAL: pra erros DEPOIS do user já ter pago
// - Webhook sempre retorna 200 ao Stripe pra não causar retries em loop em
//   erros não-recuperáveis (subscription_id inválido, user inexistente, etc)
// - Erros recuperáveis (DB indisponível, etc) idealmente retornariam 5xx pra
//   Stripe re-tentar — mas isso é melhoria futura.

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

  console.log(`[webhook] Recebido: ${event.type} (${event.id})`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.CheckoutSession
        const userId = session.metadata?.userId
        const planoMeta = session.metadata?.plano
        if (!userId) {
          console.warn(`[webhook] checkout.session.completed sem userId — ignorando`)
          break
        }

        // ─── Créditos de scan — pacotes avulsos ───────────────────────
        if (planoMeta?.startsWith('scan_')) {
          const creditos = parseInt(session.metadata?.creditos || '0', 10)
          if (creditos > 0) {
            try {
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

              const { data: uDataScan } = await supabase.from('users').select('email, name').eq('id', userId).limit(1)
              if (uDataScan?.[0]?.email) {
                const scanType = (planoMeta as any) || 'scan_popular'
                await sendPurchaseConfirmationEmail(uDataScan[0].email, uDataScan[0].name || '', scanType).catch(console.error)
              }
            } catch (err: any) {
              console.error(`[webhook] CRITICAL: falha ao creditar scan para ${userId}:`, err.message)
            }

            // Lançamento financeiro (independente do sucesso do update do user)
            try {
              const piId = await extrairPaymentIntentDeSession(stripe, session)
              await registrarReceitaStripe(supabase, {
                paymentIntentId:    piId,
                valorTotalCentavos: session.amount_total || 0,
                descricao:          DESCRICAO_PLANO[planoMeta] || `Pacote de Scan — ${planoMeta}`,
                dataCompetencia:    new Date(event.created * 1000).toISOString().slice(0, 10),
                userId,
              })
            } catch (err: any) {
              console.error(`[webhook] CRITICAL: falha ao registrar receita scan:`, err.message)
            }
          }
          break
        }

        // ─── Separadores — pagamento único ───────────────────────────
        if (planoMeta === 'separadores') {
          try {
            await supabase.from('users').update({
              separadores_desbloqueado: true,
            }).eq('id', userId)
            console.log(`[webhook] Separadores desbloqueado para ${userId}`)

            const { data: uData } = await supabase.from('users').select('email, name').eq('id', userId).limit(1)
            if (uData?.[0]?.email) {
              await sendPurchaseConfirmationEmail(uData[0].email, uData[0].name || '', 'separadores').catch(console.error)
            }
          } catch (err: any) {
            console.error(`[webhook] CRITICAL: falha ao desbloquear separadores para ${userId}:`, err.message)
          }

          try {
            const piId = await extrairPaymentIntentDeSession(stripe, session)
            await registrarReceitaStripe(supabase, {
              paymentIntentId:    piId,
              valorTotalCentavos: session.amount_total || 0,
              descricao:          DESCRICAO_PLANO['separadores'],
              dataCompetencia:    new Date(event.created * 1000).toISOString().slice(0, 10),
              userId,
            })
          } catch (err: any) {
            console.error(`[webhook] CRITICAL: falha ao registrar receita separadores:`, err.message)
          }
          break
        }

        // ─── Pro — assinatura recorrente ─────────────────────────────
        if (!session.subscription) {
          console.warn(`[webhook] checkout Pro sem subscription — ignorando`)
          break
        }

        try {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          const priceId = subscription.items.data[0]?.price.id
          const plano = priceId === process.env.STRIPE_PRICE_ANUAL ? 'anual' : 'mensal'

          // Lê period_end de forma compatível (item-level ou subscription-level)
          const periodEnd = getSubscriptionPeriodEnd(subscription)
          const proExpiraEm = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

          if (!proExpiraEm) {
            console.error(`[webhook] CRITICAL: subscription ${subscription.id} sem current_period_end válido. items.data[0]:`, JSON.stringify(subscription.items?.data?.[0]))
          }

          await supabase.from('users').update({
            is_pro: true,
            plano,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            ...(proExpiraEm ? { pro_expira_em: proExpiraEm } : {}),
          }).eq('id', userId)

          console.log(`[webhook] Pro ativado para ${userId} — plano ${plano} (expira ${proExpiraEm || 'desconhecido'})`)

          const { data: uDataPro } = await supabase.from('users').select('email, name').eq('id', userId).limit(1)
          if (uDataPro?.[0]?.email) {
            await sendPurchaseConfirmationEmail(uDataPro[0].email, uDataPro[0].name || '', plano === 'anual' ? 'pro_anual' : 'pro_mensal').catch(console.error)
          }

          // Lançamento financeiro
          try {
            const piId = await extrairPaymentIntentDeSession(stripe, session)
            await registrarReceitaStripe(supabase, {
              paymentIntentId:    piId,
              valorTotalCentavos: session.amount_total || 0,
              descricao:          DESCRICAO_PLANO[plano === 'anual' ? 'pro_anual' : 'pro_mensal'],
              dataCompetencia:    new Date(event.created * 1000).toISOString().slice(0, 10),
              userId,
            })
          } catch (err: any) {
            console.error(`[webhook] CRITICAL: falha ao registrar receita Pro:`, err.message)
          }
        } catch (err: any) {
          console.error(`[webhook] CRITICAL: falha ao ativar Pro para ${userId}:`, err.message, err.stack)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break

        try {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)

          const periodEnd = getSubscriptionPeriodEnd(subscription)
          const proExpiraEm = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

          await supabase.from('users').update({
            is_pro: true,
            ...(proExpiraEm ? { pro_expira_em: proExpiraEm } : {}),
          }).eq('stripe_subscription_id', invoice.subscription)

          console.log(`[webhook] Renovação processada — subscription ${invoice.subscription} (expira ${proExpiraEm || 'desconhecido'})`)

          // Pula lançamento na 1ª cobrança (já coberta no checkout.session.completed)
          if (invoice.billing_reason === 'subscription_create') break

          const priceId  = subscription.items.data[0]?.price.id
          const planoTag = priceId === process.env.STRIPE_PRICE_ANUAL ? 'pro_anual' : 'pro_mensal'

          const { data: userData } = await supabase
            .from('users')
            .select('id')
            .eq('stripe_subscription_id', invoice.subscription as string)
            .limit(1)

          const piId = invoice.payment_intent
            ? (typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent.id)
            : null

          await registrarReceitaStripe(supabase, {
            paymentIntentId:    piId,
            valorTotalCentavos: invoice.amount_paid || invoice.amount_due || 0,
            descricao:          `${DESCRICAO_PLANO[planoTag]} (renovação)`,
            dataCompetencia:    new Date(event.created * 1000).toISOString().slice(0, 10),
            userId:             userData?.[0]?.id,
          })
        } catch (err: any) {
          console.error(`[webhook] CRITICAL: falha em invoice.payment_succeeded ${invoice.id}:`, err.message, err.stack)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        try {
          await supabase.from('users').update({
            is_pro: false,
            plano: 'free',
            stripe_subscription_id: null,
            pro_expira_em: null,
          }).eq('stripe_subscription_id', subscription.id)

          console.log(`[webhook] Pro cancelado — subscription ${subscription.id}`)
        } catch (err: any) {
          console.error(`[webhook] CRITICAL: falha ao cancelar Pro ${subscription.id}:`, err.message)
        }
        break
      }
    }
  } catch (err: any) {
    // Erros não capturados pelos try/catch internos (improvável agora,
    // mas mantido como rede de segurança final)
    console.error(`[webhook] CRITICAL UNHANDLED: ${event.type}:`, err.message, err.stack)
  }

  return NextResponse.json({ received: true })
}
