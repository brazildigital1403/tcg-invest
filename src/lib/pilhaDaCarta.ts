/**
 * Casamento de pilha na `user_cards`, igual ao que o banco faz.
 *
 * O indice unico da tabela e
 *   (user_id, pokemon_api_id, coalesce(variante,'normal'), idioma)
 *   where pokemon_api_id is not null and graduada = false
 * desde 15/10/2026. Antes era so (user_id, pokemon_api_id): o banco so aceitava
 * UMA linha por carta por usuario, entao somar a foil na pilha da normal nao
 * era descuido de codigo, era o modelo de dados.
 *
 * Quem procura "ja tenho essa carta?" antes de gravar PRECISA perguntar pela
 * mesma chave que o indice usa. Perguntar so por pokemon_api_id acha a pilha
 * errada e soma na dela; perguntar com `.eq('variante', ...)` cru erra no caso
 * do NULL, porque a coluna e nullable e, para o indice, NULL e 'normal' --
 * o SELECT nao acharia a linha, o INSERT bateria 23505 e o usuario veria erro.
 *
 * Um helper so para os cinco caminhos de escrita: eles tratam conflito cada um
 * do seu jeito, e a regra de casamento nao pode divergir entre eles.
 */

export const VARIANTE_PADRAO = 'normal'
export const IDIOMA_PADRAO = 'pt'

/**
 * Filtro minimo que uma consulta de pilha precisa ter. Nao e generico de
 * proposito: amarrar o tipo do PostgREST em si mesmo (`Q extends Filtravel<Q>`)
 * estoura a inferencia do Supabase com TS2589.
 */
type Filtravel = {
  eq: (coluna: string, valor: unknown) => Filtravel
  or: (filtro: string) => Filtravel
}

/**
 * Aplica variante e idioma a uma consulta que ja filtrou user_id,
 * pokemon_api_id e graduada. Devolve a consulta com o tipo que entrou, para o
 * chamador seguir encadeando `.limit()`, `.maybeSingle()` e afins.
 */
export function aplicarPilha<Q>(
  consulta: Q,
  variante?: string | null,
  idioma?: string | null,
): Q {
  const q = consulta as unknown as Filtravel
  const v = variante || VARIANTE_PADRAO
  const i = idioma || IDIOMA_PADRAO
  const comVariante = v === VARIANTE_PADRAO
    // Linha antiga com variante NULL e a MESMA pilha que 'normal' para o
    // indice. Hoje sao 0 linhas, mas a coluna continua nullable e basta uma
    // escrita futura sem variante para o SELECT deixar de achar.
    ? q.or(`variante.is.null,variante.eq.${VARIANTE_PADRAO}`)
    : q.eq('variante', v)
  return comVariante.eq('idioma', i) as unknown as Q
}
