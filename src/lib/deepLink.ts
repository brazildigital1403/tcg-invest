/**
 * Deep links dos e-mails da regua (E02, E03, E05, E07, E11).
 *
 * As paginas de destino sao client-side. Ler do `window.location` (e nao do
 * `useSearchParams`) evita exigir um <Suspense> na pagina inteira, o que
 * mudaria a forma de renderizar a rota. Por isso estes helpers so podem ser
 * chamados dentro de useEffect ou de handler (no servidor nao ha window).
 */

/** Valor de um parametro da URL atual, ou null. */
export function lerParametro(nome: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return new URLSearchParams(window.location.search).get(nome)
  } catch {
    return null
  }
}

/**
 * Tira parametros da URL atual sem navegar nem recarregar. Usado depois que o
 * deep link foi atendido: recarregar a pagina nao repete a acao, e o resto da
 * query (utm, por exemplo) fica como estava.
 */
export function limparParametros(...nomes: string[]): void {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    let mudou = false
    for (const n of nomes) {
      if (url.searchParams.has(n)) { url.searchParams.delete(n); mudou = true }
    }
    if (mudou) window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  } catch { /* URL invalida: deixa como esta */ }
}
