/**
 * Leilao da Bynx — funcoes puras (sem I/O, sem Supabase).
 *
 * Usadas no servidor (rotas /api/leiloes) e no cliente (telas /leiloes).
 * Contrato da fatia 1: rodada ao vivo da loja, lote a lote, soft close.
 *
 * ★ A tabela de incrementos e a MESMA da funcao SQL `leilao_incremento(int)`.
 * Mudou uma, muda a outra no mesmo commit — o servidor e quem decide o minimo,
 * a tela so mostra. Se divergirem, o usuario ve um minimo e toma erro de outro.
 */

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type StatusLote =
  | 'rascunho'
  | 'agendado'
  | 'ativo'
  | 'sem_lances'
  | 'aguardando_pagamento'
  | 'vendido'
  | 'calote'
  | 'cancelado'

/** O que a tela mostra, derivado do status do banco + relogio do servidor. */
export type StatusPublico =
  | 'em_breve'
  | 'ao_vivo'
  | 'encerrando'
  | 'encerrado'
  | 'arrematado'
  | 'sem_lances'
  | 'cancelado'

/** Campos da view `leiloes_publico` em camelCase (sem o teto do lider). */
export interface LotePublico {
  id: string
  codigo: string
  slug: string
  rodadaId: string | null
  ordem: number | null
  vendedorUserId: string
  lojaId: string | null
  cardId: string | null
  cardSlug: string | null
  cardName: string
  cardNumero: string | null
  setNome: string | null
  cardImage: string | null
  fotos: string[]
  condicao: string | null
  idioma: string | null
  graduadora: string | null
  nota: string | null
  descricao: string | null
  lanceInicialCents: number
  precoAtualCents: number | null
  /** Apelido do lider ja mascarado pela view ("j***a"). */
  liderApelido: string | null
  nLances: number
  nParticipantes: number
  duracaoSeg: number
  softCloseSeg: number
  iniciaEm: string | null
  terminaEm: string | null
  prorrogacoes: number
  status: StatusLote
  encerradoEm: string | null
  versao: number
  game: string
}

/** Retorno do RPC `dar_lance` em camelCase. */
export interface LanceResultado {
  ok: boolean
  precoCents: number
  /** true = quem deu o lance esta liderando. */
  lider: boolean
  terminaEm: string | null
  serverNow: string
  minimoProximoCents: number
  nLances: number
  versao: number
}

export type CodigoErroLance =
  | 'nao_autenticado'
  | 'cadastro_incompleto'
  | 'leilao_fechado'
  | 'proprio_leilao'
  | 'abaixo_minimo'
  | 'suspenso'
  | 'desconhecido'

// ─── Incrementos ────────────────────────────────────────────────────────────

/** [teto exclusivo do lance atual, incremento] — em centavos. */
const FAIXAS_INCREMENTO: ReadonlyArray<readonly [number, number]> = [
  [2000, 100],
  [5000, 200],
  [10000, 500],
  [25000, 1000],
  [50000, 2000],
  [100000, 5000],
  [250000, 10000],
  [500000, 20000],
  [1000000, 50000],
]
const INCREMENTO_MAXIMO = 100000

/** Incremento minimo a partir do lance atual (centavos). */
export function incrementoCents(atualCents: number): number {
  const v = Number.isFinite(atualCents) ? Math.max(0, Math.floor(atualCents)) : 0
  for (const [teto, inc] of FAIXAS_INCREMENTO) {
    if (v < teto) return inc
  }
  return INCREMENTO_MAXIMO
}

/**
 * Menor lance aceito agora. Sem lances: o lance inicial. Com lances: preco
 * atual + incremento da faixa.
 */
export function minimoProximoCents(
  lote: Pick<LotePublico, 'lanceInicialCents' | 'precoAtualCents' | 'nLances'>
): number {
  if (!lote.nLances || lote.precoAtualCents == null) return lote.lanceInicialCents
  return lote.precoAtualCents + incrementoCents(lote.precoAtualCents)
}

// ─── Tempo ──────────────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * Tempo restante legivel:
 *   > 24h        -> "3d 4h"
 *   1h a 24h     -> "5h 12min"
 *   10min a 1h   -> "42min 10s"
 *   < 10min      -> "08:41"
 */
export function formatarTempoRestante(ms: number): string {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (total > 86400) return `${d}d ${h}h`
  if (total >= 3600) return `${Math.floor(total / 3600)}h ${m}min`
  if (total >= 600) return `${m}min ${s}s`
  return `${pad2(m)}:${pad2(s)}`
}

/** Janela final em que o lote aparece como "encerrando". */
const JANELA_ENCERRANDO_MS = 10_000

/**
 * Status que a tela mostra. `agora` deve vir do relogio do SERVIDOR
 * (server_now + deslocamento), nunca do relogio cru do aparelho.
 */
export function statusPublico(
  lote: Pick<LotePublico, 'status' | 'iniciaEm' | 'terminaEm' | 'softCloseSeg'>,
  agora: Date | number = Date.now()
): StatusPublico {
  const t = typeof agora === 'number' ? agora : agora.getTime()
  switch (lote.status) {
    case 'rascunho':
    case 'agendado':
      return 'em_breve'
    case 'cancelado':
      return 'cancelado'
    case 'sem_lances':
      return 'sem_lances'
    case 'aguardando_pagamento':
    case 'vendido':
    case 'calote':
      return 'arrematado'
    case 'ativo': {
      const ini = lote.iniciaEm ? Date.parse(lote.iniciaEm) : NaN
      if (Number.isFinite(ini) && t < ini) return 'em_breve'
      const fim = lote.terminaEm ? Date.parse(lote.terminaEm) : NaN
      if (!Number.isFinite(fim)) return 'ao_vivo'
      // Ativo com relogio zerado: o tick ainda nao fechou. Mostra encerrado
      // e espera o proximo estado do servidor.
      if (t >= fim) return 'encerrado'
      const janela = Math.max(JANELA_ENCERRANDO_MS, (lote.softCloseSeg || 0) * 1000)
      return fim - t <= janela ? 'encerrando' : 'ao_vivo'
    }
    default:
      return 'encerrado'
  }
}

// ─── Apelido, slug, codigo ──────────────────────────────────────────────────

/** "joana" -> "j***a". Curto demais vira "***". */
export function mascararApelido(nome: string | null | undefined): string {
  const s = (nome ?? '').trim()
  if (s.length < 2) return '***'
  const chars = Array.from(s)
  return `${chars[0]}***${chars[chars.length - 1]}`.toLowerCase()
}

/** Minusculas, sem acento, so [a-z0-9] e hifen simples. */
export function slugify(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Slug do lote: {slug-da-carta}-{graduadora-nota?}-{codigo}.
 * Ex.: ("Charizard ex 199/165", "PSA", "10", "k3x9qa") -> "charizard-ex-199-165-psa-10-k3x9qa".
 * O codigo fica SEMPRE no fim: e ele que resolve o lote (codigoDoSlug).
 */
export function slugLote(
  cardSlugOuNome: string,
  graduadora: string | null | undefined,
  nota: string | null | undefined,
  codigo: string
): string {
  const partes = [slugify(cardSlugOuNome) || 'carta']
  const grad = slugify([graduadora, nota].filter(Boolean).join(' '))
  if (graduadora && grad) partes.push(grad)
  partes.push(slugify(codigo))
  return partes.join('-')
}

/** Os 6 ultimos caracteres depois do ultimo hifen. null se nao parecer codigo. */
export function codigoDoSlug(slug: string | null | undefined): string | null {
  const s = (slug ?? '').trim().toLowerCase()
  if (!s) return null
  const ultimo = s.slice(s.lastIndexOf('-') + 1)
  const cod = ultimo.slice(-6)
  return /^[a-z0-9]{6}$/.test(cod) ? cod : null
}

// ─── Formatacao ─────────────────────────────────────────────────────────────

/** "R$ 1.234,56" */
export function formatarBRL(cents: number): string {
  return ((Number.isFinite(cents) ? cents : 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

/** "27/09/2026, 21:30 (Brasília)" — sempre America/Sao_Paulo. */
export function horarioBrasilia(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const txt = d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${txt} (Brasília)`
}

// ─── Erros do lance ─────────────────────────────────────────────────────────

export interface ErroLance {
  codigo: CodigoErroLance
  mensagem: string
  status: number
  /** So em abaixo_minimo: o minimo que o servidor exige agora. */
  minimoCents?: number
}

/**
 * Converte a mensagem do `raise` do dar_lance em erro de tela.
 * Formatos aceitos: "abaixo_minimo:1500", "leilao_fechado", ou texto que os contenha.
 */
export function erroDoLance(msg: string | null | undefined): ErroLance {
  const s = (msg ?? '').trim()
  const m = s.match(/abaixo_minimo:(\d+)/)
  if (m) {
    const minimoCents = Number(m[1])
    return {
      codigo: 'abaixo_minimo',
      status: 409,
      minimoCents,
      mensagem: `Outro lance chegou primeiro. Lance mínimo agora: ${formatarBRL(minimoCents)}.`,
    }
  }
  const tabela: Array<[Exclude<CodigoErroLance, 'abaixo_minimo' | 'desconhecido'>, number, string]> = [
    ['nao_autenticado', 401, 'Entre na sua conta para dar lances.'],
    ['cadastro_incompleto', 403, 'Complete seu cadastro para dar lances.'],
    ['leilao_fechado', 409, 'Este lote já foi encerrado.'],
    ['proprio_leilao', 403, 'Você não pode dar lance no seu próprio lote.'],
    ['suspenso', 403, 'Sua conta está impedida de dar lances no momento.'],
  ]
  for (const [codigo, status, mensagem] of tabela) {
    if (s.includes(codigo)) return { codigo, status, mensagem }
  }
  return {
    codigo: 'desconhecido',
    status: 500,
    mensagem: 'Não foi possível registrar o lance. Tente de novo.',
  }
}

// ─── Mapeadores (linha do banco -> camelCase) ───────────────────────────────

type Linha = Record<string, unknown>
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

export function lotePublicoDeLinha(r: Linha): LotePublico {
  const fotos = Array.isArray(r.fotos)
    ? r.fotos.filter((u): u is string => typeof u === 'string' && !!u)
    : []
  return {
    id: String(r.id),
    codigo: String(r.codigo ?? ''),
    slug: String(r.slug ?? ''),
    rodadaId: str(r.rodada_id),
    ordem: num(r.ordem),
    vendedorUserId: String(r.vendedor_user_id ?? ''),
    lojaId: str(r.loja_id),
    cardId: str(r.card_id),
    cardSlug: str(r.card_slug),
    cardName: String(r.card_name ?? ''),
    cardNumero: str(r.card_numero),
    setNome: str(r.set_nome),
    cardImage: str(r.card_image),
    fotos,
    condicao: str(r.condicao),
    idioma: str(r.idioma),
    graduadora: str(r.graduadora),
    nota: str(r.nota),
    descricao: str(r.descricao),
    lanceInicialCents: num(r.lance_inicial_cents) ?? 0,
    precoAtualCents: num(r.preco_atual_cents),
    liderApelido: str(r.lider_apelido),
    nLances: num(r.n_lances) ?? 0,
    nParticipantes: num(r.n_participantes) ?? 0,
    duracaoSeg: num(r.duracao_seg) ?? 0,
    softCloseSeg: num(r.soft_close_seg) ?? 10,
    iniciaEm: str(r.inicia_em),
    terminaEm: str(r.termina_em),
    prorrogacoes: num(r.prorrogacoes) ?? 0,
    status: (str(r.status) ?? 'rascunho') as StatusLote,
    encerradoEm: str(r.encerrado_em),
    versao: num(r.versao) ?? 0,
    game: str(r.game) ?? 'pokemon',
  }
}

export function lanceResultadoDeJson(r: Linha): LanceResultado {
  return {
    ok: r.ok === true,
    precoCents: num(r.preco_cents) ?? 0,
    lider: r.lider === true,
    terminaEm: str(r.termina_em),
    serverNow: str(r.server_now) ?? new Date().toISOString(),
    minimoProximoCents: num(r.minimo_proximo_cents) ?? 0,
    nLances: num(r.n_lances) ?? 0,
    versao: num(r.versao) ?? 0,
  }
}
