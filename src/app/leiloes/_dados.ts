import { cache } from 'react'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { lotePublicoDeLinha, type LotePublico } from '@/lib/leilao'

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
    q = q.in('status', ['agendado', 'ativo']).order('termina_em', { ascending: true, nullsFirst: false })
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
export const buscarReferenciaMercadoCents = cache(
  async (cardId: string | null, graduadora: string | null): Promise<number | null> => {
    if (!cardId || graduadora) return null
    const db = getServiceSupabase()
    if (!db) return null
    const { data, error } = await db.from('pokemon_cards').select('preco_min').eq('id', cardId).maybeSingle()
    if (error || !data) return null
    const v = Number((data as { preco_min?: unknown }).preco_min)
    return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null
  }
)
