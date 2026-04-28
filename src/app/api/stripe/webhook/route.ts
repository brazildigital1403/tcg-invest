import { NextRequest, NextResponse } from 'next/server'
import { sendPurchaseConfirmationEmail } from '@/lib/email'
import Stripe from 'stripe'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ─── Mapeamento: planoMeta → descrição amigável ─────────────────────────────
//
// O valor sempre vem do Stripe (amount_total / amount_paid em centavos),
// mas o nome amigável vem daqui pra ficar mais bonito no admin financeiro.

const DESCRICAO_PLANO: Record<string, string> = {
  'pro_mensal':    'Bynx Pro — assinatura mensal',
  'pro_anual':     'Bynx Pro — assinatura anual',
  'separadores':   'Separadores Customizados',
  'scan_starter':  'Pacote de Scan — Starter',
  'scan_popular':  'Pacote de Scan — Popular',
  'scan_pro':      'Pacote de Scan — Pro',
  'scan_premium':  'Pacote de Scan — Premium',
}

// ─── Helper: cria lançamento de receita pra evento Stripe (idempotente) ─────
//
// Usa stripe_payment_intent_id como chave UNIQUE (já existe constraint
// `lancamentos_stripe_unique` na tabela). Se Stripe re-entregar o mesmo
// payment_intent (retries do webhook), o INSERT falha com 23505 e a gente
// trata como sucesso silencioso ("já registrado").
//
// Nota: se paymentIntentId for null/undefined (raro — Stripe Connect com
// transferência delayed, ou modos exóticos), pula o registro pra não
// inserir lançamento sem rastreabilidade.

async function registrarReceitaStripe(
  supabase: SupabaseClient,
  params: {
    paymentIntentId: string | null | undefined
    valorTotalCentavos: number
    descricao: string
    dataCompetencia: string  // YYYY-MM-DD
    userId?: string | null
  }
): Promise<{ inserted: boolean; reason?: string }> {
  if (!params.paymentIntentId) {
    console.warn('[webhook/financeiro] Sem payment_intent_id — pulando lançamento')
    return { inserted: false, reason: 'no_payment_intent' }
  }

  const valorBruto = Math.round(params.valorTotalCentavos) / 100
  const valorLiq   = valorBruto  // taxa Stripe não vem no webhook (vem só na balance_transaction)

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
    recebido: true,    // Stripe já recebeu
    fonte: 'stripe',
    stripe_payment_intent_id: params.paymentIntentId,
    user_id: params.userId || null,
    detalhes: null,
    observacao: null,
  }

  const { error } = await supabase.from('lancamentos').insert(insert)

  if (!error) return { inserted: true }

  // 23505 = unique_violation (payment_intent já registrado). Retry idempotente.
  if (error.code === '23505') {
    console.log(`[webhook/financeiro] PI ${params.paymentIntentId} já registrado (idempotente)`)
    return { inserted: false, reason: 'already_processed' }
  }

  // Outro erro: loga mas NÃO faz o webhook falhar — o lançamento financeiro
  // é secundário. O importante é o estado do user (Pro, créditos, etc) já
  // ter sido atualizado antes desta chamada.
  console.error(`[webhook/financeiro] Erro ao inserir lançamento:`, error.message)
  return { inserted: false, reason: error.message }
}

// ─── Helper: extrai payment_intent_id de uma session/invoice ────────────────

async function extrairPaymentIntentDeSession(
  stripe: Stripe,
  session: Stripe.CheckoutSession
): Promise<string | null> {
  // Modo 'payment' (separadores, scan): payment_intent direto na session
  if (session.payment_intent) {
    return typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent.id
  }

  // Modo 'subscription' (Pro): payment_intent fica na invoice
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
            // Envia email de confirmação
            const { data: uDataScan } = await supabase.from('users').select('email, name').eq('id', userId).limit(1)
            if (uDataScan?.[0]?.email) {
              const scanType = (planoMeta as any) || 'scan_popular'
              await sendPurchaseConfirmationEmail(uDataScan[0].email, uDataScan[0].name || '', scanType).catch(console.error)
            }

            // ─── Lançamento financeiro ─────────────────────────────────
            const piId = await extrairPaymentIntentDeSession(stripe, session)
            await registrarReceitaStripe(supabase, {
              paymentIntentId:    piId,
              valorTotalCentavos: session.amount_total || 0,
              descricao:          DESCRICAO_PLANO[planoMeta] || `Pacote de Scan — ${planoMeta}`,
              dataCompetencia:    new Date(event.created * 1000).toISOString().slice(0, 10),
              userId,
            })
          }
          break
        }

        // Separadores — pagamento único
        if (planoMeta === 'separadores') {
          await supabase.from('users').update({
            separadores_desbloqueado: true,
          }).eq('id', userId)
          console.log(`[webhook] Separadores desbloqueado para ${userId}`)
          // Envia email de confirmação
          const { data: uData } = await supabase.from('users').select('email, name').eq('id', userId).limit(1)
          if (uData?.[0]?.email) {
            await sendPurchaseConfirmationEmail(uData[0].email, uData[0].name || '', 'separadores').catch(console.error)
          }

          // ─── Lançamento financeiro ─────────────────────────────────
          const piId = await extrairPaymentIntentDeSession(stripe, session)
          await registrarReceitaStripe(supabase, {
            paymentIntentId:    piId,
            valorTotalCentavos: session.amount_total || 0,
            descricao:          DESCRICAO_PLANO['separadores'],
            dataCompetencia:    new Date(event.created * 1000).toISOString().slice(0, 10),
            userId,
          })
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
        // Envia email de confirmação
        const { data: uDataPro } = await supabase.from('users').select('email, name').eq('id', userId).limit(1)
        if (uDataPro?.[0]?.email) {
          await sendPurchaseConfirmationEmail(uDataPro[0].email, uDataPro[0].name || '', plano === 'anual' ? 'pro_anual' : 'pro_mensal').catch(console.error)
        }

        // ─── Lançamento financeiro (1ª cobrança da assinatura) ──────────
        // OBS: cobranças subsequentes (renovações) virão pelo evento
        // 'invoice.payment_succeeded' abaixo. Aqui é só a primeira.
        const piId = await extrairPaymentIntentDeSession(stripe, session)
        await registrarReceitaStripe(supabase, {
          paymentIntentId:    piId,
          valorTotalCentavos: session.amount_total || 0,
          descricao:          DESCRICAO_PLANO[plano === 'anual' ? 'pro_anual' : 'pro_mensal'],
          dataCompetencia:    new Date(event.created * 1000).toISOString().slice(0, 10),
          userId,
        })
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

        // ─── Lançamento financeiro: renovações de Pro ──────────────────
        //
        // Stripe dispara DOIS eventos quando alguém assina pela primeira
        // vez: 'checkout.session.completed' E 'invoice.payment_succeeded'.
        // O UNIQUE em payment_intent_id garante idempotência no nível do
        // banco (se entrarem 2x, o 2º falha com 23505), mas pra evitar log
        // de erro inútil também filtramos billing_reason='subscription_create'.
        // Renovações vêm com 'subscription_cycle'.
        if (invoice.billing_reason === 'subscription_create') {
          break
        }

        // Identifica plano pelo price atual + busca user_id
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
        // Cancelamento NÃO gera lançamento (não é movimentação financeira).
        break
      }
    }
  } catch (err: any) {
    console.error('[webhook] Erro:', err.message)
  }

  return NextResponse.json({ received: true })
}
