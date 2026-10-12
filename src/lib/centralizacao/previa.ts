// Previa de centralizacao (usuario logado): regras puras, usadas pela tela e
// pela rota /api/centralizacao. A previa entrega ~10% do Pre-grading: so a
// frente, a proporcao do pior eixo e uma faixa em linguagem simples. Nenhuma
// graduadora, nenhuma nota, nenhum mm.

/** Versao gravada em cada medicao: versoes diferentes nao se misturam na base. */
export const ALGORITMO_PREVIA = 'previa-v1'

export type FaixaPrevia = 'bem' | 'levemente' | 'descentralizada'

/**
 * Cortes das 3 faixas pelo lado maior do pior eixo. Ficam so no codigo: a
 * tela mostra o nome da faixa, nunca o limite (decisao do Du, 12/10/2026).
 */
export const CORTES_FAIXA = { bem: 55, levemente: 60 } as const

export function faixaDe(pior: number): FaixaPrevia {
  if (pior <= CORTES_FAIXA.bem) return 'bem'
  if (pior <= CORTES_FAIXA.levemente) return 'levemente'
  return 'descentralizada'
}

export const ROTULO_FAIXA: Record<FaixaPrevia, string> = {
  bem: 'Bem centralizada',
  levemente: 'Levemente descentralizada',
  descentralizada: 'Descentralizada',
}

/**
 * Le o numero impresso como a pessoa digita ("025/198", "25 / 198") e devolve
 * na forma do catalogo: number_norm (minusculo, zeros a esquerda tirados de
 * cada trecho numerico, igual a coluna gerada no banco) e o total impresso.
 */
export function lerNumeroImpresso(entrada: string): { norm: string; total: number; texto: string } | null {
  const m = entrada.trim().toLowerCase().replace(/\s+/g, '').match(/^([a-z]{0,4}\d{1,4}[a-z]?)\/(\d{1,4})$/)
  if (!m) return null
  const norm = m[1].replace(/0*(\d+)/g, '$1')
  const total = Number(m[2])
  if (!norm || !(total > 0)) return null
  return { norm, total, texto: `${m[1].toUpperCase()}/${m[2]}` }
}

export const fmtProporcao = (maior: number) => {
  const r = Math.round(maior * 10) / 10
  const s = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','))
  return `${s(r)}/${s(Math.round((100 - r) * 10) / 10)}`
}
