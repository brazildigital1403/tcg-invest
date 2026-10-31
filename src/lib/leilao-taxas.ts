/**
 * Taxas do LEILAO — aprovadas pelo Du em 05/10/2026 (Quadro #411): vendedor
 * 6,99% + R$ 0,40 por pedido, comprador 5% de protecao (minimo R$ 2) + cartao.
 *
 * Arquivo proprio de proposito: src/lib/comissao.ts (economia travada das
 * vendas de preco fixo) NAO foi alterado. Daqui so se IMPORTA de la a taxa
 * fixa por pedido e o custo do metodo, para as duas contas nao divergirem.
 *
 *   LADO VENDEDOR: 6,99% + R$ 0,40 por pedido (a fixa so incide a partir de
 *     R$ 20, mesma regra de TAXA_FIXA_* do comissao.ts).
 *   LADO COMPRADOR: "taxa de protecao" de 5% (minimo R$ 2)
 *     + custo do metodo (cartao: 4,8% min R$ 1,20, do comissao.ts).
 *
 * INVARIANTE (a mesma do comissao.ts): o vendedor recebe o MESMO liquido em
 * qualquer metodo. O metodo so muda o que o COMPRADOR paga.
 *
 * ★ FIXA POR PEDIDO, NUNCA POR ITEM: a fixa de R$ 0,40 (vendedor) e o minimo
 * de R$ 2 da protecao (comprador) incidem UMA vez sobre o total do pedido.
 * Tres lotes arrematados na mesma rodada viram um pedido so e pagam uma fixa,
 * nao tres. `calcularPedidoLeilao` e a conta; `calcularArremate` e o caso de 1.
 *
 * Fatia 1 e so cartao; o parametro `metodo` existe para o Pix entrar depois
 * sem mexer na conta do vendedor.
 */

import {
  TAXA_FIXA_CENTS,
  TAXA_FIXA_MINIMO_CENTS,
  acrescimoCompradorCents,
  type MetodoPagamento,
} from './comissao'

export const LEILAO_PCT_VENDEDOR = 0.0699
export const LEILAO_PROTECAO_PCT = 0.05
export const LEILAO_PROTECAO_MIN_CENTS = 200

/** Referencia de custo da Stripe no cartao (so para estimar a margem). */
const STRIPE_CARTAO_PCT = 0.0399
const STRIPE_CARTAO_FIXO_CENTS = 39

export interface Arremate {
  /** Soma dos precos de martelo do pedido (1 lote = o proprio lance vencedor). */
  precoCents: number
  /** Quantidade de lotes no pedido. */
  nLotes: number
  /** Comissao do vendedor (6,99% + fixa UMA vez por pedido). */
  comissaoVendedorCents: number
  /** Taxa de protecao do comprador (5%, min R$ 2 UMA vez por pedido). */
  protecaoCents: number
  /** Custo do metodo, pago pelo comprador. */
  custoMetodoCents: number
  /** Total cobrado do comprador (sem frete). */
  compradorPagaCents: number
  /** Liquido do vendedor — igual em qualquer metodo. */
  vendedorRecebeCents: number
  /** Tudo que fica com a Bynx antes do custo do processador. */
  bynxBrutoCents: number
  /** application_fee_amount da Stripe (destination charge). */
  applicationFeeCents: number
  /** Estimativa do custo da Stripe no total cobrado. null = sem custo estimado (Pix). */
  custoStripeEstimadoCents: number | null
  /** bynxBruto - custo Stripe estimado. null quando nao ha estimativa de custo. */
  bynxLiquidoEstimadoCents: number | null
}

export function comissaoVendedorLeilaoCents(precoCents: number): number {
  if (!Number.isFinite(precoCents) || precoCents <= 0) return 0
  let fee = Math.round(precoCents * LEILAO_PCT_VENDEDOR)
  if (precoCents >= TAXA_FIXA_MINIMO_CENTS) fee += TAXA_FIXA_CENTS
  return Math.min(fee, precoCents)
}

export function protecaoCompradorCents(precoCents: number): number {
  if (!Number.isFinite(precoCents) || precoCents <= 0) return 0
  return Math.max(Math.round(precoCents * LEILAO_PROTECAO_PCT), LEILAO_PROTECAO_MIN_CENTS)
}

/**
 * Conta de um PEDIDO de leilao (1 ou mais lotes do mesmo vendedor). Tudo sobre
 * o subtotal: percentuais, fixa do vendedor e minimo da protecao aplicados uma
 * vez. Preco invalido (<= 0, NaN) nao entra na soma.
 */
export function calcularPedidoLeilao(precosCents: readonly number[], metodo: MetodoPagamento = 'cartao'): Arremate {
  const validos = (precosCents ?? [])
    .filter(p => Number.isFinite(p) && p > 0)
    .map(p => Math.round(p))
  const subtotal = validos.reduce((a, p) => a + p, 0)
  const comissao = comissaoVendedorLeilaoCents(subtotal)
  const protecao = protecaoCompradorCents(subtotal)
  const custoMetodo = subtotal > 0 ? acrescimoCompradorCents(subtotal, metodo) : 0
  const compradorPaga = subtotal + protecao + custoMetodo
  const vendedorRecebe = subtotal - comissao
  const applicationFee = compradorPaga - vendedorRecebe
  const custoStripe =
    metodo === 'cartao'
      ? compradorPaga > 0
        ? Math.round(compradorPaga * STRIPE_CARTAO_PCT) + STRIPE_CARTAO_FIXO_CENTS
        : 0
      : null
  return {
    precoCents: subtotal,
    nLotes: validos.length,
    comissaoVendedorCents: comissao,
    protecaoCents: protecao,
    custoMetodoCents: custoMetodo,
    compradorPagaCents: compradorPaga,
    vendedorRecebeCents: vendedorRecebe,
    bynxBrutoCents: applicationFee,
    applicationFeeCents: applicationFee,
    custoStripeEstimadoCents: custoStripe,
    bynxLiquidoEstimadoCents: custoStripe == null ? null : applicationFee - custoStripe,
  }
}

/** Um lote so: o caso de 1 item de calcularPedidoLeilao. */
export function calcularArremate(precoCents: number, metodo: MetodoPagamento = 'cartao'): Arremate {
  return calcularPedidoLeilao([precoCents], metodo)
}
