// src/lib/parceiros.ts
//
// Programa de Parceiros — comissao por cupom de influenciador.
//
// Chamado SO pelo webhook Stripe (service_role). Toda funcao aqui e
// best-effort: o chamador envolve em try/catch nao-critico (padrao do
// mark_referral_engaged) e um erro aqui NUNCA derruba o processamento do
// evento. Tabela ausente (migration pendente, 42P01) degrada com warn.
//
// O ledger parceiro_comissoes e append-only: credito na venda/renovacao,
// linha NEGATIVA no estorno. Dedup por stripe_payment_intent_id
// (venda/renovacao) e por stripe_event_id (estorno) — a Stripe re-entrega.

import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

// Via PostgREST a tabela ausente chega como PGRST205 (schema cache), nao
// como o 42P01 do Postgres — os dois contam como "migration pendente".
const TABELAS_AUSENTES = ['42P01', 'PGRST205']
const DUPLICADO = '23505'

interface ParceiroRow {
  id: string
  nome: string
  ativo: boolean
  comissao_primeira_pct: number
  comissao_renovacao_pct: number
  recorrente_meses: number
}

/**
 * Resolve o promotion code aplicado na session (promo_...), se houver.
 * No payload do webhook `discounts` normalmente ja vem; o retrieve cobre
 * payload de versao antiga que venha sem o campo.
 */
async function extrairPromotionCodeId(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<string | null> {
  let discounts = session.discounts
  if ((discounts == null || discounts.length === 0) && (session.total_details?.amount_discount || 0) > 0) {
    try {
      const cheia = await stripe.checkout.sessions.retrieve(session.id)
      discounts = cheia.discounts
    } catch (err: any) {
      console.warn(`[parceiros] retrieve da session ${session.id} falhou: ${err?.message}`)
      return null
    }
  }
  const promo = discounts?.[0]?.promotion_code
  if (!promo) return null
  return typeof promo === 'string' ? promo : promo.id
}

function logErroInsert(contexto: string, error: { code?: string; message?: string } | null) {
  if (!error) return
  if (error.code === DUPLICADO) {
    console.log(`[parceiros] ${contexto}: ja registrado (dedup) — ok`)
  } else if (TABELAS_AUSENTES.includes(error.code || '')) {
    console.warn(`[parceiros] ${contexto}: tabelas ainda nao existem (migration pendente) — pulando`)
  } else {
    console.error(`[parceiros] CRITICAL: ${contexto} falhou: ${error.message}`)
  }
}

/**
 * Plug do checkout.session.completed (ramo Pro/Plus usuario).
 * Se a session usou cupom de parceiro, credita a comissao da 1a cobranca.
 * Base da comissao = valor PAGO (pos-desconto), o que entrou no caixa.
 */
export async function registrarVendaParceiro(
  supabase: SupabaseClient,
  stripe: Stripe,
  params: {
    session: Stripe.Checkout.Session
    plano: string
    userId: string
    paymentIntentId: string | null | undefined
    eventId: string
  }
): Promise<void> {
  const promoId = await extrairPromotionCodeId(stripe, params.session)
  if (!promoId) return

  const { data: parceiros, error: pErr } = await supabase
    .from('parceiros')
    .select('id, nome, ativo, comissao_primeira_pct, comissao_renovacao_pct, recorrente_meses')
    .eq('stripe_promotion_code_id', promoId)
    .limit(1)

  if (pErr) {
    logErroInsert(`lookup do promo ${promoId}`, pErr)
    return
  }
  const parceiro = parceiros?.[0] as ParceiroRow | undefined
  // Cupom da Stripe que nao e de parceiro (promo avulso do Du) — nada a fazer.
  if (!parceiro) return

  // Linha sem PI e invisivel pro dedup E pro estorno (o lookup do refund e
  // por PI): comissao paga indevidamente e irrecuperavel; comissao faltante
  // se reconcilia pelo log + dashboard. Nao inserir.
  if (!params.paymentIntentId) {
    console.error(`[parceiros] CRITICAL: venda do parceiro ${parceiro.nome} sem payment_intent (event ${params.eventId}) — comissao NAO registrada, reconciliar a mao`)
    return
  }

  // Cancelar-e-reassinar com o mesmo cupom nao paga a comissao de 1a cobranca
  // de novo: um user so gera 'venda' uma vez na vida (a Stripe ainda daria o
  // desconto, mas o promo e 'once' por assinatura — perda pequena e visivel).
  const { data: vendaAnterior, error: vaErr } = await supabase
    .from('parceiro_comissoes')
    .select('id')
    .eq('user_id', params.userId)
    .eq('tipo', 'venda')
    .limit(1)
  if (vaErr) {
    logErroInsert(`lookup de venda anterior do user ${params.userId}`, vaErr)
    return
  }
  if (vendaAnterior?.[0]) {
    console.warn(`[parceiros] user ${params.userId} ja gerou comissao de venda antes (reassinatura) — nao credita de novo`)
    return
  }

  const valorBase = params.session.amount_total || 0
  if (valorBase <= 0) return
  const comissao = Math.round(valorBase * Number(parceiro.comissao_primeira_pct) / 100)

  const { error } = await supabase.from('parceiro_comissoes').insert({
    parceiro_id: parceiro.id,
    tipo: 'venda',
    user_id: params.userId,
    plano: params.plano,
    stripe_subscription_id: (params.session.subscription as string) || null,
    stripe_payment_intent_id: params.paymentIntentId || null,
    stripe_event_id: params.eventId,
    valor_base_cents: valorBase,
    comissao_cents: comissao,
  })

  if (error) {
    logErroInsert(`venda do parceiro ${parceiro.nome} (PI ${params.paymentIntentId})`, error)
  } else {
    console.log(`[parceiros] venda registrada: ${parceiro.nome} — ${params.plano}, comissao ${comissao} cents`)
  }
}

/**
 * Plug do invoice.payment_succeeded (renovacao de plano de usuario).
 * Comissiona a renovacao enquanto estiver dentro da janela de
 * recorrente_meses contada da VENDA original. Parceiro pausado continua
 * recebendo pelas renovacoes dos assinantes que ja trouxe — pausar o cupom
 * corta vendas NOVAS (o promotion code morre na Stripe), nao o contrato.
 */
export async function registrarRenovacaoParceiro(
  supabase: SupabaseClient,
  params: {
    subscriptionId: string
    plano: string
    amountPaidCents: number
    paymentIntentId: string | null | undefined
    eventId: string
  }
): Promise<void> {
  if (params.amountPaidCents <= 0) return

  const { data: vendas, error: vErr } = await supabase
    .from('parceiro_comissoes')
    .select('id, parceiro_id, user_id, criado_em')
    .eq('stripe_subscription_id', params.subscriptionId)
    .eq('tipo', 'venda')
    .limit(1)

  if (vErr) {
    logErroInsert(`lookup da venda (sub ${params.subscriptionId})`, vErr)
    return
  }
  const venda = vendas?.[0]
  if (!venda) return

  const { data: parceiros } = await supabase
    .from('parceiros')
    .select('id, nome, ativo, comissao_primeira_pct, comissao_renovacao_pct, recorrente_meses')
    .eq('id', venda.parceiro_id)
    .limit(1)
  const parceiro = parceiros?.[0] as ParceiroRow | undefined
  if (!parceiro) return

  if (!params.paymentIntentId) {
    console.error(`[parceiros] CRITICAL: renovacao do parceiro ${parceiro.nome} sem payment_intent (event ${params.eventId}, sub ${params.subscriptionId}) — comissao NAO registrada, reconciliar a mao`)
    return
  }

  // Janela em dias fixos (mes = 30d): "12 meses" = a 1a cobranca + 11
  // renovacoes mensais (a 12a cai em ~365d, fora dos 360d) e a renovacao
  // do plano ANUAL (ano 2, ~365d) fica determinismicamente FORA. setMonth
  // teria overflow de dia (31/01 + 1m) e borderline por segundos no anual.
  const idadeMs = Date.now() - new Date(venda.criado_em).getTime()
  if (idadeMs >= Number(parceiro.recorrente_meses || 0) * 30 * 86400_000) {
    console.log(`[parceiros] renovacao fora da janela de ${parceiro.recorrente_meses}m (${parceiro.nome}) — sem comissao`)
    return
  }

  const comissao = Math.round(params.amountPaidCents * Number(parceiro.comissao_renovacao_pct) / 100)
  if (comissao <= 0) return

  const { error } = await supabase.from('parceiro_comissoes').insert({
    parceiro_id: parceiro.id,
    tipo: 'renovacao',
    user_id: venda.user_id,
    plano: params.plano,
    stripe_subscription_id: params.subscriptionId,
    stripe_payment_intent_id: params.paymentIntentId || null,
    stripe_event_id: params.eventId,
    valor_base_cents: params.amountPaidCents,
    comissao_cents: comissao,
  })

  if (error) {
    logErroInsert(`renovacao do parceiro ${parceiro.nome} (PI ${params.paymentIntentId})`, error)
  } else {
    console.log(`[parceiros] renovacao registrada: ${parceiro.nome} — comissao ${comissao} cents`)
  }
}

/**
 * Plug do charge.refunded. Reverte a comissao na MESMA proporcao do estorno,
 * como linha negativa (o snapshot de fechamento antigo nunca muda — estorno
 * de linha ja paga compensa no fechamento seguinte). Acumulativo: estornos
 * parciais sucessivos convergem pro alvo proporcional.
 */
export async function reverterComissaoParceiro(
  supabase: SupabaseClient,
  params: {
    paymentIntentId: string
    devolvidoCents: number
    brutoCents: number
    eventId: string
  }
): Promise<void> {
  if (params.brutoCents <= 0 || params.devolvidoCents <= 0) return

  const { data: linhas, error: lErr } = await supabase
    .from('parceiro_comissoes')
    .select('id, parceiro_id, user_id, plano, stripe_subscription_id, valor_base_cents, comissao_cents')
    .eq('stripe_payment_intent_id', params.paymentIntentId)
    .in('tipo', ['venda', 'renovacao'])
    .limit(1)

  if (lErr) {
    logErroInsert(`lookup pra estorno (PI ${params.paymentIntentId})`, lErr)
    return
  }
  const linha = linhas?.[0]
  if (!linha) {
    console.log(`[parceiros] estorno sem linha de comissao pro PI ${params.paymentIntentId} — ok se a venda nao teve cupom de parceiro`)
    return
  }

  const fracao = Math.min(1, params.devolvidoCents / params.brutoCents)
  const comissaoAlvo = Math.round(Number(linha.comissao_cents) * fracao)
  const baseAlvo = Math.round(Number(linha.valor_base_cents) * fracao)

  const { data: estornos, error: eErr } = await supabase
    .from('parceiro_comissoes')
    .select('comissao_cents, valor_base_cents')
    .eq('stripe_payment_intent_id', params.paymentIntentId)
    .eq('tipo', 'estorno')

  // Erro aqui NAO pode virar "ja estornado = 0": inseriria a reversao INTEIRA
  // de novo e reverteria em dobro. Aborta — a Stripe re-entrega o evento.
  if (eErr) {
    logErroInsert(`lookup de estornos anteriores (PI ${params.paymentIntentId})`, eErr)
    return
  }

  const comissaoJa = (estornos || []).reduce((s, e) => s - Number(e.comissao_cents), 0)
  const baseJa = (estornos || []).reduce((s, e) => s - Number(e.valor_base_cents), 0)
  const deltaComissao = comissaoAlvo - comissaoJa
  if (deltaComissao <= 0) return
  const deltaBase = Math.max(0, baseAlvo - baseJa)

  const { error } = await supabase.from('parceiro_comissoes').insert({
    parceiro_id: linha.parceiro_id,
    tipo: 'estorno',
    user_id: linha.user_id,
    plano: linha.plano,
    stripe_subscription_id: linha.stripe_subscription_id,
    stripe_payment_intent_id: params.paymentIntentId,
    stripe_event_id: params.eventId,
    valor_base_cents: -deltaBase,
    comissao_cents: -deltaComissao,
    observacao: `Estorno Stripe ${params.devolvidoCents}/${params.brutoCents} centavos`,
  })

  if (error) {
    logErroInsert(`estorno de comissao (PI ${params.paymentIntentId})`, error)
  } else {
    console.log(`[parceiros] comissao revertida em ${deltaComissao} cents (PI ${params.paymentIntentId})`)
  }
}
