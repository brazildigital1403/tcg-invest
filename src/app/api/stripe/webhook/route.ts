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
import { sendPurchaseConfirmationEmail, sendEmailLojaPlanoAlterado, sendReferralEngagedEmail, sendPaymentFailedEmail, sendDisputeAdminEmail, sendMasterSetUnlockedEmail, sendConnectAtivoEmail, sendConnectPendenciaEmail, sendVendaLojistaEmail, sendPedidoCompradorEmail } from '@/lib/email'
import Stripe from 'stripe'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { classificarConta } from '@/lib/connect-status'

// ─── Mapas de descrição (sincronizados com checkout/SCAN_PACKAGES) ──────────

const DESCRICAO_PLANO: Record<string, string> = {
  'plus':                    'Bynx Plus — assinatura mensal',
  'pro_mensal':              'Bynx Pro — assinatura mensal',
  'pro_anual':               'Bynx Pro — assinatura anual',
  'separadores':             'Separadores Customizados',
  // Sincronizado com checkout/SCAN_PACKAGES (era 'scan_starter/pro/premium' no v1)
  'scan_basico':             'Pacote de Scan — Básico (20 créditos)',
  'scan_popular':            'Pacote de Scan — Popular (60 créditos)',
  'scan_colecionador':       'Pacote de Scan — Colecionador (150 créditos)',
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

/**
 * Taxa cobrada pela Stripe nessa cobranca, em centavos, ou null se nao der
 * pra saber. A fonte e a `balance_transaction` da charge — e a unica que tem
 * o numero exato (varia por bandeira, meio de pagamento e parcelamento).
 *
 * Nunca lanca: o chamador usa isto pra ENRIQUECER o lancamento, e uma falha
 * aqui nao pode impedir que a venda seja registrada.
 */
async function buscarTaxaStripeCentavos(
  stripe: Stripe,
  paymentIntentId: string
): Promise<number | null> {
  try {
    // A balance_transaction pode ainda NAO existir logo apos o checkout (a
    // 1a venda de Pagina Lendaria em 16/08 chegou ~1s depois e a taxa veio
    // null SEM log — lancamento nasceu com taxa 0). Retry curto + warn no
    // caminho que antes era silencioso.
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      if (tentativa > 0) await new Promise(r => setTimeout(r, 1500 * tentativa))
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge.balance_transaction'],
      })
      const charge = pi.latest_charge as Stripe.Charge | null
      const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null
      if (typeof bt?.fee === 'number') return bt.fee
    }
    console.warn(
      `[webhook/financeiro] balance_transaction sem fee apos 3 tentativas no PI ${paymentIntentId} — lancamento vai nascer com taxa 0, corrigir a mao`
    )
    return null
  } catch (err: any) {
    console.warn(
      `[webhook/financeiro] nao consegui ler a taxa do PI ${paymentIntentId}: ${err.message}`
    )
    return null
  }
}

async function registrarReceitaStripe(
  supabase: SupabaseClient,
  params: {
    paymentIntentId: string | null | undefined
    valorTotalCentavos: number
    descricao: string
    dataCompetencia: string
    userId?: string | null
    /**
     * Default 'assinatura' pra nao mexer nas chamadas que ja existiam.
     * Venda do marketplace usa 'comissao': la o que entra pra Bynx e a taxa,
     * nao o valor do item (o resto vai pra loja via transfer_data).
     * Master Set usa 'master_set': e compra AVULSA vitalicia, nao recorrente
     * — deixar como 'assinatura' inflava o MRR (27/07/2026: R$ 19,98 dos
     * R$ 55,78 de "assinatura" eram venda avulsa, 36%).
     */
    categoria?: 'assinatura' | 'comissao' | 'master_set'
    /**
     * Cliente Stripe, pra ler a TAXA REAL da transacao. Sem ele o lancamento
     * nasce com taxa 0 e liquido = bruto, que e o que acontecia ate hoje nos
     * 11 lancamentos existentes: o painel mostrava liquido igual ao bruto e
     * superestimava o que de fato entrou (nesta venda, R$ 0,79 em R$ 9,99).
     */
    stripe?: Stripe
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

  // ─── Taxa REAL da Stripe (27/07/2026) ───────────────────────────────────
  // Antes era `taxa: 0` cravado, entao valor_liquido sempre igual ao bruto e
  // o painel superestimava a entrada. A taxa vem da balance_transaction da
  // cobranca — a unica fonte que sabe o valor exato (varia por meio de
  // pagamento, parcelamento e bandeira; nao da pra calcular por formula).
  //
  // Se a leitura falhar, cai no comportamento antigo (taxa 0) em vez de
  // derrubar o lancamento: dinheiro registrado com taxa faltando e ruim, mas
  // venda sem registro nenhum e pior.
  let taxa = 0
  if (params.stripe) {
    const taxaCentavos = await buscarTaxaStripeCentavos(params.stripe, params.paymentIntentId)
    if (taxaCentavos != null) taxa = Math.round(taxaCentavos) / 100
  }

  // Em destination charge (comissao), o valorBruto e a application_fee e a
  // taxa da Stripe sai do bolso da plataforma — entao liquido = fee - taxa,
  // que pode dar NEGATIVO numa venda pequena. O CHECK do banco exige
  // valor_liquido >= 0, e um insert rejeitado viraria venda sem lancamento.
  // Trava no zero e registra, porque prejuizo silencioso e pior que zero.
  let valorLiquido = valorBruto - taxa
  if (valorLiquido < 0) {
    console.warn(
      `[webhook/financeiro] taxa (R$ ${taxa.toFixed(2)}) maior que o bruto ` +
      `(R$ ${valorBruto.toFixed(2)}) no PI ${params.paymentIntentId} — liquido travado em 0. ` +
      `Vale conferir se essa venda realmente da prejuizo.`
    )
    valorLiquido = 0
  }

  const insert = {
    tipo: 'receita',
    valor_bruto: valorBruto,
    taxa,
    valor_liquido: valorLiquido,
    descricao: params.descricao,
    categoria: params.categoria || 'assinatura',
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

  // ── Assinatura: aceita DOIS segredos ────────────────────────────────────
  // A Stripe nao deixa um endpoint escutar "sua conta" E "contas conectadas" ao
  // mesmo tempo (o campo "Eventos de" e definido na criacao e vira read-only).
  // Entao a mesma URL recebe de dois destinos, cada um com seu whsec_:
  //   STRIPE_WEBHOOK_SECRET          -> eventos da propria conta (assinaturas)
  //   STRIPE_WEBHOOK_SECRET_CONNECT  -> eventos das contas conectadas (lojas)
  // Tentamos os dois: o que validar, vale. Sem o segundo, account.updated cairia
  // como "Assinatura invalida".
  const segredos = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_CONNECT,
  ].filter((x): x is string => !!x)

  let event: Stripe.Event | null = null
  let ultimoErro = ''
  for (const segredo of segredos) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, segredo)
      break
    } catch (err: any) {
      ultimoErro = err?.message || 'erro'
    }
  }
  if (!event) {
    console.error(`[webhook] Assinatura inválida (${segredos.length} segredo(s) tentado(s)):`, ultimoErro)
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

        // ─── VENDA ON-SITE (marketplace + Connect) ──────────────────────
        // Identificada pelo metadata que a rota de checkout gravou. Precisa vir
        // ANTES do check de userId/plano (que e das assinaturas) — senao a venda
        // cairia no "ignorando".
        const pedidoId = session.metadata?.bynx_pedido_id
        if (pedidoId) {
          const { data: peds } = await supabase
            .from('pedidos')
            .select('id, numero, status, loja_id, vendedor_user_id, comprador_user_id, marketplace_id, produto_id, item_nome, total_comprador_cents, liquido_loja_cents, repasse_prazo')
            .eq('id', pedidoId)
            .limit(1)

          const pedido = peds?.[0]
          if (!pedido) {
            console.error(`[webhook] venda: pedido ${pedidoId} nao encontrado`)
            break
          }
          // Idempotencia: a Stripe re-entrega evento. Nao marcar vendido 2x.
          if (pedido.status !== 'aguardando_pagamento') {
            console.log(`[webhook] venda: pedido ${pedido.numero} ja estava ${pedido.status} — ignorando`)
            break
          }

          const cd = session.customer_details
          const end = cd?.address
          const enderecoStr = end
            ? [end.line1, end.line2, end.city, end.state, end.postal_code].filter(Boolean).join(', ')
            : 'não informado'

          const { error: upPedErr } = await supabase
            .from('pedidos')
            .update({
              status: 'pago',
              pago_em: new Date().toISOString(),
              stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
              endereco: {
                nome: cd?.name || null,
                email: cd?.email || null,
                telefone: cd?.phone || null,
                linha1: end?.line1 || null,
                linha2: end?.line2 || null,
                cidade: end?.city || null,
                estado: end?.state || null,
                cep: end?.postal_code || null,
                pais: end?.country || null,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', pedido.id)

          if (upPedErr) {
            console.error(`[webhook] venda: falha atualizando pedido ${pedido.numero}:`, upPedErr.message)
            break
          }

          // ── Receita da Bynx ──────────────────────────────────────────────
          // Este ramo era o UNICO dos seis do checkout.session.completed que
          // nao registrava receita — a comissao do marketplace nunca chegava
          // no /admin/financeiro. Assinatura e produto proprio apareciam;
          // venda, nao.
          //
          // O que entra pra Bynx e a TAXA, nao o valor do item: o resto vai
          // pra loja via transfer_data.destination.
          //
          //   taxaBynx = comissao do vendedor + acrescimo do comprador
          //            = total_comprador - liquido_loja
          //
          // Os dois campos ja estao gravados no pedido, calculados no checkout
          // por calcularCheckout(). NAO refazemos a conta aqui de proposito —
          // a economia da comissao e travada, e duplicar a formula em dois
          // lugares e como as duas versoes divergem.
          //
          // O frete entra nos dois campos e some na subtracao, entao nao
          // contamina a receita.
          const taxaBynxCents =
            (pedido.total_comprador_cents || 0) - (pedido.liquido_loja_cents || 0)

          if (taxaBynxCents > 0) {
            const piVenda = typeof session.payment_intent === 'string' ? session.payment_intent : null
            await registrarReceitaStripe(supabase, {
              stripe,
              paymentIntentId: piVenda,
              valorTotalCentavos: taxaBynxCents,
              descricao: `Comissao venda #${pedido.numero} — ${pedido.item_nome}`,
              dataCompetencia: new Date().toISOString().slice(0, 10),
              userId: pedido.comprador_user_id,
              categoria: 'comissao',
            })
          } else {
            console.warn(`[webhook] venda: taxa <= 0 no pedido ${pedido.numero} — sem lancamento`)
          }

          // ── Baixa do item ────────────────────────────────────────────────
          // Carta: 1 unidade -> o anuncio sai do ar.
          // Produto: N unidades -> DECREMENTA. So some da vitrine quando zera
          // (a policy da vitrine filtra estoque > 0), e volta se o lojista
          // repuser — sem mexer no campo `ativo`.
          if (pedido.marketplace_id) {
            await supabase
              .from('marketplace')
              .update({ status: 'vendido', buyer_id: pedido.comprador_user_id })
              .eq('id', pedido.marketplace_id)
          } else if (pedido.produto_id) {
            const { data: prodAtual } = await supabase
              .from('loja_produtos')
              .select('estoque, vendidos, nome')
              .eq('id', pedido.produto_id)
              .single()

            if (prodAtual) {
              const novoEstoque = Math.max(0, (prodAtual.estoque || 0) - 1)
              await supabase
                .from('loja_produtos')
                .update({
                  estoque: novoEstoque,
                  vendidos: (prodAtual.vendidos || 0) + 1,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', pedido.produto_id)

              console.log(`[webhook] venda: estoque de "${prodAtual.nome}" ${prodAtual.estoque} -> ${novoEstoque}`)

              // Esgotou: avisa o lojista pra repor (o produto some da vitrine).
              if (novoEstoque === 0) {
                try {
                  await supabase.from('notifications').insert({
                    user_id: pedido.vendedor_user_id,
                    type: 'aviso',
                    title: 'Produto esgotado',
                    message: `${prodAtual.nome} vendeu a última unidade e saiu da sua vitrine. Reponha o estoque para voltar a vender.`,
                    data: { link: `/minha-loja/${pedido.loja_id}/produtos` },
                  })
                } catch (err: any) {
                  console.error('[webhook] venda: falha avisando esgotado:', err?.message)
                }
              }
            }
          }

          console.log(`[webhook] venda: pedido ${pedido.numero} PAGO — ${pedido.item_nome} (loja ${pedido.loja_id})`)

          const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

          // Sino pros dois lados
          try {
            await supabase.from('notifications').insert([
              {
                user_id: pedido.vendedor_user_id,
                type: 'aviso',
                title: 'Você vendeu!',
                message: `${pedido.item_nome} foi vendido. Envie o produto e marque como enviado.`,
                data: { link: `/minha-loja/${pedido.loja_id}/pedidos` },
              },
              {
                user_id: pedido.comprador_user_id,
                type: 'aviso',
                title: 'Pagamento confirmado',
                message: `Sua compra de ${pedido.item_nome} foi confirmada. A loja vai preparar o envio.`,
                data: { link: `/pedido/${pedido.id}` },
              },
            ])
          } catch (err: any) {
            console.error('[webhook] venda: falha no sino:', err?.message)
          }

          // Emails
          try {
            const { data: partes } = await supabase
              .from('users')
              .select('id, email, name')
              .in('id', [pedido.vendedor_user_id, pedido.comprador_user_id])

            const vendedor = partes?.find((u: any) => u.id === pedido.vendedor_user_id)
            const comprador = partes?.find((u: any) => u.id === pedido.comprador_user_id)

            const { data: lojaRow } = await supabase
              .from('lojas')
              .select('nome')
              .eq('id', pedido.loja_id)
              .single()

            if (vendedor?.email) {
              await sendVendaLojistaEmail({
                to: vendedor.email,
                nomeUser: vendedor.name || '',
                nomeLoja: lojaRow?.nome || 'sua loja',
                lojaId: pedido.loja_id,
                pedidoNumero: pedido.numero,
                itemNome: pedido.item_nome,
                liquidoBRL: brl(pedido.liquido_loja_cents),
                compradorNome: cd?.name || comprador?.name || 'Comprador',
                endereco: enderecoStr,
                repassePrazo: pedido.repasse_prazo,
              })
            }
            if (comprador?.email) {
              await sendPedidoCompradorEmail({
                to: comprador.email,
                nomeUser: comprador.name || '',
                pedidoId: pedido.id,
                pedidoNumero: pedido.numero,
                itemNome: pedido.item_nome,
                nomeLoja: lojaRow?.nome || 'a loja',
                totalBRL: brl(pedido.total_comprador_cents),
              })
            }
          } catch (err: any) {
            console.error('[webhook] venda: falha nos emails:', err?.message)
          }

          break
        }

        // ─── Assinaturas / pacotes (fluxo antigo) ───────────────────────
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
              stripe,
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
              stripe,
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

        // ─── MASTER SET (one-time, por set) ─────────────────
        if (planoMeta === 'master_set') {
          const setId = session.metadata?.setId
          if (!setId) {
            console.warn(`[webhook] master_set sem setId — ignorando`)
            break
          }
          const piId = await extrairPaymentIntentDeSession(stripe, session)
          try {
            await supabase.from('user_master_sets').upsert({
              user_id: userId,
              set_id: setId,
              source: 'stripe',
              stripe_payment_intent_id: piId || null,
            }, { onConflict: 'user_id,set_id' })
            await supabase.from('users').update({
              stripe_customer_id: session.customer as string || null,
            }).eq('id', userId)
            console.log(`[webhook] Master set ${setId} desbloqueado para ${userId}`)
          } catch (err: any) {
            console.error(`[webhook] CRITICAL: falha desbloqueando master set ${setId} para ${userId}:`, err.message)
          }

          try {
            const { data: msRow } = await supabase.from('master_sets').select('nome').eq('set_id', setId).limit(1)
            const nomeSet = msRow?.[0]?.nome || setId
            await registrarReceitaStripe(supabase, {
              stripe,
              paymentIntentId:    piId,
              valorTotalCentavos: session.amount_total || 0,
              descricao:          `Master Set — ${nomeSet}`,
              categoria:          'master_set',
              dataCompetencia:    new Date(event.created * 1000).toISOString().slice(0, 10),
              userId,
            })
          } catch (err: any) {
            console.error(`[webhook] CRITICAL: falha registrando receita master set:`, err.message)
          }

          try {
            const { data: uData } = await supabase.from('users').select('email, name').eq('id', userId).limit(1)
            if (uData?.[0]?.email) {
              const { data: psRow } = await supabase.from('pokemon_sets').select('name_pt, name').eq('id', setId).limit(1)
              const { data: msRow2 } = await supabase.from('master_sets').select('nome').eq('set_id', setId).limit(1)
              const nomeExibicao = psRow?.[0]?.name_pt || msRow2?.[0]?.nome || setId
              await sendMasterSetUnlockedEmail(uData[0].email, uData[0].name || '', nomeExibicao, setId).catch(console.error)
              console.log(`[webhook] email master set enviado para ${uData[0].email}`)
            }
          } catch (err: any) {
            console.error(`[webhook] falha enviando email master set:`, err.message)
          }
          break
        }

        // ─── PAGINA LENDARIA / COLECAO LENDARIA (one-time) ──────────────
        // Mesmo desenho do master_set: upsert idempotente (a Stripe
        // re-entrega) + receita como venda avulsa, nunca assinatura.
        // A tabela pode nao existir ainda (migration pendente): o erro fica
        // logado como CRITICAL e o success/route ja fez o fallback — nada
        // de dinheiro se perde, so o registro do desbloqueio, que o resend
        // do evento refaz depois que a migration rodar.
        if (planoMeta === 'pagina_lendaria' || planoMeta === 'colecao_lendaria') {
          const paginaId = session.metadata?.paginaId
          if (!paginaId) {
            console.warn(`[webhook] ${planoMeta} sem paginaId — ignorando`)
            break
          }
          const piId = await extrairPaymentIntentDeSession(stripe, session)
          try {
            await supabase.from('user_paginas_lendarias').upsert({
              user_id: userId,
              pagina_id: paginaId,
              source: 'stripe',
              stripe_payment_intent_id: piId || null,
            }, { onConflict: 'user_id,pagina_id' })
            await supabase.from('users').update({
              stripe_customer_id: session.customer as string || null,
            }).eq('id', userId)
            console.log(`[webhook] Pagina Lendaria ${paginaId} desbloqueada para ${userId}`)
          } catch (err: any) {
            console.error(`[webhook] CRITICAL: falha desbloqueando pagina lendaria ${paginaId} para ${userId}:`, err.message)
          }

          try {
            const descricao = paginaId === '*'
              ? 'Colecao Lendaria — pacote completo'
              : `Pagina Lendaria — ${paginaId}`
            await registrarReceitaStripe(supabase, {
              stripe,
              paymentIntentId:    piId,
              valorTotalCentavos: session.amount_total || 0,
              descricao,
              categoria:          'master_set',
              dataCompetencia:    new Date(event.created * 1000).toISOString().slice(0, 10),
              userId,
            })
          } catch (err: any) {
            console.error(`[webhook] CRITICAL: falha registrando receita pagina lendaria:`, err.message)
          }

          try {
            const { data: uData } = await supabase.from('users').select('email, name').eq('id', userId).limit(1)
            if (uData?.[0]?.email) {
              await sendPurchaseConfirmationEmail(uData[0].email, uData[0].name || '', planoMeta).catch(console.error)
            }
          } catch (err: any) {
            console.error(`[webhook] falha enviando email pagina lendaria:`, err.message)
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
              stripe,
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
          const isPlus = priceId === process.env.STRIPE_PRICE_PLUS
          const plano = isPlus ? 'plus' : (priceId === process.env.STRIPE_PRICE_ANUAL ? 'anual' : 'mensal')

          const periodEnd = getSubscriptionPeriodEnd(subscription)
          const proExpiraEm = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

          if (!proExpiraEm) {
            console.error(`[webhook] CRITICAL: sub ${subscription.id} sem current_period_end válido`)
          }

          await supabase.from('users').update({
            is_pro: !isPlus,
            plano,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            ...(proExpiraEm ? { pro_expira_em: proExpiraEm } : {}),
          }).eq('id', userId)

          console.log(`[webhook] Pro ${plano} ativado para ${userId} (expira ${proExpiraEm || '?'})`)

          const { data: uData } = await supabase.from('users').select('email, name').eq('id', userId).limit(1)
          if (uData?.[0]?.email) {
            await sendPurchaseConfirmationEmail(uData[0].email, uData[0].name || '', isPlus ? 'plus' : (plano === 'anual' ? 'pro_anual' : 'pro_mensal')).catch(console.error)
          }

          // ── Indique e Ganhe: marca referral como 'engajado' (+200 pts ao referrer) ──
          try {
            const { data: engagedResult } = await supabase.rpc('mark_referral_engaged', {
              p_user_id: userId,
            })

            if (engagedResult?.engaged && engagedResult?.referrer_user_id) {
              const { data: refData } = await supabase
                .from('users')
                .select('email, name, points_balance')
                .eq('id', engagedResult.referrer_user_id)
                .limit(1)

              if (refData?.[0]?.email) {
                await sendReferralEngagedEmail({
                  to: refData[0].email,
                  name: refData[0].name || '',
                  newBalance: refData[0].points_balance || 0,
                }).catch(console.error)
              }
            }
          } catch (err: any) {
            console.error(`[webhook] mark_referral_engaged falhou (não crítico):`, err?.message)
          }

          const piId = await extrairPaymentIntentDeSession(stripe, session)
          await registrarReceitaStripe(supabase, {
              stripe,
            paymentIntentId:    piId,
            valorTotalCentavos: session.amount_total || 0,
            descricao:          DESCRICAO_PLANO[isPlus ? 'plus' : (plano === 'anual' ? 'pro_anual' : 'pro_mensal')],
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
              stripe,
              paymentIntentId:    piId,
              valorTotalCentavos: invoice.amount_paid || invoice.amount_due || 0,
              descricao:          `${DESCRICAO_PLANO[planoTag] || planoTag} (renovação)`,
              dataCompetencia:    new Date(event.created * 1000).toISOString().slice(0, 10),
              userId:             null,
            })
            break
          }

          // ─── Renovação Pro/Plus usuário ───
          const isPlusUser = priceId === process.env.STRIPE_PRICE_PLUS
          await supabase.from('users').update({
            is_pro: !isPlusUser,
            ...(isPlusUser ? { plano: 'plus' } : {}),
            ...(novaExpiraEm ? { pro_expira_em: novaExpiraEm } : {}),
          }).eq('stripe_subscription_id', invoice.subscription)

          console.log(`[webhook] Renovação Pro user — sub ${invoice.subscription} (expira ${novaExpiraEm || '?'})`)

          if (invoice.billing_reason === 'subscription_create') break

          const planoTag = isPlusUser ? 'plus' : (priceId === process.env.STRIPE_PRICE_ANUAL ? 'pro_anual' : 'pro_mensal')

          const { data: userData } = await supabase
            .from('users')
            .select('id')
            .eq('stripe_subscription_id', invoice.subscription as string)
            .limit(1)

          const piId = await extrairPaymentIntentDeInvoice(stripe, invoice)

          await registrarReceitaStripe(supabase, {
              stripe,
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
          } else if (priceId === process.env.STRIPE_PRICE_PLUS) {
            await supabase.from('users').update({
              is_pro: false,
              plano: 'plus',
              ...(novaExpiraEm ? { pro_expira_em: novaExpiraEm } : {}),
            }).eq('stripe_subscription_id', subscription.id)
            console.log(`[webhook] Plus user atualizado — sub ${subscription.id}`)
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
        try {
          if (invoice.subscription) {
            const { data: u } = await supabase
              .from('users')
              .select('email, name')
              .eq('stripe_subscription_id', invoice.subscription as string)
              .limit(1)
            if (u?.[0]?.email) {
              await sendPaymentFailedEmail(u[0].email, u[0].name || '').catch(console.error)
              console.log(`[webhook] dunning enviado para ${u[0].email}`)
            } else {
              console.warn(`[webhook] payment_failed sem user para sub ${invoice.subscription}`)
            }
          }
        } catch (err: any) {
          console.error(`[webhook] falha enviando dunning:`, err?.message)
        }
        break
      }

      // ────────────────────────────────────────────────────────────────────
      // CHARGE.DISPUTE.CREATED — chargeback (cliente disputou no banco)
      // ────────────────────────────────────────────────────────────────────
      // Custo Stripe: USD 15 + multa. Log crítico pra ação imediata.
      // ─── ESTORNO ────────────────────────────────────────────────────────
      // Fecha o buraco descoberto na auditoria de 26/07/2026: 5 assinaturas
      // duplicadas do mesmo usuario foram estornadas PELO PAINEL DA STRIPE e o
      // banco nunca soube — o /admin/financeiro seguiu somando R$149,50 que ja
      // tinham voltado pro cartao.
      //
      // A rota /api/lojas/[id]/pedidos tambem estorna, mas so cobre o
      // cancelamento feito pela loja dentro do app. Este handler cobre os DOIS
      // caminhos, inclusive o reembolso manual no dashboard.
      //
      // Proporcional de proposito: charge.refunded tambem dispara em estorno
      // PARCIAL. Zerar cego inflaria a reversao. O reembolso da Bynx e sempre
      // integral (V1), entao parcial so vem do dashboard — e ai a proporcao e
      // a unica leitura honesta.
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : null

        if (!pi) {
          console.warn(`[webhook] charge.refunded sem payment_intent (charge ${charge.id}) — nada a fazer`)
          break
        }

        const bruto = charge.amount || 0
        const devolvido = charge.amount_refunded || 0
        const integral = bruto > 0 && devolvido >= bruto
        const fracaoQueSobra = bruto > 0 ? Math.max(0, 1 - devolvido / bruto) : 0

        console.log(
          `[webhook] estorno: PI ${pi} — devolvido ${devolvido}/${bruto} (${integral ? 'integral' : 'parcial'})`
        )

        // ── 1. Financeiro ────────────────────────────────────────────────
        try {
          const { data: lancs } = await supabase
            .from('lancamentos')
            .select('id, valor_bruto, descricao')
            .eq('stripe_payment_intent_id', pi)
            .limit(1)

          const lanc = lancs?.[0]
          if (!lanc) {
            console.log(`[webhook] estorno: sem lancamento para o PI ${pi} — nada a reverter`)
          } else {
            const novoValor = Math.round(Number(lanc.valor_bruto) * fracaoQueSobra * 100) / 100
            const { error: revErr } = await supabase
              .from('lancamentos')
              .update({
                valor_bruto: novoValor,
                valor_liquido: novoValor,
                observacao: `Estornado na Stripe em ${new Date().toISOString().slice(0, 10)} — `
                  + `${integral ? 'integral' : 'parcial'} (${devolvido}/${bruto} centavos), charge ${charge.id}.`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', lanc.id)

            if (revErr) {
              console.error(`[webhook] CRITICAL: estorno nao aplicado no lancamento ${lanc.id} (PI ${pi}):`, revErr.message)
            } else {
              console.log(`[webhook] estorno: lancamento "${lanc.descricao}" ${lanc.valor_bruto} -> ${novoValor}`)
            }
          }
        } catch (err) {
          console.error('[webhook] CRITICAL: excecao revertendo lancamento:', (err as Error)?.message)
        }

        // ── 2. Pedido ────────────────────────────────────────────────────
        // Estorno feito no dashboard deixava o pedido como 'pago' pra sempre:
        // o comprador via "pagamento aprovado" com o dinheiro ja de volta.
        // So mexe em estorno integral — parcial nao cancela a venda.
        if (integral) {
          try {
            const { data: peds } = await supabase
              .from('pedidos')
              .select('id, numero, status, marketplace_id, produto_id')
              .eq('stripe_payment_intent_id', pi)
              .limit(1)

            const pedido = peds?.[0]
            if (pedido && pedido.status !== 'reembolsado' && pedido.status !== 'cancelado') {
              await supabase
                .from('pedidos')
                .update({
                  status: 'reembolsado',
                  cancelado_em: new Date().toISOString(),
                  cancelado_por: 'stripe',
                  cancelamento_motivo: 'Estorno feito diretamente na Stripe',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', pedido.id)

              // Devolve o item pra venda, igual ao cancelamento pela loja.
              if (pedido.produto_id) {
                await supabase.rpc('restaurar_estoque_produto', { p_id: pedido.produto_id })
              } else if (pedido.marketplace_id) {
                await supabase
                  .from('marketplace')
                  .update({ status: 'disponivel', buyer_id: null })
                  .eq('id', pedido.marketplace_id)
              }

              console.log(`[webhook] estorno: pedido ${pedido.numero} marcado como reembolsado`)
            }
          } catch (err) {
            console.error('[webhook] CRITICAL: excecao atualizando pedido no estorno:', (err as Error)?.message)
          }
        }

        break
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        console.error(`[webhook] CRITICAL DISPUTE: charge ${dispute.charge} reason ${dispute.reason} amount ${dispute.amount} status ${dispute.status}`)
        try {
          if (process.env.ADMIN_EMAIL) {
            await sendDisputeAdminEmail({
              to: process.env.ADMIN_EMAIL,
              charge: typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id || '',
              reason: dispute.reason || 'unknown',
              amount: dispute.amount || 0,
              currency: dispute.currency || 'brl',
              status: dispute.status || 'needs_response',
              customer: typeof (dispute as any).customer === 'string' ? (dispute as any).customer : null,
            }).catch(console.error)
            console.log(`[webhook] alerta de chargeback enviado para admin`)
          } else {
            console.warn(`[webhook] ADMIN_EMAIL nao configurado -- alerta de dispute nao enviado`)
          }
        } catch (err: any) {
          console.error(`[webhook] falha enviando alerta de dispute:`, err?.message)
        }
        break
      }

      // ────────────────────────────────────────────────────────────────────
      // ACCOUNT.UPDATED — conta Connect (Express) da loja mudou de estado
      // ────────────────────────────────────────────────────────────────────
      // Dispara quando o lojista avanca/conclui o onboarding hospedado da
      // Stripe, ou quando a Stripe pede/libera algo. Sem isso, o status so
      // atualizaria quando alguem abrisse /minha-loja/[id]/pagamentos.
      //
      // ATENCAO: este e um evento de CONTA CONECTADA. O endpoint do webhook
      // precisa estar assinando eventos "de contas conectadas" no dashboard,
      // senao ele nunca chega aqui.
      case 'account.updated': {
        const acc = event.data.object as Stripe.Account
        const c = classificarConta(acc)

        const { data: lojas, error: selErr } = await supabase
          .from('lojas')
          .select('id, nome, owner_user_id, stripe_connect_status')
          .eq('stripe_connect_account_id', acc.id)
          .limit(1)

        if (selErr) {
          console.error(`[webhook] account.updated: erro buscando loja de ${acc.id}:`, selErr.message)
          break
        }
        const loja = lojas?.[0]
        if (!loja) {
          // Conta conectada que nao e da Bynx (ou foi removida). Nao e erro.
          console.warn(`[webhook] account.updated: nenhuma loja com account ${acc.id}`)
          break
        }

        const eraAtivo = loja.stripe_connect_status === 'ativo'
        const virouAtivo = c.status === 'ativo' && !eraAtivo

        const patchLoja: Record<string, any> = {
          stripe_connect_status: c.status,
          connect_charges_enabled: c.charges,
          connect_payouts_enabled: c.payouts,
          connect_requirements: c.requirements,
          updated_at: new Date().toISOString(),
        }
        if (virouAtivo) patchLoja.connect_onboarded_em = new Date().toISOString()

        const { error: upErr } = await supabase.from('lojas').update(patchLoja).eq('id', loja.id)
        if (upErr) {
          console.error(`[webhook] account.updated: falha ao atualizar loja ${loja.id}:`, upErr.message)
          break
        }

        console.log(`[webhook] account.updated: loja ${loja.nome} (${loja.id}) -> ${c.status} (charges ${c.charges} payouts ${c.payouts} pendencias ${c.pendencias.length})`)

        // ── Avisos ao dono: sino + email ──────────────────────────────────
        // Dois momentos que valem interromper o lojista:
        //   1) virou ATIVO      -> "pode vender" (comemora)
        //   2) virou RESTRITO   -> "a Stripe precisa de mais X" (acao dele)
        // NUNCA avisar em `em_analise`: nao ha nada a fazer, o email so geraria
        // ansiedade e um clique que nao resolve. E so avisamos na TRANSICAO,
        // pra nao spammar (a Stripe manda varios account.updated seguidos —
        // vimos 6 num onboarding so).
        const virouRestrito = c.status === 'restrito' && loja.stripe_connect_status !== 'restrito'

        if ((virouAtivo || virouRestrito) && loja.owner_user_id) {
          const sino = virouAtivo
            ? {
                title: 'Recebimentos ativos!',
                message: `A loja ${loja.nome} está pronta para vender na Bynx. O dinheiro das suas vendas cai direto na sua conta.`,
              }
            : {
                title: 'Falta pouco para vender na Bynx',
                message: `A Stripe precisa de mais ${c.pendencias.length} informação(ões) para liberar os recebimentos da loja ${loja.nome}.`,
              }

          try {
            await supabase.from('notifications').insert({
              user_id: loja.owner_user_id,
              type: 'aviso',
              title: sino.title,
              message: sino.message,
              data: { link: `/minha-loja/${loja.id}/pagamentos` },
            })
          } catch (err: any) {
            console.error(`[webhook] account.updated: falha no sino:`, err?.message)
          }

          // Email (o sino so e visto se o lojista entrar; o email traz ele de volta)
          try {
            const { data: dono } = await supabase
              .from('users')
              .select('email, name')
              .eq('id', loja.owner_user_id)
              .single()

            if (dono?.email) {
              if (virouAtivo) {
                await sendConnectAtivoEmail({
                  to: dono.email,
                  nomeUser: dono.name || '',
                  nomeLoja: loja.nome,
                  lojaId: loja.id,
                })
              } else {
                await sendConnectPendenciaEmail({
                  to: dono.email,
                  nomeUser: dono.name || '',
                  nomeLoja: loja.nome,
                  lojaId: loja.id,
                  qtdPendencias: c.pendencias.length,
                })
              }
              console.log(`[webhook] account.updated: email de ${virouAtivo ? 'ativo' : 'pendencia'} enviado pra loja ${loja.nome}`)
            }
          } catch (err: any) {
            console.error(`[webhook] account.updated: falha no email:`, err?.message)
          }
        }
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
