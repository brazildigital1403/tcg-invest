/**
 * Comissao da Bynx nas vendas on-site (epico da vitrine).
 *
 * A tabela espelha a da LigaSegura (marketplace) de proposito: o lojista BR ja
 * conhece esses numeros, entao a Bynx nao parece cara nem estranha.
 *
 *   Prazo de repasse | Comissao
 *   14 dias          | 4,99% + R$ 0,40 (em vendas >= R$ 20)
 *   30 dias          | 3,99% + R$ 0,40 (em vendas >= R$ 20)
 *
 * ATENCAO (margem): a LigaSegura E o proprio processador; a Bynx paga a Stripe
 * por cima (~4% no cartao, ~1,2% no Pix). Ou seja: no Pix sobra ~2,8%, no
 * cartao a margem fica perto de zero. Por isso empurramos Pix no checkout.
 */

export const PRAZOS_REPASSE = [14, 30] as const
export type PrazoRepasse = (typeof PRAZOS_REPASSE)[number]

/** Percentual por prazo (fracao, nao %). */
const PCT_POR_PRAZO: Record<PrazoRepasse, number> = {
  14: 0.0499,
  30: 0.0399,
}

/** Taxa fixa por venda, em centavos (so incide a partir do minimo). */
export const TAXA_FIXA_CENTS = 40

/** Valor minimo (centavos) a partir do qual a taxa fixa incide: R$ 20,00. */
export const TAXA_FIXA_MINIMO_CENTS = 2000

export function ehPrazoValido(v: unknown): v is PrazoRepasse {
  return v === 14 || v === 30
}

export function normalizarPrazo(v: unknown): PrazoRepasse {
  return ehPrazoValido(v) ? v : 30
}

/** Percentual do prazo em formato de exibicao: "3,99%". */
export function pctLabel(prazo: PrazoRepasse): string {
  return `${(PCT_POR_PRAZO[prazo] * 100).toFixed(2).replace('.', ',')}%`
}

/**
 * Comissao da Bynx (application_fee_amount da Stripe), em centavos.
 * Nunca passa do valor da venda (guard de sanidade).
 */
export function calcularComissaoCents(valorCents: number, prazo: PrazoRepasse): number {
  if (!Number.isFinite(valorCents) || valorCents <= 0) return 0
  const pct = PCT_POR_PRAZO[normalizarPrazo(prazo)]
  let fee = Math.round(valorCents * pct)
  if (valorCents >= TAXA_FIXA_MINIMO_CENTS) fee += TAXA_FIXA_CENTS
  return Math.min(fee, valorCents)
}

/** Quanto a loja recebe liquido, em centavos. */
export function calcularLiquidoCents(valorCents: number, prazo: PrazoRepasse): number {
  return Math.max(0, valorCents - calcularComissaoCents(valorCents, prazo))
}

/** Formata centavos como "R$ 1.234,56". */
export function fmtBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
