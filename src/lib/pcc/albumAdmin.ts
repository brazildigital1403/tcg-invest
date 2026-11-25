// Album do Club no /admin (21/11/2026): tipos do painel, textos dos erros do banco e os
// pequenos conversores que a tela e a rota dividem. Sem nada de servidor aqui: a tela
// importa este arquivo no navegador. O envio da arte (servidor) fica em albumArte.ts.

import type { MissaoId } from '@/lib/pcc/album'

export type FaseEdicao = 'rascunho' | 'agendada' | 'aberta' | 'so_pedidos' | 'prazo_encerrado' | 'encerrada'

export type RegraTipo = 'manual' | 'sinal' | 'cartas_da_edicao' | 'conteudos' | 'conteudos_sequencia' | 'capitulos'
export type PapelEdicao = 'base' | 'capitulo' | 'especial'
export type TrilhaEdicao = 'creator' | 'bynx' | 'club'

export type CartaAdmin = {
  id: string
  numero: number
  missao: MissaoId
  modo: 'auto' | 'manual'
  como_ganhar: string
  nome: string | null
  tipo: string | null
  raridade: string | null
  texto_efeito: string | null
  homenageado: string | null
  arte_path: string | null
  previa: boolean
  secreta: boolean
  /** A regra da missão (Fase 2): tipo em lista fechada, parâmetro e "só vale depois da abertura". */
  regra_tipo: RegraTipo | null
  regra_param: Record<string, unknown>
  regra_desde_abertura: boolean
  /** O rosto da missão no álbum: título curto, ícone, texto do botão e para onde ele leva. */
  missao_titulo: string | null
  missao_icone: string | null
  missao_botao: string | null
  missao_href: string | null
  /** Quantas pessoas têm a carta (sem contar as revogadas) e quantas já viraram. */
  donos: number
  viradas: number
}

export type EdicaoAdmin = {
  id: string
  slug: string
  edicao: number
  titulo: string
  status: 'rascunho' | 'publicada' | 'encerrada'
  fase: FaseEdicao
  abre_em: string | null
  fecha_em: string | null
  pedir_set_ate: string | null
  tiragem_fisica: number | null
  papel: PapelEdicao
  trilha: TrilhaEdicao | null
  ciclo: number
  /** Quantas cartas a edição precisa ter para publicar (12 na Base, 9 nos capítulos). */
  total_previsto: number | null
  /** 1 = regra da Fase 1 (a edição 1); 2 = regra por dado, editável aqui. */
  motor: 1 | 2
  total_cartas: number
  faltando: { numero: number; campos: string[] }[]
  resumo: { pessoas: number; ganhas: number; reveladas: number; pedidos: number; pedidos_ativos: number }
  cartas: CartaAdmin[]
}

export type PainelAdmin = {
  edicoes: { slug: string; edicao: number; titulo: string; status: string; papel: PapelEdicao; trilha: TrilhaEdicao | null }[]
  edicao: EdicaoAdmin | null
}

export type EstadoLinha = 'recebe' | 'ja_tem' | 'nao_membro' | 'sem_conta' | 'ambiguo'
export type LinhaPrevia = { token: string; estado: EstadoLinha; nome: string | null; instagram: string | null; faltam: number }
export type PreviaLote = { linhas: LinhaPrevia[]; totais: Record<EstadoLinha, number> }

export type ResultadoLote = {
  lote: string | null
  pessoas: number
  ignorados: number
  novas: number
  reativadas: number
  ja_tinham: number
  nao_membros: { token: string; nome: string | null }[]
  nao_encontrados: string[]
  ambiguos: string[]
}

export type ItemHistorico = {
  id: number
  quando: string
  papel: string
  /** @ de quem fez; nulo quando foi o Admin. */
  quem: string | null
  acao: string
  alvo: string | null
  detalhe: Record<string, unknown> | null
  /** Só nos lotes concedidos: quantas linhas ainda valem (maior que zero = dá para desfazer). */
  ativas: number | null
}

export type StatusPedido = 'solicitada' | 'combinada' | 'postada' | 'entregue' | 'cancelada'
export type PedidoSetAdmin = {
  numero: number
  status: StatusPedido
  nota: string | null
  criado_em: string
  atualizado_em: string
  nome: string | null
  instagram: string | null
  email: string | null
  whatsapp: string | null
}
export type PedidosAdmin = { tiragem: number | null; ativos: number; lista: PedidoSetAdmin[] }

export const PAPEIS_EDICAO: Record<PapelEdicao, string> = { base: 'Base', capitulo: 'Capítulo', especial: 'Especial' }
export const TRILHAS: Record<TrilhaEdicao, string> = { creator: 'Creator', bynx: 'Bynx', club: 'Club' }

export const REGRAS: Record<RegraTipo, string> = {
  manual: 'Manual: a organização concede',
  sinal: 'Sinal: o site confere um gesto',
  cartas_da_edicao: 'Cartas da edição: deriva de outras cartas',
  conteudos: 'Conteúdos do portfólio',
  conteudos_sequencia: 'Semanas seguidas com conteúdo',
  capitulos: 'Capítulos fechados: deriva do álbum inteiro',
}

/**
 * As fontes do tipo "sinal", iguais às do banco (club_sinal_conta). `n` = a fonte tem um limiar próprio
 * (cartas na pasta, cartas do set, tamanho da meta). `semData` = não aceita "só vale depois da abertura".
 * `fatia2` = a tabela chega com o portfólio: a regra é aceita, mas ainda não confere nada.
 */
export const FONTES: { id: string; nome: string; n?: string; semData?: boolean; fatia2?: boolean }[] = [
  { id: 'membro', nome: 'É membro do Club' },
  { id: 'aniversario', nome: 'Data nos Aniversariantes' },
  { id: 'instagram', nome: '@ do Instagram no perfil', semData: true },
  { id: 'voto', nome: 'Voto em enquete do Club' },
  { id: 'indicacao', nome: 'Indicação ativada' },
  { id: 'colecao_cartas', nome: 'Cartas na coleção' },
  { id: 'colecao_graduada', nome: 'Carta graduada' },
  { id: 'colecao_dias', nome: 'Dias diferentes adicionando carta' },
  { id: 'colecao_set', nome: 'Cartas do mesmo set', n: 'Cartas no set' },
  { id: 'meta', nome: 'Meta de coleção criada' },
  { id: 'meta_concluida', nome: 'Meta de coleção concluída', n: 'Tamanho mínimo da meta' },
  { id: 'pasta', nome: 'Pasta com cartas', n: 'Cartas na pasta' },
  { id: 'pasta_publica', nome: 'Pasta pública', n: 'Cartas na pasta' },
  { id: 'acompanhando', nome: 'Cartas acompanhadas' },
  { id: 'preco_alvo', nome: 'Preço-alvo definido' },
  { id: 'centralizacao', nome: 'Centralização medida' },
  { id: 'ficha_criador', nome: 'Ficha de criador', fatia2: true },
  { id: 'bio_criador', nome: 'Bio de uma linha', fatia2: true },
  { id: 'aceite', nome: 'Aceite de um termo', fatia2: true },
]

/** Os ícones que o álbum sabe desenhar (amigo-secreto/estilo.tsx). Ícone novo é código. */
export const ICONES_MISSAO = [
  'star', 'cal', 'insta', 'colecao', 'enquete', 'share', 'trophy', 'users', 'mic', 'trend', 'chat', 'spark',
  'eye', 'search', 'pin', 'livro', 'gift', 'video', 'link', 'megafone', 'loja', 'sacola', 'tachinha', 'check', 'clock', 'box', 'lock', 'user',
] as const

/** A regra em uma frase, para a lista de cartas do Admin. */
export function resumoRegra(c: Pick<CartaAdmin, 'regra_tipo' | 'regra_param' | 'regra_desde_abertura'>): string {
  const p = c.regra_param || {}
  const depois = c.regra_desde_abertura ? ', só depois da abertura' : ''
  if (!c.regra_tipo) return 'Sem regra'
  if (c.regra_tipo === 'manual') return 'A organização concede'
  if (c.regra_tipo === 'sinal') {
    const f = FONTES.find(x => x.id === p.fonte)
    const n = f?.n && p.n ? ` (${f.n.toLowerCase()}: ${p.n})` : ''
    return `${f?.nome || String(p.fonte)}${n}, mínimo ${p.minimo}${depois}`
  }
  if (c.regra_tipo === 'cartas_da_edicao') {
    return p.todas ? `Ter ${p.minimo} das outras cartas desta edição` : `Ter ${p.minimo} destas: ${Array.isArray(p.chaves) ? p.chaves.join(', ') : ''}`
  }
  if (c.regra_tipo === 'conteudos') {
    const filtros = (['formato', 'tema', 'rede'] as const).filter(k => p[k]).map(k => `${k} ${p[k]}`).join(', ')
    return `${p.minimo} conteúdo(s) no portfólio${filtros ? ` (${filtros})` : ''}${depois}`
  }
  if (c.regra_tipo === 'capitulos') {
    const trilha = typeof p.trilha === 'string' ? TRILHAS[p.trilha as TrilhaEdicao] : null
    return `Ter ${p.minimo} capítulos fechados${trilha ? ` da trilha ${trilha}` : ''}`
  }
  return `${p.semanas} semanas seguidas com conteúdo${depois}`
}

export const FASES: Record<FaseEdicao, string> = {
  rascunho: 'Rascunho',
  agendada: 'Agendada',
  aberta: 'Aberta',
  so_pedidos: 'Só pedidos do set',
  prazo_encerrado: 'Prazo encerrado',
  encerrada: 'Encerrada',
}

/** Mensagens das funções do banco e da rota, em texto para quem está no Admin. */
export function erroAdminAlbum(codigo?: string | null, detalhe?: string | null): string {
  const c = (codigo || '').trim()
  const mapa: Record<string, string> = {
    nome_invalido: 'O nome precisa ter de 2 a 60 caracteres.',
    tipo_invalido: 'O tipo precisa ter de 2 a 30 caracteres.',
    raridade_invalida: 'A raridade precisa ter de 2 a 30 caracteres.',
    texto_invalido: 'O texto precisa ter até 280 caracteres.',
    homenageado_invalido: 'A homenagem precisa ter de 2 a 80 caracteres.',
    como_ganhar_invalido: 'O "como ganhar" precisa ter de 3 a 80 caracteres.',
    previa_invalida: 'Valor de prévia inválido.',
    previa_e_secreta: 'A carta secreta não pode ser prévia.',
    previa_sem_rosto: 'Para liberar a prévia, a carta precisa de nome e de arte.',
    campo_obrigatorio: 'Com a edição publicada, nome, tipo, raridade, texto e arte não podem ficar em branco.',
    arte_invalida: 'Caminho de arte inválido.',
    arte_repetida: 'Essa arte já está em outra carta.',
    arte_tamanho: 'A arte precisa ter até 4 MB.',
    arte_tipo: 'Use uma imagem PNG, JPG ou WebP.',
    arte_envio: 'Não conseguimos enviar a arte. Tente de novo.',
    edicao_encerrada: 'A edição está encerrada: nada mais muda nela.',
    edicao_nao_encontrada: 'Edição não encontrada.',
    carta_nao_encontrada: 'Carta não encontrada.',
    titulo_invalido: 'O título precisa ter de 3 a 80 caracteres.',
    tiragem_invalida: 'A tiragem é um número inteiro, ou vazia para ficar sem teto.',
    tiragem_menor_que_pedidos: 'Já existem mais pedidos do set do que essa tiragem.',
    data_invalida: 'Data inválida.',
    datas_fora_de_ordem: 'A abertura precisa vir antes do fim, e o fim antes do prazo do set.',
    ja_abriu: 'A edição já abriu: a abertura não muda mais.',
    datas_so_depois_de_publicar: 'As datas só existem depois de publicar.',
    estado_invalido: 'Essa ação não vale para o estado atual da edição.',
    prazo_invalido: 'Use de 7 a 365 dias para ganhar cartas e de 0 a 120 para pedir o set.',
    lista_grande_demais: 'Cole no máximo 200 nomes por vez.',
    sem_cartas: 'Escolha pelo menos uma carta.',
    sem_pessoas: 'Cole pelo menos um @ ou e-mail.',
    origem_invalida: 'Origem inválida.',
    lote_nao_encontrado: 'Lote não encontrado.',
    status_invalido: 'Andamento inválido.',
    pedido_nao_encontrado: 'Pedido não encontrado.',
    pedido_cancelado: 'Pedido cancelado não muda.',
    pedido_entregue: 'Pedido entregue não cancela.',
    slug_invalido: 'O endereço usa só letras minúsculas, números e hífen, sem espaço.',
    slug_repetido: 'Já existe uma edição com esse endereço.',
    edicao_repetida: 'Não conseguimos numerar a edição. Tente de novo.',
    papel_invalido: 'Papel inválido.',
    trilha_invalida: 'Trilha inválida.',
    total_invalido: 'O total de cartas vai de 1 a 99.',
    ciclo_invalido: 'Ciclo inválido.',
    base_repetida: 'Este ciclo já tem uma Base.',
    edicao_motor_antigo: 'A edição 1 usa a regra da Fase 1: cartas e regras dela não mudam por aqui.',
    edicao_publicada: 'Só dá para mexer em cartas e regras com a edição em rascunho. Recolha a edição antes.',
    edicao_cheia: 'A edição já tem todas as cartas previstas.',
    numero_invalido: 'O número da carta vai de 1 a 99.',
    numero_repetido: 'Já existe uma carta com esse número nesta edição.',
    missao_invalida: 'A chave da missão usa só letras minúsculas, números e sublinhado (2 a 40).',
    missao_repetida: 'Já existe uma carta com essa chave de missão nesta edição.',
    secreta_invalida: 'Valor de carta secreta inválido.',
    fonte_sem_data: 'Essa fonte não tem data: não dá para marcar "só vale depois da abertura".',
    missao_titulo_invalido: 'O título da missão precisa ter de 2 a 30 caracteres.',
    missao_icone_invalido: 'Ícone fora da lista.',
    missao_botao_invalido: 'O botão precisa de texto (2 a 24 caracteres) e de destino, os dois juntos.',
    missao_href_invalido: 'O destino do botão é um caminho do site, começando com barra. Endereço de fora não vale.',
    carta_com_dono: 'Alguém já tem essa carta: ela não pode ser apagada.',
    brinde_so_na_base: 'A camiseta entrega só as cartas da Base.',
    'Não autorizado': 'Sessão do Admin expirada. Entre de novo.',
  }
  if (c === 'regra_invalida') {
    const d = (detalhe || '').trim()
    return /^[0-9]+$/.test(d) ? `A regra da carta ${d} está inválida. Abra a missão dela e salve de novo.` : `Regra inválida${d ? ` (${d})` : ''}. Confira o tipo, a fonte e os números.`
  }
  if (c === 'cartas_incompletas') {
    const d = (detalhe || '').trim()
    if (d && /^[0-9,]+$/.test(d)) return `Faltam dados nas cartas ${d.split(',').join(', ')}. Veja o aviso no topo.`
    const m = /^cartas: (\d+) de (\d+|\?)$/.exec(d)
    return m ? `A edição tem ${m[1]} de ${m[2]} cartas. Crie as que faltam antes de publicar.` : 'A edição precisa ter todas as cartas completas (nome, tipo, raridade, texto, arte e título da missão).'
  }
  return mapa[c] || 'Não conseguimos concluir. Tente de novo.'
}

/** Texto colado (um por linha, ou separado por vírgula, ponto e vírgula ou espaço) em lista de @ ou e-mails, sem repetir. */
export function separarTokens(texto: string): string[] {
  const vistos = new Set<string>()
  const lista: string[] = []
  for (const bruto of texto.split(/[\s,;]+/)) {
    const t = bruto.trim()
    const chave = t.toLowerCase().replace(/^@+/, '')
    if (!t || !chave || vistos.has(chave)) continue
    vistos.add(chave)
    lista.push(t)
  }
  return lista
}

/** Horário de Brasília como o campo datetime-local pede: 2026-11-21T03:10. */
export function paraDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d)
  const p = (t: string) => partes.find(x => x.type === t)?.value || ''
  return `${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}`
}

/** O contrário: o valor do campo (horário de Brasília) em ISO. O Brasil não tem horário de verão desde 2019: -03:00 fixo. */
export function deDatetimeLocal(s: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec((s || '').trim())
  if (!m) return null
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00-03:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Data e hora curtas em Brasília: 21/11 03:10. */
export const dataHoraCurta = (iso: string | null | undefined): string =>
  iso ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)).replace(',', '') : '-'

export const dataBr = (iso: string | null | undefined): string =>
  iso ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso)) : '-'
