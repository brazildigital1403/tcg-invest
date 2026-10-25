import 'server-only'
import type Stripe from 'stripe'
import { comissaoADevolver, type PlanoComissao } from '@/lib/custoEstorno'

/**
 * Lado Stripe da regra de custo do estorno (regra pura em lib/custoEstorno).
 * Recebe o cliente Stripe de quem chama, para servir a qualquer fluxo:
 * leilao e venda de loja (destination charge) hoje, planos depois.
 *
 * ★ NUNCA importar em componente 'use client'.
 */

export interface CustosDaCobranca {
  chargeId: string
  /** charge.amount */
  cobradoCents: number
  /** charge.amount_refunded (cumulativo, inclui estorno manual pelo dashboard) */
  estornadoCents: number
  /** Taxa REAL da Stripe (balance_transaction.fee). null = ainda nao disponivel. */
  taxaStripeCents: number | null
  /** ApplicationFee da destination charge; null em cobranca direta. */
  comissao: { id: string; cents: number; devolvidoCents: number } | null
}

/** Le a cobranca do PaymentIntent com a taxa real e a comissao. Leitura so. */
export async function custosDaCobranca(s: Stripe, paymentIntent: string): Promise<CustosDaCobranca> {
  const pi = await s.paymentIntents.retrieve(paymentIntent, {
    expand: ['latest_charge.balance_transaction', 'latest_charge.application_fee'],
  })
  const ch = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null
  if (!ch) throw new Error(`PaymentIntent ${paymentIntent} sem charge`)
  const bt = ch.balance_transaction && typeof ch.balance_transaction !== 'string' ? ch.balance_transaction : null
  const fee = ch.application_fee && typeof ch.application_fee !== 'string' ? ch.application_fee : null
  return {
    chargeId: ch.id,
    cobradoCents: ch.amount,
    estornadoCents: ch.amount_refunded,
    taxaStripeCents: typeof bt?.fee === 'number' ? bt.fee : null,
    comissao: fee ? { id: fee.id, cents: fee.amount, devolvidoCents: fee.amount_refunded } : null,
  }
}

/**
 * Devolve a loja a parte da comissao que a regra permite, ANTES do estorno da
 * charge (assim o webhook charge.refunded ja encontra a comissao no valor
 * final). Idempotente por `chave`: procura refund da ApplicationFee com
 * `metadata.bynx_chave` antes de criar, e usa `<chave>-comissao` como
 * idempotencyKey. Sem comissao (cobranca direta) ou nada a devolver: nao chama
 * a Stripe.
 *
 * `estornoCents` = valor deste estorno ao comprador (null = o restante).
 * Taxa ainda sem balance_transaction (raro, logo apos o pagamento): trata como
 * a comissao inteira retida -- nunca devolve sem saber a taxa.
 */
export async function devolverComissaoComCusto(s: Stripe, a: {
  custos: CustosDaCobranca
  chave: string
  estornoCents: number | null
  custosExtrasCents?: number
  metadata?: Record<string, string>
}): Promise<PlanoComissao & { feeRefundId: string | null; reaproveitado: boolean }> {
  const { custos } = a
  if (!custos.comissao) return { devolverCents: 0, retidoCents: 0, faltaCobrirCents: 0, feeRefundId: null, reaproveitado: false }

  const ja = await s.applicationFees.listRefunds(custos.comissao.id, { limit: 100 })
  const achado = ja.data.find(r => r.metadata?.bynx_chave === a.chave)
  if (achado) {
    return {
      devolverCents: achado.amount, retidoCents: custos.comissao.cents - custos.comissao.devolvidoCents,
      faltaCobrirCents: 0, feeRefundId: achado.id, reaproveitado: true,
    }
  }

  const restante = Math.max(0, custos.cobradoCents - custos.estornadoCents)
  const desteEstorno = a.estornoCents == null ? restante : Math.min(Math.max(0, a.estornoCents), restante)
  const plano = comissaoADevolver({
    cobradoCents: custos.cobradoCents,
    comissaoCents: custos.comissao.cents,
    taxaStripeCents: custos.taxaStripeCents ?? custos.comissao.cents,
    estornadoTotalCents: custos.estornadoCents + desteEstorno,
    jaDevolvidoCents: custos.comissao.devolvidoCents,
    custosExtrasCents: a.custosExtrasCents,
  })
  if (plano.devolverCents <= 0) return { ...plano, feeRefundId: null, reaproveitado: false }

  const r = await s.applicationFees.createRefund(
    custos.comissao.id,
    { amount: plano.devolverCents, metadata: { ...(a.metadata || {}), bynx_chave: a.chave } },
    { idempotencyKey: `${a.chave}-comissao` },
  )
  return { ...plano, feeRefundId: r.id, reaproveitado: false }
}
