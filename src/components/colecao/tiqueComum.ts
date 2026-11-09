/**
 * Tipos e regras puras da grade de tique (Buscar e Por set).
 *
 * Tudo aqui e funcao sem estado, para a conta de vagas e a resolucao de
 * variante/idioma serem testaveis fora do React. A UI (GradeTique e as
 * folhas) so le daqui; nunca decide regra sozinha.
 */

import { CAMPO_VALOR, getPrecoVariante } from '@/lib/calcPatrimonio'
import type { CardPrice } from '@/components/ui/CardItem'

// ── Contrato (espelha ESPEC-BUILD.md) ────────────────────────────────────────

export type PilhaCarta = { id: string; variante: string; idioma: string; quantity: number }

export type CartaTique = {
  card_id: string
  nome: string
  numero: string | null
  set_id: string | null
  set_name: string | null
  image_small: string | null
  raridade: string | null
  valor: number
  precos: { normal?: number | null; foil?: number | null; reverse?: number | null; promo?: number | null; pokeball?: number | null }
  /** Linhas do usuario em user_cards para este card_id. Vazio = nao tenho. */
  pilhas: PilhaCarta[]
}

export type PadraoLote = { variante: string; idioma: string }

/** Ajuste por carta. Objeto vazio = segue o padrao do lote. */
export type AjusteCarta = { variante?: string; idioma?: string; quantity?: number }

export type ItemLote = { card_id: string; variante: string; idioma: string; quantity: number }

export type ResultadoLote = {
  entraram: { id: string; card_id: string; variante: string; idioma: string; quantity: number }[]
  somadas: { id: string; card_id: string; quantity: number }[]
  recusadas: string[]
  ignorados: string[]
  limite: number
  total_agora: number
}

/** limite -1 = sem limite; totalAtual = linhas em user_cards hoje. */
export type PlanoTique = { limite: number; totalAtual: number }

export const PADRAO_INICIAL: PadraoLote = { variante: 'normal', idioma: 'pt' }

// ── Variantes e idiomas ──────────────────────────────────────────────────────

// Rotulo "Holo" para foil: e como o wireframe aprovado e o colecionador
// chamam; a chave no banco continua 'foil'.
export const VARIANTES: { key: string; label: string }[] = [
  { key: 'normal', label: 'Normal' },
  { key: 'reverse', label: 'Reverse' },
  { key: 'foil', label: 'Holo' },
  { key: 'promo', label: 'Promo' },
  { key: 'pokeball', label: 'Pokeball' },
]

export const IDIOMAS_PRINCIPAIS = ['pt', 'en', 'jp', 'es', 'fr']
export const IDIOMAS_OUTROS: { key: string; label: string }[] = [
  { key: 'de', label: 'Alemão' },
  { key: 'it', label: 'Italiano' },
  { key: 'cn', label: 'Chinês' },
  { key: 'kr', label: 'Coreano' },
]

export function rotuloVariante(v: string): string {
  return VARIANTES.find(x => x.key === v)?.label || v
}

export const fmtBRL = (v: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

const num = (v: unknown): number => {
  const f = parseFloat(String(v))
  return isNaN(f) || f <= 0 ? 0 : f
}

// ── Preco ────────────────────────────────────────────────────────────────────

/**
 * Converte `precos` (um numero por variante) para o formato de colunas que
 * `CardItem` e `getPrecoVariante` leem. Cada variante replica o mesmo numero
 * em min/medio/max porque a RPC so devolve o menor preco; assim CAMPO_VALOR
 * acha o campo seja qual for a regra do dia.
 */
export function precosParaCardPrice(precos: CartaTique['precos'] | null | undefined, valor: number): CardPrice {
  const r: Record<string, number> = {}
  const poe = (base: string, v: number) => { if (v > 0) { r[`${base}_min`] = v; r[`${base}_medio`] = v; r[`${base}_max`] = v } }
  poe('preco', num(precos?.normal) || num(valor))
  poe('preco_foil', num(precos?.foil))
  poe('preco_reverse', num(precos?.reverse))
  poe('preco_promo', num(precos?.promo))
  poe('preco_pokeball', num(precos?.pokeball))
  return r as CardPrice
}

/** A carta tem preco nesta variante? Normal aceita o `valor` como reserva. */
export function temPrecoVariante(carta: CartaTique, variante: string): boolean {
  if (variante === 'normal') return num(carta.precos?.normal) > 0 || num(carta.valor) > 0
  const p = carta.precos as Record<string, number | null | undefined> | undefined
  return num(p?.[variante]) > 0
}

export function temAlgumPreco(carta: CartaTique): boolean {
  return VARIANTES.some(v => temPrecoVariante(carta, v.key))
}

/**
 * Variante que realmente entra: a escolhida, se a carta tem preco nela. Se a
 * carta tem preco em alguma variante mas nao nessa, ela nao existe assim no
 * catalogo e cai para normal (quadro 06: "entra como Normal e voce ve a
 * pilula"). Carta sem preco nenhum aceita qualquer variante.
 */
export function varianteEfetiva(carta: CartaTique | undefined, variante: string): string {
  if (!carta || variante === 'normal') return variante
  if (!temAlgumPreco(carta)) return variante
  return temPrecoVariante(carta, variante) ? variante : 'normal'
}

export function resolverItem(cardId: string, ajuste: AjusteCarta, padrao: PadraoLote, carta?: CartaTique): ItemLote {
  const variante = varianteEfetiva(carta, ajuste.variante ?? padrao.variante)
  const idioma = (ajuste.idioma ?? padrao.idioma).toLowerCase()
  const quantity = Math.max(1, Math.floor(ajuste.quantity ?? 1))
  return { card_id: cardId, variante, idioma, quantity }
}

/** Valor unitario da carta na variante (Mercado Brasileiro). 0 quando nao ha preco. */
export function precoUnitario(carta: CartaTique | undefined, variante: string): number {
  if (!carta) return 0
  const faixa = getPrecoVariante(precosParaCardPrice(carta.precos, carta.valor), variante)
  const v = faixa[CAMPO_VALOR]
  return v > 0 ? v : num(carta.valor)
}

// ── Pilhas e vagas ───────────────────────────────────────────────────────────

/** A pilha do usuario que casa com variante + idioma do item (e a que o banco somaria). */
export function pilhaCasada(carta: CartaTique, item: ItemLote): PilhaCarta | null {
  return carta.pilhas.find(p => (p.variante || 'normal') === item.variante && (p.idioma || 'pt').toLowerCase() === item.idioma) || null
}

/**
 * Gasta vaga quando vira linha nova em user_cards. Carta desconhecida (fora
 * da tela e nunca vista) conta como vaga, por seguranca.
 */
export function gastaVaga(carta: CartaTique | undefined, item: ItemLote): boolean {
  if (!carta) return true
  return !pilhaCasada(carta, item)
}

export function totalTenho(carta: CartaTique): number {
  return carta.pilhas.reduce((s, p) => s + (p.quantity || 0), 0)
}

/** Texto da pilula na carta: so o que foge do padrao ("Holo · EN", "x3"). */
export function pilulaDe(item: ItemLote, padrao: PadraoLote): string | null {
  const partes: string[] = []
  if (item.variante !== padrao.variante) partes.push(rotuloVariante(item.variante))
  if (item.idioma !== padrao.idioma.toLowerCase()) partes.push(item.idioma.toUpperCase())
  if (item.quantity > 1) partes.push(`x${item.quantity}`)
  return partes.length ? partes.join(' · ') : null
}

/** A pessoa mexeu em variante ou idioma desta carta a mao (quadro 06 preserva). */
export function ajustadaAMao(ajuste: AjusteCarta): boolean {
  return ajuste.variante !== undefined || ajuste.idioma !== undefined
}

export type Vagas = {
  semLimite: boolean
  limite: number
  totalAtual: number
  /** Marcadas que viram linha nova. */
  gastam: number
  /** Marcadas que so somam copia em pilha existente. */
  somam: number
  usadasDepois: number
  /** Infinity quando sem limite. */
  restantes: number
  travado: boolean
  alerta: 'ok' | 'perto' | 'travado'
}

/**
 * Vagas = limite - totalAtual - (marcadas que gastam vaga). Pura e testavel.
 * `padrao` resolve variante/idioma das marcadas sem ajuste; sem ele assume
 * Normal · PT.
 */
export function calcularVagas(plano: PlanoTique, selecao: Map<string, AjusteCarta>, cartas: CartaTique[], padrao: PadraoLote = PADRAO_INICIAL): Vagas {
  const mapa = new Map(cartas.map(c => [c.card_id, c]))
  let gastam = 0
  let somam = 0
  selecao.forEach((ajuste, id) => {
    const carta = mapa.get(id)
    const item = resolverItem(id, ajuste, padrao, carta)
    if (gastaVaga(carta, item)) gastam++
    else somam++
  })
  const semLimite = plano.limite < 0
  const usadasDepois = plano.totalAtual + gastam
  const restantes = semLimite ? Infinity : Math.max(0, plano.limite - usadasDepois)
  const travado = !semLimite && plano.limite - usadasDepois <= 0
  // Ambar a 10 do fim: no Gratis (100) e o "a partir de 90" do wireframe.
  const alerta: Vagas['alerta'] = travado ? 'travado' : !semLimite && restantes <= 10 ? 'perto' : 'ok'
  return { semLimite, limite: plano.limite, totalAtual: plano.totalAtual, gastam, somam, usadasDepois, restantes, travado, alerta }
}

export function numeroESet(carta: CartaTique): string {
  return [carta.numero, carta.set_name].filter(Boolean).join(' · ')
}
