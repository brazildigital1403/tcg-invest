/**
 * Taxas do LEILAO — PROPOSTA, pendente de aprovacao do Du.
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
  /** Preco do martelo (lance vencedor). */
  precoCents: number
  /** Comissao do vendedor (6,99% + fixa). */
  comissaoVendedorCents: number
  /** Taxa de protecao do comprador (5%, min R$ 2). */
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
  /** Estimativa do custo da Stripe no total cobrado (so cartao). */
  custoStripeEstimadoCents: number
  /** bynxBruto - custo Stripe estimado. */
  bynxLiquidoEstimadoCents: number
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

export function calcularArremate(precoCents: number, metodo: MetodoPagamento = 'cartao'): Arremate {
  const preco = Number.isFinite(precoCents) && precoCents > 0 ? Math.round(precoCents) : 0
  const comissao = comissaoVendedorLeilaoCents(preco)
  const protecao = protecaoCompradorCents(preco)
  const custoMetodo = acrescimoCompradorCents(preco, metodo)
  const compradorPaga = preco + protecao + custoMetodo
  const vendedorRecebe = preco - comissao
  const applicationFee = compradorPaga - vendedorRecebe
  const custoStripe =
    metodo === 'cartao' && compradorPaga > 0
      ? Math.round(compradorPaga * STRIPE_CARTAO_PCT) + STRIPE_CARTAO_FIXO_CENTS
      : 0
  return {
    precoCents: preco,
    comissaoVendedorCents: comissao,
    protecaoCents: protecao,
    custoMetodoCents: custoMetodo,
    compradorPagaCents: compradorPaga,
    vendedorRecebeCents: vendedorRecebe,
    bynxBrutoCents: applicationFee,
    applicationFeeCents: applicationFee,
    custoStripeEstimadoCents: custoStripe,
    bynxLiquidoEstimadoCents: applicationFee - custoStripe,
  }
}
