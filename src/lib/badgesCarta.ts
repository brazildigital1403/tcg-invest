import { GRADUADORA_MAP, notaCurta } from '@/lib/graduadoras'

/**
 * Como uma carta anunciada se DESCREVE em texto curto: variante, idioma e
 * condicao/graduacao.
 *
 * ★ POR QUE ISTO E UM MODULO PROPRIO (04/09/2026): a regra nasceu dentro de
 * `vitrineLoja.ts`, que e `server-only`. O checkout precisava da mesma coisa e
 * nao podia importar de la — o caminho facil seria copiar, e ai a regra
 * passaria a existir em dois lugares. Foi exatamente assim que uma PSA 10
 * apareceu na vitrine como "Normal · NM". Uma fonte so.
 */

export const VARIANTE_LABEL: Record<string, string> = {
  normal: 'Normal', foil: 'Foil', promo: 'Promo', reverse: 'Reverse', pokeball: 'Pokeball',
}

/** Idioma so vira badge quando NAO e portugues — PT e o default silencioso. */
const IDIOMA_LABEL: Record<string, string> = {
  en: 'Ingles', ja: 'Japones', es: 'Espanhol', fr: 'Frances', de: 'Alemao', it: 'Italiano',
  ko: 'Coreano', zh: 'Chines',
}

export type CartaBadgeavel = {
  variante?: string | null
  idioma?: string | null
  condicao?: string | null
  graduada?: boolean | null
  graduadora?: string | null
  nota?: number | null
  black_label?: boolean | null
}

/**
 * Badges da carta. NUNCA inventa condicao.
 *
 * ★ O bug que isto conserta: carta graduada grava `condicao: null` (o
 * formulario nao pede condicao de slab). O codigo antigo fazia
 * `c.condicao || 'NM'` e uma PSA 10 virava "Normal · NM" — o slab sumia e a
 * carta ganhava uma condicao que ninguem declarou, justo o atributo que mais
 * move o preco.
 *
 * Graduada mostra graduadora + nota (mesmo formato do /marketplace); crua
 * mostra a condicao SE o vendedor declarou.
 */
export function badgesDaCarta(c: CartaBadgeavel): string[] {
  const out = [VARIANTE_LABEL[c.variante || 'normal'] || 'Normal']

  const idi = String(c.idioma || '').toLowerCase()
  if (idi && idi !== 'pt' && idi !== 'pt-br' && idi !== 'ptbr') {
    out.push(IDIOMA_LABEL[idi] || idi.toUpperCase())
  }

  if (c.graduada && c.graduadora) {
    const g = GRADUADORA_MAP[c.graduadora]
    const nome = g?.curto || c.graduadora.toUpperCase()
    const n = notaCurta(c.nota, !!c.black_label)
    out.push(n ? `${nome} ${n}` : nome)
    return out
  }

  if (c.condicao) out.push(c.condicao)
  return out
}
