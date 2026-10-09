/**
 * Resumo do historico de preco de uma carta (Fase 2b do #490, 09/10/2026).
 *
 * O grafico sempre existiu, mas era desenhado no navegador: o Google e os
 * modelos de IA liam uma pagina sem historico nenhum. Agora os pontos chegam
 * do servidor e viram DUAS frases derivadas do dado ("subiu 78,7% em 30
 * dias", "minima R$ 177 em 27/05, 14 levantamentos desde maio") -- que e o
 * que um leitor humano ou de IA consegue citar.
 *
 * Valor de cada ponto: o MENOR preco do dia (regra de divulgacao da casa desde
 * 25/08/2026); o medio so entra quando o minimo nao existe. Puro, sem
 * dependencia de React: a mesma conta serve o servidor (prosa) e o cliente
 * (bloco do historico).
 */

export type PontoHistorico = {
  snapshot_date: string
  preco_min: number | null
  preco_medio: number | null
  preco_max: number | null
}

export type ResumoHistorico = {
  /** Levantamentos com valor. */
  n: number
  primeiro: string
  ultimo: string
  valorAtual: number
  /** Comparacao com o levantamento mais recente de pelo menos 30 dias antes do ultimo. */
  variacao30: { pct: number; de: number; para: number; desde: string } | null
  minima: { valor: number; em: string }
  maxima: { valor: number; em: string }
}

export function valorDoPonto(p: PontoHistorico): number | null {
  const v = Number(p.preco_min ?? p.preco_medio)
  return v > 0 ? v : null
}

export function resumirHistorico(pontos: PontoHistorico[] | null | undefined): ResumoHistorico | null {
  if (!pontos || !pontos.length) return null
  const validos = pontos
    .map(p => ({ data: String(p.snapshot_date).slice(0, 10), valor: valorDoPonto(p) }))
    .filter((x): x is { data: string; valor: number } => x.valor != null && /^\d{4}-\d{2}-\d{2}$/.test(x.data))
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
  if (!validos.length) return null

  const ultimo = validos[validos.length - 1]
  const limite = new Date(`${ultimo.data}T00:00:00Z`)
  limite.setUTCDate(limite.getUTCDate() - 30)
  const corte = limite.toISOString().slice(0, 10)
  const ref = [...validos].reverse().find(x => x.data <= corte) ?? null
  const variacao30 = ref
    ? { pct: ((ultimo.valor - ref.valor) / ref.valor) * 100, de: ref.valor, para: ultimo.valor, desde: ref.data }
    : null

  let minima = validos[0]
  let maxima = validos[0]
  for (const x of validos) {
    if (x.valor < minima.valor) minima = x
    if (x.valor > maxima.valor) maxima = x
  }

  return {
    n: validos.length,
    primeiro: validos[0].data,
    ultimo: ultimo.data,
    valorAtual: ultimo.valor,
    variacao30,
    minima: { valor: minima.valor, em: minima.data },
    maxima: { valor: maxima.valor, em: maxima.data },
  }
}

/**
 * "em 30 dias" quando o ultimo levantamento e recente; "nos 30 dias até 21/07"
 * quando ele tem mais de 35 dias. Sem isso, uma carta medida pela ultima vez
 * em julho dizia "estavel nos ultimos 30 dias" em outubro.
 */
export function rotulo30(r: ResumoHistorico, hoje: Date = new Date()): string {
  const ultimo = new Date(`${r.ultimo}T00:00:00Z`)
  const dias = (hoje.getTime() - ultimo.getTime()) / 864e5
  return dias > 35 ? `nos 30 dias até ${fmtDiaMes(r.ultimo)}` : 'em 30 dias'
}

/** "2026-05-27" -> "27/05" */
export const fmtDiaMes = (iso: string) => {
  const [, m, d] = iso.split('-')
  return d && m ? `${d}/${m}` : iso
}

/** "2026-05-27" -> "maio" (ou "maio de 2025" quando o ano e outro). */
export function fmtMesDesde(iso: string, anoReferencia?: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  const mes = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(d)
  const ano = iso.slice(0, 4)
  return anoReferencia && ano !== anoReferencia ? `${mes} de ${ano}` : mes
}

/** 78.66 -> "78,7%" */
export const fmtPct = (v: number) =>
  `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(v))}%`
