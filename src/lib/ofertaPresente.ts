// src/lib/ofertaPresente.ts
//
// Campanha "Presente" (e-mail pros leads do formulario Meta, set/2026).
// PURO: sem import de servidor, usado pela landing /presente (client) e pelas
// rotas /api/presente/* e /api/stripe/checkout.
//
// Regras:
//   - 50% na 1a cobranca dos planos de usuario (Plus, Pro mensal, Pro Anual).
//     O cupom na Stripe tambem cobre os planos de loja, mas o checkout de loja
//     exige loja cadastrada e ainda nao aceita a oferta.
//   - promotion code PRESENTE50: so primeiro pedido, 100 usos, expira no mesmo
//     horario da landing. O servidor recusa antes disso tambem.
//   - o link do e-mail leva so um token (campanha_convites.token). Nome e e-mail
//     nunca entram na URL.

export const OFERTA_PRESENTE = {
  id: 'presente',
  campanha: 'presente-2026-09',
  codigo: 'PRESENTE50',
  fimISO: '2026-09-18T23:59:59-03:00',
  descontoPct: 50,
} as const

export type PlanoPresente = 'anual' | 'mensal' | 'plus'

/** Ordem de exibicao: o Pro Anual vem marcado (sem salto de preco no mes 2). */
export const PLANOS_PRESENTE: {
  id: PlanoPresente
  nome: string
  raridade: string
  estrelas: number
  descricao: string
  cheio: number
  periodo: 'ano' | 'mês'
}[] = [
  { id: 'anual', nome: 'Pro Anual', raridade: 'Rara secreta', estrelas: 3, descricao: 'Tudo liberado por 12 meses, com Master Sets e Páginas Lendárias', cheio: 249, periodo: 'ano' },
  { id: 'mensal', nome: 'Pro', raridade: 'Ultra rara', estrelas: 2, descricao: 'Scan e coleção ilimitados, mês a mês', cheio: 29.9, periodo: 'mês' },
  { id: 'plus', nome: 'Plus', raridade: 'Rara', estrelas: 1, descricao: 'Até 500 cartas e dashboard', cheio: 14.9, periodo: 'mês' },
]

export function precoPresente(cheio: number): number {
  return Math.round(cheio * (100 - OFERTA_PRESENTE.descontoPct)) / 100
}

export function ofertaPresenteAtiva(agora: number = Date.now()): boolean {
  return agora <= Date.parse(OFERTA_PRESENTE.fimISO)
}

export function ehPlanoPresente(v: unknown): v is PlanoPresente {
  return v === 'anual' || v === 'mensal' || v === 'plus'
}

/** Etapas que o navegador pode carimbar. As outras sao carimbadas so pelo servidor. */
export const ETAPAS_CLIENTE = ['presente_aberto'] as const
export type EtapaCliente = (typeof ETAPAS_CLIENTE)[number]

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function ehTokenValido(v: unknown): v is string {
  return typeof v === 'string' && TOKEN_RE.test(v)
}
