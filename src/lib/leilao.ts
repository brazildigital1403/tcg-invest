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
  /**
   * Teto de quem deu o lance. O SQL so devolve quando o lider ajusta o proprio
   * teto; nos outros casos vem null e a tela usa o valor que enviou.
   */
  seuMaximoCents: number | null
  /** true = replay do mesmo `idem` (a rede reenviou); nada novo foi gravado. */
  repetido: boolean
}

/** Resposta de GET /api/leiloes/[id]/estado. */
export interface EstadoLote {
  lote: LotePublico
  server_now: string
  /** Calculado no servidor para o usuario do Bearer. false sem login. */
  voceLidera: boolean
  /** O SEU teto em leilao_proxy (nunca o de outra pessoa). null sem lance. */
  seuMaximoCents: number | null
  /** true = o usuario do Bearer e o vendedor do lote. O id do vendedor nunca sai. */
  proprio: boolean
  /**
   * Prazo para pagar o arremate (ISO). So vem para QUEM VENCEU, com o lote em
   * `aguardando_pagamento`; para qualquer outro, null. A coluna nao e publica.
   */
  pagarAte?: string | null
}

/**
 * Codigos de erro do lance. Os do banco sao exatamente os `raise` de
 * `dar_lance` (supabase/migrations/20260928090000_leilao_motor.sql); os demais
 * nascem na rota ou no PostgREST.
 */
export type CodigoErroLance =
  // raise do dar_lance
  | 'nao_autenticado'
  | 'pedido_invalido'
  | 'cadastro_incompleto'
  | 'suspenso'
  | 'leilao_fechado'
  | 'idem_invalido'
  | 'proprio_leilao'
  | 'abaixo_minimo'
  // PostgREST / Postgres
  | 'sessao_expirada'
  | 'lote_ocupado'
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

/** "joana" -> "j***a". Menos de 3 caracteres vira "***" (igual ao SQL leilao_mascarar). */
export function mascararApelido(nome: string | null | undefined): string {
  const s = (nome ?? '').trim()
  const chars = Array.from(s)
  if (chars.length < 3) return '***'
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
  return `${slugBaseLote(cardSlugOuNome, graduadora, nota)}-${slugify(codigo)}`
}

/**
 * Slug do lote SEM o codigo: {slug-da-carta}-{graduadora-nota?}. Usado quando
 * o codigo nasce no banco (leilao_adicionar_lote fecha com "-{codigo}").
 */
export function slugBaseLote(
  cardSlugOuNome: string,
  graduadora: string | null | undefined,
  nota: string | null | undefined
): string {
  const partes = [slugify(cardSlugOuNome) || 'carta']
  const grad = slugify([graduadora, nota].filter(Boolean).join(' '))
  if (graduadora && grad) partes.push(grad)
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

/**
 * "27/09/2026, 21:30 (Brasília)" — sempre America/Sao_Paulo.
 *
 * Montado a mao a partir das partes: toLocaleString varia entre o ICU do Node
 * e o do navegador (virgula, espaco estreito), e isso quebra a hidratacao.
 */
const FMT_BRASILIA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function horarioBrasilia(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const p: Record<string, string> = {}
  for (const part of FMT_BRASILIA.formatToParts(d)) p[part.type] = part.value
  const hora = p.hour === '24' ? '00' : p.hour
  return `${p.day}/${p.month}/${p.year}, ${hora}:${p.minute} (Brasília)`
}

/** "2026-09-27" no fuso de Brasilia (priceValidUntil do JSON-LD). */
export function dataBrasiliaISO(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const p: Record<string, string> = {}
  for (const part of FMT_BRASILIA.formatToParts(d)) p[part.type] = part.value
  return `${p.year}-${p.month}-${p.day}`
}

// ─── Erros do lance ─────────────────────────────────────────────────────────

export interface ErroLance {
  codigo: CodigoErroLance
  mensagem: string
  status: number
  /** So em abaixo_minimo: o minimo que o servidor exige agora. */
  minimoCents?: number
}

/** Contexto opcional para diferenciar os dois casos de `abaixo_minimo`. */
export interface ContextoErroLance {
  /** Lance minimo que a tela mostrava quando o usuario confirmou. */
  vistoCents?: number | null
  /** Status HTTP da resposta do PostgREST (401 = token vencido/invalido). */
  httpStatus?: number | null
  /** `error.code` do PostgREST/Postgres (PGRST301, 55P03, 57014...). */
  pgCode?: string | null
}

const MSG_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre de novo para dar lance.'
const MSG_PEDIDO_INVALIDO = 'Pedido inválido. Atualize a página e tente de novo.'

/**
 * Converte o erro do RPC `dar_lance` em erro de tela.
 * Formatos aceitos: "abaixo_minimo:1500", "leilao_fechado", ou texto que os contenha.
 *
 * abaixo_minimo tem duas causas com mensagens diferentes:
 *   - o minimo do servidor SUBIU em relacao ao que a tela mostrava
 *     (`vistoCents`) -> outro lance chegou primeiro;
 *   - o minimo e o mesmo que a tela mostrava -> o valor digitado ficou abaixo.
 * Sem `vistoCents`, mensagem neutra com o minimo atual.
 */
export function erroDoLance(msg: string | null | undefined, ctx: ContextoErroLance = {}): ErroLance {
  const s = (msg ?? '').trim()

  // Token vencido/invalido: o PostgREST barra antes de chegar na funcao.
  if (ctx.httpStatus === 401 || /^PGRST30\d$/.test(ctx.pgCode ?? '') || /\bjwt\b/i.test(s)) {
    return { codigo: 'sessao_expirada', status: 401, mensagem: MSG_SESSAO_EXPIRADA }
  }

  const m = s.match(/abaixo_minimo:(\d+)/)
  if (m) {
    const minimoCents = Number(m[1])
    const visto = ctx.vistoCents
    let mensagem: string
    if (visto != null && Number.isFinite(visto) && minimoCents > visto) {
      mensagem = `Outro lance chegou primeiro. Lance mínimo agora: ${formatarBRL(minimoCents)}.`
    } else if (visto != null && Number.isFinite(visto)) {
      mensagem = `O valor informado está abaixo do lance mínimo de ${formatarBRL(minimoCents)}.`
    } else {
      mensagem = `O lance mínimo agora é ${formatarBRL(minimoCents)}.`
    }
    return { codigo: 'abaixo_minimo', status: 409, minimoCents, mensagem }
  }

  // Ordem importa so se um codigo contiver outro; hoje nenhum contem.
  const tabela: Array<[Exclude<CodigoErroLance, 'abaixo_minimo' | 'desconhecido' | 'lote_ocupado'>, number, string]> = [
    ['nao_autenticado', 401, MSG_SESSAO_EXPIRADA],
    ['pedido_invalido', 400, MSG_PEDIDO_INVALIDO],
    ['idem_invalido', 400, MSG_PEDIDO_INVALIDO],
    ['cadastro_incompleto', 403, 'Complete seu cadastro (CPF e CEP) para dar lances.'],
    ['suspenso', 403, 'Sua conta está impedida de dar lances no momento.'],
    ['leilao_fechado', 409, 'Este lote não está aberto para lances.'],
    ['proprio_leilao', 403, 'Você não pode dar lance no seu próprio lote.'],
  ]
  for (const [codigo, status, mensagem] of tabela) {
    if (new RegExp(`\\b${codigo}\\b`).test(s)) return { codigo, status, mensagem }
  }

  // lock_timeout (55P03) / statement_timeout (57014): lote disputado demais.
  if (ctx.pgCode === '55P03' || ctx.pgCode === '57014') {
    return {
      codigo: 'lote_ocupado',
      status: 503,
      mensagem: 'Muitos lances ao mesmo tempo neste lote. Tente de novo em instantes.',
    }
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
    seuMaximoCents: num(r.seu_maximo_cents),
    repetido: r.repetido === true,
  }
}

// ─── Checkout do arremate ───────────────────────────────────────────────────

/** Limites da Stripe para `expires_at` de uma Checkout Session. */
export const SESSAO_STRIPE_MIN_SEG = 30 * 60
export const SESSAO_STRIPE_MAX_SEG = 24 * 60 * 60
/** Folga para relogio e ida e volta: a Stripe mede a partir da criacao dela. */
const SESSAO_FOLGA_SEG = 60
/**
 * Quanto a sessao pode passar de `pagar_ate`: 14 min, dentro da carencia de
 * 15 min do tick (leilao_tick passo 5). Quem abriu o pagamento perto do fim
 * do prazo ainda consegue concluir, e o tick nunca marca calote com sessao
 * aberta. ★ Mudou aqui, conferir a carencia e a janela de 30 min do tick.
 */
export const SESSAO_ALEM_DO_PRAZO_SEG = 14 * 60

/**
 * `expires_at` (segundos Unix) da sessao de pagamento de um arremate.
 * No maximo `pagar_ate` + 14 min (dentro da carencia do tick) e nunca alem de
 * 24h (teto da Stripe). Se nem com a extensao sobra o minimo da Stripe (30 min
 * + folga), devolve null e a rota recusa. Prazo ja vencido tambem devolve null:
 * a extensao e so para quem abre o pagamento ANTES do prazo. A tela continua
 * mostrando `pagar_ate`.
 */
export function expiraSessaoLeilao(pagarAteMs: number, agoraMs: number): number | null {
  if (!Number.isFinite(pagarAteMs) || !Number.isFinite(agoraMs)) return null
  if (agoraMs >= pagarAteMs) return null
  const agoraSeg = Math.floor(agoraMs / 1000)
  const limiteSeg = Math.floor(pagarAteMs / 1000) + SESSAO_ALEM_DO_PRAZO_SEG
  const alvo = Math.min(limiteSeg, agoraSeg + SESSAO_STRIPE_MAX_SEG - SESSAO_FOLGA_SEG)
  if (alvo < agoraSeg + SESSAO_STRIPE_MIN_SEG + SESSAO_FOLGA_SEG) return null
  return alvo
}
