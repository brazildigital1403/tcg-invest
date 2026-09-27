/**
 * Leilao — pagina publica da RODADA (/leiloes/rodada/[numero]). Funcoes puras:
 * sem I/O, sem Supabase. Usadas na pagina (server), na rota
 * /api/leiloes/rodada/[numero]/estado e na ilha RodadaAoVivo (cliente).
 *
 * IDENTIDADE: a rodada e publica pelo `leilao_rodadas.numero` (identity,
 * unico, curto: /leiloes/rodada/42). Sem slug de titulo: o titulo e editavel
 * em rascunho e o link que a loja divulga na live nao pode mudar.
 */

import { formatarBRL, lotePublicoDeLinha, type LotePublico } from './leilao'

export type StatusRodada = 'rascunho' | 'agendada' | 'ao_vivo' | 'encerrada' | 'cancelada'

/** Colunas publicas de `leilao_rodadas` (nunca `vendedor_user_id`). */
export interface RodadaPublica {
  id: string
  numero: number
  lojaId: string | null
  titulo: string | null
  descricao: string | null
  modo: string
  status: StatusRodada
  iniciaEm: string | null
  linkTransmissao: string | null
}

/** Resposta de GET /api/leiloes/rodada/[numero]/estado. */
export interface EstadoRodada {
  rodada: RodadaPublica
  lotes: LotePublico[]
  server_now: string
  /** Cresce a cada mudanca da rodada ou de qualquer lote: descarta resposta velha. */
  versao: number
}

/** Colunas lidas de `leilao_rodadas`. ★ Nunca incluir vendedor_user_id. */
export const COLUNAS_RODADA = 'id, numero, loja_id, titulo, descricao, modo, status, inicia_em, link_transmissao'

/**
 * Colunas lidas de `leiloes_publico` para a rodada. Fora: vendedor_user_id
 * (a view tem, a pagina nao precisa) e descricao (fica na pagina do lote;
 * a resposta do polling sai para todo mundo a cada 2-3s).
 */
export const COLUNAS_LOTE_RODADA = [
  'id', 'codigo', 'slug', 'rodada_id', 'ordem', 'loja_id',
  'card_id', 'card_slug', 'card_name', 'card_numero', 'set_nome', 'card_image', 'fotos',
  'condicao', 'idioma', 'graduadora', 'nota',
  'lance_inicial_cents', 'preco_atual_cents', 'lider_apelido',
  'n_lances', 'n_participantes', 'duracao_seg', 'soft_close_seg',
  'inicia_em', 'termina_em', 'prorrogacoes', 'status', 'encerrado_em', 'versao', 'game',
].join(', ')

const STATUS_RODADA_VALIDOS: ReadonlyArray<StatusRodada> = ['rascunho', 'agendada', 'ao_vivo', 'encerrada', 'cancelada']

type Linha = Record<string, unknown>
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

export function rodadaPublicaDeLinha(r: Linha): RodadaPublica {
  const status = str(r.status) as StatusRodada | null
  const numero = Number(r.numero)
  return {
    id: String(r.id),
    numero: Number.isFinite(numero) ? numero : 0,
    lojaId: str(r.loja_id),
    titulo: str(r.titulo),
    descricao: str(r.descricao),
    modo: str(r.modo) ?? 'ao_vivo',
    status: status && STATUS_RODADA_VALIDOS.includes(status) ? status : 'rascunho',
    iniciaEm: str(r.inicia_em),
    linkTransmissao: str(r.link_transmissao),
  }
}

export function lotesDaRodadaDeLinhas(linhas: unknown[] | null | undefined): LotePublico[] {
  return (linhas ?? []).map(r => lotePublicoDeLinha(r as Linha)).sort(porOrdem)
}

/** "42" -> 42. So digitos, sem zero a esquerda, dentro do bigint seguro. null se nao for numero de rodada. */
export function numeroDaRodada(param: string | null | undefined): number | null {
  const s = (param ?? '').trim()
  if (!/^[1-9]\d{0,14}$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(n) ? n : null
}

export function urlRodada(numero: number): string {
  return `/leiloes/rodada/${numero}`
}

/** Titulo exibido: o da loja, ou "Rodada #42". */
export function tituloRodada(r: Pick<RodadaPublica, 'titulo' | 'numero'>): string {
  return r.titulo?.trim() || `Rodada #${r.numero}`
}

/** So rodada que ainda vai acontecer ou esta no ar vai para o indice. */
export function deveIndexarRodada(status: StatusRodada): boolean {
  return status === 'agendada' || status === 'ao_vivo'
}

// ─── Lotes da rodada ────────────────────────────────────────────────────────

function porOrdem(a: LotePublico, b: LotePublico): number {
  return (a.ordem ?? Number.MAX_SAFE_INTEGER) - (b.ordem ?? Number.MAX_SAFE_INTEGER)
}

const STATUS_FECHADOS = new Set(['sem_lances', 'aguardando_pagamento', 'vendido', 'calote', 'cancelado'])

/**
 * Separa os lotes em: o que esta no ar (status `ativo`), a fila (agendados,
 * pela ordem) e os encerrados (pela ordem). Rascunho nunca chega aqui (a view
 * filtra), mas se chegar fica de fora.
 */
export function separarLotesRodada(lotes: LotePublico[]): {
  ativo: LotePublico | null
  proximos: LotePublico[]
  encerrados: LotePublico[]
} {
  const ordenados = [...lotes].sort(porOrdem)
  return {
    ativo: ordenados.find(l => l.status === 'ativo') ?? null,
    proximos: ordenados.filter(l => l.status === 'agendado'),
    encerrados: ordenados.filter(l => STATUS_FECHADOS.has(l.status)),
  }
}

export type TipoResultado = 'arrematado' | 'sem_lances' | 'cancelado'

/** "Arrematado por R$ 120,00" / "Sem lances" / "Cancelado". null se o lote ainda nao fechou. */
export function resultadoLoteRodada(
  l: Pick<LotePublico, 'status' | 'precoAtualCents' | 'nLances'>
): { tipo: TipoResultado; texto: string } | null {
  switch (l.status) {
    case 'aguardando_pagamento':
    case 'vendido':
    case 'calote':
      return l.precoAtualCents != null && l.nLances > 0
        ? { tipo: 'arrematado', texto: `Arrematado por ${formatarBRL(l.precoAtualCents)}` }
        : { tipo: 'arrematado', texto: 'Arrematado' }
    case 'sem_lances':
      return { tipo: 'sem_lances', texto: 'Sem lances' }
    case 'cancelado':
      return { tipo: 'cancelado', texto: 'Cancelado' }
    default:
      return null
  }
}

/**
 * O lote que estava no ar e fechou entre duas leituras. `idAnterior` e o id
 * do lote ativo na leitura anterior; devolve o lote (ja com o status final)
 * se ele deixou de estar ativo. null se nada fechou.
 */
export function loteQueFechou(idAnterior: string | null, lotesNovos: LotePublico[]): LotePublico | null {
  if (!idAnterior) return null
  const l = lotesNovos.find(x => x.id === idAnterior)
  if (!l || l.status === 'ativo') return null
  return resultadoLoteRodada(l) ? l : null
}

const RANK_STATUS_RODADA: Record<StatusRodada, number> = {
  rascunho: 0, agendada: 1, ao_vivo: 2, encerrada: 3, cancelada: 3,
}

/**
 * Versao da rodada para descartar resposta atrasada. `leiloes.versao` so
 * cresce (todo UPDATE do motor faz versao + 1) e lote publico nao some; o
 * status da rodada so anda para frente. Soma * 4 + rank: qualquer lote que
 * mudou vence qualquer diferenca de rank.
 */
export function versaoRodada(status: StatusRodada, lotes: Array<Pick<LotePublico, 'versao'>>): number {
  const soma = lotes.reduce((s, l) => s + (Number.isFinite(l.versao) ? l.versao : 0), 0)
  return soma * 4 + RANK_STATUS_RODADA[status]
}

// ─── Polling ────────────────────────────────────────────────────────────────

export const POLL_RODADA_AO_VIVO_MS = 3_000
export const POLL_RODADA_FINAL_MS = 2_000
export const POLL_RODADA_AGENDADA_MS = 30_000
/** Ultimos N ms do lote no ar: polling mais curto. */
export const JANELA_FINAL_RODADA_MS = 15_000

/**
 * Proximo intervalo do polling da rodada. null = parar (encerrada, cancelada).
 * Ao vivo: 3s, e 2s nos ultimos 15s do lote (ou com o relogio ja zerado,
 * esperando o fechamento). Agendada: 30s.
 */
export function intervaloPollRodada(
  status: StatusRodada,
  terminaEmAtivo: string | null | undefined,
  agoraMs: number
): number | null {
  if (status === 'agendada') return POLL_RODADA_AGENDADA_MS
  if (status !== 'ao_vivo') return null
  const fim = terminaEmAtivo ? Date.parse(terminaEmAtivo) : NaN
  if (Number.isFinite(fim) && fim - agoraMs <= JANELA_FINAL_RODADA_MS) return POLL_RODADA_FINAL_MS
  return POLL_RODADA_AO_VIVO_MS
}
