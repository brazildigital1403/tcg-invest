/**
 * Leituras de status de pedido que o COMPRADOR ve, num lugar so.
 *
 * ★ POR QUE EXISTE (12/09/2026). Desde o c4eabab o webhook cancela o pedido
 * cuja sessao de checkout venceu sem pagamento. Esse pedido tem status
 * `cancelado`, e as duas telas do comprador trataram ele como se fosse um
 * cancelamento com dinheiro envolvido: o /compras punha na aba "Reembolsados"
 * e o /pedido/[id] dizia "se tiver duvida, fale com a loja". Nos dois casos e
 * falso -- ninguem foi cobrado e a loja nao fez nada.
 *
 * ★ O SINAL E `pago_em`, NAO `cancelado_por`. "Nada foi cobrado" so e verdade
 * se o pedido nunca foi pago, qualquer que seja o caminho que o cancelou.
 */

type PedidoMin = { status: string; pago_em: string | null }

/** Pedido encerrado: cancelado ou reembolsado. */
export function pedidoEncerrado(p: { status: string }): boolean {
  return p.status === 'cancelado' || p.status === 'reembolsado'
}

/** Cancelado sem nunca ter sido pago: checkout abandonado. */
export function canceladoSemCobranca(p: PedidoMin): boolean {
  return p.status === 'cancelado' && !p.pago_em
}

/**
 * Pedido ainda em curso. A contagem da aba e o filtro da lista LEEM DAQUI --
 * antes eram duas listas a mao e divergiam: o numero ignorava
 * `aguardando_pagamento` e a lista mostrava.
 */
export const STATUS_EM_ANDAMENTO = ['aguardando_pagamento', 'pago', 'enviado'] as const
export function pedidoEmAndamento(p: { status: string }): boolean {
  return (STATUS_EM_ANDAMENTO as readonly string[]).includes(p.status)
}
