// src/app/api/stripe/webhook/route.ts
//
// R7-PAY Commit 2 — 30/abril/2026 (v2.1)
//
// Mudança vs v2 (Commit 1):
// - Marca lojas.trial_usado_em quando subscription.status === 'trialing' no
//   checkout.session.completed. Impede que cliente cancele e re-crie trial
//   indefinidamente. Validação no /api/stripe/checkout antes de criar a session.
//
// Mudanças vs v1:
// 1. Idempotência por event.id (tabela stripe_events_processed)
//    Protege provisionamento (créditos, separadores, Pro, Lojista) contra
//    reprocessamento. v1 tinha idempotência só pra `lancamentos` (financeiro).
// 2. Suporte a Lojista
//    Lê lojaId do metadata, atualiza `lojas.plano` em vez de `users.is_pro`.
//    Mapeia 'lojista_pro_*' → 'pro' e 'lojista_premium_*' → 'premium' (ignora
//    periodicidade, como discutido — front lê plano direto da tabela).
// 3. DESCRICAO_PLANO sincronizado com SCAN_PACKAGES do checkout
//    Antes os mapas estavam desalinhados → email de scan vinha com texto técnico.
// 4. Novos handlers:
//    - customer.subscription.updated  → upgrade/downgrade entre planos
//    - invoice.payment_failed         → cobrança falhou (log crítico)
//    - charge.dispute.created         → chargeback (log crítico)
// 5. Renovação detecta se sub é de user ou de loja (busca em ambas as tabelas).

import { NextRequest, NextResponse } from 'next/server'
import { sendPurchaseConfirmationEmail, sendEmailLojaPlanoAlterado } from '@/lib/email'
import Stripe from 'stripe'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ─── Mapas de descrição (sincronizados com checkout/SCAN_PACKAGES) ──────────

const DESCRICAO_PLANO: Record<string, string> = {
  'pro_mensal':              'Bynx Pro — assinatura mensal',
  'pro_anual':               'Bynx Pro — assinatura anual',
  'separadores':             'Separadores Customizados',
  // Sincronizado com checkout/SCAN_PACKAGES (era 'scan_starter/pro/premium' no v1)
  'scan_basico':             'Pacote de Scan — Básico (5 créditos)',
  'scan_popular':            'Pacote de Scan — Popular (15 créditos)',
  'scan_colecionador':       'Pacote de Scan — Colecionador (40 créditos)',
  // Lojista
  'lojista_pro_mensal':      'Bynx Lojista Pro — assinatura mensal',
  'lojista_pro_anual':       'Bynx Lojista Pro — assinatura anual',
  'lojista_premium_mensal':  'Bynx Lojista Premium — assinatura mensal',
  'lojista_premium_anual':   'Bynx Lojista Premium — assinatura anual',
}

// Mapeia plano de checkout → tier base (ignora periodicidade)
function getLojistaTier(plano: string): 'pro' | 'premium' | null {
  if (plano.startsWith('lojista_pro_'))     return 'pro'
  if (plano.startsWith('lojista_premium_')) return 'premium'
  return null
}

// Identifica price ID de Lojista pra usar em renovação/upgrade
function getLojistaTierFromPriceId(priceId: string): 'pro' | 'premium' | null {
  if (priceId === process.env.STRIPE_PRICE_LOJISTA_PRO_MENSAL)     return 'pro'
  if (priceId === process.env.STRIPE_PRICE_LOJISTA_PRO_ANUAL)      return 'pro'
  if (priceId === process.env.STRIPE_PRICE_LOJISTA_PREMIUM_MENSAL) return 'premium'
  if (priceId === process.env.STRIPE_PRICE_LOJISTA_PREMIUM_ANUAL)  return 'premium'
  return null
}

// ─── Helpers Stripe API 2025-03-31.basil ─────────────────────────────────────

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): number | null {
  const itemEnd = subscription.items?.data?.[0]?.current_period_end as number | undefined
  if (typeof itemEnd === 'number' && Number.isFinite(itemEnd)) return itemEnd

  const subEnd = (subscription as any).current_period_end as number | undefined
  if (typeof subEnd === 'number' && Number.isFinite(subEnd)) return subEnd

  return null
}

async function extrairPaymentIntentDeInvoice(
  stripe: Stripe,
  invoice: Stripe.Invoice
): Promise<string | null> {
  const paymentsArr = (invoice as any).payments?.data
  if (Array.isArray(paymentsArr) && paymentsArr.length > 0) {
    const first = paymentsArr[0]
    const pi = first?.payment?.payment_intent
    if (pi) return typeof pi === 'string' ? pi : pi.id
  }

  try {
    const list = await (stripe as any).invoicePayments?.list?.({ invoice: invoice.id, limit: 1 })
    const first = list?.data?.[0]
    const pi = first?.payment?.payment_intent
    if (pi) return typeof pi === 'string' ? pi : pi.id
  } catch (err: any) {
    console.log(`[webhook/debug] invoicePayments.list falhou:`, err?.message)
  }

  const oldPI = (invoice as any).payment_intent
  if (oldPI) return typeof oldPI === 'string' ? oldPI : oldPI.id

  return null
}

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
      const invoice = await stripe.invoices.retrieve(invoiceId, {
        expand: ['payments.data.payment.payment_intent'],
      } as any)
      return await extrairPaymentIntentDeInvoice(stripe, invoice)
    } catch (err: any) {
      console.error('[webhook] Erro ao buscar invoice:', err.message)
    }
  }

  return null
}

// ─── Helper: registrar receita em lancamentos (idempotente via PI unique) ───

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
    console.warn('[webhook/financeiro] sem payment_intent_id — pulando lançamento')
    return { inserted: false, reason: 'no_payment_intent' }
  }

  // R7-PAY: trial Lojista paga R$0,00 — não cria lançamento financeiro
  if (params.valorTotalCentavos <= 0) {
    console.log(`[webhook/financeiro] valor zero (trial?) — pulando lançamento`)
    return { inserted: false, reason: 'zero_amount' }
  }

  const valorBruto = Math.round(params.valorTotalCentavos) / 100

  const insert = {
    tipo: 'receita',
    valor_bruto: valorBruto,
    taxa: 0,
    valor_liquido: valorBruto,
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

  console.error(`[webhook/financeiro] CRITICAL: erro inserindo PI ${params.paymentIntentId}:`, error.message)
  return { inserted: false, reason: error.message }
}

// ─── Helper: idempotência por event.id ──────────────────────────────────────
//
// Insere a row em stripe_events_processed no INÍCIO. Se 23505 → já processou
// → retorna 'duplicate'. Se sucesso → continua, e atualizamos `result` no fim.

async function registrarEventoIdempotente(
  supabase: SupabaseClient,
  event: Stripe.Event,
  metadata?: { userId?: string; lojaId?: string }
): Promise<'first_time' | 'duplicate' | 'error'> {
  const { error } = await supabase.from('stripe_events_processed').insert({
    event_id:   event.id,
    event_type: event.type,
    livemode:   event.livemode,
    user_id:    metadata?.userId || null,
    loja_id:    metadata?.lojaId || null,
    result:     'processing',
  })

  if (!error) return 'first_time'
  if (error.code === '23505') {
    console.log(`[webhook] event ${event.id} já processado — ignorando`)
    return 'duplicate'
  }

  console.error(`[webhook] CRITICAL: erro registrando event ${event.id}:`, error.message)
  // Em caso de erro DB, processamos mesmo assim (melhor processar 2x do que perder)
  return 'error'
}

async function marcarEventoComoFinalizado(
  supabase: SupabaseClient,
  eventId: string,
  result: 'ok' | 'error',
  errorMessage?: string
): Promise<void> {
  await supabase.from('stripe_events_processed').update({
    result,
    error_message: errorMessage || null,
  }).eq('event_id', eventId)
}

// ─── Handler principal ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[webhook] CRITICAL: env vars Stripe faltando')
    return NextResponse.json({ error: 'Stripe não configurado' }, { status: 503 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
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
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    console.error('[webhook] Assinatura inválida:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log(`[webhook] Recebido: ${event.type} (${event.id})`)

  // ── Extrai metadata pra idempotência (best-effort, antes do switch) ──
  let metadataParaIdempotencia: { userId?: string; lojaId?: string } = {}
  try {
    const obj: any = event.data.object
    if (obj?.metadata?.userId) metadataParaIdempotencia.userId = obj.metadata.userId
    if (obj?.metadata?.lojaId) metadataParaIdempotencia.lojaId = obj.metadata.lojaId
  } catch {}

  // ── Idempotência: bloqueia reprocessamento ──
  const idempStatus = await registrarEventoIdempotente(supabase, event, metadataParaIdempotencia)
  if (idempStatus === 'duplicate') {
    return NextResponse.json({ received: true, idempotent: true })
  }

  let processError: string | null = null

  try {
    switch (event.type) {

      // ────────────────────────────────────────────────────────────────────
      // CHECKOUT.SESSION.COMPLETED — primeira ativação de qualquer fluxo
      // ────────────────────────────────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.CheckoutSession
        const userId = session.metadata?.userId
        const lojaId = session.metadata?.lojaId
        const planoMeta = session.metadata?.plano

        if (!userId || !planoMeta) {
          console.warn(`[webhook] checkout.session.completed sem userId/plano — ignorando`)
          break
        }

        // ─── PACOTE DE SCAN (one-time) ──────────────────────────────────
        if (planoMeta.startsWith('scan_')) {
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
                stripe_customer_id: session.customer as string || null,
              }).eq('id', userId)
              console.log(`[webhook] +${creditos} créditos scan para ${userId} (total: ${atual + creditos})`)

              const { data: uData } = await supabase.from('users').select('email, name').eq('id', userId).limit(1)
              if (uData?.[0]?.email) {
                await sendPurchaseConfirmationEmail(uData[0].email, uData[0].name || '', planoMeta).catch(console.error)
              }
            } catch (err: any) {
              console.error(`[webhook] CRITICAL: falha ao creditar scan para ${userId}:`, err.message)
            }

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
              console.error(`[webhook] CRITICAL: falha registrando receita scan:`, err.message)
            }
          }
          break
        }

        // ─── SEPARADORES (one-time) ─────────────────────────────────────
        if (planoMeta === 'separadores') {
          try {
            await supabase.from('users').update({
              separadores_desbloqueado: true,
              stripe_customer_id: session.customer as string || null,
            }).eq('id', userId)
            console.log(`[webhook] Separadores desbloqueado para ${userId}`)

            const { data: uData } = await supabase.from('users').select('email, name').eq('id', userId).limit(1)
            if (uData?.[0]?.email) {
              await sendPurchaseConfirmationEmail(uData[0].email, uData[0].name || '', 'separadores').catch(console.error)
            }
          } catch (err: any) {
            console.error(`[webhook] CRITICAL: falha desbloqueando separadores ${userId}:`, err.message)
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
            console.error(`[webhook] CRITICAL: falha registrando receita separadores:`, err.message)
          }
          break
        }

        // ─── LOJISTA (subscription com trial 14 dias) ───────────────────
        if (planoMeta.startsWith('lojista_')) {
          if (!lojaId) {
            console.warn(`[webhook] checkout lojista sem lojaId — ignorando`)
            break
          }
          if (!session.subscription) {
            console.warn(`[webhook] checkout lojista sem subscription — ignorando`)
            break
          }

          const tier = getLojistaTier(planoMeta)
          if (!tier) {
            console.warn(`[webhook] tier lojista não reconhecido: ${planoMeta}`)
            break
          }

          try {
            const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

            // Trial: usar trial_end (epoch) se presente, senão current_period_end
            const trialEnd = (subscription as any).trial_end as number | undefined
            const periodEnd = trialEnd && Number.isFinite(trialEnd)
              ? trialEnd
              : getSubscriptionPeriodEnd(subscription)
            const expiraEm = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

            // Lê plano anterior pra mandar email correto (upgrade vs ativação inicial)
            const { data: lojaAtual } = await supabase
              .from('lojas')
              .select('plano, nome, slug')
              .eq('id', lojaId)
              .limit(1)
            const planoAnterior = (lojaAtual?.[0]?.plano || 'basico') as 'basico' | 'pro' | 'premium'

            // Se a sub veio com trial ativo (subscription.status === 'trialing'),
            // marca trial_usado_em pra impedir re-uso futuro do trial nessa loja.
            const consumiuTrial = (subscription as any).status === 'trialing'

            await supabase.from('lojas').update({
              plano: tier,
              ...(expiraEm ? { plano_expira_em: expiraEm } : {}),
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              ...(consumiuTrial ? { trial_usado_em: new Date().toISOString() } : {}),
            }).eq('id', lojaId)

            console.log(`[webhook] Lojista ${tier} ativado pra loja ${lojaId} (expira ${expiraEm || '?'})`)

            // Email da loja (usa template existente sendEmailLojaPlanoAlterado)
            const { data: uData } = await supabase.from('users').select('email, name').eq('id', userId).limit(1)
            const nomeUser = uData?.[0]?.name || ''
            const emailUser = uData?.[0]?.email
            if (emailUser && lojaAtual?.[0]) {
              await sendEmailLojaPlanoAlterado({
                to: emailUser,
                nomeUser,
                nomeLoja: lojaAtual[0].nome || 'sua loja',
                slug: lojaAtual[0].slug || '',
                planoAnterior,
                planoNovo: tier,
                expiraEm,
              }).catch(console.error)
            }

            // Lançamento financeiro (durante trial, valor é 0 — helper pula)
            const piId = await extrairPaymentIntentDeSession(stripe, session)
            await registrarReceitaStripe(supabase, {
              paymentIntentId:    piId,
              valorTotalCentavos: session.amount_total || 0,
              descricao:          DESCRICAO_PLANO[planoMeta] || `Lojista — ${planoMeta}`,
              dataCompetencia:    new Date(event.created * 1000).toISOString().slice(0, 10),
              userId,
            })
          } catch (err: any) {
            console.error(`[webhook] CRITICAL: falha ativando Lojista ${tier} pra loja ${lojaId}:`, err.message, err.stack)
          }
          break
        }

        // ─── PRO USUÁRIO (subscription, sem trial) ──────────────────────
        if (!session.subscription) {
          console.warn(`[webhook] checkout Pro sem subscription — ignorando`)
          break
        }

        try {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          const priceId = subscription.items.data[0]?.price.id
          const plano = priceId === process.env.STRIPE_PRICE_ANUAL ? 'anual' : 'mensal'

          const periodEnd = getSubscriptionPeriodEnd(subscription)
          const proExpiraEm = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

          if (!proExpiraEm) {
            console.error(`[webhook] CRITICAL: sub ${subscription.id} sem current_period_end válido`)
          }

          await supabase.from('users').update({
            is_pro: true,
            plano,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            ...(proExpiraEm ? { pro_expira_em: proExpiraEm } : {}),
          }).eq('id', userId)

          console.log(`[webhook] Pro ${plano} ativado para ${userId} (expira ${proExpiraEm || '?'})`)

          const { data: uData } = await supabase.from('users').select('email, name').eq('id', userId).limit(1)
          if (uData?.[0]?.email) {
            await sendPurchaseConfirmationEmail(uData[0].email, uData[0].name || '', plano === 'anual' ? 'pro_anual' : 'pro_mensal').catch(console.error)
          }

          const piId = await extrairPaymentIntentDeSession(stripe, session)
          await registrarReceitaStripe(supabase, {
            paymentIntentId:    piId,
            valorTotalCentavos: session.amount_total || 0,
            descricao:          DESCRICAO_PLANO[plano === 'anual' ? 'pro_anual' : 'pro_mensal'],
            dataCompetencia:    new Date(event.created * 1000).toISOString().slice(0, 10),
            userId,
          })
        } catch (err: any) {
          console.error(`[webhook] CRITICAL: falha ativando Pro para ${userId}:`, err.message, err.stack)
        }
        break
      }

      // ────────────────────────────────────────────────────────────────────
      // INVOICE.PAYMENT_SUCCEEDED — renovação (Pro user OU Lojista)
      // ────────────────────────────────────────────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break

        try {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
          const priceId = subscription.items.data[0]?.price.id || ''
          const periodEnd = getSubscriptionPeriodEnd(subscription)
          const novaExpiraEm = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

          // Identifica se é Pro user ou Lojista — busca em ambas as tabelas
          const lojistaTier = getLojistaTierFromPriceId(priceId)

          if (lojistaTier) {
            // ─── Renovação Lojista ───
            const { data: loja } = await supabase
              .from('lojas')
              .select('id')
              .eq('stripe_subscription_id', invoice.subscription as string)
              .limit(1)

            if (loja?.[0]?.id) {
              await supabase.from('lojas').update({
                plano: lojistaTier,
                ...(novaExpiraEm ? { plano_expira_em: novaExpiraEm } : {}),
              }).eq('id', loja[0].id)
              console.log(`[webhook] Renovação Lojista ${lojistaTier} — sub ${invoice.subscription} (expira ${novaExpiraEm || '?'})`)
            } else {
              console.warn(`[webhook] Renovação Lojista — loja não encontrada pra sub ${invoice.subscription}`)
            }

            // Pula lançamento na 1ª cobrança (já cobre via checkout) e em trials
            if (invoice.billing_reason === 'subscription_create') break
            if ((invoice.amount_paid || 0) <= 0) break

            const piId = await extrairPaymentIntentDeInvoice(stripe, invoice)
            const planoTag = priceId === process.env.STRIPE_PRICE_LOJISTA_PRO_ANUAL || priceId === process.env.STRIPE_PRICE_LOJISTA_PREMIUM_ANUAL
              ? `lojista_${lojistaTier}_anual`
              : `lojista_${lojistaTier}_mensal`

            await registrarReceitaStripe(supabase, {
              paymentIntentId:    piId,
              valorTotalCentavos: invoice.amount_paid || invoice.amount_due || 0,
              descricao:          `${DESCRICAO_PLANO[planoTag] || planoTag} (renovação)`,
              dataCompetencia:    new Date(event.created * 1000).toISOString().slice(0, 10),
              userId:             null,
            })
            break
          }

          // ─── Renovação Pro usuário ───
          await supabase.from('users').update({
            is_pro: true,
            ...(novaExpiraEm ? { pro_expira_em: novaExpiraEm } : {}),
          }).eq('stripe_subscription_id', invoice.subscription)

          console.log(`[webhook] Renovação Pro user — sub ${invoice.subscription} (expira ${novaExpiraEm || '?'})`)

          if (invoice.billing_reason === 'subscription_create') break

          const planoTag = priceId === process.env.STRIPE_PRICE_ANUAL ? 'pro_anual' : 'pro_mensal'

          const { data: userData } = await supabase
            .from('users')
            .select('id')
            .eq('stripe_subscription_id', invoice.subscription as string)
            .limit(1)

          const piId = await extrairPaymentIntentDeInvoice(stripe, invoice)

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

      // ────────────────────────────────────────────────────────────────────
      // CUSTOMER.SUBSCRIPTION.UPDATED — upgrade/downgrade entre planos
      // ────────────────────────────────────────────────────────────────────
      // Dispara quando cliente troca de Pro Mensal → Anual no portal Stripe,
      // ou quando admin faz update via dashboard. Apenas atualiza plano + expiração.
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const priceId = subscription.items.data[0]?.price.id || ''
        const periodEnd = getSubscriptionPeriodEnd(subscription)
        const novaExpiraEm = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

        try {
          const lojistaTier = getLojistaTierFromPriceId(priceId)

          if (lojistaTier) {
            await supabase.from('lojas').update({
              plano: lojistaTier,
              ...(novaExpiraEm ? { plano_expira_em: novaExpiraEm } : {}),
            }).eq('stripe_subscription_id', subscription.id)
            console.log(`[webhook] Lojista atualizado pra ${lojistaTier} — sub ${subscription.id}`)
          } else if (priceId === process.env.STRIPE_PRICE_MENSAL || priceId === process.env.STRIPE_PRICE_ANUAL) {
            const novoPlano = priceId === process.env.STRIPE_PRICE_ANUAL ? 'anual' : 'mensal'
            await supabase.from('users').update({
              is_pro: true,
              plano: novoPlano,
              ...(novaExpiraEm ? { pro_expira_em: novaExpiraEm } : {}),
            }).eq('stripe_subscription_id', subscription.id)
            console.log(`[webhook] Pro user atualizado pra ${novoPlano} — sub ${subscription.id}`)
          }
        } catch (err: any) {
          console.error(`[webhook] CRITICAL: falha em subscription.updated ${subscription.id}:`, err.message)
        }
        break
      }

      // ────────────────────────────────────────────────────────────────────
      // CUSTOMER.SUBSCRIPTION.DELETED — cancelamento (no fim do ciclo)
      // ────────────────────────────────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const priceId = subscription.items.data[0]?.price.id || ''

        try {
          const lojistaTier = getLojistaTierFromPriceId(priceId)

          if (lojistaTier) {
            await supabase.from('lojas').update({
              plano: 'basico',
              plano_expira_em: null,
              stripe_subscription_id: null,
            }).eq('stripe_subscription_id', subscription.id)
            console.log(`[webhook] Lojista cancelado — sub ${subscription.id} → basico`)
          } else {
            await supabase.from('users').update({
              is_pro: false,
              plano: 'free',
              stripe_subscription_id: null,
              pro_expira_em: null,
            }).eq('stripe_subscription_id', subscription.id)
            console.log(`[webhook] Pro user cancelado — sub ${subscription.id}`)
          }
        } catch (err: any) {
          console.error(`[webhook] CRITICAL: falha cancelando sub ${subscription.id}:`, err.message)
        }
        break
      }

      // ────────────────────────────────────────────────────────────────────
      // INVOICE.PAYMENT_FAILED — cobrança recusada (cartão expirado, sem saldo)
      // ────────────────────────────────────────────────────────────────────
      // Não revoga acesso imediatamente — Stripe vai retentar 3-4x antes de
      // cancelar a sub. Apenas log crítico pra acompanhamento manual.
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.error(`[webhook] CRITICAL: payment_failed — invoice ${invoice.id} sub ${invoice.subscription} customer ${invoice.customer} amount ${invoice.amount_due}`)
        // TODO: enviar email avisando cliente pra atualizar cartão
        break
      }

      // ────────────────────────────────────────────────────────────────────
      // CHARGE.DISPUTE.CREATED — chargeback (cliente disputou no banco)
      // ────────────────────────────────────────────────────────────────────
      // Custo Stripe: USD 15 + multa. Log crítico pra ação imediata.
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        console.error(`[webhook] CRITICAL DISPUTE: charge ${dispute.charge} reason ${dispute.reason} amount ${dispute.amount} status ${dispute.status}`)
        // TODO: notificar admin via email
        break
      }
    }
  } catch (err: any) {
    processError = err.message || 'unknown'
    console.error(`[webhook] CRITICAL UNHANDLED: ${event.type}:`, err.message, err.stack)
  } finally {
    // Marca evento como processado (ok ou error)
    await marcarEventoComoFinalizado(
      supabase,
      event.id,
      processError ? 'error' : 'ok',
      processError || undefined
    ).catch(console.error)
  }

  return NextResponse.json({ received: true })
}
