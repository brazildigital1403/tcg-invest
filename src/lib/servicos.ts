// Servicos de bancada da Bynx: restauracao de cartas e pre-grading (fase 1).
//
// Tudo o que as paginas /restauracao-de-cartas, /pre-grading e
// /restauracao-de-cartas/agendar mostram sai daqui: flags, precos, prazos,
// listas, FAQ e casos. Uma fonte so, pra pagina, JSON-LD e formulario nunca
// divergirem (a mesma conta em dois lugares sempre diverge).
//
// ★ Publicado em 04/10/2026 (decisao do Du): index nas duas landings, sitemap,
// rodape, cabecalho publico e menu do app. Com false, voltam a noindex (os
// links e o sitemap nao leem esta flag: remover a mao). SERVICOS_FORM_ATIVO liga o envio do formulario
// (tabelas da F7 + rotas /api/servicos da F8). Desligado, nada sai do navegador.
// Valor `null` = decisao pendente do Du: a secao que depende dele nao aparece.

export const SERVICOS_PUBLICADO = true
export const SERVICOS_FORM_ATIVO = true
// Pagamento por cartao (Stripe Checkout) no /servico/[id]. Ligado em 04/10/2026
// depois do teste completo na sandbox (pagamento, reenvio, estornos, cancelamento).
// Com false o botao some e POST /api/servicos/[id]/checkout responde 404.
export const SERVICOS_CARTAO_ATIVO = true

export type ServicoId = 'restauracao' | 'pre_grading' | 'completo'

export interface Precos {
  restauracao: number
  preGrading: number
  completo: number
  /** Acrescimo do prazo expresso, POR CARTA. null = sem expresso. */
  expresso: number | null
  /** Desconto por volume, em %. null = sem desconto anunciado. */
  desc10a20: number | null
  descAcima20: number | null
}

/**
 * Valores por carta definidos pelo Du em 26/09/2026. Descontos por volume (10% de
 * 10 a 20 cartas, 15% acima) seguem a referencia de mercado, decisao dele no
 * mesmo dia. Tabela revista em 28/09/2026 pelo painel de precificacao (decisao
 * do Du): Completo R$ 229 (sem quebra de slab), restauracao "a partir de"
 * R$ 165 com valor final na proposta, expresso so no pre-grading.
 * O antigo "seguro 7%" saiu em 28/09/2026: a Bynx nao vende seguro. Na volta o
 * cliente paga so a taxa de valor declarado dos Correios (CORREIOS_VD).
 */
// ── Valor declarado dos Correios (envio de volta) ───────────────────────────
// Fonte oficial: correios.com.br/enviar/servicos-adicionais e
// /receber/encomenda/indenizacoes, vigencia 12/04/2026, consulta 27/09/2026.
// Balcao, sem contrato: 2% sobre o que passa da cobertura automatica. Os tetos
// reajustam todo abril: revisar. Indenizacao ate o valor declarado, sem
// franquia, proporcional ao dano (perda, roubo, avaria).
export const CORREIOS_VD = {
  pct: 2,
  coberturaAutomaticaCents: 2563,
  tetoSedexCents: 3968048,
  tetoPacCents: 466829,
  vigencia: '12/04/2026',
}

/** Taxa dos Correios para declarar o valor da carta na volta, em centavos. */
export function taxaValorDeclaradoCents(valorDeclaradoCents: number): number {
  return Math.round(Math.max(0, valorDeclaradoCents - CORREIOS_VD.coberturaAutomaticaCents) * CORREIOS_VD.pct / 100)
}

/** Rotulo unico da linha que ocupa a coluna seguro_cents (nome antigo no banco). */
export const ROTULO_VALOR_DECLARADO = 'Valor declarado nos Correios'

const reaisVd = (c: number) => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Expresso (painel de precificacao, 28/09/2026): so pre-grading, + R$ 80, 1
 * carta por pedido e ate EXPRESSO_VAGAS expressos ao mesmo tempo na bancada (de
 * qualquer cliente; o Du subiu de 1 para 3 no mesmo dia),
 * postado em ate 2 dias uteis apos a chegada, volta por SEDEX. Restauracao e
 * completo nao tem expresso: o descanso nao acelera. Pedido padrao do mesmo
 * cliente so comeca depois que o expresso for enviado.
 */
export const EXPRESSO_MAX_CARTAS = 1
/** Quantos expressos podem estar abertos ao mesmo tempo na bancada. */
export const EXPRESSO_VAGAS = 3
export const EXPRESSO_SERVICOS: readonly ServicoId[] = ['pre_grading']
/** Status em que um expresso ocupa uma vaga da bancada (a partir do aceite). */
export const STATUS_EXPRESSO_OCUPA_VAGA = ['aceito', 'recebida', 'em_bancada', 'pronta'] as const
/** Acima disso o prazo padrao sai no orcamento. */
export const PRAZO_PADRAO_ATE_CARTAS = 5
/** Restauracao tem valor final na proposta: o preco publicado e piso. */
export const PRECO_A_PARTIR: readonly ServicoId[] = ['restauracao']
export const rotuloPreco = (id: ServicoId, v: number) => `${PRECO_A_PARTIR.includes(id) ? 'a partir de ' : ''}R$ ${brl(v)}`
/** Status em que um pedido expresso ainda ocupa a bancada (segura o prazo dos padrao). */
export const STATUS_EXPRESSO_EM_ANDAMENTO = ['aguardando_orcamento', 'orcado', 'aceito', 'recebida', 'proposta', 'em_bancada', 'descansando', 'pronta'] as const
export const AVISO_FILA_EXPRESSO = 'Você tem um pedido expresso em andamento. O prazo deste pedido começa a contar depois que o expresso for enviado.'

export const PRECOS: Precos | null = {
  restauracao: 165,
  preGrading: 80,
  completo: 229,
  expresso: 80,
  desc10a20: 10,
  descAcima20: 15,
}

// Definidos pelo Du em 26/09/2026.
export const PRAZOS = {
  /** Dias uteis apos a chegada da carta. */
  padraoDiasUteis: 5 as number | null,
  /** Dias uteis entre a chegada e a postagem de volta, no expresso. */
  expressoDiasUteis: 2 as number | null,
  /** Prazo do orcamento depois do envio das fotos. */
  orcamento: '48 horas' as string | null,
}

export const LINKS = {
  whatsapp: null as string | null,
  instagram: 'https://instagram.com/bynx.gg',
  youtube: 'https://www.youtube.com/@bynx_gg' as string | null,
  /** Id do video longo do YouTube (secao "Veja o processo inteiro"). */
  videoProcessoId: null as string | null,
  videoProcessoDuracao: null as string | null,
  /** Clipe curto (mp4) da abertura do pacote. */
  videoAbertura: null as string | null,
  videoAberturaPoster: null as string | null,
  guiaEmbalagem: null as string | null,
}

export const CIDADE: string | null = null
export const MAX_CARTAS_POR_SOLICITACAO = 20

export const SERVICOS: { id: ServicoId; nome: string; curto: string; descricao: string }[] = [
  {
    id: 'restauracao',
    nome: 'Restauração',
    curto: 'Vinco, amassado, carta ondulada',
    descricao: 'Tratamento à mão, sem tinta e sem cola, carta por carta.',
  },
  {
    id: 'pre_grading',
    nome: 'Pré-grading',
    curto: 'Nota provável antes de graduar',
    descricao: 'Centralização medida, mapa de imperfeições e a graduadora certa.',
  },
  {
    id: 'completo',
    nome: 'Restauração + pré-grading',
    curto: 'O caminho inteiro até a graduadora',
    descricao: 'Inclui quebra de slab quando a carta chega graduada.',
  },
]

export function servicoPorParam(v: string | null | undefined): ServicoId {
  if (v === 'pre-grading' || v === 'pre_grading') return 'pre_grading'
  if (v === 'completo') return 'completo'
  return 'restauracao'
}

export function precoDoServico(id: ServicoId): number | null {
  if (!PRECOS) return null
  return id === 'restauracao' ? PRECOS.restauracao : id === 'pre_grading' ? PRECOS.preGrading : PRECOS.completo
}

export const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── O que resolve / atenua / nao resolve ─────────────────────────────────────

export const RESOLVE = [
  { t: 'Carta ondulada', d: 'A carta que empenou com umidade ou calor volta a deitar reta na mesa.' },
  { t: 'Amassado sem papel rompido', d: 'Dobra de manuseio em que a fibra não quebrou sai por completo ou quase.' },
  { t: 'Superfície levantada por pressão', d: 'A camada que estufou volta a assentar com prensagem controlada.' },
  { t: 'Sujeira de manuseio', d: 'Marca de dedo e poeira, limpas a seco, sem produto que deixe resíduo.' },
]

export const ATENUA = [
  { t: 'Vinco com fibra rompida', d: 'O relevo diminui bastante, mas a linha continua visível na luz rasante. Avisamos isso antes de você enviar.' },
]

export const NAO_RESOLVE = [
  { t: 'Borda ou canto branco', d: 'É tinta que saiu. Cobrir exige repintura.' },
  { t: 'Arranhão no holo', d: 'O brilho riscado não volta sem alterar a carta.' },
  { t: 'Rasgo, furo ou carta abrindo em camadas', d: 'Consertar exige cola, e cola torna a carta ingraduável.' },
  { t: 'Centralização e defeito de fábrica', d: 'Vêm da impressão. Não há correção depois de fabricada.' },
]

// ── Processo e custodia ──────────────────────────────────────────────────────

export const PASSOS = [
  { t: 'Orçamento pelas fotos', d: 'Você manda frente e verso. A Bynx diz o que dá para fazer e quanto custa, antes de qualquer envio.' },
  { t: 'Você aprova e envia', d: 'Você aprova o orçamento e paga o sinal, que cobre o frete de volta e o valor declarado nos Correios. Aí aparece o endereço, com o guia de embalagem.' },
  { t: 'Chegada filmada', d: 'O pacote é aberto em vídeo, sem corte, com a etiqueta visível. A carta ganha um número de custódia e uma ficha de condição com fotos de cada canto.' },
  { t: 'Você aprova o tratamento', d: 'Para cada carta chega uma proposta: o que foi encontrado, o que fazer, o risco e a alternativa de não mexer. Com o seu sim e o pagamento do serviço, a carta vai para a bancada.' },
  { t: 'Bancada e descanso', d: 'Depois da prensa, a carta descansa. É essa etapa que faz o resultado durar, e ela não tem atalho.' },
  { t: 'Volta com laudo e rastreio', d: 'Fotos de saída na mesma luz da entrada, embalagem lacrada e código de rastreio na sua conta.' },
]

export const CUSTODIA = [
  { t: 'Vídeo do pacote abrindo', d: 'Plano único, sem corte, com a etiqueta visível do começo ao fim.' },
  { t: 'Foto de entrada antes de qualquer toque', d: 'Na mesma luz e no mesmo enquadramento da foto de saída, para você comparar.' },
  { t: 'Status na sua conta a cada etapa', d: 'Recebida, em bancada, descansando, pronta, enviada. Com foto em cada passo.' },
  { t: 'Envio com valor declarado', d: 'Na volta, a carta vai com valor declarado nos Correios pelo valor que você informou. Você paga só a taxa deles, cotada no orçamento, sem margem da Bynx.' },
]

/** Custodia do pre-grading: sem etapa de descanso (e da prensa). */
export const CUSTODIA_PRE_GRADING = [
  CUSTODIA[0],
  CUSTODIA[1],
  { t: 'Status na sua conta a cada etapa', d: 'Recebida, em bancada, pronta, enviada. Com foto em cada passo.' },
  CUSTODIA[3],
]

// ── Pre-grading ──────────────────────────────────────────────────────────────

export const LAUDO_ITENS = [
  { t: 'Centralização medida', d: 'Frente e verso em proporção, como 55/45, comparados ao limite de cada graduadora.' },
  { t: 'Mapa de imperfeições', d: 'Cada marca localizada e classificada: tratável, atenuável ou definitiva.' },
  { t: 'Faixa de nota provável', d: 'Uma faixa, nunca uma promessa. A nota final é da graduadora.' },
  { t: 'Graduadora recomendada', d: 'Qual faz mais sentido para essa carta, pelo perfil e pelo valor.' },
  { t: 'Próximo passo', d: 'Graduar agora, restaurar antes ou guardar como está.' },
  { t: 'Fotos em luz difusa e rasante', d: 'O registro da condição exata em que a carta chegou e saiu.' },
]

export const GRADUADORAS = [
  { nome: 'PSA', quando: 'Carta de valor alto, pensando em revenda fora do Brasil.' },
  { nome: 'TAG', quando: 'Quem quer o relatório de imperfeições da própria graduadora.' },
  { nome: 'CGC', quando: 'Carta moderna com superfície impecável, em busca do 10.' },
  { nome: 'BGS', quando: 'Quem coleciona pelas subnotas de canto, borda, centro e superfície.' },
  { nome: 'GBA', quando: 'Envio nacional, sem câmbio e com prazo mais curto.' },
]

// ── Casos (antes/depois reais) ───────────────────────────────────────────────
// Vazio ate chegar a midia do Du. Foto 5:7, mesma luz rasante no antes e no depois.

export interface Caso {
  slug: string
  carta: string
  defeito: string
  antes: string
  depois: string
  feito: string
  prazo: string
  data: string
}

export const CASOS: Caso[] = []

export interface CasoRecusado { carta: string; motivo: string; resultado: string }
export const CASO_RECUSADO: CasoRecusado | null = null

// ── FAQ ──────────────────────────────────────────────────────────────────────
// O mesmo array renderiza o HTML e o FAQPage do JSON-LD.

export interface Faq { q: string; a: string }

export const FAQ_RESTAURACAO: Faq[] = [
  {
    q: 'Quando eu pago?',
    a: 'Em duas partes. No aceite do orçamento você paga o sinal, que cobre o frete de volta e o valor declarado nos Correios. O serviço só é cobrado quando a carta já chegou e você aprovou a proposta de tratamento, antes de a Bynx tocar nela. No pré-grading, que não tem proposta, o pagamento é um só, no aceite.',
  },
  {
    q: 'E se a carta se perder no correio?',
    a: `Na ida, declare o valor na postagem. Na volta, a Bynx envia com valor declarado nos Correios, e você paga só a taxa de valor declarado deles, cotada no orçamento, sem margem da Bynx. Em perda, roubo ou avaria no transporte, os Correios indenizam até o valor declarado, sem franquia. O teto do SEDEX hoje é R$ ${reaisVd(CORREIOS_VD.tetoSedexCents)}: carta acima disso, combinamos a entrega com você antes. Cada etapa fica registrada na sua conta com foto.`,
  },
  {
    q: 'A graduadora vai perceber que a carta foi tratada?',
    a: 'O trabalho é de conservação: prensagem, umidade controlada e limpeza a seco. A Bynx não usa tinta, cola nem corte, que é o que as graduadoras tratam como alteração. Mesmo assim, ninguém sério promete nota, e nós também não prometemos.',
  },
  {
    q: 'O tratamento pode piorar a minha carta?',
    a: 'Toda intervenção tem risco, e ele muda com o tipo de carta: holo, japonesa e texturizada reagem de jeitos diferentes. Por isso o orçamento avisa o risco da sua carta antes do aceite, e nós paramos no ponto seguro, mesmo que o vinco não tenha saído todo.',
  },
  {
    q: 'O vinco some?',
    a: 'Amassado sem fibra rompida costuma sair por completo. Vinco com fibra rompida diminui bastante, mas a linha continua visível na luz rasante. Pelas fotos já dá para dizer em qual dos dois casos a sua carta está.',
  },
  {
    q: 'Como sei que a carta que volta é a mesma?',
    a: 'Ela recebe um número de custódia na chegada, fotografado ao lado dela. As fotos de entrada e de saída usam a mesma luz e o mesmo enquadramento, e você compara as duas na sua conta.',
  },
  {
    q: 'Vocês arrumam borda branca?',
    a: 'Não. Borda branca é tinta que saiu, e cobrir exige repintura, o que torna a carta ingraduável. Se esse é o único problema, o orçamento diz não.',
  },
  {
    q: 'Quanto tempo a carta fica com vocês?',
    a: 'O prazo conta a partir da sua aprovação da proposta de tratamento. Parte dele é o descanso depois da prensa, que é o que faz o resultado durar.',
  },
  {
    q: 'Como devo embalar a carta?',
    a: 'Sleeve, toploader, fita só no toploader e papelão dos dois lados. O guia completo, com fotos, vem junto do endereço depois do aceite.',
  },
]

export const FAQ_PRE_GRADING: Faq[] = [
  {
    q: 'O pré-grading garante a nota?',
    a: 'Não. Ele indica a faixa provável com base na centralização medida e no estado de cantos, bordas e superfície. A nota final é da graduadora.',
  },
  {
    q: 'Qual a diferença entre pré-grading e graduação?',
    a: 'A graduação é feita pela graduadora, que dá a nota oficial e lacra a carta no slab. O pré-grading vem antes: diz se vale a pena pagar a graduação e para qual graduadora mandar.',
  },
  {
    q: 'Vocês enviam a carta para a graduadora por mim?',
    a: 'Por enquanto a carta volta para você preparada para o envio, e a escolha da graduadora fica com você, com a recomendação do laudo.',
  },
  // Por pergunta, nao por posicao: a ordem do FAQ da restauracao muda.
  ...FAQ_RESTAURACAO.filter(f => ['Quando eu pago?', 'E se a carta se perder no correio?', 'Como sei que a carta que volta é a mesma?'].includes(f.q)),
]

// ── Formulario ───────────────────────────────────────────────────────────────

export const QUEIXAS = ['Vinco', 'Amassado', 'Ondulada', 'Superfície', 'Cantos', 'Não sei'] as const

export const FOTO_SLOTS = [
  { id: 'frente', rotulo: 'Frente', obrigatoria: true },
  { id: 'verso', rotulo: 'Verso', obrigatoria: true },
  { id: 'rasante', rotulo: 'Luz rasante', obrigatoria: false },
  { id: 'cantos', rotulo: 'Cantos', obrigatoria: false },
] as const

export type FotoSlotId = (typeof FOTO_SLOTS)[number]['id']

// ── SEO ──────────────────────────────────────────────────────────────────────

export const SITE = 'https://bynx.gg'

export function jsonLdServico(opts: {
  path: string
  nome: string
  descricao: string
  tipo: string
  preco: number | null
  faq: Faq[]
  migalha: string
}) {
  const url = `${SITE}${opts.path}`
  const service: Record<string, unknown> = {
    '@type': 'Service',
    '@id': `${url}#servico`,
    name: opts.nome,
    serviceType: opts.tipo,
    description: opts.descricao,
    url,
    areaServed: { '@type': 'Country', name: 'BR' },
    provider: { '@type': 'Organization', name: 'Bynx', url: SITE },
  }
  // [PRECO] nunca vai pro ar: sem valor fechado, sem Offer.
  if (opts.preco != null) {
    service.offers = {
      '@type': 'Offer',
      price: opts.preco.toFixed(2),
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      url,
    }
  }
  return {
    '@context': 'https://schema.org',
    '@graph': [
      service,
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Bynx', item: SITE },
          { '@type': 'ListItem', position: 2, name: opts.migalha, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: opts.faq.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }
}

// ── Status (painel admin e, depois, a pagina do cliente) ─────────────────────

export const STATUS_SERVICO: Record<string, string> = {
  aguardando_orcamento: 'Aguardando orçamento',
  orcado: 'Orçado',
  aceito: 'Aceito',
  recusado_cliente: 'Recusado pelo cliente',
  recusado_bynx: 'Recusado pela Bynx',
  recebida: 'Recebida',
  proposta: 'Proposta de tratamento',
  em_bancada: 'Em bancada',
  descansando: 'Descansando',
  pronta: 'Pronta',
  enviada: 'Enviada',
  entregue: 'Entregue',
  devolvida_sem_servico: 'Devolvida sem serviço',
  cancelado: 'Cancelado',
  // Marcador da linha do tempo (nao e status do pedido).
  cobranca_servico: 'Cobrança do serviço',
}

/**
 * Para onde o ADMIN pode mover cada status. Orcar (aguardando -> orcado |
 * recusado_bynx) e enviar a proposta (recebida -> proposta) tem acao propria.
 * `orcado -> aceito` registra o aceite combinado por WhatsApp.
 * `recebida -> em_bancada` so vale para pre-grading (nao ha tratamento a
 * propor); `proposta -> em_bancada` so depois da decisao do cliente. As duas
 * travas vivem no servidor.
 */
export const TRANSICOES_ADMIN: Record<string, string[]> = {
  aguardando_orcamento: ['cancelado'],
  orcado: ['aceito', 'recusado_cliente', 'cancelado'],
  aceito: ['recebida', 'cancelado'],
  recebida: ['em_bancada', 'devolvida_sem_servico'],
  proposta: ['em_bancada', 'devolvida_sem_servico'],
  em_bancada: ['descansando', 'pronta', 'devolvida_sem_servico'],
  descansando: ['em_bancada', 'pronta'],
  pronta: ['enviada'],
  enviada: ['entregue'],
}

/** De quem e a vez: a pergunta que o painel responde primeiro. */
export function turnoServico(status: string): 'bynx' | 'cliente' | 'fim' {
  if (['orcado', 'aceito', 'proposta'].includes(status)) return 'cliente'
  if (['entregue', 'cancelado', 'recusado_cliente', 'recusado_bynx', 'devolvida_sem_servico'].includes(status)) return 'fim'
  return 'bynx'
}

// ── Pagamento por etapa: o calculo puro ─────────────────────────────────────
// Vive aqui (e nao no servicosServer) para a lista /servicos, que e client-side,
// usar a MESMA conta do GET do pedido e do checkout. O servicosServer reexporta.

export type EtapaPagamento = 'sinal' | 'servico' | 'integral'

export interface LinhaPagamento {
  id: string; etapa: EtapaPagamento; valor_cents: number; metodo: string | null; pago_em: string | null
  reembolsado_cents?: number; reembolsado_em?: string | null
}

/** A etapa que o cliente deve pagar AGORA (ou null). */
export function etapaDevida(status: string, propostaAceita: boolean, linhas: LinhaPagamento[]): LinhaPagamento | null {
  const aberta = (e: EtapaPagamento) => linhas.find(l => l.etapa === e && !l.pago_em) || null
  if (status === 'aceito' || status === 'recebida') return aberta('integral') || aberta('sinal')
  if (status === 'proposta' && propostaAceita) return aberta('servico')
  return null
}

/**
 * A etapa que o cliente pode pagar agora, ja com a trava da cobranca: o servico
 * so vira "devido" depois que a cobranca saiu (evento 'cobranca_servico'); com
 * recusa na proposta, o admin confere o valor antes. Ate la: "recalculando".
 * Uma fonte so para o GET do pedido, o checkout do cartao e a lista /servicos.
 */
export function etapaCobravel(status: string, propostaAceita: boolean, linhas: LinhaPagamento[], cobrancaEnviada: boolean) {
  const bruta = etapaDevida(status, propostaAceita, linhas)
  const recalculando = bruta?.etapa === 'servico' && !cobrancaEnviada
  return { devida: recalculando ? null : bruta, recalculando }
}

export const MIDIAS_ADMIN = [
  { tipo: 'video_abertura', rotulo: 'Vídeo de abertura', porItem: false },
  { tipo: 'entrada_difusa', rotulo: 'Entrada · difusa', porItem: true },
  { tipo: 'entrada_rasante', rotulo: 'Entrada · rasante', porItem: true },
  { tipo: 'entrada_canto', rotulo: 'Entrada · canto', porItem: true },
  { tipo: 'entrada_borda', rotulo: 'Entrada · borda', porItem: true },
  { tipo: 'entrada_angulo', rotulo: 'Entrada · superfície em ângulo', porItem: true },
  { tipo: 'entrada_dano', rotulo: 'Entrada · dano', porItem: true },
  { tipo: 'processo', rotulo: 'Durante o processo', porItem: true },
  { tipo: 'saida_difusa', rotulo: 'Saída · difusa', porItem: true },
  { tipo: 'saida_rasante', rotulo: 'Saída · rasante', porItem: true },
  { tipo: 'saida_canto', rotulo: 'Saída · canto', porItem: true },
  { tipo: 'saida_borda', rotulo: 'Saída · borda', porItem: true },
  { tipo: 'embalagem', rotulo: 'Embalagem', porItem: false },
  { tipo: 'video_devolucao', rotulo: 'Vídeo de devolução', porItem: false },
  { tipo: 'laudo', rotulo: 'Laudo (PDF ou imagem)', porItem: true },
] as const

export const CAMPOS_LAUDO = [
  { k: 'centralizacao_frente', rotulo: 'Centralização frente', ex: '55/45' },
  { k: 'centralizacao_verso', rotulo: 'Centralização verso', ex: '60/40' },
  { k: 'cantos', rotulo: 'Cantos', ex: '1 com desgaste leve' },
  { k: 'bordas', rotulo: 'Bordas', ex: 'Sem branco' },
  { k: 'superficie', rotulo: 'Superfície', ex: 'Sem risco no holo' },
  { k: 'faixa_nota', rotulo: 'Faixa provável', ex: '8 a 9' },
  { k: 'graduadora', rotulo: 'Graduadora recomendada', ex: 'PSA' },
  { k: 'proximo_passo', rotulo: 'Próximo passo', ex: 'Graduar como está' },
  { k: 'caderno', rotulo: 'Caderno de bancada', ex: '3 ciclos de prensa, UR 45%, parei no ponto seguro' },
] as const

/** #S-0012. Mesmo formato do e-mail e da tela de sucesso. */
export const numeroServico = (n: number) => `#S-${String(n).padStart(4, '0')}`

/** Data e hora em Brasilia: o banco guarda UTC, a tela mostra America/Sao_Paulo. */
export const fmtDataHoraBRT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
})

const PARTES_BRT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Sao_Paulo',
})
function partesBRT(d: Date | string) {
  const p = Object.fromEntries(PARTES_BRT.formatToParts(typeof d === 'string' ? new Date(d) : d).map(x => [x.type, x.value]))
  return { data: `${p.day}/${p.month}/${p.year}`, hora: `${p.hour}:${p.minute}` }
}

/**
 * Documento de gaveta (relatorio de bancada): "dd/mm/aaaa hh:mm" em Brasilia,
 * sempre com ano. Montado por partes para nao depender da virgula que o ICU
 * poe (ou nao) entre data e hora.
 */
export const fmtDataHoraAnoBRT = {
  format: (d: Date | string) => { const p = partesBRT(d); return `${p.data} ${p.hora}` },
}
/** So a data, "dd/mm/aaaa", em Brasilia. */
export const fmtDataAnoBRT = {
  format: (d: Date | string) => partesBRT(d).data,
}

/** Status em que o relatorio de bancada pode ser gerado (painel e rota). */
export const STATUS_RELATORIO = ['pronta', 'enviada', 'entregue', 'devolvida_sem_servico'] as const

// ── Termo de ciencia de risco (aceito junto com o orcamento) ─────────────────
// Cada texto tem uma versao, gravada em servico_solicitacoes.termo_versao no
// aceite. Texto aceito NUNCA muda: correcao vira versao nova. RASCUNHO para
// revisao do Du (inclusive juridica).
// v1: aceito ate 27/09/2026 em todos os servicos (fala de restauracao ate no
// pre-grading, e o item 3 tinha a frase quebrada). Fica aqui para o historico.

export const TERMO_V1 = [
  'A restauração é um trabalho de conservação: prensagem, umidade controlada e limpeza a seco. A Bynx não usa tinta, cola nem corte.',
  'Toda intervenção em papel tem risco. Holo, cartas japonesas e cartas texturizadas reagem de formas diferentes, e o resultado depende do estado em que a carta chega.',
  'A Bynx para no ponto seguro. Se continuar puder danificar a carta, o trabalho é interrompido, mesmo que o defeito não tenha saído por completo.',
  'Nenhuma nota de graduação é garantida. A faixa do pré-grading é uma estimativa; a nota final é da graduadora.',
  'A carta viaja pelo valor declarado no orçamento. Ao chegar, o pacote é aberto em vídeo e a carta recebe um número de custódia.',
  'Se na chegada a carta estiver diferente das fotos, a Bynx avisa antes de qualquer trabalho, e você decide se segue.',
]

/** v2: restauracao e completo. Igual a v1, com o item 3 corrigido. */
export const TERMO_V2 = [
  TERMO_V1[0],
  TERMO_V1[1],
  'A Bynx para no ponto seguro: quando seguir com o trabalho pode danificar a carta, ele é interrompido, mesmo que o defeito não tenha saído por completo.',
  TERMO_V1[3],
  TERMO_V1[4],
  TERMO_V1[5],
]

/** Pre-grading v1: avaliacao sem intervencao nenhuma na carta. */
export const TERMO_PRE_GRADING_V1 = [
  'O pré-grading é uma avaliação: a carta é medida, examinada com lupa e fotografada em luz difusa e rasante. Nada é feito na carta: sem limpeza e sem nenhum tratamento.',
  'O resultado é uma faixa de nota provável, não uma nota. A nota final é atribuída só pela graduadora, com critérios próprios que podem mudar.',
  'O laudo descreve a carta como ela chegou, na data da avaliação. A condição pode mudar depois, no manuseio, na guarda ou no envio.',
  'A Bynx não é afiliada a nenhuma graduadora. Os nomes delas aparecem só para identificar o critério usado na comparação.',
  TERMO_V1[4],
  'Se na chegada a carta estiver diferente das fotos, a Bynx avisa antes da avaliação, e você decide se segue.',
]

/** Todo texto de termo ja publicado, pela versao gravada no pedido. */
export const TERMOS_POR_VERSAO: Record<string, string[]> = {
  'v1-2026-09': TERMO_V1,
  'v2-2026-09': TERMO_V2,
  'pg-v1-2026-09': TERMO_PRE_GRADING_V1,
}

/** Termo vigente para aceitar agora, conforme o servico do pedido. */
export function termoDoServico(servico: string): { versao: string; itens: string[] } {
  return servico === 'pre_grading'
    ? { versao: 'pg-v1-2026-09', itens: TERMO_PRE_GRADING_V1 }
    : { versao: 'v2-2026-09', itens: TERMO_V2 }
}

export const GUIA_EMBALAGEM = [
  'Carta em sleeve e depois em toploader. A fita vai só no toploader, nunca na carta.',
  'Toploader entre dois pedaços de papelão, um de cada lado, presos com fita.',
  'Tudo dentro de um envelope ou caixa que não dobre. Anote o número do pedido por fora.',
  'Envie com rastreio e valor declarado, e informe o código de rastreio na página do pedido.',
]

/**
 * Link de rastreio. Codigo no formato dos Correios (AA123456789BR) abre o
 * rastreio OFICIAL ja com o objeto preenchido (a pessoa so resolve o captcha
 * deles); qualquer outro formato vai para o 17TRACK, que cobre transportadoras.
 */
export function linkRastreio(codigo: string): { href: string; onde: string } {
  const c = codigo.toUpperCase().replace(/[\s.-]/g, '')
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(c)) {
    return { href: `https://rastreamento.correios.com.br/app/index.php?objetos=${c}`, onde: 'Correios' }
  }
  return { href: `https://t.17track.net/pt#nums=${encodeURIComponent(c)}`, onde: '17TRACK' }
}


// ── Fase 2: objetivo, ficha de condicao, protocolo fotografico, proposta ─────

export const OBJETIVOS = [
  { id: 'colecionar', rotulo: 'Colecionar' },
  { id: 'apresentacao', rotulo: 'Melhorar a apresentação' },
  { id: 'preservacao', rotulo: 'Preservação' },
  { id: 'venda', rotulo: 'Vender' },
  { id: 'avaliacao', rotulo: 'Saber a condição' },
  { id: 'graduacao', rotulo: 'Preparar para graduação' },
  { id: 'outro', rotulo: 'Outro' },
] as const
export type ObjetivoId = (typeof OBJETIVOS)[number]['id']

export const GRADUADORAS_ALVO = ['PSA', 'CGC', 'BGS', 'TAG', 'GBA', 'outra', 'indefinida'] as const
export const ROTULO_GRADUADORA: Record<string, string> = { outra: 'Outra', indefinida: 'Ainda não sei' }

/** Alerta que aparece para quem vai graduar (formulario, proposta e termo). */
export const ALERTA_GRADUACAO =
  'Nem todo procedimento que deixa a carta visualmente melhor é adequado para uma carta que vai para graduação. As graduadoras têm regras próprias sobre alteração, e a proposta de tratamento leva isso em conta.'

// Ficha de condicao (entrada e saida). Escala textual, nunca nota: numero
// parece nota de graduadora e contradiz o "nao prometemos nota".
export const ESCALA = [
  { id: 'excelente', rotulo: 'Excelente' },
  { id: 'muito_bom', rotulo: 'Muito bom' },
  { id: 'bom', rotulo: 'Bom' },
  { id: 'regular', rotulo: 'Regular' },
  { id: 'ruim', rotulo: 'Ruim' },
] as const
export const PILARES = [
  { id: 'centralizacao', rotulo: 'Centralização' },
  { id: 'cantos', rotulo: 'Cantos' },
  { id: 'bordas', rotulo: 'Bordas' },
  { id: 'superficie', rotulo: 'Superfície' },
] as const
export const DANOS = [
  { id: 'arranhoes', rotulo: 'Arranhões' },
  { id: 'whitening', rotulo: 'Whitening' },
  { id: 'dobras', rotulo: 'Dobras' },
  { id: 'amassados', rotulo: 'Amassados' },
  { id: 'manchas', rotulo: 'Manchas' },
  { id: 'print_lines', rotulo: 'Print lines' },
  { id: 'impressao', rotulo: 'Imperfeição de impressão' },
  { id: 'residuos', rotulo: 'Resíduos' },
  { id: 'alteracao', rotulo: 'Alteração aparente' },
] as const
export const IDENTIFICACAO = [
  { k: 'colecao', rotulo: 'Coleção' },
  { k: 'numero', rotulo: 'Número' },
  { k: 'variante', rotulo: 'Variante' },
  { k: 'idioma', rotulo: 'Idioma' },
  { k: 'serie', rotulo: 'Número de série' },
] as const

export type Lado = 'frente' | 'verso'
export interface FichaCondicao {
  identificacao: Partial<Record<(typeof IDENTIFICACAO)[number]['k'], string>>
  frente: Partial<Record<(typeof PILARES)[number]['id'], string>>
  verso: Partial<Record<(typeof PILARES)[number]['id'], string>>
  danos_frente: string[]
  danos_verso: string[]
  observacao?: string
}

/** Sanitiza a ficha vinda do painel. Exige os 4 pilares nos dois lados. */
export function validarFicha(entrada: unknown): { ok: true; ficha: FichaCondicao } | { ok: false; erro: string } {
  const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>
  const escala = new Set<string>(ESCALA.map(x => x.id))
  const danos = new Set<string>(DANOS.map(x => x.id))
  const lado = (v: unknown, nome: string) => {
    const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
    const r: Record<string, string> = {}
    for (const p of PILARES) {
      const x = String(o[p.id] || '')
      if (!escala.has(x)) throw new Error(`Avalie ${p.rotulo.toLowerCase()} (${nome})`)
      r[p.id] = x
    }
    return r
  }
  try {
    const idIn = (e.identificacao && typeof e.identificacao === 'object' ? e.identificacao : {}) as Record<string, unknown>
    const identificacao: Record<string, string> = {}
    for (const c of IDENTIFICACAO) {
      const v = typeof idIn[c.k] === 'string' ? (idIn[c.k] as string).trim().slice(0, 80) : ''
      if (v) identificacao[c.k] = v
    }
    const ds = (v: unknown) => (Array.isArray(v) ? v.filter((d): d is string => typeof d === 'string' && danos.has(d)) : [])
    const obs = typeof e.observacao === 'string' ? e.observacao.trim().slice(0, 1000) : ''
    return {
      ok: true,
      ficha: {
        identificacao,
        frente: lado(e.frente, 'frente'),
        verso: lado(e.verso, 'verso'),
        danos_frente: ds(e.danos_frente),
        danos_verso: ds(e.danos_verso),
        ...(obs ? { observacao: obs } : {}),
      },
    }
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : 'Ficha inválida' }
  }
}

// Protocolo fotografico: o que o painel cobra antes de liberar cada passo.
export interface SlotFoto { tipo: string; posicao: string; rotulo: string }
const CANTOS = [
  { p: 'sup_esq', r: 'superior esquerdo' }, { p: 'sup_dir', r: 'superior direito' },
  { p: 'inf_esq', r: 'inferior esquerdo' }, { p: 'inf_dir', r: 'inferior direito' },
]
const cantos = (tipo: string, lado: Lado): SlotFoto[] =>
  CANTOS.map(c => ({ tipo, posicao: `${lado}_${c.p}`, rotulo: `Canto ${c.r} (${lado})` }))

/** Entrada: antes de enviar a proposta (ou de ir para a bancada, no pre-grading). */
export const FOTOS_ENTRADA: SlotFoto[] = [
  { tipo: 'entrada_difusa', posicao: 'frente', rotulo: 'Frente inteira' },
  { tipo: 'entrada_difusa', posicao: 'verso', rotulo: 'Verso inteiro' },
  ...cantos('entrada_canto', 'frente'),
  ...cantos('entrada_canto', 'verso'),
  { tipo: 'entrada_borda', posicao: 'superior', rotulo: 'Borda superior' },
  { tipo: 'entrada_borda', posicao: 'inferior', rotulo: 'Borda inferior' },
  { tipo: 'entrada_borda', posicao: 'esquerda', rotulo: 'Borda esquerda' },
  { tipo: 'entrada_borda', posicao: 'direita', rotulo: 'Borda direita' },
  { tipo: 'entrada_angulo', posicao: 'frente', rotulo: 'Superfície em ângulo' },
]

/** Saida: antes de marcar "pronta", nas cartas que passaram por tratamento. */
export const FOTOS_SAIDA: SlotFoto[] = [
  { tipo: 'saida_difusa', posicao: 'frente', rotulo: 'Frente inteira' },
  { tipo: 'saida_difusa', posicao: 'verso', rotulo: 'Verso inteiro' },
  ...cantos('saida_canto', 'frente'),
  ...cantos('saida_canto', 'verso'),
]

export function fotosFaltando(slots: SlotFoto[], midias: { tipo: string; posicao: string | null }[]): SlotFoto[] {
  const tem = new Set(midias.map(m => `${m.tipo}:${m.posicao || ''}`))
  return slots.filter(s => !tem.has(`${s.tipo}:${s.posicao}`))
}

export const RISCOS = [
  { id: 'baixo', rotulo: 'Risco baixo' },
  { id: 'medio', rotulo: 'Risco médio' },
  { id: 'alto', rotulo: 'Risco alto' },
] as const

// Termo especifico da proposta de tratamento (segundo aceite). RASCUNHO v1
// para revisao do Du e juridica. Trocar TERMO_PROPOSTA_VERSAO junto.
export const TERMO_PROPOSTA_VERSAO = 'proposta-v1-2026-09'
export const TERMO_PROPOSTA_V1 = [
  'Fui informado da condição da minha carta na chegada, registrada na ficha de condição e nas fotos deste pedido, que passam a fazer parte deste termo.',
  'Para cada procedimento, fui informado do problema encontrado, do resultado esperado, do risco e da alternativa de não realizar a intervenção.',
  'Autorizo apenas os procedimentos que marquei como aprovados. Os recusados não serão realizados.',
  'Sei que o resultado depende das características do material e do histórico da carta, e que nenhuma nota de graduação é garantida.',
  'O valor declarado no pedido é a referência para qualquer indenização relacionada a este serviço.',
]

/**
 * Texto de um termo pela versao GRAVADA no pedido (aceite do orcamento ou da
 * proposta). Versao desconhecida devolve null: o relatorio imprime so versao e
 * data, nunca o texto vigente com o rotulo de outra versao.
 */
export function textoDoTermo(versao: string | null | undefined): string[] | null {
  if (!versao) return null
  if (versao === TERMO_PROPOSTA_VERSAO) return TERMO_PROPOSTA_V1
  return TERMOS_POR_VERSAO[versao] || null
}

// ── Laudo: faixa, graduadora e o que falta para valer ───────────────────────

const NOTA_FAIXA = '(10|[1-9](?:[.,]5)?)'
const RE_FAIXA = new RegExp(`^${NOTA_FAIXA} a ${NOTA_FAIXA}$`)

/**
 * Faixa provavel "X a Y" (1 a 10, meio ponto permitido, virgula ou ponto,
 * X < Y). Devolve os limites e o texto normalizado com virgula ("8,5 a 9"),
 * ou null. Nota unica ("10") nunca passa: faixa e intervalo, nao promessa.
 */
export function lerFaixaNota(v: unknown): { min: number; max: number; texto: string } | null {
  if (typeof v !== 'string') return null
  const m = v.trim().toLowerCase().replace(/\s+/g, ' ').match(RE_FAIXA)
  if (!m) return null
  const min = Number(m[1].replace(',', '.'))
  const max = Number(m[2].replace(',', '.'))
  if (!(min >= 1 && max <= 10 && min < max)) return null
  const txt = (n: number) => String(n).replace('.', ',')
  return { min, max, texto: `${txt(min)} a ${txt(max)}` }
}

/** Nome canonico da graduadora do laudo (lista fechada), ou null. */
export function lerGraduadora(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const g = GRADUADORAS.find(x => x.nome.toLowerCase() === v.trim().toLowerCase())
  return g ? g.nome : null
}

// ── Limite de centralizacao publicado por graduadora ───────────────────────
// Numeros = lado maior da proporcao (55 = 55/45), da nota mais alta para a
// mais baixa. Verso null = a graduadora nao separa o verso naquela nota.
// So fonte oficial, consultada em 27/09/2026. Revisar quando alguma mudar.
//  - PSA: psacard.com/gradingstandards (vale para "cards" em geral).
//  - BGS: beckett.com/grading/scale (fora do ar na consulta; lida a copia de
//    03/05/2026 do Wayback Machine). Gem Mint 9.5 e 50/50 num sentido e 55/45
//    no outro: aqui entra o pior sentido.
//  - CGC: cgccards.com/card-grading/grading-scale. Para TCG so a nota 10 tem
//    numero; do 9 para baixo o limite publicado e de esporte/nao-esporte.
//  - TAG: taggrading.com/pages/rubric, coluna de verso de TCG (ate a nota 8).
//  - GBA: gbagrading.com.br/terms fala de centralizacao so de forma qualitativa.

export const LIMITES_CONSULTA = '27/09/2026'

export interface LimiteCentralizacao { nota: string; frente: number; verso: number | null }

export const LIMITES_CENTRALIZACAO: Record<string, { limites: LimiteCentralizacao[]; obs?: string }> = {
  PSA: {
    limites: [
      { nota: 'GEM-MT 10', frente: 55, verso: 75 },
      { nota: 'MINT 9', frente: 60, verso: 90 },
      { nota: 'NM-MT 8', frente: 65, verso: 90 },
      { nota: 'NM 7', frente: 70, verso: 90 },
      { nota: 'EX-MT 6', frente: 80, verso: 90 },
      { nota: 'EX 5', frente: 85, verso: 90 },
    ],
    obs: 'A PSA admite uma folga de 5% na frente para notas 7 ou maiores, conforme o apelo visual.',
  },
  BGS: {
    limites: [
      { nota: 'Pristine 10', frente: 50, verso: 60 },
      { nota: 'Gem Mint 9.5', frente: 55, verso: 60 },
      { nota: 'Mint 9', frente: 55, verso: 70 },
      { nota: 'NM/Mint 8', frente: 60, verso: 80 },
      { nota: 'NM 7', frente: 65, verso: 90 },
      { nota: 'EX Mint 6', frente: 70, verso: 95 },
    ],
    obs: 'A Beckett apresenta esses números como referência geral, não como regra.',
  },
  CGC: {
    limites: [
      { nota: 'Pristine 10', frente: 50, verso: null },
      { nota: 'Gem Mint 10', frente: 55, verso: 75 },
    ],
    obs: 'Para TCG, a CGC publica limite de centralização só na nota 10.',
  },
  TAG: {
    limites: [
      { nota: 'Pristine 10', frente: 51, verso: 52 },
      { nota: 'Gem Mint 10', frente: 55, verso: 65 },
      { nota: 'Mint 9', frente: 60, verso: 75 },
      { nota: '8.5', frente: 62.5, verso: 85 },
      { nota: '8', frente: 65, verso: 95 },
    ],
  },
}

/**
 * Lado maior da centralizacao anotada ("55/45" -> 55). Aceita virgula e mais de
 * uma proporcao ("55/45 e 52/48", um por eixo): vale a pior. null se nao ler.
 */
export function lerProporcao(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const pares = [...v.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*\/\s*(\d{1,3}(?:[.,]\d+)?)/g)]
  if (!pares.length) return null
  let pior = 0
  for (const [, a, b] of pares) {
    const x = Number(a.replace(',', '.')), y = Number(b.replace(',', '.'))
    if (!(x >= 0 && y >= 0) || Math.abs(x + y - 100) > 1) return null
    pior = Math.max(pior, x, y)
  }
  return pior
}

const pct = (n: number) => `${String(n).replace('.', ',')}/${String(Math.round((100 - n) * 10) / 10).replace('.', ',')}`

/**
 * Compara a centralizacao medida com o limite publicado da graduadora. Texto
 * pronto para o relatorio, ou null quando nao ha graduadora ou medida legivel.
 * Nunca promete nota: diz so em que faixa da tabela a centralizacao cabe.
 */
export function compararCentralizacao(graduadora: string | null, frente: unknown, verso: unknown): { texto: string; nota: string } | null {
  if (!graduadora) return null
  const nota = `Critério publicado pela ${graduadora}, consultado em ${LIMITES_CONSULTA}. A centralização é só um dos critérios da nota.`
  const tab = LIMITES_CENTRALIZACAO[graduadora]
  if (!tab) return { texto: `A ${graduadora} não publica limite de centralização em proporção, então esta comparação não se aplica.`, nota: `Consultado em ${LIMITES_CONSULTA}.` }
  const f = lerProporcao(frente), v = lerProporcao(verso)
  if (f == null || v == null) return null
  const notaCompleta = tab.obs ? `${nota} ${tab.obs}` : nota
  const cabe = tab.limites.find(l => f <= l.frente && (l.verso == null || v <= l.verso))
  if (cabe) {
    const lim = `frente até ${pct(cabe.frente)}${cabe.verso != null ? ` e verso até ${pct(cabe.verso)}` : ''}`
    return { texto: `Pela centralização, a carta cabe no limite da ${graduadora} para ${cabe.nota} (${lim}).`, nota: notaCompleta }
  }
  const ultima = tab.limites[tab.limites.length - 1]
  return {
    texto: `A centralização fica fora dos limites publicados pela ${graduadora}. O mais largo da tabela, ${ultima.nota}, vai até ${pct(ultima.frente)} na frente${ultima.verso != null ? ` e ${pct(ultima.verso)} no verso` : ''}.`,
    nota: notaCompleta,
  }
}

/**
 * O que falta para o laudo valer (trava de "pronta" e relatorio). Anexo em PDF
 * nao cumpre: o relatorio imprime o laudo preenchido.
 */
export function faltasDoLaudo(laudo: unknown): string[] {
  const l = (laudo && typeof laudo === 'object' ? laudo : {}) as Record<string, unknown>
  const tem = (k: string) => typeof l[k] === 'string' && (l[k] as string).trim() !== ''
  const faltas: string[] = []
  if (!lerFaixaNota(l.faixa_nota)) faltas.push('faixa provável')
  if (!lerGraduadora(l.graduadora)) faltas.push('graduadora')
  if (!tem('centralizacao_frente')) faltas.push('centralização da frente')
  if (!tem('centralizacao_verso')) faltas.push('centralização do verso')
  return faltas
}

// ── Ficha: chegada comparada com a saida ────────────────────────────────────

export type Variacao = 'melhorou' | 'igual' | 'piorou'
export interface LinhaFicha {
  lado: Lado
  pilar: string
  /** id da ESCALA */
  chegada: string | null
  saida: string | null
  /** null quando falta um dos lados da comparacao. */
  variacao: Variacao | null
}

/**
 * Pilar a pilar, frente e verso. Uma regra so para o e-mail "pronta" e para o
 * relatorio: a ESCALA vai do melhor (indice 0) para o pior.
 */
export function compararFicha(entrada: FichaCondicao | null, saida: FichaCondicao | null): LinhaFicha[] {
  const ordem = new Map<string, number>(ESCALA.map((e, i) => [e.id, i]))
  const linhas: LinhaFicha[] = []
  for (const lado of ['frente', 'verso'] as const) {
    for (const p of PILARES) {
      const a = entrada?.[lado]?.[p.id] || null
      const b = saida?.[lado]?.[p.id] || null
      if (!a && !b) continue
      let variacao: Variacao | null = null
      if (a && b) {
        const ia = ordem.get(a) ?? 99, ib = ordem.get(b) ?? 99
        variacao = ib < ia ? 'melhorou' : ib > ia ? 'piorou' : 'igual'
      }
      linhas.push({ lado, pilar: p.id, chegada: a, saida: b, variacao })
    }
  }
  return linhas
}


// ── Shorts da bancada (secao em carrossel na landing) ───────────────────────
// Legenda escrita para a pagina (sem contracao), a partir do titulo do video.
// `vertical`: o YouTube tem miniatura vertical (oardefault) para este short;
// sem ela, o componente usa a hqdefault.
export const SHORTS: { id: string; titulo: string; tema: string; vertical: boolean }[] = [
  { id: '8ROgeOQHqP8', tema: 'Preparação', titulo: 'O ritual de preparação antes da graduação', vertical: true },
  { id: 'p8qU2bMirkI', tema: 'Centralização', titulo: 'Como medimos a centralização antes de graduar', vertical: false },
  { id: 'WfhJcA3RXqQ', tema: 'Limpeza', titulo: 'Cartas de 1999 depois de anos esquecidas numa caixa', vertical: false },
  { id: 'invoH6DVGCU', tema: 'Resultado', titulo: 'Uma Clefairy graduada na AGS: a nota surpreendeu', vertical: false },
  { id: 'hpGch0jUrQQ', tema: 'Resultado', titulo: 'Os três iniciais de Kanto na AGS: saiu 10?', vertical: true },
]


// ── Pre-grading: passos e FAQ proprios da landing ──────────────────────────
// A landing do pre-grading nao tem proposta de tratamento: o pagamento e um
// so, no aceite (FAQ "Quando eu pago?"). Por isso os passos sao outros.

export const PASSOS_PRE_GRADING = [
  {
    t: 'Orçamento pelas fotos',
    d: PRAZOS.orcamento
      ? `Você manda frente e verso. A Bynx responde em até ${PRAZOS.orcamento}, antes de qualquer envio.`
      : 'Você manda frente e verso. A Bynx responde antes de qualquer envio.',
  },
  { t: 'Você aprova e envia', d: 'No pré-grading o pagamento é um só, no aceite. Aí aparece o endereço, com o guia de embalagem.' },
  { t: 'Chegada filmada', d: PASSOS[2].d },
  { t: 'Medição na bancada', d: 'Régua, lupa e luz rasante, frente e verso. Nenhuma etapa é feita no olho.' },
  { t: 'Laudo na sua conta', d: 'Faixa provável, graduadora recomendada, próximo passo e as fotos de entrada.' },
  { t: 'Volta preparada', d: 'Sleeve, toploader, embalagem lacrada e código de rastreio na sua conta.' },
]

/** Perguntas que so a landing do pre-grading faz. Entram antes das emprestadas da restauracao. */
export const FAQ_PRE_GRADING_EXTRA: Faq[] = [
  {
    q: 'E se o laudo disser que não vale graduar?',
    a: `${PRECOS ? `Os R$ ${brl(PRECOS.preGrading)}` : 'O pré-grading'} ${PRECOS ? 'pagaram' : 'pagou'} justamente essa resposta. A carta volta com o laudo e a decisão é sua.`,
  },
  {
    q: 'Dá para avaliar só pelas fotos?',
    a: 'As fotos servem para o orçamento. A medição que vira laudo é feita com a carta na bancada.',
  },
  {
    q: 'Posso mandar várias cartas de uma vez?',
    a: `Sim, até ${MAX_CARTAS_POR_SOLICITACAO} por solicitação.${PRECOS?.desc10a20 != null ? ` De 10 a 20 cartas entra o desconto de ${PRECOS.desc10a20}%.` : ''}`,
  },
]

/** FAQ completo da landing (HTML e JSON-LD): as proprias, as novas, depois as da restauracao. */
export const FAQ_PRE_GRADING_LANDING: Faq[] = [
  ...FAQ_PRE_GRADING.filter(f => !FAQ_RESTAURACAO.includes(f)),
  ...FAQ_PRE_GRADING_EXTRA,
  ...FAQ_PRE_GRADING.filter(f => FAQ_RESTAURACAO.includes(f)),
]
