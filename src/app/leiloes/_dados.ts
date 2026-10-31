import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { lotePublicoDeLinha, type LotePublico } from '@/lib/leilao'
import {
  COLUNAS_LOTE_ATIVO_EXTRA,
  COLUNAS_LOTE_RODADA,
  COLUNAS_RODADA,
  lotesDaRodadaDeLinhas,
  rodadaPublicaDeLinha,
  type RodadaPublica,
} from '@/lib/leilao-rodada'
import { contarRodadasPorLoja, STATUS_RODADA_FOI_AO_AR, type LoteNoArResumo } from '@/lib/leilao-vitrine'

/**
 * Leituras server-side do leilao. Sempre pela view `leiloes_publico` (sem o
 * teto oculto do lider, apelido ja mascarado) e nunca `rascunho`.
 *
 * Service role porque a view e security_invoker (a RLS da base vale para o
 * anon). O que sai daqui e so o que a view expoe.
 *
 * ★ Falha LANCA, nunca vira lista vazia. Hoje nao ha unstable_cache aqui
 * (rota force-dynamic), mas se um dia houver, vazio viraria entrada valida e
 * ficaria servido ate o revalidate — regra da casa.
 */

export type OrdemVitrine = 'terminando' | 'novos' | 'sem_lance'

export const ORDENS_VITRINE: ReadonlyArray<{ chave: OrdemVitrine; rotulo: string }> = [
  { chave: 'terminando', rotulo: 'Terminando em breve' },
  { chave: 'novos', rotulo: 'Novos' },
  { chave: 'sem_lance', rotulo: 'Sem lance' },
]

export function ordemValida(v: unknown): OrdemVitrine {
  return v === 'novos' || v === 'sem_lance' ? v : 'terminando'
}

const LIMITE_VITRINE = 48

export async function listarLotesVitrine(ordem: OrdemVitrine): Promise<LotePublico[]> {
  const db = getServiceSupabase()
  if (!db) throw new Error('[leiloes] service role ausente')

  let q = db.from('leiloes_publico').select('*')
  if (ordem === 'sem_lance') {
    q = q.eq('status', 'ativo').eq('n_lances', 0).order('termina_em', { ascending: true, nullsFirst: false })
  } else if (ordem === 'novos') {
    q = q.in('status', ['agendado', 'ativo']).order('inicia_em', { ascending: false, nullsFirst: false })
  } else {
    // Terminando: so lote ABERTO (status 'ativo') e com prazo. Lote 'agendado'
    // de rodada ainda esta na fila, nao termina em nada; entrava aqui antes.
    q = q
      .eq('status', 'ativo')
      .not('termina_em', 'is', null)
      .order('termina_em', { ascending: true })
  }

  const { data, error } = await q.limit(LIMITE_VITRINE)
  if (error) throw new Error(`[leiloes] vitrine: ${error.code} ${error.message}`)
  return (data ?? []).map(r => lotePublicoDeLinha(r as Record<string, unknown>))
}

/**
 * Lote pelo codigo (os 6 ultimos caracteres do slug). `cache()` porque
 * generateMetadata e a pagina chamam os dois: sem ele sao 2 consultas por
 * visita (query do Supabase nao dedupa sozinha, so fetch).
 */
export const buscarLotePorCodigo = cache(async (codigo: string): Promise<LotePublico | null> => {
  const db = getServiceSupabase()
  if (!db) throw new Error('[leiloes] service role ausente')
  const { data, error } = await db
    .from('leiloes_publico')
    .select('*')
    .eq('codigo', codigo)
    .neq('status', 'rascunho')
    .maybeSingle()
  if (error) throw new Error(`[leiloes] lote ${codigo}: ${error.code} ${error.message}`)
  return data ? lotePublicoDeLinha(data as Record<string, unknown>) : null
})

export interface LojaDoLote {
  slug: string
  nome: string | null
  logoUrl: string | null
  verificada: boolean
}

/** Loja do vendedor, por PK. Complementar: falha vira null, a pagina segue. */
export const buscarLojaDoLote = cache(async (lojaId: string | null): Promise<LojaDoLote | null> => {
  if (!lojaId) return null
  const db = getServiceSupabase()
  if (!db) return null
  const { data, error } = await db
    .from('lojas')
    .select('slug, nome, logo_url, verificada')
    .eq('id', lojaId)
    .maybeSingle()
  if (error || !data?.slug) return null
  return {
    slug: String(data.slug),
    nome: (data.nome as string | null) ?? null,
    logoUrl: (data.logo_url as string | null) ?? null,
    verificada: data.verificada === true,
  }
})

/**
 * Referencia do Mercado Brasileiro para o aviso de lance alto: o MENOR preco
 * (regra de divulgacao desde 25/08 — a media mente quando a faixa e aberta).
 * Leitura por PK na view `pokemon_cards`. So para carta sem graduacao: slab
 * nao tem preco comparavel no catalogo. Falha vira null (o aviso so some).
 */
export async function lerReferenciaMercadoCents(
  db: SupabaseClient,
  cardId: string | null,
  graduadora: string | null
): Promise<number | null> {
  if (!cardId || graduadora) return null
  const { data, error } = await db.from('pokemon_cards').select('preco_min').eq('id', cardId).maybeSingle()
  if (error || !data) return null
  const v = Number((data as { preco_min?: unknown }).preco_min)
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null
}

export const buscarReferenciaMercadoCents = cache(
  async (cardId: string | null, graduadora: string | null): Promise<number | null> => {
    const db = getServiceSupabase()
    if (!db) return null
    return lerReferenciaMercadoCents(db, cardId, graduadora)
  }
)

// ─── Rodada ─────────────────────────────────────────────────────────────────

/** Rodada publica pelo numero (indice unico). Nunca rascunho. Falha LANCA. */
export async function lerRodadaPorNumero(db: SupabaseClient, numero: number): Promise<RodadaPublica | null> {
  const { data, error } = await db
    .from('leilao_rodadas')
    .select(COLUNAS_RODADA)
    .eq('numero', numero)
    .neq('status', 'rascunho')
    .maybeSingle()
  if (error) throw new Error(`[leiloes] rodada ${numero}: ${error.code} ${error.message}`)
  return data ? rodadaPublicaDeLinha(data as unknown as Record<string, unknown>) : null
}

/**
 * Lotes publicos da rodada (pelo indice rodada_id, ordem), com as colunas
 * enxutas de COLUNAS_LOTE_RODADA. O lote NO AR ganha fotos e apelido do lider
 * numa segunda leitura por PK (uma linha), em vez de levar as duas colunas em
 * todos os lotes a cada volta do polling. Falha LANCA.
 */
export async function lerLotesDaRodada(db: SupabaseClient, rodadaId: string): Promise<LotePublico[]> {
  const { data, error } = await db
    .from('leiloes_publico')
    .select(COLUNAS_LOTE_RODADA)
    .eq('rodada_id', rodadaId)
    .order('ordem', { ascending: true })
    .limit(LIMITE_LOTES_RODADA)
  if (error) throw new Error(`[leiloes] lotes da rodada ${rodadaId}: ${error.code} ${error.message}`)
  const lotes = lotesDaRodadaDeLinhas(data as unknown[] | null)

  const i = lotes.findIndex(l => l.status === 'ativo')
  if (i < 0) return lotes
  const ativo = lotes[i]
  const extra = await db.from('leiloes_publico').select(COLUNAS_LOTE_ATIVO_EXTRA).eq('id', ativo.id).maybeSingle()
  if (extra.error) throw new Error(`[leiloes] lote no ar ${ativo.id}: ${extra.error.code} ${extra.error.message}`)
  if (extra.data) {
    const { fotos, liderApelido } = lotePublicoDeLinha(extra.data as unknown as Record<string, unknown>)
    lotes[i] = { ...ativo, fotos, liderApelido }
  }
  return lotes
}

/** Teto de seguranca da lista de lotes de uma rodada (a loja monta dezenas, nao milhares). */
const LIMITE_LOTES_RODADA = 200

function dbOuErro(): SupabaseClient {
  const db = getServiceSupabase()
  if (!db) throw new Error('[leiloes] service role ausente')
  return db
}

/** `cache()`: generateMetadata e a pagina leem a mesma rodada. */
export const buscarRodadaPorNumero = cache(async (numero: number) => lerRodadaPorNumero(dbOuErro(), numero))

export const buscarLotesDaRodada = cache(async (rodadaId: string) => lerLotesDaRodada(dbOuErro(), rodadaId))

/**
 * Rodada do lote, por PK (so para o aviso "este lote faz parte da rodada").
 * Complementar: falha vira null, a pagina do lote segue.
 */
export const buscarRodadaPorId = cache(async (rodadaId: string | null): Promise<RodadaPublica | null> => {
  if (!rodadaId) return null
  const db = getServiceSupabase()
  if (!db) return null
  const { data, error } = await db
    .from('leilao_rodadas')
    .select(COLUNAS_RODADA)
    .eq('id', rodadaId)
    .neq('status', 'rascunho')
    .maybeSingle()
  if (error || !data) return null
  return rodadaPublicaDeLinha(data as unknown as Record<string, unknown>)
})

// ─── Casca e home da ferramenta ─────────────────────────────────────────────

/**
 * Rodadas NO AR agora. Le `leilao_rodadas` filtrando `status = 'ao_vivo'`,
 * que e exatamente o predicado do indice parcial `idx_leilao_rodadas_ao_vivo`:
 * o indice so tem as rodadas no ar (unidades), entao a leitura toca poucas
 * paginas, nunca a tabela inteira. Usada pela home (o selo AO VIVO do
 * cabecalho tem rota propria, /api/leiloes/no-ar). Falha LANCA.
 */
export const buscarRodadasAoVivo = cache(async (): Promise<RodadaPublica[]> => {
  const db = dbOuErro()
  const { data, error } = await db
    .from('leilao_rodadas')
    .select(COLUNAS_RODADA)
    .eq('status', 'ao_vivo')
    .order('numero', { ascending: true })
    .limit(LIMITE_RODADAS_NO_AR)
  if (error) throw new Error(`[leiloes] rodadas no ar: ${error.code} ${error.message}`)
  return (data ?? []).map(r => rodadaPublicaDeLinha(r as unknown as Record<string, unknown>))
})

const LIMITE_RODADAS_NO_AR = 6

/**
 * Proximas rodadas agendadas, pelo horario (indice parcial
 * `idx_leilao_rodadas_agendada` em inicia_em). Falha LANCA.
 */
export async function listarRodadasAgendadas(limite = 20): Promise<RodadaPublica[]> {
  const db = dbOuErro()
  const { data, error } = await db
    .from('leilao_rodadas')
    .select(COLUNAS_RODADA)
    .eq('status', 'agendada')
    .order('inicia_em', { ascending: true, nullsFirst: false })
    .limit(limite)
  if (error) throw new Error(`[leiloes] rodadas agendadas: ${error.code} ${error.message}`)
  return (data ?? []).map(r => rodadaPublicaDeLinha(r as unknown as Record<string, unknown>))
}

/**
 * Rodadas encerradas mais recentes. Sem indice proprio: `leilao_rodadas` e
 * uma tabela pequena (uma linha por live de loja). Se crescer a ponto de
 * pesar, entra um indice parcial em (inicia_em) where status = 'encerrada'.
 * Falha LANCA.
 */
export async function listarRodadasEncerradas(limite = 20): Promise<RodadaPublica[]> {
  const db = dbOuErro()
  const { data, error } = await db
    .from('leilao_rodadas')
    .select(COLUNAS_RODADA)
    .eq('status', 'encerrada')
    .order('inicia_em', { ascending: false, nullsFirst: false })
    .limit(limite)
  if (error) throw new Error(`[leiloes] rodadas encerradas: ${error.code} ${error.message}`)
  return (data ?? []).map(r => rodadaPublicaDeLinha(r as unknown as Record<string, unknown>))
}

/**
 * Quantos lotes publicos (nao cancelados) cada rodada tem. Uma leitura so,
 * pelo indice (rodada_id, ordem). Complementar: falha vira mapa vazio e a
 * lista sai sem a contagem.
 */
export async function contarLotesPorRodada(rodadaIds: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>()
  if (!rodadaIds.length) return mapa
  const db = getServiceSupabase()
  if (!db) return mapa
  const { data, error } = await db
    .from('leiloes_publico')
    .select('rodada_id, status')
    .in('rodada_id', rodadaIds)
    .limit(LIMITE_LOTES_RODADA * rodadaIds.length)
  if (error || !data) return mapa
  for (const r of data as Array<{ rodada_id: string | null; status: string | null }>) {
    if (!r.rodada_id || r.status === 'cancelado') continue
    mapa.set(r.rodada_id, (mapa.get(r.rodada_id) ?? 0) + 1)
  }
  return mapa
}

/** Lojas por id (PK), para as listas de rodada. Complementar: falha vira mapa vazio. */
export async function buscarLojasPorId(ids: string[]): Promise<Map<string, LojaDoLote>> {
  const mapa = new Map<string, LojaDoLote>()
  const unicos = [...new Set(ids.filter(Boolean))]
  if (!unicos.length) return mapa
  const db = getServiceSupabase()
  if (!db) return mapa
  const { data, error } = await db.from('lojas').select('id, slug, nome, logo_url, verificada').in('id', unicos)
  if (error || !data) return mapa
  for (const d of data as Array<Record<string, unknown>>) {
    if (!d.slug) continue
    mapa.set(String(d.id), {
      slug: String(d.slug),
      nome: (d.nome as string | null) ?? null,
      logoUrl: (d.logo_url as string | null) ?? null,
      verificada: d.verificada === true,
    })
  }
  return mapa
}

// ─── Vitrine (/leiloes) ─────────────────────────────────────────────────────

export interface ResumoRodada {
  /** Lotes publicos nao cancelados. */
  n: number
  /** Ate 3 imagens de carta, na ordem da rodada (mosaico da agenda e do palco). */
  imagens: string[]
  /** Lote no ar (status 'ativo'): lances e prazo, para escolher o palco. null = nenhum. */
  noAr: LoteNoArResumo | null
}

/**
 * Contagem e mosaico de cada rodada numa leitura so, pelo indice
 * (rodada_id, ordem). Complementar: falha vira mapa vazio e a lista sai sem
 * contagem nem mosaico.
 */
export async function resumirLotesPorRodada(rodadaIds: string[]): Promise<Map<string, ResumoRodada>> {
  const mapa = new Map<string, ResumoRodada>()
  const unicos = [...new Set(rodadaIds.filter(Boolean))]
  if (!unicos.length) return mapa
  const db = getServiceSupabase()
  if (!db) return mapa
  const { data, error } = await db
    .from('leiloes_publico')
    .select('rodada_id, status, ordem, card_image, n_lances, termina_em')
    .in('rodada_id', unicos)
    .order('ordem', { ascending: true })
    .limit(LIMITE_LOTES_RODADA * unicos.length)
  if (error || !data) {
    if (error) console.error('[leiloes] resumo das rodadas:', error.code, error.message)
    return mapa
  }
  type Linha = {
    rodada_id: string | null; status: string | null; card_image: string | null
    n_lances: number | null; termina_em: string | null
  }
  for (const r of data as Linha[]) {
    if (!r.rodada_id || r.status === 'cancelado') continue
    const atual = mapa.get(r.rodada_id) ?? { n: 0, imagens: [], noAr: null }
    atual.n += 1
    if (r.card_image && atual.imagens.length < 3) atual.imagens.push(r.card_image)
    if (r.status === 'ativo') atual.noAr = { nLances: Number(r.n_lances) || 0, terminaEm: r.termina_em ?? null }
    mapa.set(r.rodada_id, atual)
  }
  return mapa
}

export interface Arrematado {
  lote: LotePublico
  /**
   * Menor preco do Mercado Brasileiro HOJE (preco_min atual, nao congelado no
   * arremate). null para carta graduada, sem carta do catalogo ou sem preco.
   */
  mercadoHojeCents: number | null
}

/**
 * Ultimos lotes PAGOS (status 'vendido'), do mais recente para o mais antigo.
 *
 * Sem indice por (status, encerrado_em) em `leiloes`: hoje a tabela e pequena
 * (lotes de leilao, nao catalogo) e a leitura com filtro + order + limit 6 e
 * barata. Se a tabela crescer a ponto de pesar, o indice parcial
 * `(encerrado_em desc) where status = 'vendido'` e DECISAO DO DU (schema).
 *
 * A referencia do Mercado vem por PK na view `pokemon_cards` (in(id), <= 6
 * linhas). Complementar: falha vira lista vazia e a secao some.
 */
export async function listarArrematadosRecentes(limite = 6): Promise<Arrematado[]> {
  const db = getServiceSupabase()
  if (!db) return []
  const { data, error } = await db
    .from('leiloes_publico')
    .select(`${COLUNAS_LOTE_RODADA}, fotos`)
    .eq('status', 'vendido')
    .order('encerrado_em', { ascending: false, nullsFirst: false })
    .limit(limite)
  if (error || !data) {
    if (error) console.error('[leiloes] arrematados:', error.code, error.message)
    return []
  }
  const lotes = (data as unknown[]).map(r => lotePublicoDeLinha(r as Record<string, unknown>))

  const ids = [...new Set(lotes.filter(l => l.cardId && !l.graduadora).map(l => l.cardId as string))]
  const precos = new Map<string, number>()
  if (ids.length) {
    const ref = await db.from('pokemon_cards').select('id, preco_min').in('id', ids)
    if (ref.error) console.error('[leiloes] mercado dos arrematados:', ref.error.code, ref.error.message)
    for (const r of (ref.data ?? []) as Array<{ id: unknown; preco_min: unknown }>) {
      const v = Number(r.preco_min)
      if (Number.isFinite(v) && v > 0) precos.set(String(r.id), Math.round(v * 100))
    }
  }
  return lotes.map(lote => ({
    lote,
    mercadoHojeCents: lote.cardId && !lote.graduadora ? precos.get(lote.cardId) ?? null : null,
  }))
}

export interface LojaDoLeilao extends LojaDoLote {
  id: string
  /** Rodadas que ja foram ao ar (regra unica: contarRodadasPorLoja). */
  nRodadas: number
  /** Estrelas das avaliacoes recebidas pelo dono (RPC get_avaliacoes_usuario). */
  estrelas: number[]
}

const LIMITE_LOJAS_LEILAO = 8

/**
 * Rodadas por loja pela REGRA UNICA de leilao-vitrine.ts (so as que ja foram
 * ao ar: ao_vivo ou encerrada). Vitrine (todas as lojas, sem `lojaIds`) e
 * pagina da rodada (uma loja) leem daqui, entao o numero e o mesmo nas duas.
 * `leilao_rodadas` e uma tabela pequena (uma linha por live de loja); com
 * `lojaIds` a leitura vai pelo indice `idx_leilao_rodadas_loja`.
 * Complementar: falha vira null (quem chama esconde o numero).
 */
export async function lerRodadasPorLoja(
  db: SupabaseClient,
  lojaIds?: readonly string[]
): Promise<Map<string, number> | null> {
  let q = db
    .from('leilao_rodadas')
    .select('loja_id, status')
    .in('status', [...STATUS_RODADA_FOI_AO_AR])
    .not('loja_id', 'is', null)
  if (lojaIds) {
    const unicos = [...new Set(lojaIds.filter(Boolean))]
    if (!unicos.length) return new Map()
    q = q.in('loja_id', unicos)
  }
  const { data, error } = await q.limit(2000)
  if (error || !data) {
    if (error) console.error('[leiloes] rodadas por loja:', error.code, error.message)
    return null
  }
  return contarRodadasPorLoja(data as Array<{ loja_id: string | null; status: string | null }>)
}

/** Rodadas de UMA loja pela regra unica. null = nao deu para contar. */
export async function contarRodadasDaLoja(db: SupabaseClient, lojaId: string): Promise<number | null> {
  const mapa = await lerRodadasPorLoja(db, [lojaId])
  return mapa ? mapa.get(lojaId) ?? 0 : null
}

/**
 * Lojas com pelo menos uma rodada que ja foi ao ar, da que mais fez para a
 * que menos fez. Tres leituras pequenas: rodadas por loja (lerRodadasPorLoja),
 * lojas por PK (so 'ativa', a mesma regra da pagina /lojas/[slug]) e a
 * avaliacao de cada dono pela RPC da casa (a mesma do ReputacaoCard).
 * Complementar: falha vira lista vazia e a secao some.
 */
export async function listarLojasDoLeilao(): Promise<LojaDoLeilao[]> {
  const db = getServiceSupabase()
  if (!db) return []
  const contagem = await lerRodadasPorLoja(db)
  if (!contagem?.size) return []

  const lj = await db
    .from('lojas')
    .select('id, slug, nome, logo_url, verificada, owner_user_id')
    .in('id', [...contagem.keys()])
    .eq('status', 'ativa')
  if (lj.error || !lj.data) {
    if (lj.error) console.error('[leiloes] lojas do leilao (lojas):', lj.error.code, lj.error.message)
    return []
  }
  const lojas = (lj.data as Array<Record<string, unknown>>)
    .filter(d => d.slug)
    .map(d => ({
      id: String(d.id),
      slug: String(d.slug),
      nome: (d.nome as string | null) ?? null,
      logoUrl: (d.logo_url as string | null) ?? null,
      verificada: d.verificada === true,
      owner: (d.owner_user_id as string | null) ?? null,
      nRodadas: contagem.get(String(d.id)) ?? 0,
    }))
    .sort((a, b) => b.nRodadas - a.nRodadas || (a.nome ?? a.slug).localeCompare(b.nome ?? b.slug, 'pt-BR'))
    .slice(0, LIMITE_LOJAS_LEILAO)

  const avaliacoes = await Promise.all(
    lojas.map(async l => {
      if (!l.owner) return [] as number[]
      const { data, error } = await db.rpc('get_avaliacoes_usuario', { p_user_id: l.owner })
      if (error || !Array.isArray(data)) return [] as number[]
      return (data as Array<{ estrelas: unknown }>).map(a => Number(a.estrelas)).filter(Number.isFinite)
    })
  )
  return lojas.map((l, i) => ({
    id: l.id, slug: l.slug, nome: l.nome, logoUrl: l.logoUrl, verificada: l.verificada,
    nRodadas: l.nRodadas, estrelas: avaliacoes[i],
  }))
}
