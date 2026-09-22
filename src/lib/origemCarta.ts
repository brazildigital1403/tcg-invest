/**
 * De onde veio cada carta da colecao -- e, por consequencia, quais delas a
 * Bynx pode chamar de VERIFICADA.
 *
 * ★ POR QUE EXISTE. Ate 22/09/2026 toda linha de `user_cards` valia o mesmo:
 * a carta que o dono digitou no "Ja tenho" tinha exatamente o mesmo peso da
 * carta que passou pela camera ou que foi comprada e paga dentro da
 * plataforma. Numa colecao isso e detalhe; num perfil publico e no Mercado
 * e o que separa "alguem diz que tem" de "a Bynx viu".
 *
 * ★ A ESCALA SOBE, NUNCA DESCE. Uma linha agrupa N copias da mesma carta
 * (`quantity`), entao a origem guardada e a MAIS FORTE que ja passou por ela:
 * quem declarou uma copia e depois comprou outra pela Bynx fica com `compra`.
 * O contrario -- comprar e depois declarar mais uma -- nao rebaixa a linha.
 * Por isso toda escrita passa por `promoveuOrigem()` antes de gravar.
 *
 * ★ O QUE CONTA COMO VERIFICADA. `scan` (a carta passou pela camera e foi
 * reconhecida) e `compra` (pedido pago dentro da Bynx). `declarada` e o
 * default e continua sendo a maioria absoluta do acervo -- o selo existe pra
 * destacar a minoria provada, nao pra desqualificar o resto. Nenhuma tela
 * escreve "nao verificada" em carta nenhuma.
 */

export type OrigemCarta = 'declarada' | 'scan' | 'compra'

/** Ordem de forca. Usada pela promocao; nao e ordem de exibicao. */
const FORCA: Record<OrigemCarta, number> = { declarada: 0, scan: 1, compra: 2 }

export const ORIGEM_PADRAO: OrigemCarta = 'declarada'

/** Qualquer coisa fora da escala vira `declarada` -- inclusive null e undefined. */
export function normalizarOrigem(v: unknown): OrigemCarta {
  const k = String(v || '').toLowerCase()
  return (k === 'scan' || k === 'compra') ? k : 'declarada'
}

/** A pergunta que a UI faz. Linha sem origem (banco antigo) responde `false`. */
export function ehVerificada(v: unknown): boolean {
  return normalizarOrigem(v) !== 'declarada'
}

/** `true` quando a origem nova e mais forte que a guardada -- e so entao grava. */
export function promoveuOrigem(atual: unknown, nova: OrigemCarta): boolean {
  return FORCA[nova] > FORCA[normalizarOrigem(atual)]
}

/**
 * Como cada origem se chama na tela. Copy sem contracao (regra da casa) e sem
 * citar o fornecedor da IA -- o Scan e o Scan.
 */
const ROTULO: Record<OrigemCarta, string> = {
  declarada: 'Declarada por você',
  scan: 'Reconhecida pelo Scan',
  compra: 'Comprada na Bynx',
}

export function rotuloOrigem(v: unknown): string {
  return ROTULO[normalizarOrigem(v)]
}

/**
 * A linha do detalhe da carta: rotulo + data, quando a data existe.
 * Devolve `null` em carta declarada -- ali o detalhe nao mostra nada.
 */
export function textoOrigem(v: unknown, em?: string | null): string | null {
  const o = normalizarOrigem(v)
  if (o === 'declarada') return null
  if (!em) return ROTULO[o]
  const d = new Date(em)
  if (Number.isNaN(d.getTime())) return ROTULO[o]
  return `${ROTULO[o]} em ${d.toLocaleDateString('pt-BR')}`
}
