/**
 * Plano da LOJA (basico | pro | premium) e o que ele libera. Nao confundir com
 * o plano PESSOAL do usuario (src/lib/plan.ts).
 *
 * ★ POR QUE EXISTE (13/09/2026). A regra "plano vencido cai pra basico" estava
 * copiada a mao em duas rotas (upload-foto e produtos/foto), e o limite de foto
 * por PRODUTO so existia no nome: o servidor cortava em 10 em qualquer plano e
 * a tela deixava subir 10. Na pratica o Pro ja colocava 10 fotos por produto,
 * nao 5, e o Basico nao colocava nenhuma -- o que tornava "produto ilimitado
 * no Basico" uma promessa vazia (sem foto o produto nao vende).
 */

export type PlanoLoja = 'basico' | 'pro' | 'premium'

/**
 * `plano_expira_em` nulo = plano PERMANENTE (concessao do admin). Com data, vale
 * ate ela; depois disso a loja e tratada como basico, mesmo antes do
 * cron-loja-trial rebaixar a coluna.
 */
export function planoEfetivoLoja(loja: { plano: string | null; plano_expira_em: string | null }): PlanoLoja {
  const p = (loja.plano || 'basico') as PlanoLoja
  if (p === 'basico') return 'basico'
  if (!loja.plano_expira_em) return p
  return new Date(loja.plano_expira_em).getTime() > Date.now() ? p : 'basico'
}

/**
 * Fotos por PRODUTO. O Basico ganhou 1 (era 0) em 13/09, junto da regra que
 * deixou produto ilimitado pra toda loja: sem ao menos uma foto, ilimitado nao
 * vende. Galeria da LOJA e outra coisa e segue em upload-foto.
 */
export const LIMITE_FOTOS_PRODUTO: Record<PlanoLoja, number> = { basico: 1, pro: 5, premium: 10 }

/**
 * A Stripe so aceita `subscription_data.trial_end` no Checkout a 48h ou mais no
 * futuro. A hora a mais cobre o tempo entre abrir a tela e clicar em assinar.
 */
export const TRIAL_STRIPE_MIN_MS = 49 * 3600_000

/**
 * Ate quando a loja ainda esta de graca, se assinar agora. E a data da primeira
 * cobranca da assinatura. Null = a cobranca e no dia da assinatura.
 *
 * ★ POR QUE EXISTE (13/09/2026, Quadro #287, decisao do Du). O checkout dava
 * 14 dias de trial na Stripe por cima dos 14 dias gratis da aprovacao: 28 sem
 * pagar. Agora a assinatura so empurra a cobranca ate o fim do gratis que a
 * loja JA tem -- nem soma dias, nem faz perder os que faltam.
 *
 * Plano permanente (data nula) e assinante nao tem gratis a preservar. Com
 * menos de 49h restando a Stripe recusaria a data, entao a cobranca e na hora.
 *
 * Mesma funcao no checkout e na tela de plano: a data do botao e a da Stripe.
 */
export function fimDoGratisLoja(
  loja: { plano: string | null; plano_expira_em: string | null; stripe_subscription_id: string | null },
  agora: number = Date.now(),
): Date | null {
  if (loja.stripe_subscription_id) return null
  if (loja.plano !== 'pro' && loja.plano !== 'premium') return null
  if (!loja.plano_expira_em) return null
  const fim = new Date(loja.plano_expira_em).getTime()
  if (!Number.isFinite(fim) || fim - agora < TRIAL_STRIPE_MIN_MS) return null
  return new Date(fim)
}
