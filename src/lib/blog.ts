import { cache } from 'react'
import { getServiceSupabase } from '@/lib/supabaseServer'
import type { BlogBlock } from '@/lib/blogBlocks'

export type BlogCategory = {
  id: string
  slug: string
  name: string
  description: string | null
}

export type BlogPost = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  cover_image_url: string | null
  content: BlogBlock[]
  category_id: string | null
  tags: string[]
  status: 'draft' | 'published'
  published_at: string | null
  seo_title: string | null
  seo_description: string | null
  created_at: string
  updated_at: string
  reading_minutes: number | null
  category?: BlogCategory | null
}

const POST_COLUMNS =
  'id, slug, title, excerpt, cover_image_url, content, category_id, tags, status, published_at, seo_title, seo_description, created_at, updated_at, reading_minutes, category:blog_categories(id, slug, name, description)'

/**
 * Busca um post publicado pelo slug. `cache()` memoiza por request — assim
 * generateMetadata e o corpo da pagina reaproveitam a mesma consulta (mesmo
 * padrao de fetchHub em pokemon/[name]/page.tsx).
 */
export const fetchPublishedPost = cache(async (slug: string): Promise<BlogPost | null> => {
  const sb = getServiceSupabase()
  if (!sb) return null

  const { data, error } = await sb
    .from('blog_posts')
    .select(POST_COLUMNS)
    .eq('slug', slug)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .maybeSingle()

  if (error) {
    console.error('[blog] erro ao buscar post:', error)
    return null
  }
  return (data as unknown as BlogPost) || null
})

export type BlogListItem = Pick<
  BlogPost,
  'id' | 'slug' | 'title' | 'excerpt' | 'cover_image_url' | 'published_at' | 'tags' | 'reading_minutes' | 'category'
>

const LIST_COLUMNS =
  'id, slug, title, excerpt, cover_image_url, published_at, tags, reading_minutes, category:blog_categories(id, slug, name, description)'

const PAGE_SIZE = 12

export async function fetchPublishedPostsList(opts: {
  categorySlug?: string
  page?: number
}): Promise<{ posts: BlogListItem[]; total: number; page: number; totalPages: number }> {
  const sb = getServiceSupabase()
  if (!sb) return { posts: [], total: 0, page: 1, totalPages: 1 }

  const page = Math.max(1, opts.page || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = sb
    .from('blog_posts')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .range(from, to)

  if (opts.categorySlug) {
    const { data: cat } = await sb.from('blog_categories').select('id').eq('slug', opts.categorySlug).maybeSingle()
    if (!cat) return { posts: [], total: 0, page, totalPages: 1 }
    query = query.eq('category_id', cat.id)
  }

  const { data, error, count } = await query
  if (error) {
    console.error('[blog] erro ao listar posts:', error)
    return { posts: [], total: 0, page, totalPages: 1 }
  }

  const total = count || 0
  return {
    posts: (data as unknown as BlogListItem[]) || [],
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}

export const fetchCategories = cache(async (): Promise<BlogCategory[]> => {
  const sb = getServiceSupabase()
  if (!sb) return []
  const { data, error } = await sb.from('blog_categories').select('id, slug, name, description').order('name')
  if (error) {
    console.error('[blog] erro ao buscar categorias:', error)
    return []
  }
  return data || []
})

// Resumo minimo de uma carta pra renderizar o bloco "produto/carta" (CardItem).
// Busca por slug OU id — o que o editor guardou no bloco.
export type BlogCardSummary = {
  id: string
  slug: string | null
  name: string
  image_small: string | null
  image_large: string | null
  set_name: string | null
  number: string | null
  rarity: string | null
  preco_medio: number | null
}

const CARD_SUMMARY_COLUMNS = 'id, slug, name, image_small, image_large, set_name, number, rarity, preco_medio'

export const fetchCardSummary = cache(async (idOrSlug: string): Promise<BlogCardSummary | null> => {
  const sb = getServiceSupabase()
  if (!sb || !idOrSlug) return null

  // Duas consultas separadas (nao .or() interpolado) — o valor vem do jsonb do
  // post, e interpolar direto no filtro do PostgREST abriria pra injecao de
  // filtro (mesmo risco ja documentado em /api/admin/lojas).
  const bySlug = await sb.from('pokemon_cards').select(CARD_SUMMARY_COLUMNS).eq('slug', idOrSlug).maybeSingle()
  if (bySlug.data) return bySlug.data as BlogCardSummary
  const byId = await sb.from('pokemon_cards').select(CARD_SUMMARY_COLUMNS).eq('id', idOrSlug).maybeSingle()
  if (byId.error) {
    console.error('[blog] erro ao buscar carta do bloco produto:', byId.error)
    return null
  }
  return (byId.data as BlogCardSummary) || null
})

// Ultimos posts publicados (pra RSS e "relacionados") — sem paginacao.
export async function fetchLatestPublishedPosts(limit = 20): Promise<BlogPost[]> {
  const sb = getServiceSupabase()
  if (!sb) return []
  const { data, error } = await sb
    .from('blog_posts')
    .select(POST_COLUMNS)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[blog] erro ao buscar ultimos posts:', error)
    return []
  }
  return (data as unknown as BlogPost[]) || []
}
