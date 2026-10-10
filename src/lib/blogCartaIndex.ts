/**
 * src/lib/blogCartaIndex.ts
 *
 * Indice leve dos posts publicados do blog, para a pagina da carta linkar o
 * post certo sem fazer consulta por carta (Fase 2 do #490, 09/10/2026).
 *
 * UM `unstable_cache` global de 1h com {slug, titulo, resumo, tags, cartas
 * citadas} de todos os publicados (hoje 3; cresce com o blog). O casamento e
 * em memoria, no render da carta: (a) a carta e citada num bloco `product`
 * do post, ou (b) uma tag do post bate com o nome do Pokemon ou com o nome do
 * set (EN ou PT). Fecha o ciclo: o blog ja linkava carta, a carta nao linkava
 * blog.
 *
 * Regra da casa: dentro do cache falha LANCA. Vazio virava entrada valida por
 * uma hora; quem converte em "sem posts" e o chamador, fora do cache.
 */

import { unstable_cache } from 'next/cache'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { normalizarNome } from '@/lib/pokedexTextos'

export type PostDaCarta = { slug: string; titulo: string; resumo: string | null }

type PostIndexado = PostDaCarta & { tags: string[]; cardIds: string[]; cardSlugs: string[] }

const indiceDoBlog = unstable_cache(
  async (): Promise<PostIndexado[]> => {
    const sb = getServiceSupabase()
    if (!sb) throw new Error('[blog-cartas] sem cliente Supabase')
    const { data, error } = await sb
      .from('blog_posts')
      .select('slug, title, excerpt, tags, content')
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(200)
    if (error) throw new Error(`[blog-cartas] ${error.message}`)
    return (data || []).map(p => {
      const blocos = Array.isArray(p.content) ? (p.content as Array<Record<string, unknown>>) : []
      const cardIds: string[] = []
      const cardSlugs: string[] = []
      for (const b of blocos) {
        if (b?.type !== 'product') continue
        if (typeof b.cardId === 'string' && b.cardId) cardIds.push(b.cardId)
        if (typeof b.cardSlug === 'string' && b.cardSlug) cardSlugs.push(b.cardSlug)
      }
      return {
        slug: p.slug as string,
        titulo: p.title as string,
        resumo: (p.excerpt as string | null) ?? null,
        tags: Array.isArray(p.tags) ? (p.tags as string[]).map(normalizarNome) : [],
        cardIds,
        cardSlugs,
      }
    })
  },
  ['blog-cards-index-v1'],
  { revalidate: 3600 },
)

export async function postsParaCarta(alvo: {
  cardId: string
  cardSlug: string | null
  pokemonName: string | null
  setNames: Array<string | null>
  max?: number
}): Promise<PostDaCarta[]> {
  let posts: PostIndexado[]
  try {
    posts = await indiceDoBlog()
  } catch (err) {
    // Fora do cache, falha vira "sem posts" -- a pagina da carta nao cai por
    // causa do blog.
    console.error('[blog-cartas]', (err as Error)?.message)
    return []
  }
  const max = alvo.max ?? 2
  const chaves = new Set(
    [alvo.pokemonName, ...alvo.setNames].filter((s): s is string => !!s).map(normalizarNome),
  )
  const citados: PostDaCarta[] = []
  const porTag: PostDaCarta[] = []
  for (const p of posts) {
    const cita = p.cardIds.includes(alvo.cardId) || (!!alvo.cardSlug && p.cardSlugs.includes(alvo.cardSlug))
    if (cita) {
      citados.push({ slug: p.slug, titulo: p.titulo, resumo: p.resumo })
      continue
    }
    if (chaves.size && p.tags.some(t => chaves.has(t))) porTag.push({ slug: p.slug, titulo: p.titulo, resumo: p.resumo })
  }
  return [...citados, ...porTag].slice(0, max)
}
