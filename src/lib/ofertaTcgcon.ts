// src/lib/ofertaTcgcon.ts
//
// Oferta de evento da TCG CON 2026 (13/09/2026). PURO: sem import de servidor,
// usado pela landing /tcgcon (client) e pela rota /api/stripe/checkout.
//
// Regras:
//   - so Pro Anual, 30% na 1a cobranca (cupom da Stripe restrito ao produto anual)
//   - sem periodo gratis: a conta criada pela oferta perde o trial reverso
//   - fecha 23h59 de Brasilia. O promotion code expira na Stripe no mesmo horario,
//     e o servidor recusa antes disso tambem — as duas travas batem.
//
// O codigo TCGCON30 continua digitavel no checkout normal (decisao do Du): quem
// nao conseguir fechar pela landing ainda usa ate 23h59.

export const OFERTA_TCGCON = {
  id: 'tcgcon',
  codigo: 'TCGCON30',
  fimISO: '2026-09-13T23:59:59-03:00',
  /** Desde quando uma conta conta como "criada pela oferta" (perde o trial). */
  inicioContasISO: '2026-09-13T00:00:00-03:00',
  precoCheio: 249,
  precoOferta: 174.3,
  descontoPct: 30,
} as const

// ★ 17/10/2026: o tipo e o validador de oferta passaram a cobrir TODAS as
// ofertas de evento (src/lib/ofertasEvento.ts). Este arquivo segue como a
// regra da landing /tcgcon, que ja fechou.
export type { OfertaEventoId as OfertaId } from './ofertasEvento'
export { ehOfertaEvento as ehOfertaValida } from './ofertasEvento'

export function ofertaTcgconAtiva(agora: number = Date.now()): boolean {
  return agora <= Date.parse(OFERTA_TCGCON.fimISO)
}

