// Album do Club no /admin (21/11/2026): tipos do painel, textos dos erros do banco e os
// pequenos conversores que a tela e a rota dividem. Sem nada de servidor aqui: a tela
// importa este arquivo no navegador. O envio da arte (servidor) fica em albumArte.ts.

import type { MissaoId } from '@/lib/pcc/album'

export type FaseEdicao = 'rascunho' | 'agendada' | 'aberta' | 'so_pedidos' | 'prazo_encerrado' | 'encerrada'

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
  total_cartas: number
  faltando: { numero: number; campos: string[] }[]
  resumo: { pessoas: number; ganhas: number; reveladas: number; pedidos: number; pedidos_ativos: number }
  cartas: CartaAdmin[]
}

export type PainelAdmin = {
  edicoes: { slug: string; edicao: number; titulo: string; status: string }[]
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
    'Não autorizado': 'Sessão do Admin expirada. Entre de novo.',
  }
  if (c === 'cartas_incompletas') {
    const d = (detalhe || '').trim()
    return d && /^[0-9,]+$/.test(d) ? `Faltam dados nas cartas ${d.split(',').join(', ')}. Veja o aviso no topo.` : 'A edição precisa ter as 12 cartas completas (nome, tipo, raridade, texto e arte).'
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
