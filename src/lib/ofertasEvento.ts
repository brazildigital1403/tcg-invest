// src/lib/ofertasEvento.ts
//
// Ofertas de EVENTO (anuncio geolocalizado -> landing -> cadastro -> checkout
// com cupom aplicado pelo servidor, sem periodo gratis). PURO: sem import de
// servidor, usado pelas landings (client), pelo AuthModal, pelo pos-cadastro e
// pela rota /api/stripe/checkout.
//
// ★ Por que uma lista (Quadro #321): a TCG CON (13/09/2026) nasceu com codigo,
// prazo e preco cravados em src/lib/ofertaTcgcon.ts, e o checkout, o
// pos-cadastro e o AuthModal tinham um ramo so para ela. A Poke Fan Fest 4
// (17-18/10/2026) e o segundo evento: a regra passa a viver aqui, por id, e os
// tres pontos leem a mesma entrada. Oferta nova = uma entrada nova nesta lista
// + uma landing. O cupom na Stripe LIVE e criado pelo Du com o mesmo codigo,
// mesma expiracao e "so primeiro pedido".
//
// A oferta Presente (convite pessoal por e-mail, token) NAO esta aqui: ela tem
// o convite como condicao e vive em src/lib/ofertaPresente.ts.

export type PlanoOferta = 'anual' | 'mensal' | 'plus'

/** Preco cheio dos planos de usuario (o mesmo da /planos e do checkout). */
export const PRECO_CHEIO: Record<PlanoOferta, number> = { anual: 249, mensal: 29.9, plus: 14.9 }

export const NOME_PLANO: Record<PlanoOferta, string> = { anual: 'Pro Anual', mensal: 'Pro', plus: 'Plus' }

export interface OfertaEvento {
  id: string
  /** Promotion code na Stripe LIVE (digitavel tambem no checkout normal ate o prazo). */
  codigo: string
  evento: string
  eventoCurto: string
  local: string
  cidade: string
  /** Rota da landing; e para onde o pos-cadastro volta se o checkout falhar. */
  landing: string
  /** Fecha neste instante (Brasilia). O promotion code expira na Stripe no mesmo horario. */
  fimISO: string
  /** Conta criada a partir daqui conta como "criada pela oferta" (perde o trial). */
  inicioContasISO: string
  descontoPct: number
  planos: readonly PlanoOferta[]
  /** Como a oferta fecha, em texto, para modal e e-mail de confirmacao. */
  fechaTexto: string
}

export const OFERTAS_EVENTO = {
  tcgcon: {
    id: 'tcgcon',
    codigo: 'TCGCON30',
    evento: 'TCG CON 2026',
    eventoCurto: 'TCG CON',
    local: 'TCG CON 2026',
    cidade: 'São Paulo',
    landing: '/tcgcon',
    fimISO: '2026-09-13T23:59:59-03:00',
    inicioContasISO: '2026-09-13T00:00:00-03:00',
    descontoPct: 30,
    planos: ['anual'],
    fechaTexto: 'hoje, às 23h59',
  },
  pokefanfest: {
    id: 'pokefanfest',
    codigo: 'POKEFAN50',
    evento: 'Poke Fan Fest 4',
    eventoCurto: 'Poke Fan Fest',
    local: 'Centro de Eventos UPX, Universidade Positivo',
    cidade: 'Curitiba',
    landing: '/pokefanfest',
    fimISO: '2026-10-18T23:59:59-03:00',
    inicioContasISO: '2026-10-17T00:00:00-03:00',
    descontoPct: 50,
    planos: ['anual', 'mensal', 'plus'],
    fechaTexto: 'domingo, 18/10, às 23h59',
  },
} as const satisfies Record<string, OfertaEvento>

export type OfertaEventoId = keyof typeof OFERTAS_EVENTO

export function ehOfertaEvento(v: unknown): v is OfertaEventoId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(OFERTAS_EVENTO, v)
}

export function ofertaEvento(id: OfertaEventoId): OfertaEvento {
  return OFERTAS_EVENTO[id]
}

export function ofertaEventoAtiva(id: OfertaEventoId, agora: number = Date.now()): boolean {
  return agora <= Date.parse(OFERTAS_EVENTO[id].fimISO)
}

export function ehPlanoDaOferta(id: OfertaEventoId, plano: unknown): plano is PlanoOferta {
  return (OFERTAS_EVENTO[id].planos as readonly string[]).includes(String(plano))
}

export function precoComDesconto(cheio: number, descontoPct: number): number {
  return Math.round(cheio * (100 - descontoPct)) / 100
}

export const brlOferta = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** "Pro Anual · R$ 124,50 no 1º ano" / "Pro · R$ 14,95 no 1º mês". */
export function rotuloPlanoOferta(plano: PlanoOferta, id: OfertaEventoId): string {
  const o = OFERTAS_EVENTO[id]
  const preco = precoComDesconto(PRECO_CHEIO[plano], o.descontoPct)
  return `${NOME_PLANO[plano]} · R$ ${brlOferta(preco)} ${plano === 'anual' ? 'no 1º ano' : 'no 1º mês'}`
}
