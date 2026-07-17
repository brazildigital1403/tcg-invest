/**
 * Comissao da Bynx nas vendas on-site — MODELO "LIGA NOS DOIS LADOS".
 *
 * Espelha a tabela da LigaSegura de proposito: o lojista BR ja conhece esses
 * numeros, entao a Bynx nao parece cara nem estranha.
 *
 *   LADO VENDEDOR (loja) — escolhe o prazo de repasse:
 *     14 dias -> 4,99% + R$ 0,40 (a partir de R$ 20)
 *     30 dias -> 3,99% + R$ 0,40 (a partir de R$ 20)
 *
 *   LADO COMPRADOR — acrescimo por forma de pagamento (igual Liga):
 *     Pix     -> + R$ 0,99
 *     Cartao  -> + 4,8% (minimo R$ 1,20)
 *
 * POR QUE O ACRESCIMO NO COMPRADOR:
 * a LigaSegura E o proprio processador (custo dela = intercambio ~1-2%). A Bynx
 * roda em cima da Stripe: cartao 3,99% + R$0,39 · Pix 1,19%. Cobrando so os
 * 3,99% do vendedor a operacao daria PREJUIZO no cartao (-R$2 numa venda de
 * R$250). Repassando o custo do cartao pro comprador — exatamente como a Liga
 * faz nas transacoes comuns — a margem fica saudavel e o lojista continua vendo
 * o mesmo 3,99% que ele conhece.
 *
 * INVARIANTE: o vendedor recebe o MESMO liquido no Pix ou no cartao. O metodo
 * so muda o que o COMPRADOR paga. Assim a conta do lojista e previsivel e o
 * comprador tem incentivo natural pro Pix (mais barato pra ele).
 */

export const PRAZOS_REPASSE = [14, 30] as const
export type PrazoRepasse = (typeof PRAZOS_REPASSE)[number]

export type MetodoPagamento = 'pix' | 'cartao'

// ─── Lado vendedor ──────────────────────────────────────────────────────────
const PCT_POR_PRAZO: Record<PrazoRepasse, number> = { 14: 0.0499, 30: 0.0399 }

/** Taxa fixa por venda (centavos), so a partir do minimo. */
export const TAXA_FIXA_CENTS = 40
/** Valor minimo (centavos) pra taxa fixa incidir: R$ 20,00. */
export const TAXA_FIXA_MINIMO_CENTS = 2000

// ─── Lado comprador ─────────────────────────────────────────────────────────
/**
 * O Pix esta liberado na conta Stripe da Bynx?
 *
 * A Stripe confirmou por email (jul/2026) que o Pix no Brasil e um **beta
 * fechado por convite**, sem criterio publico de entrada — eles chamam se e
 * quando aceitarem. Lista de espera: https://docs.stripe.com/payments/pix
 *
 * Enquanto for `false`, a tela de checkout mostra o Pix como "em breve" e o
 * cartao e o padrao. Sem essa trava, quem escolhesse Pix tomaria erro da Stripe
 * DEPOIS de decidir comprar — a pior hora possivel.
 *
 * QUANDO LIBERAR: virar pra `true` e dar deploy. O resto ja esta pronto (a
 * regra de preco, o checkout e o split nao mudam).
 */
export const PIX_DISPONIVEL = false

export const ACRESCIMO_PIX_CENTS = 99
export const ACRESCIMO_CARTAO_PCT = 0.048
export const ACRESCIMO_CARTAO_MIN_CENTS = 120

export function ehPrazoValido(v: unknown): v is PrazoRepasse {
  return v === 14 || v === 30
}
export function normalizarPrazo(v: unknown): PrazoRepasse {
  return ehPrazoValido(v) ? v : 30
}
export function ehMetodoValido(v: unknown): v is MetodoPagamento {
  return v === 'pix' || v === 'cartao'
}

/** "3,99%" */
export function pctLabel(prazo: PrazoRepasse): string {
  return `${(PCT_POR_PRAZO[normalizarPrazo(prazo)] * 100).toFixed(2).replace('.', ',')}%`
}

/** Comissao cobrada do VENDEDOR, em centavos. */
export function comissaoVendedorCents(valorCents: number, prazo: PrazoRepasse): number {
  if (!Number.isFinite(valorCents) || valorCents <= 0) return 0
  let fee = Math.round(valorCents * PCT_POR_PRAZO[normalizarPrazo(prazo)])
  if (valorCents >= TAXA_FIXA_MINIMO_CENTS) fee += TAXA_FIXA_CENTS
  return Math.min(fee, valorCents)
}

/** Acrescimo pago pelo COMPRADOR conforme o metodo, em centavos. */
export function acrescimoCompradorCents(valorCents: number, metodo: MetodoPagamento): number {
  if (!Number.isFinite(valorCents) || valorCents <= 0) return 0
  if (metodo === 'pix') return ACRESCIMO_PIX_CENTS
  return Math.max(Math.round(valorCents * ACRESCIMO_CARTAO_PCT), ACRESCIMO_CARTAO_MIN_CENTS)
}

export interface Checkout {
  /** Preco do anuncio (o que a loja pediu). */
  valorCents: number
  /** Acrescimo do metodo, pago pelo comprador. */
  acrescimoCents: number
  /** Total cobrado do comprador (valor + acrescimo). NAO inclui frete. */
  totalCompradorCents: number
  /** Comissao do lado vendedor. */
  comissaoVendedorCents: number
  /** application_fee_amount da Stripe: comissao do vendedor + acrescimo do comprador. */
  taxaBynxCents: number
  /** O que sobra pra loja (igual no Pix e no cartao). */
  liquidoLojaCents: number
}

/**
 * Monta a conta completa de um item.
 * O `taxaBynxCents` e o que vai no application_fee_amount; o resto do
 * transfer_data.destination cai na loja.
 */
export function calcularCheckout(
  valorCents: number,
  prazo: PrazoRepasse,
  metodo: MetodoPagamento
): Checkout {
  const acrescimo = acrescimoCompradorCents(valorCents, metodo)
  const comissao = comissaoVendedorCents(valorCents, prazo)
  const total = valorCents + acrescimo
  return {
    valorCents,
    acrescimoCents: acrescimo,
    totalCompradorCents: total,
    comissaoVendedorCents: comissao,
    taxaBynxCents: comissao + acrescimo,
    liquidoLojaCents: valorCents - comissao,
  }
}

/** "R$ 1.234,56" */
export function fmtBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
