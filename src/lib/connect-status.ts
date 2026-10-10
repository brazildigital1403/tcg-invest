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
 * 3) ★ 29/09/2026 — O LOOP DE (2) VOLTOU POR UMA PORTA LATERAL, e derrubou uma
 *    loja de verdade (GhosTCG, 15 anuncios e R$ 619 parados por 2 dias). A
 *    defesa de (2) so reconhecia o disabled_reason EXATO
 *    `requirements.pending_verification`; havia um `else if (disabledReason)
 *    -> restrito` logo abaixo, que capturava qualquer OUTRO motivo de analise
 *    (`under_review`, `platform_paused`...) mesmo com as duas listas vazias.
 *    O lojista recebeu, no sino e no email, a frase que prova o bug sozinha:
 *    "a Stripe precisa de mais 0 informacao(oes)". Zero.
 *
 *    A regra abaixo agora esta no codigo, nao so no comentario: a UNICA coisa
 *    que faz uma conta com dados enviados e sem pendencia virar restrito e a
 *    RECUSA (`rejected.*`), que e outra conversa — nao se resolve preenchendo
 *    formulario. Qualquer outro motivo com as listas vazias e ANALISE.
 *
 *    ★ Ao mexer aqui: se voce precisar escrever "quantas pendencias" numa
 *    mensagem, pergunte-se o que ela diz quando o numero for ZERO. Se a frase
 *    ficar absurda, o estado esta classificado errado.
 *
 * Regra: so e "restrito" quando ha algo concreto a fazer (currently_due /
 * past_due) ou a conta foi RECUSADA.
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
  const recusada = disabledReason?.startsWith('rejected.') ?? false

  let status: ConnectStatus = 'pendente'
  if (charges && payouts) status = 'ativo'
  else if (!detalhesEnviados) status = 'pendente'
  else if (temPendenciaReal) status = 'restrito'
  else if (recusada) status = 'restrito'
  else if (emVerificacao) status = 'em_analise'
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

/**
 * Traducao dos campos que a Stripe pede para algo que um lojista entende.
 *
 * ★ POR QUE EXISTE (29/09/2026, mesmo incidente do gotcha 3 la em cima). A
 * rota `GET /api/lojas/[id]/connect` SEMPRE devolveu `pendencias` com os nomes
 * dos campos, e a tela de Pagamentos simplesmente ignorava a lista: o cartao
 * de conta restrita dizia so "a Stripe pediu informacoes adicionais". Quem le
 * isso nao sabe se falta o CNPJ, a conta bancaria ou uma selfie — vai ao
 * onboarding procurar as cegas.
 *
 * O nome vem da Stripe em ingles e com prefixo do tipo de conta
 * (`company.tax_id`, `individual.id_number`, `representative.dob.day`). O
 * prefixo nao interessa a quem le: "Data de nascimento" resolve, venha ela do
 * representante ou do titular. Por isso normalizamos o prefixo antes de
 * traduzir, e `rotulosPendencias` DEDUPLICA — sem isso, endereco da empresa e
 * do representante virariam "Endereco" duas vezes na mesma lista.
 *
 * Campo desconhecido NAO some da lista: vira um rotulo generico honesto. Some
 * seria pior — a pessoa veria "faltam 3" e contaria 2.
 */

/** Tira o prefixo do tipo de conta e o indice de socio (`owners.0.`). */
function semPrefixo(campo: string): string {
  return campo
    .replace(/^(company|individual|representative|owners|directors|executives)\.\d*\.?/, '')
    .replace(/^verification\./, 'doc.')
}

const ROTULOS: Record<string, string> = {
  // Documento e identificacao
  'tax_id': 'CNPJ da empresa',
  'id_number': 'CPF',
  'ssn_last_4': 'Últimos dígitos do CPF',
  'doc.document': 'Foto de um documento com foto',
  'doc.additional_document': 'Documento complementar',
  'doc.proof_of_liveness': 'Selfie de confirmação',
  'doc.proof_of_address': 'Comprovante de endereço',
  'first_name': 'Nome',
  'last_name': 'Sobrenome',
  'dob.day': 'Data de nascimento',
  'dob.month': 'Data de nascimento',
  'dob.year': 'Data de nascimento',
  'phone': 'Telefone',
  'email': 'E-mail',
  'relationship.title': 'Seu cargo na empresa',
  'political_exposure': 'Declaração de pessoa politicamente exposta',

  // Endereco
  'address.line1': 'Endereço',
  'address.city': 'Cidade',
  'address.state': 'Estado',
  'address.postal_code': 'CEP',

  // Empresa
  'name': 'Nome da empresa',
  'owners_provided': 'Confirmação dos sócios',
  'directors_provided': 'Confirmação dos diretores',
  'executives_provided': 'Confirmação dos responsáveis',

  // Banco e termos
  'external_account': 'Conta bancária para receber',
  'tos_acceptance.date': 'Aceite dos termos da Stripe',
  'tos_acceptance.ip': 'Aceite dos termos da Stripe',

  // Perfil do negocio
  'business_profile.mcc': 'Ramo de atividade',
  'business_profile.url': 'Site ou rede social',
  'business_profile.product_description': 'Descrição do que você vende',
  'business_profile.monthly_estimated_revenue.amount': 'Faturamento mensal estimado',
  'business_profile.monthly_estimated_revenue.currency': 'Faturamento mensal estimado',
  'settings.card_payments.statement_descriptor_prefix': 'Nome que aparece na fatura do cliente',
}

/** Um campo da Stripe em portugues. Desconhecido vira rotulo generico. */
export function rotuloPendencia(campo: string): string {
  return ROTULOS[semPrefixo(campo)] || ROTULOS[campo] || 'Um dado do seu cadastro'
}

/**
 * A lista pronta para a tela: traduzida, sem repetido e na ordem em que a
 * Stripe mandou (o que ela pede primeiro costuma ser o que trava).
 */
export function rotulosPendencias(campos: string[]): string[] {
  const vistos = new Set<string>()
  const out: string[] = []
  for (const c of campos) {
    const r = rotuloPendencia(c)
    if (vistos.has(r)) continue
    vistos.add(r)
    out.push(r)
  }
  return out
}
