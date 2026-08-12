import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { validateBlocks, estimateReadingMinutes, BlogBlockValidationError } from '@/lib/blogBlocks'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// GET /api/admin/blog/posts/[id] — hidrata a tela de edicao
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const sb = supabaseAdmin()
    const { data, error } = await sb.from('blog_posts').select('*').eq('id', id).maybeSingle()
    if (error) {
      console.error('[admin/blog/posts/[id] GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'Post nao encontrado' }, { status: 404 })

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[admin/blog/posts/[id] GET] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PATCH /api/admin/blog/posts/[id] — edita campos (parcial) e/ou muda status
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body invalido' }, { status: 400 })
    }

    const sb = supabaseAdmin()
    const update: Record<string, unknown> = {}

    if (typeof body.title === 'string') {
      if (!body.title.trim()) return NextResponse.json({ error: 'Titulo nao pode ficar vazio' }, { status: 400 })
      update.title = body.title.trim()
    }
    if (typeof body.slug === 'string' && body.slug.trim()) update.slug = body.slug.trim()
    if (typeof body.excerpt === 'string') update.excerpt = body.excerpt.trim() || null
    if (typeof body.cover_image_url === 'string') update.cover_image_url = body.cover_image_url || null
    if (body.category_id === null || typeof body.category_id === 'string') update.category_id = body.category_id || null
    if (Array.isArray(body.tags)) update.tags = body.tags.filter((t: unknown) => typeof t === 'string').slice(0, 20)
    if (typeof body.seo_title === 'string') update.seo_title = body.seo_title.trim() || null
    if (typeof body.seo_description === 'string') update.seo_description = body.seo_description.trim() || null

    if (body.content !== undefined) {
      try {
        const blocks = validateBlocks(body.content)
        update.content = blocks
        update.reading_minutes = estimateReadingMinutes(blocks)
      } catch (e) {
        if (e instanceof BlogBlockValidationError) return NextResponse.json({ error: e.message }, { status: 400 })
        throw e
      }
    }

    // Le o slug/published_at atuais uma vez so: usado pro carimbo de
    // published_at (so na 1a vez que publica) e pra saber o path antigo a
    // revalidar (post pode estar trocando de slug na mesma edicao).
    const { data: before } = await sb.from('blog_posts').select('slug, published_at').eq('id', id).maybeSingle()

    if (typeof body.status === 'string') {
      if (!['draft', 'published'].includes(body.status)) {
        return NextResponse.json({ error: 'Status invalido' }, { status: 400 })
      }
      update.status = body.status
      if (body.status === 'published' && !before?.published_at) {
        // So carimba published_at na PRIMEIRA vez que vira published — edicoes
        // seguintes nao devem "reagendar" o post pra agora.
        update.published_at = new Date().toISOString()
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
    }
    update.updated_at = new Date().toISOString()

    const { data, error } = await sb.from('blog_posts').update(update).eq('id', id).select('id, slug, status').single()
    if (error) {
      console.error('[admin/blog/posts/[id] PATCH]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fura o ISR na hora — sem isso, edicao/publicacao/despublicacao so
    // aparece pro leitor quando o cache de 1h expirar sozinho (achado real:
    // "despublicar" atualizava o banco mas o post pesado continuava no ar).
    if (before?.slug) revalidatePath(`/blog/${before.slug}`)
    if (data.slug && data.slug !== before?.slug) revalidatePath(`/blog/${data.slug}`)
    revalidatePath('/blog')
    revalidatePath('/blog/rss.xml')

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[admin/blog/posts/[id] PATCH] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE /api/admin/blog/posts/[id]
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const sb = supabaseAdmin()
    const { data: before } = await sb.from('blog_posts').select('slug').eq('id', id).maybeSingle()

    const { error } = await sb.from('blog_posts').delete().eq('id', id)
    if (error) {
      console.error('[admin/blog/posts/[id] DELETE]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (before?.slug) revalidatePath(`/blog/${before.slug}`)
    revalidatePath('/blog')
    revalidatePath('/blog/rss.xml')

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[admin/blog/posts/[id] DELETE] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
