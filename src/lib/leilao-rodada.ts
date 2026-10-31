/**
 * Leilao — pagina publica da RODADA (/leiloes/rodada/[numero]). Funcoes puras:
 * sem I/O, sem Supabase. Usadas na pagina (server), na rota
 * /api/leiloes/rodada/[numero]/estado e na ilha RodadaAoVivo (cliente).
 *
 * IDENTIDADE: a rodada e publica pelo `leilao_rodadas.numero` (identity,
 * unico, curto: /leiloes/rodada/42). Sem slug de titulo: o titulo e editavel
 * em rascunho e o link que a loja divulga na live nao pode mudar.
 */

import { formatarBRL, incrementoCents, lotePublicoDeLinha, minimoProximoCents, type LotePublico } from './leilao'

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
  /**
   * Referencia do Mercado Brasileiro (menor preco, centavos) do lote NO AR, para
   * o aviso de lance alto. null sem lote no ar, carta graduada ou sem preco.
   */
  referenciaMercadoCents?: number | null
  /**
   * Ultimos lances do lote NO AR (mais novo primeiro, ate LIMITE_FEED_LANCES),
   * da view `leilao_lances_publico`: apelido mascarado, nunca user_id.
   * `lancesLoteId` diz de qual lote sao (a tela ignora se o lote no ar mudou).
   */
  lances?: LancePublico[]
  lancesLoteId?: string | null
}

/** Colunas lidas de `leilao_rodadas`. ★ Nunca incluir vendedor_user_id. */
export const COLUNAS_RODADA = 'id, numero, loja_id, titulo, descricao, modo, status, inicia_em, link_transmissao'

/**
 * Colunas lidas de `leiloes_publico` para TODOS os lotes da rodada. Fora:
 * vendedor_user_id (a view tem, a pagina nao precisa), descricao (fica na
 * pagina do lote), `fotos` (fila e encerrados mostram a card_image) e
 * `lider_apelido` (so importa no lote no ar). A resposta do polling sai para
 * todo mundo a cada 2-3s: cada coluna aqui pesa x lotes x leitores.
 */
export const COLUNAS_LOTE_RODADA = [
  'id', 'codigo', 'slug', 'rodada_id', 'ordem', 'loja_id',
  'card_id', 'card_slug', 'card_name', 'card_numero', 'set_nome', 'card_image',
  'condicao', 'idioma', 'graduadora', 'nota',
  'lance_inicial_cents', 'preco_atual_cents',
  'n_lances', 'n_participantes', 'duracao_seg', 'soft_close_seg',
  'inicia_em', 'termina_em', 'prorrogacoes', 'status', 'encerrado_em', 'versao', 'game',
].join(', ')

/** Complemento do lote NO AR, lido por PK (uma linha): fotos e apelido do lider. */
export const COLUNAS_LOTE_ATIVO_EXTRA = 'fotos, lider_apelido'

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

/**
 * "42" -> 42. So digitos, dentro do inteiro seguro. null se nao for numero de
 * rodada. Zero a esquerda e aceito ("042" -> 42): a pagina compara com o
 * canonico e responde 308 para /leiloes/rodada/42 (link digitado a mao ou
 * colado de lista numerada nao vira 404).
 */
export function numeroDaRodada(param: string | null | undefined): number | null {
  const s = (param ?? '').trim()
  if (!/^\d+$/.test(s)) return null
  const semZeros = s.replace(/^0+/, '')
  if (!semZeros || semZeros.length > 15) return null
  const n = Number(semZeros)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/** Mantido aqui por compatibilidade: a fonte e src/lib/leilao-urls.ts. */
export { urlRodada } from './leilao-urls'

/** Titulo exibido: o da loja, ou "Rodada #42". */
export function tituloRodada(r: Pick<RodadaPublica, 'titulo' | 'numero'>): string {
  return r.titulo?.trim() || `Rodada #${r.numero}`
}

/** Complemento do titulo/OG pelo status: "leilão ao vivo" so quando esta no ar. */
export function rotuloTituloRodada(status: StatusRodada): string {
  switch (status) {
    case 'ao_vivo':
      return 'leilão ao vivo'
    case 'agendada':
      return 'leilão agendado'
    case 'cancelada':
      return 'leilão cancelado'
    default:
      return 'resultado do leilão'
  }
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

/** Resultado de lote mais velho que isso (aba que voltou do fundo) nao vira faixa. */
export const RESULTADO_RECENTE_MS = 10_000

/**
 * O fechamento aconteceu ha menos de RESULTADO_RECENTE_MS pelo relogio do
 * SERVIDOR? Sem `encerradoEm` legivel, conta como recente (nao some com o
 * resultado de quem estava olhando).
 */
export function resultadoRecente(encerradoEm: string | null | undefined, serverNowMs: number): boolean {
  const fim = encerradoEm ? Date.parse(encerradoEm) : NaN
  if (!Number.isFinite(fim) || !Number.isFinite(serverNowMs)) return true
  return serverNowMs - fim < RESULTADO_RECENTE_MS
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
/** Agendada a N ms (ou menos) do inicio, ou ja passada: polling de ao vivo. */
export const JANELA_INICIO_RODADA_MS = 30_000
/** Ultimos N ms do lote no ar: polling mais curto. */
export const JANELA_FINAL_RODADA_MS = 15_000

/**
 * Proximo intervalo do polling da rodada. null = parar (encerrada, cancelada).
 * Ao vivo: 3s, e 2s nos ultimos 15s do lote (ou com o relogio ja zerado,
 * esperando o fechamento). Agendada: 30s, e 3s quando faltam 30s ou menos
 * para `iniciaEm` (ou o horario ja passou e o servidor ainda nao abriu).
 */
export function intervaloPollRodada(
  status: StatusRodada,
  terminaEmAtivo: string | null | undefined,
  agoraMs: number,
  iniciaEm?: string | null
): number | null {
  if (status === 'agendada') {
    const ini = iniciaEm ? Date.parse(iniciaEm) : NaN
    return Number.isFinite(ini) && ini - agoraMs <= JANELA_INICIO_RODADA_MS
      ? POLL_RODADA_AO_VIVO_MS
      : POLL_RODADA_AGENDADA_MS
  }
  if (status !== 'ao_vivo') return null
  const fim = terminaEmAtivo ? Date.parse(terminaEmAtivo) : NaN
  if (Number.isFinite(fim) && fim - agoraMs <= JANELA_FINAL_RODADA_MS) return POLL_RODADA_FINAL_MS
  return POLL_RODADA_AO_VIVO_MS
}

// ─── Feed de lances do lote no ar ───────────────────────────────────────────

/** Uma linha de `leilao_lances_publico`. ★ Sem user_id: so o apelido mascarado. */
export interface LancePublico {
  id: number
  /** Ja mascarado pela view ("j***a"). */
  apelido: string
  valorCents: number
  /** true = lance do teto oculto (o servidor cobriu sozinho). */
  automatico: boolean
  createdAt: string
}

/**
 * Colunas lidas de `leilao_lances_publico` para o feed. ★ Nunca user_id (a view
 * nem tem) nem leilao_id (o feed ja e de um lote so).
 */
export const COLUNAS_LANCE_PUBLICO = 'id, apelido, valor_cents, automatico, created_at'

/** Quantos lances do lote no ar vao no payload da rodada (leitura pelo indice (leilao_id, id desc)). */
export const LIMITE_FEED_LANCES = 8

/** Linhas da view -> feed, mais novo primeiro. Linha sem id ou valor fica de fora. */
export function lancesPublicosDeLinhas(linhas: unknown[] | null | undefined): LancePublico[] {
  const out: LancePublico[] = []
  for (const x of linhas ?? []) {
    const r = (x ?? {}) as Linha
    const id = Number(r.id)
    const valor = Number(r.valor_cents)
    if (!Number.isSafeInteger(id) || !Number.isFinite(valor) || valor <= 0) continue
    out.push({
      id,
      apelido: str(r.apelido) ?? 'Participante',
      valorCents: Math.round(valor),
      automatico: r.automatico === true,
      createdAt: str(r.created_at) ?? '',
    })
  }
  return out.sort((a, b) => b.id - a.id).slice(0, LIMITE_FEED_LANCES)
}

/**
 * Ha quanto tempo, curto, para a coluna do feed: "agora", "12s", "3min",
 * "2h", "1d". Pelo relogio do SERVIDOR (agoraMs ja corrigido). Vazio se a
 * data nao for legivel.
 */
export function tempoDesde(iso: string | null | undefined, agoraMs: number): string {
  const t = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(t) || !Number.isFinite(agoraMs)) return ''
  const s = Math.max(0, Math.floor((agoraMs - t) / 1000))
  if (s < 1) return 'agora'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

/**
 * Ids que chegaram nesta leitura e nao estavam na anterior (para destacar a
 * linha nova). Primeira leitura (`anteriores` null) nao destaca nada: quem
 * acabou de abrir a pagina nao ve o feed inteiro piscar.
 */
export function idsNovos(anteriores: ReadonlySet<number> | null, lances: ReadonlyArray<Pick<LancePublico, 'id'>>): Set<number> {
  const novos = new Set<number>()
  if (!anteriores) return novos
  for (const l of lances) if (!anteriores.has(l.id)) novos.add(l.id)
  return novos
}

/** Inicial do avatar do feed ("j***a" -> "J"). */
export function inicialApelido(apelido: string | null | undefined): string {
  const c = (apelido ?? '').trim().charAt(0)
  return c ? c.toLocaleUpperCase('pt-BR') : '?'
}

// ─── Atalhos de lance e regras ──────────────────────────────────────────────

/**
 * Os dois atalhos de lance da rodada: +1 e +2 degraus da tabela de
 * incrementos (a mesma do SQL). O 1o e o minimo aceito agora; o 2o, o minimo
 * + o incremento da faixa dele. Rotulo relativo ao lance atual ("+ R$ 100")
 * quando ja ha lance; sem lance, o valor cheio ("R$ 150,00"), porque "+ R$ 0"
 * nao diz nada. So ABREM a folha preenchida: nenhum lance sai sem o Confirmar.
 */
export function atalhosLance(
  lote: Pick<LotePublico, 'lanceInicialCents' | 'precoAtualCents' | 'nLances'>
): Array<{ valorCents: number; rotulo: string }> {
  const d1 = minimoProximoCents(lote)
  const d2 = d1 + incrementoCents(d1)
  const comLance = lote.nLances > 0 && lote.precoAtualCents != null
  const base = comLance ? (lote.precoAtualCents as number) : 0
  return [d1, d2].map(v => ({
    valorCents: v,
    rotulo: comLance ? `+ ${formatarBRL(v - base)}` : formatarBRL(v),
  }))
}

/**
 * ★ Prazo para pagar o arremate, em horas. ESPELHO de `pagar_ate = now() +
 * interval '48 hours'` em leilao_fechar_lote (20260928090000_leilao_motor.sql).
 * Mudou la, muda aqui no mesmo commit.
 */
export const PRAZO_PAGAMENTO_HORAS = 48

/**
 * Linha da prorrogacao na rodada. O SQL empurra o fim para `agora +
 * soft_close_seg` (nao soma ao que falta): "volta o relogio para 10s".
 * Sem soft close (0), null: a linha some.
 */
export function textoProrrogacao(softCloseSeg: number, prorrogacoes: number): string | null {
  if (!Number.isFinite(softCloseSeg) || softCloseSeg <= 0) return null
  const base = `Lance nos últimos ${softCloseSeg}s volta o relógio para ${softCloseSeg}s`
  if (!Number.isFinite(prorrogacoes) || prorrogacoes <= 0) return base
  return `${base} · prorrogado ${prorrogacoes === 1 ? '1 vez' : `${prorrogacoes} vezes`}`
}

/** "4,9 de 5 · 32 avaliações" / null sem avaliacao (a tela mostra "Loja nova na Bynx"). */
export function textoAvaliacao(media: number | null | undefined, total: number | null | undefined): string | null {
  if (!total || total <= 0 || media == null || !Number.isFinite(media)) return null
  const m = (Math.round(media * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${m} de 5 · ${total} ${total === 1 ? 'avaliação' : 'avaliações'}`
}

/** "Arrematado R$ 380,00 · 9 lances" / "Sem lances" / "Cancelado". null se nao fechou. */
export function rodapeResultado(
  l: Pick<LotePublico, 'status' | 'precoAtualCents' | 'nLances'>
): { tipo: TipoResultado; texto: string } | null {
  const r = resultadoLoteRodada(l)
  if (!r) return null
  if (r.tipo !== 'arrematado') return r
  const partes = ['Arrematado']
  if (l.precoAtualCents != null && l.nLances > 0) partes[0] = `Arrematado ${formatarBRL(l.precoAtualCents)}`
  if (l.nLances > 0) partes.push(l.nLances === 1 ? '1 lance' : `${l.nLances} lances`)
  return { tipo: 'arrematado', texto: partes.join(' · ') }
}
