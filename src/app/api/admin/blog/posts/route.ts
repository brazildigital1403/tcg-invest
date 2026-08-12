import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { validateBlocks, estimateReadingMinutes, BlogBlockValidationError } from '@/lib/blogBlocks'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

function slugify(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// GET /api/admin/blog/posts?status=draft|published&q=&categoryId=&page=1
export async function GET(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { searchParams } = new URL(req.url)
    const status     = searchParams.get('status')
    const q          = searchParams.get('q')?.trim()
    const categoryId = searchParams.get('categoryId')
    const page       = Math.max(1, Number(searchParams.get('page') || 1))
    const perPage    = 30

    const sb = supabaseAdmin()
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    let query = sb
      .from('blog_posts')
      .select('id, slug, title, status, published_at, cover_image_url, category_id, updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(from, to)

    if (status && ['draft', 'published'].includes(status)) query = query.eq('status', status)
    if (categoryId) query = query.eq('category_id', categoryId)
    if (q) {
      const safeQ = q.replace(/[^a-zA-Z0-9 \-.À-ſ]/g, '').trim().slice(0, 100)
      if (safeQ) query = query.ilike('title', `%${safeQ}%`)
    }

    const { data, error, count } = await query
    if (error) {
      console.error('[admin/blog/posts GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const [{ count: draftCount }, { count: publishedCount }] = await Promise.all([
      sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
      sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    ])

    return NextResponse.json({
      posts: data || [],
      total: count || 0,
      page,
      totalPages: Math.max(1, Math.ceil((count || 0) / perPage)),
      counts: { draft: draftCount || 0, published: publishedCount || 0 },
    })
  } catch (err: any) {
    console.error('[admin/blog/posts GET] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST /api/admin/blog/posts — cria post novo (rascunho por padrao; body.status='published' publica direto)
export async function POST(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const body = await req.json().catch(() => null)
    if (!body || typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'Titulo obrigatorio' }, { status: 400 })
    }

    let blocks
    try {
      blocks = validateBlocks(body.content ?? [])
    } catch (e) {
      if (e instanceof BlogBlockValidationError) return NextResponse.json({ error: e.message }, { status: 400 })
      throw e
    }

    const sb = supabaseAdmin()
    const baseSlug = typeof body.slug === 'string' && body.slug.trim() ? slugify(body.slug) : slugify(body.title)
    if (!baseSlug) return NextResponse.json({ error: 'Slug invalido' }, { status: 400 })

    // Garante slug unico (sufixo -2, -3... se colidir)
    let slug = baseSlug
    for (let i = 2; i <= 50; i++) {
      const { data: exists } = await sb.from('blog_posts').select('id').eq('slug', slug).maybeSingle()
      if (!exists) break
      slug = `${baseSlug}-${i}`
    }

    const status: 'draft' | 'published' = body.status === 'published' ? 'published' : 'draft'

    const payload = {
      slug,
      title: body.title.trim(),
      excerpt: typeof body.excerpt === 'string' ? body.excerpt.trim() : null,
      cover_image_url: typeof body.cover_image_url === 'string' ? body.cover_image_url : null,
      content: blocks,
      category_id: typeof body.category_id === 'string' && body.category_id ? body.category_id : null,
      tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === 'string').slice(0, 20) : [],
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
      seo_title: typeof body.seo_title === 'string' ? body.seo_title.trim() || null : null,
      seo_description: typeof body.seo_description === 'string' ? body.seo_description.trim() || null : null,
      reading_minutes: estimateReadingMinutes(blocks),
    }

    const { data, error } = await sb.from('blog_posts').insert(payload).select('id, slug').single()
    if (error) {
      console.error('[admin/blog/posts POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    console.error('[admin/blog/posts POST] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
