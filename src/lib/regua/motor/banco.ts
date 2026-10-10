/**
 * Leitura do banco para o motor da regua. Tudo por indice e em lotes; nada
 * varre `pokemon_cards_all` nem `price_snapshots`.
 *
 * Medido em 08/10/2026 pelo MCP (buffer quente; o `authenticator` tem 8s e
 * buffer frio, por isso o que conta e o PLANO e os buffers, nao o tempo):
 *
 * - users inteira (466 linhas): Index Scan users_pkey, 451 buffers.
 * - user_cards .in(user_id, 50 ids) order by id: Bitmap Index Scan em
 *   idx_user_cards_user, 175 buffers (670 linhas). A colecao mais pesada
 *   (517 linhas) sozinha = 28 buffers.
 * - pokemon_cards (view) .in(id, 300 ids): Index Scan pokemon_cards_pkey,
 *   511 buffers por lote; as 4.508 cartas das colecoes = 16 lotes, ~7,7 mil.
 * - pokemon_cards set_id = X (E04/E07): Index Scan idx_pokemon_cards_set_id,
 *   168 buffers (151, 207 cartas).
 * - pokemon_cards base_pokemon_names @> {X} + regiao (meta de Pokemon, E07):
 *   Bitmap Index Scan idx_pokemon_cards_base_names, 628 buffers (Pikachu, o pior).
 * - price_snapshots .in(card_id, 150 ids) + snapshot_date > hoje-97:
 *   Index Scan em price_snapshots_card_id_snapshot_date_key, ~350 a 540
 *   buffers por lote. TODAS as 4.508 cartas distintas das colecoes de uma vez:
 *   16.242 buffers (hit), 13.767 linhas, 625 ms; tabela + indice = 2.784
 *   paginas (22 MB), entao o pior caso frio le no maximo isso, uma vez por tick.
 * - email_envios .in(user_id, 50) + enviado_em >= now()-120d: Bitmap Index
 *   Scan em email_envios_user_enviado_idx, 41 buffers (tabela vazia hoje).
 * - marketplace disponivel (anuncios ativos): Seq Scan em 172 linhas, 14 buffers.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { COLUNAS_PRECO, valorCarta } from '@/lib/calcPatrimonio'
import { imagemCarta } from '@/lib/regua/templates/blocos-a'
import { LOJAS_TESTE_NOME, ehContaDeTeste } from './config'
import { DIA_MS, diaBR, diaDoBanco, msDoBanco, somarDias } from './tempo'

export function db(): SupabaseClient {
  const c = getServiceSupabase()
  if (!c) throw new Error('[regua] supabase service role ausente no ambiente')
  return c
}

export function emBlocos<T>(itens: T[], tamanho: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < itens.length; i += tamanho) out.push(itens.slice(i, i + tamanho))
  return out
}

const PAGINA = 1000

// ─── Usuarios ───────────────────────────────────────────────────────────────

export type Usuario = {
  id: string
  email: string
  /** Primeiro nome ('' quando nao ha nome). */
  nome: string
  criadoMs: number
  criadoDia: string
  lastSeenMs: number | null
  trialExpira: string | null
  isPro: boolean
  plano: string | null
  proExpira: string | null
  marketingAceito: boolean
  optOut: boolean
  unsubscribeToken: string | null
  prefs: { colecao: boolean; mercado: boolean; novidades: boolean; radar: boolean }
  cidade: string
  uf: string
  repassePrazo: number | null
  scanUsados: number
  scanReset: string | null
  scanCreditos: number
  suspensa: boolean
  /** Conta interna/de teste: fora de todo publico automatico. */
  teste: boolean
}

const COLS_USUARIO =
  'id, email, name, created_at, last_seen_at, trial_expires_at, is_pro, plano, pro_expira_em, marketing_aceito, ' +
  'email_optout_nurture, unsubscribe_token, email_pref_colecao, email_pref_mercado, email_pref_novidades, email_pref_radar, ' +
  'city, uf, repasse_prazo, scan_mensal_usados, scan_mensal_reset, scan_creditos, suspended_at'

export function primeiroNome(nome: string | null | undefined): string {
  const p = (nome || '').trim().split(/\s+/)[0] || ''
  if (!p || p.includes('@')) return ''
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function paraUsuario(r: any, donosTeste: Set<string>): Usuario {
  const criadoMs = msDoBanco(r.created_at) ?? 0
  return {
    id: r.id,
    email: String(r.email || '').trim(),
    nome: primeiroNome(r.name),
    criadoMs,
    criadoDia: diaDoBanco(r.created_at) ?? '1970-01-01',
    lastSeenMs: msDoBanco(r.last_seen_at),
    trialExpira: r.trial_expires_at ?? null,
    isPro: r.is_pro === true,
    plano: r.plano ?? null,
    proExpira: r.pro_expira_em ?? null,
    marketingAceito: r.marketing_aceito === true,
    optOut: r.email_optout_nurture === true,
    unsubscribeToken: r.unsubscribe_token ?? null,
    prefs: {
      colecao: r.email_pref_colecao !== false,
      mercado: r.email_pref_mercado !== false,
      novidades: r.email_pref_novidades !== false,
      radar: r.email_pref_radar !== false,
    },
    cidade: String(r.city || '').trim(),
    uf: String(r.uf || '').trim().toUpperCase(),
    repassePrazo: typeof r.repasse_prazo === 'number' ? r.repasse_prazo : null,
    scanUsados: Number(r.scan_mensal_usados) || 0,
    scanReset: r.scan_mensal_reset ?? null,
    scanCreditos: Number(r.scan_creditos) || 0,
    suspensa: !!r.suspended_at,
    teste: ehContaDeTeste(r.email) || donosTeste.has(r.id),
  }
}

/** Donos das lojas de teste (Vulcano Cards). Tabela `lojas` tem ~11 linhas. */
async function donosDeLojasTeste(c: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await c.from('lojas').select('owner_user_id, nome').limit(500)
  if (error) throw new Error(`[regua] lojas: ${error.message}`)
  const alvo = new Set(LOJAS_TESTE_NOME)
  return new Set(
    (data || [])
      .filter((l: any) => alvo.has(String(l.nome || '').trim().toLowerCase()))
      .map((l: any) => l.owner_user_id as string)
      .filter(Boolean),
  )
}

/**
 * Todos os usuarios (~466; tabela pequena, paginada por id) ou so os `ids`
 * pedidos (envio na hora: E02 no cadastro, avisos do leilao), pela PK.
 */
export async function carregarUsuarios(c: SupabaseClient, ids?: string[]): Promise<Map<string, Usuario>> {
  const donos = await donosDeLojasTeste(c)
  const out = new Map<string, Usuario>()
  for (let de = 0; ; de += PAGINA) {
    let q = c.from('users').select(COLS_USUARIO)
    if (ids) q = q.in('id', ids.slice(0, 50))
    const { data, error } = await q.order('id').range(de, de + PAGINA - 1)
    // Falha de leitura NAO vira "ninguem para avisar": aborta o tick.
    if (error) throw new Error(`[regua] users: ${error.message}`)
    if (!data || data.length === 0) break
    for (const r of data) {
      const u = paraUsuario(r, donos)
      if (u.email) out.set(u.id, u)
    }
    if (data.length < PAGINA) break
  }
  return out
}

// ─── Catalogo (pokemon_cards por PK) ────────────────────────────────────────

export type CartaCatalogo = {
  id: string
  nome: string
  set: string
  setId: string
  setTotal: number | null
  numero: string
  slug: string
  /** Imagem pequena permitida (pokemontcg/scrydex/storage) ou ''. */
  imagem: string
  /** Imagem grande permitida, cai na pequena. */
  imagemGrande: string
  precoMin: number
  regiao: string | null
  pokemons: string[]
  lancamento: string | null
  /** Linha crua com as COLUNAS_PRECO, para `valorCarta`. */
  preco: Record<string, unknown>
}

const COLS_CATALOGO = `${COLUNAS_PRECO}, name, set_name, set_id, set_total, number, slug, image_small, image_large, regiao, base_pokemon_names, set_release_date`

/** "Charizard ex (199/165)" e entidades -> "Charizard ex" (mesma limpeza do mv_price_movers). */
export function nomeLimpo(nome: string | null | undefined): string {
  return String(nome || '')
    .replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
    .replace(/\s*\([0-9A-Za-z]+\s*\/\s*[0-9A-Za-z]+\)\s*$/, '')
    .trim()
}

function paraCatalogo(r: any): CartaCatalogo {
  const pequena = imagemCarta(r.image_small)
  return {
    id: r.id,
    nome: nomeLimpo(r.name),
    set: String(r.set_name || '').trim(),
    setId: String(r.set_id || ''),
    setTotal: typeof r.set_total === 'number' ? r.set_total : null,
    numero: String(r.number || ''),
    slug: r.slug || r.id,
    imagem: pequena,
    imagemGrande: imagemCarta(r.image_large) || pequena,
    precoMin: Number(r.preco_min) || 0,
    regiao: r.regiao ?? null,
    pokemons: Array.isArray(r.base_pokemon_names) ? r.base_pokemon_names : [],
    lancamento: r.set_release_date ?? null,
    preco: r,
  }
}

/** Busca no catalogo os ids que ainda nao estao no cache. Por PK, lotes de 300. */
export async function carregarCatalogo(c: SupabaseClient, cache: Map<string, CartaCatalogo>, ids: string[]): Promise<void> {
  const faltam = [...new Set(ids.filter((id) => id && !cache.has(id)))]
  for (const lote of emBlocos(faltam, 300)) {
    const { data, error } = await c.from('pokemon_cards').select(COLS_CATALOGO).in('id', lote)
    if (error) throw new Error(`[regua] pokemon_cards: ${error.message}`)
    for (const r of data || []) cache.set((r as any).id, paraCatalogo(r))
  }
}

/**
 * Cartas de um set (idx_pokemon_cards_set_id) ou de um Pokemon
 * (idx_pokemon_cards_base_names, GIN: `@>`, nunca `= ANY`). Para E04/E07.
 */
export async function cartasDoAlvo(
  c: SupabaseClient, cache: Map<string, CartaCatalogo>,
  alvo: { tipo: 'set' | 'pokemon'; valor: string; regiao?: string | null },
): Promise<CartaCatalogo[]> {
  const out: CartaCatalogo[] = []
  for (let de = 0; ; de += PAGINA) {
    let q = c.from('pokemon_cards').select(COLS_CATALOGO)
    q = alvo.tipo === 'set' ? q.eq('set_id', alvo.valor) : q.contains('base_pokemon_names', [alvo.valor])
    if (alvo.tipo === 'pokemon' && alvo.regiao) q = q.eq('regiao', alvo.regiao)
    const { data, error } = await q.order('id').range(de, de + PAGINA - 1)
    if (error) throw new Error(`[regua] cartas do alvo ${alvo.valor}: ${error.message}`)
    for (const r of data || []) {
      const cc = paraCatalogo(r)
      cache.set(cc.id, cc)
      out.push(cc)
    }
    if (!data || data.length < PAGINA) break
  }
  return out
}

/** Ordem do set, igual a `meta_cartas`: lancamento, set, numero. */
export function ordemDoSet(a: CartaCatalogo, b: CartaCatalogo): number {
  const la = a.lancamento || '9999', lb = b.lancamento || '9999'
  if (la !== lb) return la < lb ? -1 : 1
  if (a.setId !== b.setId) return a.setId < b.setId ? -1 : 1
  const na = parseInt(a.numero, 10), nb = parseInt(b.numero, 10)
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
  return a.numero < b.numero ? -1 : a.numero > b.numero ? 1 : 0
}

// ─── Colecoes (user_cards) ──────────────────────────────────────────────────

export type CartaPessoa = {
  /** pokemon_api_id (id do catalogo) ou null. */
  cardId: string | null
  cat: CartaCatalogo | null
  nome: string
  quantidade: number
  variante: string
  graduada: boolean
  /** Valor unitario pela fonte unica (calcPatrimonio.valorCarta). */
  valorUnit: number
  criadoDia: string
  idioma: string | null
}

export type Colecao = {
  cartas: CartaPessoa[]
  /** Soma das quantidades. */
  total: number
  diferentes: number
  valor: number
}

const COLS_UC = 'user_id, pokemon_api_id, card_id, card_link, card_name, variante, quantity, graduada, valor_graduada, created_at, idioma'

/** Colecoes de um conjunto de pessoas: user_cards por lote de 50 ids + catalogo por PK. */
export async function carregarColecoes(
  c: SupabaseClient, cache: Map<string, CartaCatalogo>, userIds: string[],
): Promise<Map<string, Colecao>> {
  const linhas: any[] = []
  for (const lote of emBlocos([...new Set(userIds)], 50)) {
    for (let de = 0; ; de += PAGINA) {
      const { data, error } = await c.from('user_cards').select(COLS_UC).in('user_id', lote)
        .order('id').range(de, de + PAGINA - 1)
      if (error) throw new Error(`[regua] user_cards: ${error.message}`)
      linhas.push(...(data || []))
      if (!data || data.length < PAGINA) break
    }
  }
  await carregarCatalogo(c, cache, linhas.map((l) => l.pokemon_api_id).filter(Boolean))

  const out = new Map<string, Colecao>()
  for (const id of userIds) out.set(id, { cartas: [], total: 0, diferentes: 0, valor: 0 })
  for (const l of linhas) {
    const cat = l.pokemon_api_id ? cache.get(l.pokemon_api_id) ?? null : null
    const qtd = Math.max(1, Number(l.quantity) || 1)
    const unit = valorCarta(l, cat?.preco ?? null)
    const col = out.get(l.user_id)!
    col.cartas.push({
      cardId: l.pokemon_api_id ?? null,
      cat,
      nome: cat?.nome || nomeLimpo(l.card_name),
      quantidade: qtd,
      variante: l.variante || 'normal',
      graduada: l.graduada === true,
      valorUnit: unit,
      criadoDia: diaDoBanco(l.created_at) ?? '1970-01-01',
      idioma: l.idioma ?? null,
    })
    col.total += qtd
    col.valor += unit * qtd
  }
  for (const col of out.values()) {
    col.diferentes = new Set(col.cartas.map((x) => x.cardId || x.nome)).size
    col.valor = Math.round(col.valor * 100) / 100
  }
  return out
}

// ─── Historico de preco (price_snapshots) ───────────────────────────────────

/** Janela lida: cobre a base de 30 dias com folga (snapshots so existem quando o preco muda). */
export const JANELA_HISTORICO_DIAS = 97

export class Historico {
  /** card_id -> snapshots ordenados por dia (asc). */
  private porCarta = new Map<string, { dia: string; preco: number }[]>()
  private carregados = new Set<string>()
  constructor(private hoje: string) {}

  async carregar(c: SupabaseClient, ids: string[]): Promise<void> {
    const faltam = [...new Set(ids.filter((id) => id && !this.carregados.has(id)))]
    const desde = somarDias(this.hoje, -JANELA_HISTORICO_DIAS)
    for (const lote of emBlocos(faltam, 150)) {
      for (let de = 0; ; de += PAGINA) {
        const { data, error } = await c.from('price_snapshots').select('card_id, snapshot_date, preco_min')
          .in('card_id', lote).gt('snapshot_date', desde).order('card_id').order('snapshot_date')
          .range(de, de + PAGINA - 1)
        if (error) throw new Error(`[regua] price_snapshots: ${error.message}`)
        for (const r of data || []) {
          const p = Number((r as any).preco_min)
          if (!(p > 0)) continue
          const id = (r as any).card_id as string
          const l = this.porCarta.get(id) || []
          l.push({ dia: (r as any).snapshot_date, preco: p })
          this.porCarta.set(id, l)
        }
        if (!data || data.length < PAGINA) break
      }
      lote.forEach((id) => this.carregados.add(id))
    }
  }

  /**
   * Menor preco da carta no fim do `dia`. Snapshot so e gravado quando o
   * preco muda: o ultimo snapshot ate o dia vale. Sem nenhum snapshot na
   * janela = o preco nao mudou nela (vale o atual). Com snapshot so DEPOIS do
   * dia = nao sabemos a base: null (a carta fica fora da conta, nunca chuta).
   */
  precoEm(cat: CartaCatalogo, dia: string): number | null {
    const l = this.porCarta.get(cat.id)
    if (!this.carregados.has(cat.id)) return null
    if (!l || l.length === 0) return cat.precoMin > 0 ? cat.precoMin : null
    let achado: number | null = null
    for (const s of l) {
      if (s.dia <= dia) achado = s.preco
      else break
    }
    if (achado !== null) return achado
    return null
  }

  /** Variacao do menor preco entre `dias` atras e hoje (preco atual do catalogo). */
  variacao(cat: CartaCatalogo | null, dias: number): { antes: number; agora: number; delta: number; pct: number } | null {
    if (!cat || !(cat.precoMin > 0)) return null
    const antes = this.precoEm(cat, somarDias(this.hoje, -dias))
    if (antes === null || !(antes > 0)) return null
    const agora = cat.precoMin
    const delta = Math.round((agora - antes) * 100) / 100
    const pct = Math.round(((agora - antes) / antes) * 1000) / 10
    return { antes, agora, delta, pct }
  }
}

// ─── Log de envio (email_envios) ────────────────────────────────────────────

export type EnvioLog = {
  template: string
  categoria: string
  campanha: string | null
  status: string
  enviadoMs: number
  clicadoMs: number | null
  chave: string | null
  /** card_ids citados (E08 guarda os avisados; E09 o anunciado). */
  cartas: string[]
}

/** Janela do log lida por tick: cobre teto (7d), dedup mensal e o sunset (60d). */
export const JANELA_LOG_DIAS = 120

export async function carregarEnvios(c: SupabaseClient, userIds: string[]): Promise<Map<string, EnvioLog[]>> {
  const desde = new Date(Date.now() - JANELA_LOG_DIAS * DIA_MS).toISOString()
  const out = new Map<string, EnvioLog[]>()
  for (const id of userIds) out.set(id, [])
  for (const lote of emBlocos([...new Set(userIds)], 50)) {
    for (let de = 0; ; de += PAGINA) {
      const { data, error } = await c.from('email_envios')
        .select('user_id, template, categoria, campanha, status, enviado_em, clicado_em, chave:meta->>chave, cartas:meta->cartas')
        .in('user_id', lote).gte('enviado_em', desde).order('enviado_em').range(de, de + PAGINA - 1)
      // Sem o log nao ha teto nem dedup: aborta em vez de mandar em dobro.
      if (error) throw new Error(`[regua] email_envios: ${error.message}`)
      for (const r of (data || []) as any[]) {
        out.get(r.user_id)?.push({
          template: r.template,
          categoria: r.categoria,
          campanha: r.campanha ?? null,
          status: r.status,
          enviadoMs: msDoBanco(r.enviado_em) ?? 0,
          clicadoMs: msDoBanco(r.clicado_em),
          chave: r.chave ?? null,
          cartas: Array.isArray(r.cartas) ? r.cartas.filter((x: unknown) => typeof x === 'string') : [],
        })
      }
      if (!data || data.length < PAGINA) break
    }
  }
  return out
}

// ─── Marketplace ────────────────────────────────────────────────────────────

export type Anuncio = {
  id: string
  slug: string | null
  cardId: string
  preco: number
  condicao: string | null
  idioma: string | null
  graduada: boolean
  userId: string
  criadoMs: number
  imagemVendedor: string
}

/**
 * Anuncios compraveis agora (`disponivel`, nao removidos) com vinculo ao
 * catalogo. Hoje ~104 linhas: a mesma leitura inteira paginada do
 * /api/metas/a-venda (ver o comentario la).
 */
export async function carregarAnunciosAtivos(c: SupabaseClient): Promise<Anuncio[]> {
  const out: Anuncio[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await c.from('marketplace')
      .select('id, slug, card_id, price, condicao, idioma, graduada, user_id, created_at, fotos')
      .eq('status', 'disponivel').is('removido_em', null).not('card_id', 'is', null)
      .order('created_at', { ascending: false }).range(de, de + PAGINA - 1)
    if (error) throw new Error(`[regua] marketplace: ${error.message}`)
    for (const r of (data || []) as any[]) {
      const fotos = Array.isArray(r.fotos) ? r.fotos.filter((f: unknown): f is string => typeof f === 'string') : []
      out.push({
        id: r.id, slug: r.slug ?? null, cardId: r.card_id, preco: Number(r.price) || 0,
        condicao: r.condicao ?? null, idioma: r.idioma ?? null, graduada: r.graduada === true,
        userId: r.user_id, criadoMs: msDoBanco(r.created_at) ?? 0,
        imagemVendedor: imagemCarta(fotos[0]),
      })
    }
    if (!data || data.length < PAGINA) break
  }
  return out
}

/** Quem tem anuncio ativo (disponivel/reservado/em negociacao), para o E20. */
export async function donosDeAnuncioAtivo(c: SupabaseClient): Promise<Set<string>> {
  const out = new Set<string>()
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await c.from('marketplace').select('user_id')
      .in('status', ['disponivel', 'reservado', 'em_negociacao']).is('removido_em', null)
      .order('id').range(de, de + PAGINA - 1)
    if (error) throw new Error(`[regua] marketplace donos: ${error.message}`)
    for (const r of (data || []) as any[]) out.add(r.user_id)
    if (!data || data.length < PAGINA) break
  }
  return out
}

export const hojeBR = (): string => diaBR()
/* eslint-enable @typescript-eslint/no-explicit-any */
