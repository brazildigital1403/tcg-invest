/**
 * Escala de condicao da carta, no padrao brasileiro (22/09/2026, decisao do Du
 * a partir do brief de concorrencia).
 *
 * ★ POR QUE EXISTE. A mesma escala estava escrita em SEIS lugares e com TRES
 * grafias: a colecao tinha NM/LP/MP/HP (sem carta danificada), o anuncio tinha
 * NM/LP/MP/HP/D e o modal da Pokedex usava DMG. O padrao do mercado brasileiro
 * e NM / SP / MP / HP / D, entao LP virou SP e DMG virou D -- no dado e na
 * tela. Agora a lista vive aqui e as telas so leem.
 *
 * `normalizar*` existe para o valor antigo nunca sumir da tela: carta ou
 * anuncio gravado com LP (ou DMG) continua aparecendo, como SP (ou D).
 */

export type Condicao = 'NM' | 'SP' | 'MP' | 'HP' | 'D'

export const CONDICOES: { key: Condicao; label: string; desc: string; color: string }[] = [
  { key: 'NM', label: 'NM', desc: 'Near Mint',         color: '#22c55e' },
  { key: 'SP', label: 'SP', desc: 'Slightly Played',   color: '#84cc16' },
  { key: 'MP', label: 'MP', desc: 'Moderately Played', color: '#f59e0b' },
  { key: 'HP', label: 'HP', desc: 'Heavily Played',    color: '#ef4444' },
  { key: 'D',  label: 'D',  desc: 'Damaged',           color: '#7f1d1d' },
]

export const CONDICAO_KEYS = CONDICOES.map(c => c.key)

export const CONDICAO_CORES: Record<string, string> =
  Object.fromEntries(CONDICOES.map(c => [c.key, c.color]))

/** Grafias antigas que ainda podem estar gravadas. */
const LEGADO: Record<string, Condicao> = { LP: 'SP', DMG: 'D' }

export function normalizarCondicao(c: string | null | undefined): string | null {
  if (!c) return null
  return LEGADO[c] || c
}

/** Mapa condicao -> quantidade de `user_cards.condicoes`, com o legado somado. */
export function normalizarCondicoes(
  mapa: Record<string, number> | null | undefined,
): Record<string, number> | null {
  if (!mapa) return null
  const saida: Record<string, number> = {}
  for (const [k, v] of Object.entries(mapa)) {
    const chave = LEGADO[k] || k
    saida[chave] = (saida[chave] || 0) + Number(v || 0)
  }
  return saida
}

/** A carta tem pelo menos uma copia nesta condicao? Entende o legado. */
export function temCondicao(mapa: Record<string, number> | null | undefined, cond: string): boolean {
  const n = normalizarCondicoes(mapa)
  return !!n && (n[cond] || 0) > 0
}
