/**
 * Contas sobre a colecao da pessoa que varios templates usam: variacao de
 * preco por carta, cartas que mexeram, repetidas, nomes de idioma.
 *
 * ★ Variacao so em carta NORMAL e NAO graduada: o historico (price_snapshots)
 * guarda o menor preco da variante normal. Foil, reverse e graduada ficam
 * fora da conta de "mexeu" (nunca inventar variacao que nao foi medida).
 * ★ |pct| acima de PCT_SUSPEITO e preco fora da curva: fica fora tambem.
 */
import { PCT_SUSPEITO } from './config'
import type { CartaPessoa, Colecao } from './banco'
import type { Contexto } from './contexto'

export type Mexida = {
  carta: CartaPessoa
  antes: number
  agora: number
  /** Variacao unitaria em R$. */
  delta: number
  pct: number
  /** Variacao na colecao (delta x copias). */
  naColecao: number
  /** Copias da carta na colecao (so as normais nao graduadas). */
  copias: number
}

export const r2 = (v: number): number => Math.round(v * 100) / 100
export const r1 = (v: number): number => Math.round(v * 10) / 10

export function mediuVariacao(x: CartaPessoa): boolean {
  return !!x.cat && !!x.cardId && !x.graduada && (x.variante === 'normal' || !x.variante)
}

/** Cartas da colecao com variacao medida em `dias` (agrupa copias da mesma carta). */
export function mexidas(ctx: Contexto, col: Colecao, dias: number): Mexida[] {
  const porId = new Map<string, Mexida>()
  for (const x of col.cartas) {
    if (!mediuVariacao(x)) continue
    const v = ctx.historico.variacao(x.cat, dias)
    if (!v || Math.abs(v.pct) > PCT_SUSPEITO) continue
    const ja = porId.get(x.cardId!)
    if (ja) {
      ja.naColecao = r2(ja.naColecao + v.delta * x.quantidade)
      ja.copias += x.quantidade
      continue
    }
    porId.set(x.cardId!, { carta: x, antes: v.antes, agora: v.agora, delta: v.delta, pct: v.pct, naColecao: r2(v.delta * x.quantidade), copias: x.quantidade })
  }
  return [...porId.values()]
}

/** Copias por carta do catalogo (graduadas fora: cada graduada e uma peca unica). */
export function copiasPorCarta(col: Colecao): Map<string, { carta: CartaPessoa; copias: number }> {
  const m = new Map<string, { carta: CartaPessoa; copias: number }>()
  for (const x of col.cartas) {
    if (!x.cardId || x.graduada) continue
    const ja = m.get(x.cardId)
    if (ja) ja.copias += x.quantidade
    else m.set(x.cardId, { carta: x, copias: x.quantidade })
  }
  return m
}

/** Repetidas: cartas com 2+ copias, da mais valiosa para a menos. */
export function repetidas(col: Colecao): { carta: CartaPessoa; copias: number }[] {
  return [...copiasPorCarta(col).values()]
    .filter((r) => r.copias >= 2 && r.carta.valorUnit > 0)
    .sort((a, b) => b.carta.valorUnit - a.carta.valorUnit)
}

/** Cartas diferentes com imagem, da mais valiosa para a menos. */
export function maisValiosas(col: Colecao): CartaPessoa[] {
  const vistos = new Set<string>()
  const out: CartaPessoa[] = []
  for (const x of [...col.cartas].sort((a, b) => b.valorUnit - a.valorUnit)) {
    const k = x.cardId || x.nome
    if (vistos.has(k) || !x.cat?.imagemGrande) continue
    vistos.add(k)
    out.push(x)
  }
  return out
}

const IDIOMAS: Record<string, string> = {
  pt: 'português', en: 'inglês', jp: 'japonês', ja: 'japonês', cn: 'chinês', zh: 'chinês',
  es: 'espanhol', fr: 'francês', de: 'alemão', it: 'italiano', ko: 'coreano', kr: 'coreano',
}
export function nomeIdioma(cod: string | null | undefined): string {
  const c = (cod || 'pt').toLowerCase()
  return IDIOMAS[c] || c
}

/** "Giratina V" -> "Giratina" (botao "Ver o grafico do meu Giratina"). */
export function nomeCurto(nome: string): string {
  return nome.split(/\s+/)[0] || nome
}

/** "20" -> "020" (numeracao como aparece na carta). */
export function numeroCarta(n: string): string {
  return /^\d+$/.test(n) ? n.padStart(3, '0') : n
}

/** "209/193" quando o set tem total; senao so o numero. */
export function numeroComTotal(numero: string, total: number | null): string {
  return total ? `${numero}/${total}` : numero
}
