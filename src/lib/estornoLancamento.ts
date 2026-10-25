/**
 * Valor que sobra no lancamento de receita depois de um estorno (webhook
 * charge.refunded). Funcao pura, coberta por scripts/reclamacao-selftest.mjs.
 *
 * ★ POR QUE EXISTE: o webhook aplicava a fracao que sobra
 *   (1 - amount_refunded / amount) sobre o `valor_bruto` JA REDUZIDO pelo
 *   estorno anterior. `amount_refunded` e CUMULATIVO na Stripe, entao o
 *   segundo estorno parcial reduzia duas vezes (100 -> 50% -> 25% em vez de
 *   100 -> 50% -> 0% num 50% + 50%, ou 30% + 20% virando 56% em vez de 50%).
 *
 * A base agora e o valor ORIGINAL, lido da propria charge:
 *   - destination charge (venda de loja/leilao/carrinho): o lancamento e a
 *     taxa da Bynx = `application_fee_amount`, que a Stripe nao altera no
 *     estorno (a devolucao da taxa vira ApplicationFee.amount_refunded);
 *   - cobranca direta (assinatura, Master Set, produto proprio): o
 *     lancamento e o valor cobrado = `amount`.
 * ★ 25/10/2026 (regra de custo do estorno, lib/custoEstorno): a comissao
 *   deixou de voltar na proporcao do estorno. Quando o webhook sabe quanto da
 *   ApplicationFee voltou de fato (`comissaoDevolvidaCents`, lido da Stripe),
 *   o lancamento fica com a comissao MENOS o devolvido -- o que a Bynx reteve
 *   para pagar a taxa. Sem esse dado, segue a proporcao (estorno feito no
 *   dashboard, cobranca direta).
 * O resultado nunca SOBE acima do valor atual (`atualReais`): evento antigo
 * reentregue fora de ordem, ou base que nao bate com o lancamento, nao
 * devolve receita que ja foi estornada.
 */
export function valorLancamentoAposEstorno(args: {
  amount: number
  amountRefunded: number
  applicationFeeAmount: number | null | undefined
  atualReais: number
  /** ApplicationFee.amount_refunded, quando lido da Stripe (destination charge). */
  comissaoDevolvidaCents?: number | null
}): number {
  const atualR = Number(args.atualReais)
  const fee = args.applicationFeeAmount
  if (fee != null && fee > 0 && args.comissaoDevolvidaCents != null) {
    const retido = Math.max(0, fee - Math.max(0, args.comissaoDevolvidaCents)) / 100
    return Number.isFinite(atualR) ? Math.min(retido, atualR) : retido
  }
  const bruto = Math.max(0, args.amount || 0)
  const devolvido = Math.max(0, args.amountRefunded || 0)
  const fracaoQueSobra = bruto > 0 ? Math.max(0, 1 - devolvido / bruto) : 0
  const baseCents = args.applicationFeeAmount != null && args.applicationFeeAmount > 0 ? args.applicationFeeAmount : bruto
  const novo = Math.round(baseCents * fracaoQueSobra) / 100
  const atual = Number(args.atualReais)
  return Number.isFinite(atual) ? Math.min(novo, atual) : novo
}
