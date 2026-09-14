/**
 * Como um set aparece para quem le: nome da serie e nome de fallback.
 *
 * Vivia so dentro de set/[id]/page.tsx. Saiu para ca quando a imagem de
 * compartilhamento do set (set/[id]/opengraph-image.tsx) passou a precisar da
 * mesma regra -- a mesma conta em dois lugares sempre diverge.
 */

const SERIE_INTERNA = 'Liga BR'

/** Serie como aparece na tela. A serie interna das colecoes especiais ganha nome proprio. */
export function serieExibicao(series: string | null | undefined): string | null {
  if (!series) return null
  return series === SERIE_INTERNA ? 'Coleções Especiais & Promos' : series
}

/**
 * Nome do set quando nao existe linha em `pokemon_sets`: usa o set_name da
 * primeira carta, salvo quando e o nome interno, que nunca vai para a tela.
 */
export function nomeSetSemCadastro(setNameDaCarta: string | null | undefined, id: string): string {
  return setNameDaCarta && !setNameDaCarta.startsWith(SERIE_INTERNA)
    ? setNameDaCarta
    : `Set ${id.toUpperCase()}`
}
