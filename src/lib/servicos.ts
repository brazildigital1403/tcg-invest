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
  /** Seguro sobre o valor declarado, em %. null = ainda nao definido. */
  seguroPct: number | null
  /** Desconto por volume, em %. null = sem desconto anunciado. */
  desc10a20: number | null
  descAcima20: number | null
}

/**
 * Valores por carta definidos pelo Du em 26/09/2026. Seguro (7%, so restauracao
 * e completo) e descontos por volume (10% de 10 a 20 cartas, 15% acima) seguem
 * a referencia de mercado, decisao dele no mesmo dia. Expresso: + R$ 350 por
 * ate 4 dias corridos (PRAZOS).
 */
export const PRECOS: Precos | null = {
  restauracao: 165,
  preGrading: 80,
  completo: 450,
  expresso: 350,
  seguroPct: 7,
  desc10a20: 10,
  descAcima20: 15,
}

// Definidos pelo Du em 26/09/2026.
export const PRAZOS = {
  /** Dias uteis apos a chegada da carta. */
  padraoDiasUteis: 5 as number | null,
  /** Dias corridos do expresso. */
  expressoDias: 4 as number | null,
  /** Prazo do orcamento depois do envio das fotos. */
  orcamento: '48 horas' as string | null,
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
  { t: 'Chegada filmada', d: 'O pacote é aberto em vídeo, sem corte, com a etiqueta visível. A carta ganha um número de custódia e uma ficha de condição com fotos de cada canto.' },
  { t: 'Você aprova o tratamento', d: 'Para cada carta chega uma proposta: o que foi encontrado, o que fazer, o risco e a alternativa de não mexer. Nada começa sem o seu sim.' },
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
  proposta: 'Proposta de tratamento',
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

// ── Termo de ciencia de risco (aceito junto com o orcamento) ─────────────────
// Versao em servicosServer.TERMO_VERSAO_ATUAL: trocar as duas juntas quando o
// texto mudar. RASCUNHO v1 para revisao do Du (inclusive juridica).

export const TERMO_V1 = [
  'A restauração é um trabalho de conservação: prensagem, umidade controlada e limpeza a seco. A Bynx não usa tinta, cola nem corte.',
  'Toda intervenção em papel tem risco. Holo, cartas japonesas e cartas texturizadas reagem de formas diferentes, e o resultado depende do estado em que a carta chega.',
  'A Bynx para no ponto seguro. Se continuar puder danificar a carta, o trabalho é interrompido, mesmo que o defeito não tenha saído por completo.',
  'Nenhuma nota de graduação é garantida. A faixa do pré-grading é uma estimativa; a nota final é da graduadora.',
  'A carta viaja pelo valor declarado no orçamento. Ao chegar, o pacote é aberto em vídeo e a carta recebe um número de custódia.',
  'Se na chegada a carta estiver diferente das fotos, a Bynx avisa antes de qualquer trabalho, e você decide se segue.',
]

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
