/**
 * ★ FONTE ÚNICA do valor de uma carta na Bynx.
 *
 * Este arquivo já existia desde abril se declarando "função centralizada",
 * mas NUNCA foi importado por ninguém. Enquanto isso, a mesma conta foi
 * reescrita **8 vezes em TypeScript e 6 vezes em SQL** -- e as cópias
 * divergiram:
 *
 *   - graduada: o "PATRIMÔNIO" do topo usa `valor_graduada`; os RPCs de pasta
 *     e o cron-portfolio ignoram. Resultado medido em 25/08/2026: um Machamp
 *     graduado valia R$ 9.500 no topo e R$ 320 nos RPCs, na mesma conta.
 *   - fallback USD/EUR: existia em 7 telas, em nenhum RPC.
 *   - fallback de variante: cada cópia com uma regra.
 *
 * Agora é aqui. Quem precisar de valor de carta importa daqui.
 *
 * ★★ A REGRA DE VALOR VIVE EM `CAMPO_VALOR` (abaixo). Trocar o valor de
 * divulgação da plataforma inteira é trocar aquela constante -- não é sair
 * caçando `preco_medio` em 40 arquivos de novo.
 */

// ─────────────────────────────────────────────────────────────────────────────
// A REGRA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Qual dos três valores da faixa é "o valor" da carta na Bynx.
 *
 * 'medio' = média das ofertas (regra histórica)
 * 'min'   = menor oferta — quem compra pela Liga leva pelo menor
 *
 * A faixa completa (min/médio/máx) continua sendo exibida onde faz sentido
 * mostrar dispersão (página de carta, coleção); esta constante governa o
 * número ÚNICO que representa a carta: patrimônio, título, e-mail, ranking.
 */
export const CAMPO_VALOR: 'min' | 'medio' | 'max' = 'min'

// ─────────────────────────────────────────────────────────────────────────────

const EXTRAS_VARIANTE: Record<string, { min: string; medio: string; max: string }> = {
  normal:   { min: 'preco_min',          medio: 'preco_medio',          max: 'preco_max' },
  foil:     { min: 'preco_foil_min',     medio: 'preco_foil_medio',     max: 'preco_foil_max' },
  promo:    { min: 'preco_promo_min',    medio: 'preco_promo_medio',    max: 'preco_promo_max' },
  reverse:  { min: 'preco_reverse_min',  medio: 'preco_reverse_medio',  max: 'preco_reverse_max' },
  pokeball: { min: 'preco_pokeball_min', medio: 'preco_pokeball_medio', max: 'preco_pokeball_max' },
}

/**
 * As colunas de `pokemon_cards` que esta biblioteca consulta.
 *
 * Quem faz `select` direto no banco (rotas de API, crons) precisa pedir estas
 * — senão a cascata cai em degraus que não existem no payload e o valor sai
 * menor sem erro nenhum. Foi o caso do cron-portfolio, que selecionava só as
 * `_medio` e por isso nunca batia com o "PATRIMÔNIO" do topo.
 *
 * O `/api/cards/lookup` já devolve tudo isto (ver CARD_FIELDS lá), então quem
 * passa por ele não precisa se preocupar.
 */
export const COLUNAS_PRECO =
  'id, ' +
  'preco_min, preco_medio, preco_max, ' +
  'preco_foil_min, preco_foil_medio, preco_foil_max, ' +
  'preco_promo_min, preco_promo_medio, preco_promo_max, ' +
  'preco_reverse_min, preco_reverse_medio, preco_reverse_max, ' +
  'preco_pokeball_min, preco_pokeball_medio, preco_pokeball_max, ' +
  'price_usd_normal, price_usd_holofoil, price_eur_normal, price_eur_holofoil'

export type FaixaPreco = { min: number; medio: number; max: number }

export type CartaDoUsuario = {
  pokemon_api_id?: string | null
  card_id?: string | null
  /** Fallback de quem entrou na coleção antes do vínculo por id existir. */
  card_link?: string | null
  card_name?: string | null
  variante?: string | null
  quantity?: number | null
  graduada?: boolean | null
  valor_graduada?: number | null
}

/**
 * Resolve a carta do catálogo. Tenta id, depois `card_link` — 69 das 5.110
 * cartas na base não têm `pokemon_api_id` e só chegam pelo link.
 * Nunca por nome: nome é ambíguo em 79% do catálogo.
 */
export function acharPreco(carta: CartaDoUsuario, priceMap: Record<string, any>): any {
  if (!carta || !priceMap) return null
  const id = carta.pokemon_api_id || carta.card_id
  if (id && priceMap[id]) return priceMap[id]
  if (carta.card_link && priceMap[carta.card_link]) return priceMap[carta.card_link]
  return null
}

export type Cotacoes = { usd?: number; eur?: number }

/** Sempre positivo e numérico; string vazia, null e NaN viram 0. */
function num(v: any): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Faixa (min/médio/máx) da variante pedida.
 *
 * Se a variante não tem preço próprio, cai para o normal — é o caso de 27
 * cartas foil na base hoje, que ficariam zeradas sem isso.
 *
 * O teste de "tem preço" usa `CAMPO_VALOR`, não `medio` fixo: senão, ao virar
 * a regra para mínimo, a escolha de variante continuaria decidida por um
 * número que ninguém mais exibe.
 */
/**
 * `fallbackNormal: false` devolve a variante crua, sem cair pro normal.
 *
 * Não é capricho: a Coleção decidiu de propósito **respeitar a escolha do
 * usuário e nunca sobrescrevê-la** — se ele marcou foil e não há preço foil,
 * mostrar o preço do normal seria dizer que a foil dele vale o que a comum
 * vale. As telas de patrimônio agregado fazem o oposto (preferem um valor
 * aproximado a um zero), e as duas posturas são defensáveis.
 *
 * Fica como opção explícita em vez de virar duas implementações de novo.
 */
export type OpcoesPreco = { fallbackNormal?: boolean }

export function getPrecoVariante(price: any, variante: string, opts?: OpcoesPreco): FaixaPreco {
  if (!price) return { min: 0, medio: 0, max: 0 }

  const fields = EXTRAS_VARIANTE[variante] || EXTRAS_VARIANTE.normal
  const faixa: FaixaPreco = {
    min:   num(price[fields.min]),
    medio: num(price[fields.medio]),
    max:   num(price[fields.max]),
  }

  const cair = opts?.fallbackNormal !== false
  if (cair && faixa[CAMPO_VALOR] === 0 && variante !== 'normal') {
    return {
      min:   num(price.preco_min),
      medio: num(price.preco_medio),
      max:   num(price.preco_max),
    }
  }
  return faixa
}

/** A variante salva, se tiver preço; senão a primeira que tiver. */
export function getVarianteEfetiva(price: any, varianteSalva?: string | null): string {
  const salva = varianteSalva || 'normal'
  if (!price) return salva

  const fields = EXTRAS_VARIANTE[salva]
  if (fields && num(price[fields[CAMPO_VALOR]]) > 0) return salva

  for (const [key, f] of Object.entries(EXTRAS_VARIANTE)) {
    if (num(price[f[CAMPO_VALOR]]) > 0) return key
  }
  return 'normal'
}

/**
 * ★ O valor unitário da carta, em BRL. A cascata canônica.
 *
 * Ordem, e o porquê de cada degrau:
 *   1. GRADUADA com valor informado — um slab é outro produto; o preço do
 *      catálogo é da carta crua e não serve.
 *   2. Preço da variante (com queda para normal, ver getPrecoVariante).
 *   3. USD × cotação — só 5 cartas na base dependem disso hoje, mas somam
 *      ~R$ 11.000; sem esse degrau elas apareceriam valendo zero.
 *   4. EUR × cotação — último recurso.
 *
 * Sem cotação informada os degraus 3 e 4 são pulados (não inventamos câmbio).
 */
export function valorCarta(carta: CartaDoUsuario, price: any, cotacoes?: Cotacoes): number {
  if (carta?.graduada && num(carta.valor_graduada) > 0) return num(carta.valor_graduada)
  if (!price) return 0

  const variante = getVarianteEfetiva(price, carta?.variante)
  const brl = getPrecoVariante(price, variante)[CAMPO_VALOR]
  if (brl > 0) return brl

  const usd = Math.max(num(price.price_usd_normal), num(price.price_usd_holofoil))
  if (usd > 0 && num(cotacoes?.usd) > 0) return usd * num(cotacoes?.usd)

  const eur = Math.max(num(price.price_eur_normal), num(price.price_eur_holofoil))
  if (eur > 0 && num(cotacoes?.eur) > 0) return eur * num(cotacoes?.eur)

  return 0
}

export interface PatrimonioTotais {
  /** O total pela regra vigente (CAMPO_VALOR). É este que se exibe. */
  valor: number
  min: number
  medio: number
  max: number
  totalCartas: number
  /** Cartas que não resolveram preço nenhum — útil pra avisar na tela. */
  semPreco: number
}

/**
 * Patrimônio de uma coleção.
 *
 * `priceMap` deve ser indexado por **id de catálogo**, nunca por nome: nome de
 * carta é ambíguo em 79% dos casos no catálogo da Bynx, e casar por nome já
 * produziu dado errado em produção mais de uma vez. A versão anterior desta
 * função indexava por `card_name` -- foi corrigido junto com a unificação.
 */
export function calcPatrimonio(
  cards: CartaDoUsuario[],
  priceMap: Record<string, any>,
  cotacoes?: Cotacoes,
): PatrimonioTotais {
  let valor = 0, min = 0, medio = 0, max = 0, totalCartas = 0, semPreco = 0

  for (const card of cards || []) {
    const price = acharPreco(card, priceMap)
    const qty = Math.max(1, Number(card?.quantity) || 1)

    const unit = valorCarta(card, price, cotacoes)
    valor += unit * qty
    totalCartas += qty
    if (unit === 0) semPreco += qty

    // A faixa segue só o catálogo (uma graduada não tem faixa de mercado).
    if (price) {
      const faixa = getPrecoVariante(price, getVarianteEfetiva(price, card?.variante))
      min   += faixa.min   * qty
      medio += faixa.medio * qty
      max   += faixa.max   * qty
    }
  }

  return { valor, min, medio, max, totalCartas, semPreco }
}
