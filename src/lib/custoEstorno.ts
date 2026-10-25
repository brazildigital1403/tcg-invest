/**
 * Custo do estorno: quem paga a conta quando o dinheiro volta (25/10/2026).
 * Funcao pura, coberta por scripts/reclamacao-selftest.mjs.
 *
 * ★ POR QUE EXISTE. A Stripe NAO devolve a taxa do cartao quando ha estorno
 *   (support.stripe.com/questions/understanding-fees-for-refunds). Na venda,
 *   o "custo do cartao" pago pelo comprador cobre essa taxa; no estorno
 *   integral ele volta para o comprador (o CDC exige na desistencia) e a
 *   taxa fica sem dono. Provado no pedido #39 da prova: estorno de R$ 329,40
 *   com reverse_transfer + refund_application_fee deixou a loja em R$ 0 e a
 *   BYNX EM -R$ 13,53 (a taxa). Com a etiqueta reversa da desistencia, o
 *   buraco cresce (R$ 11 a R$ 29 nas cotacoes do sandbox).
 *
 * ★ REGRA DO DU (25/10): a Bynx nunca fica negativa por um estorno. O
 *   comprador recebe o que tem direito; a taxa da Stripe e os custos extras
 *   (etiqueta) saem da comissao que voltaria para a loja.
 *
 * ★ COMO, NA STRIPE (destination charge). O estorno faz reverse_transfer
 *   (tira da loja o valor estornado) mas NAO devolve a comissao sozinho
 *   (refund_application_fee: false). A comissao volta numa chamada separada
 *   (ApplicationFee refund) no valor que `comissaoADevolver` calcula. Conta
 *   do #39 com a regra: loja -R$ 13,53, Bynx R$ 0,00, comprador R$ 329,40.
 *
 * ★ LIMITE DURO. A loja so pode ser cobrada ate a comissao daquele pedido:
 *   a Stripe NAO tem debito de conta conectada no Brasil ("Account debits are
 *   not supported from BR to BR", testado no sandbox em 25/10). Quando taxa +
 *   custos passam da comissao (lote abaixo de ~R$ 160 com etiqueta de
 *   R$ 19,90), a diferenca sai em `faltaCobrirCents`: quem chama decide (hoje:
 *   registrar e avisar; cobranca na proxima venda depende do Du).
 *
 * ★ PLANOS (cobranca direta, sem loja). Nao ha comissao para reter: o unico
 *   lugar onde a taxa pode sair e o proprio valor estornado.
 *   `estornoMaximoSemPrejuizo` da o teto. Use SO onde a lei nao exige
 *   devolucao integral (fora dos 7 dias do art. 49 do CDC).
 *
 * Tudo em centavos inteiros. Entrada invalida (NaN, negativo) vira 0.
 */

function c(v: number | null | undefined): number {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export interface PlanoComissao {
  /** Quanto da comissao devolver a loja NESTE estorno (ApplicationFee refund). */
  devolverCents: number
  /** Quanto da comissao a Bynx segura ao fim deste estorno (cumulativo). */
  retidoCents: number
  /** Parte dos custos que a comissao nao cobre: prejuizo se ninguem cobrar. */
  faltaCobrirCents: number
}

/**
 * Quanto da comissao (application fee) volta para a loja num estorno.
 *
 *   - Ponto de partida: a proporcao do estorno (o que ja valia, #437):
 *     estorno de 50% devolve 50% da comissao.
 *   - Teto: a Bynx fica com pelo menos taxa da Stripe + custos extras. O
 *     total devolvido (este estorno + os anteriores) nunca passa de
 *     comissao - taxa - custos.
 *   - Cumulativo: `jaDevolvidoCents` e o `amount_refunded` da ApplicationFee
 *     (estornos parciais anteriores). Este estorno so devolve a diferenca.
 */
export function comissaoADevolver(a: {
  /** Valor cobrado do comprador (charge.amount). */
  cobradoCents: number
  /** application_fee_amount da cobranca. */
  comissaoCents: number
  /** Taxa REAL da Stripe na cobranca (balance_transaction.fee). */
  taxaStripeCents: number
  /** Valor estornado ao comprador ACUMULADO, incluindo este estorno. */
  estornadoTotalCents: number
  /** Comissao ja devolvida a loja antes deste estorno (ApplicationFee.amount_refunded). */
  jaDevolvidoCents: number
  /** Custos que a Bynx paga por causa do estorno (etiqueta reversa). Default 0. */
  custosExtrasCents?: number
}): PlanoComissao {
  const cobrado = c(a.cobradoCents)
  const comissao = c(a.comissaoCents)
  const taxa = c(a.taxaStripeCents)
  const extras = c(a.custosExtrasCents)
  const estornado = Math.min(c(a.estornadoTotalCents), cobrado)
  const jaDevolvido = Math.min(c(a.jaDevolvidoCents), comissao)

  const proporcional = cobrado > 0 ? Math.floor((comissao * estornado) / cobrado) : 0
  const teto = Math.max(0, comissao - taxa - extras)
  const alvoTotal = Math.min(proporcional, teto)
  const devolver = Math.max(0, alvoTotal - jaDevolvido)
  return {
    devolverCents: devolver,
    retidoCents: comissao - jaDevolvido - devolver,
    faltaCobrirCents: Math.max(0, taxa + extras - comissao),
  }
}

/**
 * Cobranca direta (plano, Master Set): o maior estorno que nao deixa a Bynx
 * negativa = cobrado - taxa da Stripe - o que ja foi estornado. Use so quando
 * o estorno integral nao e obrigacao legal.
 */
export function estornoMaximoSemPrejuizo(a: {
  cobradoCents: number
  taxaStripeCents: number
  jaEstornadoCents: number
}): number {
  return Math.max(0, c(a.cobradoCents) - c(a.taxaStripeCents) - c(a.jaEstornadoCents))
}

/**
 * Resultado da Bynx numa venda de loja depois do(s) estorno(s): comissao que
 * ficou menos taxa da Stripe menos custos extras. O que o lancamento do
 * financeiro deve mostrar (pode ser negativo quando ha `faltaCobrir`).
 */
export function resultadoBynxCents(a: {
  comissaoCents: number
  comissaoDevolvidaCents: number
  taxaStripeCents: number
  custosExtrasCents?: number
}): number {
  return c(a.comissaoCents) - c(a.comissaoDevolvidaCents) - c(a.taxaStripeCents) - c(a.custosExtrasCents)
}
