// Servicos de bancada da Bynx: restauracao de cartas e pre-grading (fase 1).
//
// Tudo o que as paginas /restauracao-de-cartas, /pre-grading e
// /restauracao-de-cartas/agendar mostram sai daqui: flags, precos, prazos,
// listas, FAQ e casos. Uma fonte so, pra pagina, JSON-LD e formulario nunca
// divergirem (a mesma conta em dois lugares sempre diverge).
//
// ★ Enquanto SERVICOS_PUBLICADO = false as paginas saem com noindex e nada no
// site aponta pra elas. SERVICOS_FORM_ATIVO liga o envio do formulario
// (tabelas da F7 + rotas /api/servicos da F8). Desligado, nada sai do navegador.
// Valor `null` = decisao pendente do Du: a secao que depende dele nao aparece.

export const SERVICOS_PUBLICADO = false
export const SERVICOS_FORM_ATIVO = true

export type ServicoId = 'restauracao' | 'pre_grading' | 'completo'

export interface Precos {
  restauracao: number
  preGrading: number
  completo: number
  /** Acrescimo do prazo expresso. null = sem expresso. */
  expresso: number | null
  /** Seguro sobre o valor declarado, em %. */
  seguroPct: number
  /** Desconto por volume, em %. */
  desc10a20: number
  descAcima20: number
}

/** null ate o Du fechar os valores. A secao de preco nao renderiza sem eles. */
export const PRECOS: Precos | null = null

export const PRAZOS = {
  /** Dias uteis apos a chegada da carta. */
  padraoDiasUteis: null as number | null,
  /** Dias corridos do expresso. */
  expressoDias: null as number | null,
  /** Prazo do orcamento depois do envio das fotos. */
  orcamento: null as string | null,
}

export const LINKS = {
  whatsapp: null as string | null,
  instagram: 'https://instagram.com/bynx.gg',
  youtube: null as string | null,
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
  { t: 'Você aprova e envia', d: 'O endereço aparece só depois do aceite, com o guia de embalagem.' },
  { t: 'Chegada filmada', d: 'O pacote é aberto em vídeo, sem corte, com a etiqueta visível. A carta ganha um número de custódia.' },
  { t: 'Bancada e descanso', d: 'Depois da prensa, a carta descansa. É essa etapa que faz o resultado durar, e ela não tem atalho.' },
  { t: 'Volta com laudo e rastreio', d: 'Fotos de saída na mesma luz da entrada, embalagem lacrada e código de rastreio na sua conta.' },
]

export const CUSTODIA = [
  { t: 'Vídeo do pacote abrindo', d: 'Plano único, sem corte, com a etiqueta visível do começo ao fim.' },
  { t: 'Foto de entrada antes de qualquer toque', d: 'Na mesma luz e no mesmo enquadramento da foto de saída, para você comparar.' },
  { t: 'Status na sua conta a cada etapa', d: 'Recebida, em bancada, descansando, pronta, enviada. Com foto em cada passo.' },
  { t: 'Envio com valor declarado', d: 'A carta viaja segurada pelo valor que você informou no orçamento.' },
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
    q: 'E se a carta se perder no correio?',
    a: 'Ela viaja com valor declarado nos dois sentidos, e cada etapa fica registrada na sua conta com foto. O endereço de envio só aparece depois que você aprova o orçamento.',
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
    a: 'O prazo conta a partir da chegada e aparece no orçamento. Parte dele é o descanso depois da prensa, que é o que faz o resultado durar.',
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
  FAQ_RESTAURACAO[0],
  FAQ_RESTAURACAO[4],
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
  em_bancada: 'Em bancada',
  descansando: 'Descansando',
  pronta: 'Pronta',
  enviada: 'Enviada',
  entregue: 'Entregue',
  devolvida_sem_servico: 'Devolvida sem serviço',
  cancelado: 'Cancelado',
}

/**
 * Para onde o ADMIN pode mover cada status. Orcar (aguardando -> orcado |
 * recusado_bynx) tem acao propria, com valores. `orcado -> aceito` existe aqui
 * porque, enquanto nao ha pagina do cliente, o aceite combinado por WhatsApp e
 * registrado pelo admin.
 */
export const TRANSICOES_ADMIN: Record<string, string[]> = {
  aguardando_orcamento: ['cancelado'],
  orcado: ['aceito', 'recusado_cliente', 'cancelado'],
  aceito: ['recebida', 'cancelado'],
  recebida: ['em_bancada', 'devolvida_sem_servico'],
  em_bancada: ['descansando', 'pronta', 'devolvida_sem_servico'],
  descansando: ['em_bancada', 'pronta'],
  pronta: ['enviada'],
  enviada: ['entregue'],
}

/** De quem e a vez: a pergunta que o painel responde primeiro. */
export function turnoServico(status: string): 'bynx' | 'cliente' | 'fim' {
  if (['orcado', 'aceito'].includes(status)) return 'cliente'
  if (['entregue', 'cancelado', 'recusado_cliente', 'recusado_bynx', 'devolvida_sem_servico'].includes(status)) return 'fim'
  return 'bynx'
}

export const MIDIAS_ADMIN = [
  { tipo: 'video_abertura', rotulo: 'Vídeo de abertura', porItem: false },
  { tipo: 'entrada_difusa', rotulo: 'Entrada · difusa', porItem: true },
  { tipo: 'entrada_rasante', rotulo: 'Entrada · rasante', porItem: true },
  { tipo: 'saida_difusa', rotulo: 'Saída · difusa', porItem: true },
  { tipo: 'saida_rasante', rotulo: 'Saída · rasante', porItem: true },
  { tipo: 'embalagem', rotulo: 'Embalagem', porItem: false },
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
