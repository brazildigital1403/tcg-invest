/**
 * Loja ou colecionador -- quem e quem no Guia de Lojas e no Mercado.
 *
 * ★ POR QUE EXISTE (24/09/2026). Uma linha de `lojas` nao e necessariamente
 * uma loja: ha quem cadastre a pagina para vender cartas da propria colecao,
 * de forma ocasional. Quem procura no Guia precisa saber com quem esta
 * falando, e quem paga plano de lojista precisa que a lista de lojas seja de
 * lojas.
 *
 * ★ DOIS CAMPOS, DOIS MOMENTOS. `natureza_declarada` e o que a pessoa marcou
 * no cadastro; `natureza` e a verdade publica, que o admin confirma ou corrige
 * na aprovacao. Divergencia entre as duas nao e erro -- e o registro de uma
 * correcao, e e o caso que interessa vigiar.
 *
 * ★ A ETIQUETA MARCA SO A EXCECAO, e a ausencia dela significa coisas
 * diferentes em cada tela -- de proposito:
 *   - No GUIA, onde toda linha tem pagina, card sem etiqueta e loja.
 *   - No MERCADO existem tres vendedores (loja com pagina, colecionador com
 *     pagina e a maioria, que nao tem pagina nenhuma). La as duas etiquetas
 *     convivem e a ausencia quer dizer "vendedor sem pagina" -- por isso a
 *     etiqueta "Loja" do `VendedorLoja` continua existindo.
 */

export type NaturezaLoja = 'loja' | 'colecionador'

export const NATUREZA_PADRAO: NaturezaLoja = 'loja'

/** Qualquer coisa fora da escala vira `loja`, que e o default do banco. */
export function normalizarNatureza(v: unknown): NaturezaLoja {
  return String(v || '').toLowerCase() === 'colecionador' ? 'colecionador' : 'loja'
}

/** A unica pergunta que a UI faz -- e quem decide se a etiqueta aparece. */
export function ehColecionador(v: unknown): boolean {
  return normalizarNatureza(v) === 'colecionador'
}

/**
 * Os rotulos publicos. "Colecionador" foi escolhido no lugar de "particular"
 * (decisao do Du, 24/09): evita o tom de categoria menor e combina com a
 * linguagem do resto do site.
 */
export const NATUREZA_LABEL: Record<NaturezaLoja, string> = {
  loja: 'Loja',
  colecionador: 'Colecionador',
}

/** Plural, para aba, filtro e contadores. */
export const NATUREZA_LABEL_PLURAL: Record<NaturezaLoja, string> = {
  loja: 'Lojas',
  colecionador: 'Colecionadores',
}

/** O que cada aba do Guia explica logo abaixo do titulo. */
export const NATUREZA_DESCRICAO: Record<NaturezaLoja, string> = {
  loja: 'Lojas cadastradas que vendem de forma contínua.',
  colecionador:
    'Colecionadores vendendo cartas da própria coleção. Não são lojas e podem vender de forma ocasional.',
}

/** Como a pergunta aparece no cadastro da loja. */
export const NATUREZA_OPCOES: { valor: NaturezaLoja; titulo: string; ajuda: string }[] = [
  {
    valor: 'loja',
    titulo: 'Sou uma loja',
    ajuda: 'Vendo de forma contínua, com estoque próprio.',
  },
  {
    valor: 'colecionador',
    titulo: 'Sou colecionador',
    ajuda: 'Vendo cartas da minha coleção, de vez em quando.',
  },
]

/** Valor do parametro `?quem=` do Guia. Vazio quando e a aba padrao. */
export function paramDaNatureza(n: NaturezaLoja): string {
  return n === 'colecionador' ? 'colecionadores' : ''
}

/** O caminho de volta: `?quem=colecionadores` vira `colecionador`. */
export function naturezaDoParam(v: unknown): NaturezaLoja {
  return String(v || '').toLowerCase() === 'colecionadores' ? 'colecionador' : 'loja'
}
