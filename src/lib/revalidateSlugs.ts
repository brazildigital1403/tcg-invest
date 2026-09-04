/**
 * Barreira de entrada da rota `POST /api/revalidate`.
 *
 * Vive num modulo proprio — sem `next/server`, sem `next/cache`, sem IO — por
 * um motivo: e a UNICA coisa entre o corpo de um request externo e o
 * `revalidatePath`, e um arquivo sem dependencia pode ser testado de verdade.
 */

/** Teto por chamada. Ver o cabecalho da rota. */
export const MAX_SLUGS = 200

/**
 * Mesmo alfabeto que o `pkmn_slugify` gera (minusculas, digitos e hifen).
 * Barra, ponto e `%` ficam de fora de proposito: sao o que permitiria escapar
 * de `/carta/` pra outro segmento — `..%2f..%2f` ou `foo/../../` viram um
 * caminho totalmente diferente depois que o Next normaliza.
 */
export const SLUG_OK = /^[a-z0-9][a-z0-9-]{0,199}$/

/** Separa os slugs aceitos dos rejeitados. */
export function separarSlugs(brutos: unknown[]): { validos: string[]; rejeitados: string[] } {
  const validos: string[] = []
  const rejeitados: string[] = []
  for (const s of brutos) {
    const v = typeof s === 'string' ? s.trim().toLowerCase() : ''
    if (v && SLUG_OK.test(v)) validos.push(v)
    else rejeitados.push(String(s).slice(0, 60))
  }
  return { validos, rejeitados }
}
