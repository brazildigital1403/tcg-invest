/**
 * Função centralizada para calcular patrimônio da coleção.
 * Usada no Header, Dashboard e Minha Coleção — mesma lógica em todo o sistema.
 */

const EXTRAS_VARIANTE: Record<string, { min: string; medio: string; max: string }> = {
  normal:   { min: 'preco_min',          medio: 'preco_medio',          max: 'preco_max' },
  foil:     { min: 'preco_foil_min',     medio: 'preco_foil_medio',     max: 'preco_foil_max' },
  promo:    { min: 'preco_promo_min',    medio: 'preco_promo_medio',    max: 'preco_promo_max' },
  reverse:  { min: 'preco_reverse_min',  medio: 'preco_reverse_medio',  max: 'preco_reverse_max' },
  pokeball: { min: 'preco_pokeball_min', medio: 'preco_pokeball_medio', max: 'preco_pokeball_max' },
}

export function getPrecoVariante(price: any, variante: string): { min: number; medio: number; max: number } {
  if (!price) return { min: 0, medio: 0, max: 0 }

  const fields = EXTRAS_VARIANTE[variante] || EXTRAS_VARIANTE.normal

  // Se a variante não tem preço, cai para normal como fallback
  const medio = Number(price[fields.medio] || 0)
  if (medio === 0 && variante !== 'normal') {
    return {
      min: Number(price.preco_min || 0),
      medio: Number(price.preco_medio || 0),
      max: Number(price.preco_max || 0),
    }
  }

  return {
    min: Number(price[fields.min] || 0),
    medio,
    max: Number(price[fields.max] || 0),
  }
}

export function getVarianteEfetiva(price: any, varianteSalva: string): string {
  if (!price) return varianteSalva || 'normal'

  // Verifica se a variante salva tem preço
  const fields = EXTRAS_VARIANTE[varianteSalva]
  if (fields && Number(price[fields.medio] || 0) > 0) return varianteSalva

  // Senão pega a primeira com preço
  for (const [key, f] of Object.entries(EXTRAS_VARIANTE)) {
    if (Number(price[f.medio] || 0) > 0) return key
  }

  return 'normal'
}

export interface PatrimonioTotais {
  min: number
  medio: number
  max: number
  totalCartas: number
}

export function calcPatrimonio(
  cards: Array<{ card_name: string; variante?: string; quantity?: number }>,
  priceMap: Record<string, any>
): PatrimonioTotais {
  let min = 0, medio = 0, max = 0, totalCartas = 0

  for (const card of cards) {
    const price = priceMap[card.card_name?.trim()]
    const qty = card.quantity || 1
    const variante = getVarianteEfetiva(price, card.variante || 'normal')
    const precos = getPrecoVariante(price, variante)

    min    += precos.min    * qty
    medio  += precos.medio  * qty
    max    += precos.max    * qty
    totalCartas += qty
  }

  return { min, medio, max, totalCartas }
}