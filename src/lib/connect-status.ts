import type Stripe from 'stripe'

/**
 * Classificacao do estado de uma conta Stripe Connect (Express) da loja.
 *
 * Fonte unica da verdade: usado pela rota GET /api/lojas/[id]/connect (sincrono,
 * quando o lojista abre a pagina) E pelo webhook account.updated (assincrono,
 * quando a Stripe avisa). Se a logica divergisse entre os dois, a loja veria um
 * status na pagina e outro no banco.
 *
 * GOTCHA (mordeu na Fase 1): conta Express recem-criada JA vem com
 * `requirements.disabled_reason` preenchido — o onboarding simplesmente nao
 * terminou. Classificar por disabled_reason marcaria toda conta nova como
 * "restrito" e assustaria o lojista. O sinal correto de "ainda nao terminou o
 * cadastro" e `details_submitted`.
 */

export type ConnectStatus = 'nao_iniciado' | 'pendente' | 'ativo' | 'restrito'

export interface ContaClassificada {
  status: ConnectStatus
  charges: boolean
  payouts: boolean
  detalhesEnviados: boolean
  pendencias: string[]
  disabledReason: string | null
  /** Pronto pra gravar em lojas.connect_requirements (jsonb). */
  requirements: {
    currently_due: string[]
    past_due: string[]
    disabled_reason: string | null
  }
}

export function classificarConta(acc: Stripe.Account): ContaClassificada {
  const charges = !!acc.charges_enabled
  const payouts = !!acc.payouts_enabled
  const detalhesEnviados = !!acc.details_submitted
  const req = acc.requirements

  const currentlyDue = req?.currently_due || []
  const pastDue = req?.past_due || []
  const disabledReason = req?.disabled_reason || null

  let status: ConnectStatus = 'pendente'
  if (charges && payouts) status = 'ativo'
  else if (!detalhesEnviados) status = 'pendente'
  else if (disabledReason || pastDue.length > 0) status = 'restrito'

  return {
    status,
    charges,
    payouts,
    detalhesEnviados,
    pendencias: [...currentlyDue, ...pastDue],
    disabledReason,
    requirements: {
      currently_due: currentlyDue,
      past_due: pastDue,
      disabled_reason: disabledReason,
    },
  }
}
