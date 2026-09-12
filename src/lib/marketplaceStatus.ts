/**
 * Os status de um anuncio do marketplace, num lugar so.
 *
 * ★ POR QUE ISTO EXISTE (08/09/2026): a mesma lista de "status encerrado"
 * estava cravada a mao em 6 lugares -- `marketplace/page.tsx` (5 filtros) e
 * `cron-mensagens-nao-lidas/route.ts` -- e as 6 divergiam no MESMO ponto:
 * nenhuma incluia `vendido`. Efeito medido: anuncio ja pago e entregue pelo
 * Connect continuava contando como negociacao ABERTA pro vendedor, e o cron
 * seguia mandando email de mensagem nao lida daquela conversa.
 *
 * E a mesma licao de `numero-cravado-na-ui-envelhece`: a mesma conta em dois
 * lugares sempre diverge. Aqui ja divergiu.
 */

/** Terminal: a negociacao acabou, de um jeito ou de outro. */
export const STATUS_ENCERRADOS = ['concluido', 'cancelado', 'vendido'] as const

/**
 * O anuncio esta travado com um comprador e PODE voltar sozinho.
 *
 * ★ `enviado` fica FORA de proposito. O vendedor afirmou que postou a carta;
 * devolver a vitrine seria anunciar algo que esta nos Correios e convidar uma
 * segunda venda. Caso real: Rocket's Zapdos R$ 259, 13 mensagens, parado em
 * `enviado` por 49 dias -- resolvido na mao com o lojista, nunca por rotina.
 */
export const STATUS_EXPIRAVEIS = ['reservado', 'em_negociacao'] as const

/** Travado com comprador, expiravel ou nao. Serve pra UI, nao pra expiracao. */
export const STATUS_EM_NEGOCIACAO = ['reservado', 'em_negociacao', 'enviado'] as const

/**
 * O anuncio OCUPA UMA VAGA do plano: esta no ar ou travado com um comprador.
 *
 * ★ Lista POSITIVA de proposito. O `checkMarketplaceLimit` era o 7o lugar com
 * a lista cravada a mao, escrita como negacao (`not in (cancelado, concluido)`)
 * -- e divergia no mesmo ponto de sempre, `vendido`, que assim ocupava vaga pra
 * sempre depois de uma venda concluida pelo Connect.
 *
 * ★ E vaga so conta anuncio VIVO: quem le isto tem que filtrar
 * `removido_em is null` junto. Medido em 12/09: 2 usuarios do plano Gratis
 * estavam impedidos de anunciar por anuncios que eles PROPRIOS removeram --
 * um deles com 7 removidos desde 25/08 e nenhum no ar.
 */
export const STATUS_OCUPAM_VAGA = ['disponivel', 'reservado', 'em_negociacao', 'enviado'] as const

/**
 * Quanto tempo um anuncio pode ficar parado antes de voltar pro marketplace.
 *
 * ★ 72h, e o numero saiu dos dados, nao de chute. Em 08/09 os travados
 * estavam parados ha 2.164h, 1.624h, 807h e 175h; o unico vivo, ha 31h --
 * uma negociacao de R$ 1.900 com mensagem de dois dias atras. Qualquer corte
 * entre 3 e 7 dias separa os dois grupos; 72h fica no meio, com folga de dias
 * de cada lado. 24h passaria RASPANDO na de R$ 1.900 e dependeria do fuso.
 *
 * Referencia externa na mesma direcao: o eBay subiu o prazo de resposta a
 * contraoferta de 24h pra 96h em marco de 2026.
 */
export const HORAS_ATE_LIBERAR = 72

/** Faixa final: a UI muda de tom e o selo vira "Libera hoje". */
export const HORAS_RETA_FINAL = 12

export type StatusAnuncio = string | null | undefined

export function estaEncerrado(status: StatusAnuncio): boolean {
  return STATUS_ENCERRADOS.includes(String(status || '') as never)
}

export function podeExpirar(status: StatusAnuncio): boolean {
  return STATUS_EXPIRAVEIS.includes(String(status || '') as never)
}

/**
 * Quando este anuncio volta pro marketplace, em ISO — ou `null` se ele nao
 * esta na fila de expirar.
 *
 * `statusEm` e o carimbo do trigger `trg_marketplace_status_em`; e o unico
 * relogio confiavel, porque o cliente nao consegue forja-lo (o trigger
 * descarta o valor que vier do UPDATE quando o status nao muda).
 */
export function liberaEm(status: StatusAnuncio, statusEm: string | null): string | null {
  if (!podeExpirar(status) || !statusEm) return null
  const base = new Date(statusEm).getTime()
  if (!Number.isFinite(base)) return null
  return new Date(base + HORAS_ATE_LIBERAR * 3600_000).toISOString()
}
