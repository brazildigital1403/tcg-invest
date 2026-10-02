/**
 * Medida de fabrica de produto selado, por (formato, idioma).
 *
 * ★ POR QUE EXISTE (02/10/2026, Quadro #447). A Bynx estimava UMA dimensao
 * para todo `selado` -- 25x20x12 --, grande demais para uma Elite Trainer Box
 * e pequena demais para uma booster box de 36 pacotes. O lojista passou a
 * poder informar as tres medidas (0ef91c4), mas medir a MESMA ETB em cada
 * loja e trabalho repetido que ninguem vai fazer quando os produtos deixarem
 * de ser quatro.
 *
 * Produto selado e de FABRICA: a caixa e identica em qualquer loja do pais.
 * Entao a medida nao pertence ao lojista, pertence ao produto -- e e aqui.
 *
 * ★ A CHAVE E (formato, idioma) E PRECISA DOS DOIS. A ETB inglesa mede
 * 8,6 x 16,5 x 18,8 cm; a brasileira da Copag nao mede igual. Sem o idioma a
 * tabela erraria metade das vezes, e foi por isso que `idioma` virou campo de
 * verdade em c8e03b2 antes desta tabela existir.
 *
 * ★ A ORDEM DE PRECEDENCIA, e ela e deliberada:
 *     1. o que o LOJISTA mediu (ele tem a caixa na mao e pode ter reembalado)
 *     2. esta tabela (medida de fabrica, conferida)
 *     3. `DIMS_POR_TIPO` (a estimativa antiga, que erra mas nao quebra)
 *
 * ★ SO ENTRA LINHA COM FONTE. Esta tabela existe para desfazer chute, e
 * preenche-la de cabeca seria repor o problema com outra roupa. Cada linha
 * carrega de onde veio; sem fonte, melhor nao ter a linha -- o fallback
 * antigo continua ali e e so uma estimativa pior, nao um erro novo.
 */

export type MedidaPadrao = {
  /** Centimetros, inteiros, arredondados PARA CIMA da medida real. */
  largura_cm: number
  altura_cm: number
  comprimento_cm: number
  /** Gramas. Usado so quando o lojista nao informou peso. */
  peso_g: number
  /** De onde veio o numero. Linha sem isto nao entra. */
  fonte: string
}

/** Chave: `${formato}:${idioma}`. */
const TABELA: Record<string, MedidaPadrao> = {
  'etb:en': {
    // Reais: 8,6 x 16,5 x 18,8 cm. Arredondado para cima porque a coluna e
    // inteira e porque sobrar milimetro nunca custa frete -- faltar custa.
    largura_cm: 9,
    altura_cm: 17,
    comprimento_cm: 19,
    // Real ~680 g. Declarados 750 porque e o TETO da mesma faixa de preco do
    // Melhor Envio (680 e 750 dao R$ 19,07; 800 ja pula para R$ 20,27):
    // a folga sai de graca e protege da conciliacao metrica, que cobra
    // retroativo de quem subdeclara e cai na conta da Bynx, nao na do lojista.
    peso_g: 750,
    fonte: 'Ficha do produto (Mega Evolution Pitch Black, versao inglesa), conferida contra a foto do anuncio da Mais Que Geek em 02/10/2026.',
  },
}

/**
 * A medida de fabrica de um selado, ou null quando nao se conhece.
 *
 * Devolve null de proposito em vez de um palpite: quem chama cai no
 * `DIMS_POR_TIPO`, que erra mas e o comportamento que ja existia.
 */
export function medidaPadrao(formato: string | null | undefined, idioma: string | null | undefined): MedidaPadrao | null {
  if (!formato || !idioma) return null
  return TABELA[`${formato}:${idioma}`] ?? null
}

/** Quantas combinacoes a tabela conhece. Para o painel e para teste. */
export function totalConhecido(): number {
  return Object.keys(TABELA).length
}
