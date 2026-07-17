import type Stripe from 'stripe'

/**
 * Classificacao do estado de uma conta Stripe Connect (Express) da loja.
 *
 * Fonte unica da verdade: usado pela rota GET /api/lojas/[id]/connect (sincrono,
 * quando o lojista abre a pagina) E pelo webhook account.updated (assincrono,
 * quando a Stripe avisa). Se a logica divergisse entre os dois, a loja veria um
 * status na pagina e outro no banco.
 *
 * DOIS GOTCHAS (os dois morderam em producao):
 *
 * 1) Conta Express recem-criada JA vem com `requirements.disabled_reason`
 *    preenchido — o onboarding simplesmente nao terminou. O sinal correto de
 *    "ainda nao terminou o cadastro" e `details_submitted`.
 *
 * 2) Quando o lojista TERMINA o onboarding, a Stripe entra em
 *    `requirements.pending_verification` com currently_due/past_due VAZIOS —
 *    ela so esta conferindo os documentos, nao ha nada a fazer. Tratar isso
 *    como "restrito" fazia a pagina pedir "Resolver pendencia", o lojista
 *    voltava pro onboarding, nao tinha nada pra preencher e voltava pro mesmo
 *    estado: LOOP. Por isso existe o estado `em_analise`.
 *
 * Regra: so e "restrito" quando ha algo concreto a fazer (currently_due /
 * past_due) ou a conta foi bloqueada por outro motivo.
 */

export type ConnectStatus = 'nao_iniciado' | 'pendente' | 'em_analise' | 'ativo' | 'restrito'

export interface ContaClassificada {
  status: ConnectStatus
  charges: boolean
  payouts: boolean
  detalhesEnviados: boolean
  /** Stripe esta conferindo documentos (pending_verification). Nada a fazer. */
  emVerificacao: boolean
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

  const temPendenciaReal = currentlyDue.length > 0 || pastDue.length > 0
  const emVerificacao = disabledReason === 'requirements.pending_verification'

  let status: ConnectStatus = 'pendente'
  if (charges && payouts) status = 'ativo'
  else if (!detalhesEnviados) status = 'pendente'
  else if (temPendenciaReal) status = 'restrito'
  else if (emVerificacao) status = 'em_analise'
  else if (disabledReason) status = 'restrito'
  else status = 'em_analise'

  return {
    status,
    charges,
    payouts,
    detalhesEnviados,
    emVerificacao,
    pendencias: [...currentlyDue, ...pastDue],
    disabledReason,
    requirements: {
      currently_due: currentlyDue,
      past_due: pastDue,
      disabled_reason: disabledReason,
    },
  }
}
