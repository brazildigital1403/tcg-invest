// Álbum do Club (19/11/2026). As edições, as cartas, quem ganhou o quê e o pedido do set
// físico moram em club_colecoes, club_cartas, club_desbloqueios e club_retiradas
// (migration 20261119100000_club_album). O navegador só fala com três funções:
// club_colecao_minha (lê o álbum e confere as missões automáticas), club_carta_virar e
// club_retirada_pedir. Carta bloqueada nunca traz arte, nome nem texto: o banco não envia.

import { supabase } from '@/lib/supabaseClient'
import { dataCurta } from '@/lib/amigoSecreto'
import { AGENDA, ANIVERSARIANTES, AVISOS, CLUB } from '@/lib/pcc/rotas'

export type EstadoCarta = 'nova' | 'ganha' | 'bloqueada' | 'previa' | 'secreta'
export type OrigemCarta = 'auto' | 'manual' | 'brinde'

/** A chave da missão. Na edição 1 são as doze da Fase 1; nos capítulos é livre (vem do banco). */
export type MissaoId = string

export type CartaAlbum = {
  numero: number
  estado: EstadoCarta
  modo: 'auto' | 'manual'
  secreta: boolean
  previa: boolean
  como_ganhar: string
  /** Falta só na carta secreta que ainda não foi ganha. */
  missao?: MissaoId
  /** O rosto da missão vindo do banco (Fase 2). Quando falta, vale o mapa MISSOES abaixo. */
  missao_titulo?: string | null
  missao_icone?: string | null
  missao_botao?: string | null
  missao_href?: string | null
  // Rosto da carta: só chega quando ela é da pessoa ou foi liberada como prévia.
  nome?: string | null
  tipo?: string | null
  raridade?: string | null
  texto_efeito?: string | null
  homenageado?: string | null
  arte_path?: string | null
  // Só nas cartas da pessoa.
  ganha_em?: string
  revelada_em?: string | null
  origem?: OrigemCarta
}

export type EdicaoAlbum = {
  slug: string
  edicao: number
  titulo: string
  status: 'rascunho' | 'publicada' | 'encerrada'
  abre_em: string | null
  fecha_em: string | null
  pedir_set_ate: string | null
  /** Ainda dá para ganhar cartas (dentro da janela da edição). */
  ganhando: boolean
  /** Edição em rascunho ou agendada: só a organização enxerga. */
  previa: boolean
  /** Fase 2: a Base (as 12 de entrada), um capítulo de 9 ou uma edição especial. */
  papel?: 'base' | 'capitulo' | 'especial'
  trilha?: 'creator' | 'bynx' | 'club' | null
  ciclo?: number
  total_previsto?: number | null
}

/** Só a Base tem set físico e camiseta nesta fase: os capítulos são digitais. */
export const ehBase = (e: Pick<EdicaoAlbum, 'papel'>) => (e.papel ?? 'base') === 'base'

/** Uma edição na estante: a Base ou um capítulo, com os contadores da pessoa. */
export type EdicaoEstante = {
  slug: string
  edicao: number
  titulo: string
  status: 'rascunho' | 'publicada' | 'encerrada'
  papel: 'base' | 'capitulo' | 'especial'
  trilha: 'creator' | 'bynx' | 'club' | null
  abre_em: string | null
  fecha_em: string | null
  previa: boolean
  ganhando: boolean
  total: number
  ganhas: number
  reveladas: number
  /** Cartas que chegaram e ainda estão fechadas. */
  novas: number
}

/** As edições que a pessoa enxerga (a Base primeiro) e a soma do ciclo, sem contar prévia. */
export type Estante = { edicoes: EdicaoEstante[]; ciclo: { total: number; ganhas: number; reveladas: number } }

export const TRILHAS_ALBUM: Record<'creator' | 'bynx' | 'club', string> = { creator: 'Creator', bynx: 'Bynx', club: 'Club' }

export type StatusSet = 'solicitada' | 'combinada' | 'postada' | 'entregue'
export type PedidoSet = { numero: number; status: StatusSet; criado_em: string }

export type AlbumMinha = {
  edicao: EdicaoAlbum
  cartas: CartaAlbum[]
  total: number
  ganhas: number
  /** O contador do álbum: só conta as cartas que a pessoa já virou. */
  reveladas: number
  retirada: PedidoSet | null
  pode_pedir_set: boolean
  set_esgotado: boolean
  /** O prazo para pedir o set acabou (calculado na leitura: a tela não consulta o relógio). */
  prazo_set_passou: boolean
  papeis: string[]
}

export type RespostaAlbum = { album: AlbumMinha | null; erro: null | 'nao_membro' | 'falhou' }

export const BUCKET_ALBUM = 'club-colecao'
/** A arte mora num bucket de leitura pública; o caminho imprevisível é o que a mantém secreta. */
export const urlArte = (path: string) => supabase.storage.from(BUCKET_ALBUM).getPublicUrl(path).data.publicUrl

export const nn = (n: number) => String(n).padStart(2, '0')

export type Missao = {
  titulo: string
  /** Nome no conjunto de ícones do Club (amigo-secreto/estilo). */
  icone: string
  botao?: string
  href?: string
  /** O site não tem como saber: a organização confere. */
  confere?: boolean
}

// O texto de "como ganhar" vem do banco (club_cartas.como_ganhar); o resto da missão
// (nome curto, ícone, para onde o botão leva) fica aqui.
export const MISSOES: Record<MissaoId, Missao> = {
  entrei: { titulo: 'Entrar', icone: 'star' },
  data: { titulo: 'Aniversário', icone: 'cal', botao: 'Informar data', href: ANIVERSARIANTES },
  arroba: { titulo: 'Meu @', icone: 'insta', botao: 'Informar @', href: `${CLUB}?entrar=1` },
  colecao: { titulo: 'Minha coleção', icone: 'colecao', botao: 'Abrir coleção', href: '/minha-colecao' },
  opiniao: { titulo: 'Enquete', icone: 'enquete', botao: 'Ver avisos', href: AVISOS },
  indicacao: { titulo: 'Traga alguém', icone: 'share', botao: 'Indicar alguém', href: '/indique-e-ganhe' },
  graduada: { titulo: 'Primeira graduada', icone: 'trophy', botao: 'Abrir coleção', href: '/minha-colecao' },
  plateia: { titulo: 'Na plateia', icone: 'users', botao: 'Ver agenda', href: AGENDA, confere: true },
  palco: { titulo: 'No palco', icone: 'mic', botao: 'Ver agenda', href: AGENDA, confere: true },
  trend: { titulo: 'Na Trend', icone: 'trend', botao: 'Ver as trends', href: CLUB, confere: true },
  ideia: { titulo: 'Minha ideia', icone: 'chat', confere: true },
  completo: { titulo: 'Surpresa', icone: 'spark' },
}

/** A missão da carta: o que veio do banco, quando veio; senão o mapa da edição 1. */
export function missaoDe(c: Pick<CartaAlbum, 'missao' | 'modo' | 'missao_titulo' | 'missao_icone' | 'missao_botao' | 'missao_href'>): Missao | null {
  if (!c.missao) return null
  if (c.missao_titulo) {
    return {
      titulo: c.missao_titulo,
      icone: c.missao_icone || MISSOES[c.missao]?.icone || 'star',
      ...(c.missao_botao && c.missao_href ? { botao: c.missao_botao, href: c.missao_href } : {}),
      ...(c.modo === 'manual' ? { confere: true } : {}),
    }
  }
  return MISSOES[c.missao] ?? null
}

/** Título da carta no álbum: o nome, quando já pode aparecer; senão a missão. */
export function tituloDe(c: CartaAlbum): string {
  if (c.estado === 'ganha' || c.estado === 'nova' || c.estado === 'previa') return c.nome || missaoDe(c)?.titulo || `Carta ${nn(c.numero)}`
  return missaoDe(c)?.titulo || 'Surpresa'
}

/** A carta que abre em destaque: a primeira nova; senão a próxima a ganhar; álbum completo: nenhuma. */
export function cartaInicial(cartas: CartaAlbum[]): number | null {
  const nova = cartas.find(c => c.estado === 'nova')
  if (nova) return nova.numero
  const falta = cartas.find(c => c.estado !== 'ganha')
  return falta ? falta.numero : null
}

/** "Ganha em 12/11, com Aniversário." A de brinde não cita missão: ninguém a cumpriu. */
export function textoGanha(c: CartaAlbum): string {
  if (!c.ganha_em) return ''
  const quando = dataCurta(c.ganha_em)
  const m = missaoDe(c)
  if (c.origem === 'brinde' || !m) return `Ganha em ${quando}.`
  return c.origem === 'manual'
    ? `Ganha em ${quando}, com ${m.titulo}. A organização conferiu.`
    : `Ganha em ${quando}, com ${m.titulo}.`
}

export const PASSOS_SET: { id: StatusSet; rotulo: string }[] = [
  { id: 'solicitada', rotulo: 'Pedido' },
  { id: 'combinada', rotulo: 'Frete combinado' },
  { id: 'postada', rotulo: 'Postado' },
  { id: 'entregue', rotulo: 'Recebido' },
]

/** Mensagens das funções do banco em texto para a pessoa. */
export function erroAlbum(msg?: string | null): string {
  const m = msg || ''
  if (m.includes('nao_membro')) return 'Entre no Club para abrir o álbum.'
  if (m.includes('carta_nao_ganha')) return 'Essa carta ainda não é sua.'
  if (m.includes('album_incompleto')) return 'Vire todas as cartas antes de pedir o set.'
  if (m.includes('ja_pediu')) return 'Você já pediu o set desta edição.'
  if (m.includes('sets_esgotados')) return 'Os sets desta edição acabaram.'
  if (m.includes('prazo_encerrado')) return 'O prazo para pedir o set acabou.'
  if (m.includes('edicao_nao_encontrada')) return 'O álbum não está aberto.'
  if (m.includes('nao_logado')) return 'Entre na sua conta para continuar.'
  return 'Não conseguimos concluir. Tente de novo.'
}

/**
 * Lê o álbum da pessoa (e confere as missões automáticas). Sem slug vem a Base; com slug, aquela edição.
 * Nunca lança: quem chama decide o que mostrar.
 */
export async function carregarAlbum(slug?: string | null): Promise<RespostaAlbum> {
  const { data, error } = await supabase.rpc('club_colecao_minha_v2', { p_slug: slug || null })
  if (error) return { album: null, erro: (error.message || '').includes('nao_membro') ? 'nao_membro' : 'falhou' }
  const d = data as (Partial<Omit<AlbumMinha, 'edicao' | 'prazo_set_passou'>> & { edicao: EdicaoAlbum | null }) | null
  if (!d || !d.edicao) return { album: null, erro: null }
  return {
    album: {
      edicao: d.edicao,
      cartas: d.cartas ?? [],
      total: d.total ?? 0,
      ganhas: d.ganhas ?? 0,
      reveladas: d.reveladas ?? 0,
      retirada: d.retirada ?? null,
      pode_pedir_set: !!d.pode_pedir_set,
      set_esgotado: !!d.set_esgotado,
      prazo_set_passou: !!d.edicao.pedir_set_ate && Date.parse(d.edicao.pedir_set_ate) < Date.now(),
      papeis: d.papeis ?? [],
    },
    erro: null,
  }
}

/** A estante de capítulos (confere as missões de todas as edições abertas). Nunca lança: sem resposta, nula. */
export async function carregarEstante(): Promise<Estante | null> {
  const { data, error } = await supabase.rpc('club_album_estante')
  if (error || !data) return null
  const d = data as Partial<Estante>
  return { edicoes: d.edicoes ?? [], ciclo: d.ciclo ?? { total: 0, ganhas: 0, reveladas: 0 } }
}

type RespostaVirar = { reveladas: number; total: number; cartas: { numero: number; revelada_em: string }[] }

export type ResultadoVirar =
  | { ok: true; album: AlbumMinha; viradas: number[] }
  | { ok: false; msg: string }

/** Marca as cartas viradas no álbum que já está na tela (sem nova ida ao banco). */
export function aplicarViradas(album: AlbumMinha, r: RespostaVirar): AlbumMinha {
  const datas = new Map(r.cartas.map(c => [c.numero, c.revelada_em]))
  return {
    ...album,
    reveladas: r.reveladas,
    cartas: album.cartas.map(c => (c.estado === 'nova' && datas.has(c.numero) ? { ...c, estado: 'ganha' as const, revelada_em: datas.get(c.numero) } : c)),
  }
}

/**
 * Vira cartas (as indicadas, ou todas as que chegaram fechadas) e devolve o álbum já atualizado.
 * Com todas viradas lê o álbum de novo: o banco é quem sabe se o pedido do set já pode abrir.
 */
export async function virarCartas(album: AlbumMinha, numeros?: number[]): Promise<ResultadoVirar> {
  const { data, error } = await supabase.rpc('club_carta_virar', { p_slug: album.edicao.slug, p_numeros: numeros ?? null })
  if (error) return { ok: false, msg: erroAlbum(error.message) }
  const r = data as RespostaVirar
  const antes = new Set(album.cartas.filter(c => c.estado === 'nova').map(c => c.numero))
  const viradas = r.cartas.filter(c => antes.has(c.numero)).map(c => c.numero)
  let proximo = aplicarViradas(album, r)
  if (r.total > 0 && r.reveladas >= r.total) {
    const nova = await carregarAlbum(album.edicao.slug)
    if (nova.album) proximo = nova.album
  }
  return { ok: true, album: proximo, viradas }
}

/** Pede o set físico (Fase 1: só o "quero receber"; o frete e o envio a organização combina). */
export async function pedirSet(album: AlbumMinha): Promise<{ ok: true; album: AlbumMinha } | { ok: false; msg: string }> {
  const { data, error } = await supabase.rpc('club_retirada_pedir', { p_slug: album.edicao.slug })
  if (error) return { ok: false, msg: erroAlbum(error.message) }
  const pedido = data as PedidoSet
  return { ok: true, album: { ...album, retirada: pedido, pode_pedir_set: false } }
}
