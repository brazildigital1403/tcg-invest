import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

function slugify(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export async function GET(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const sb = supabaseAdmin()
    const { data, error } = await sb
      .from('blog_categories')
      .select('id, slug, name, description, created_at')
      .order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ categorias: data || [] })
  } catch (err: any) {
    console.error('[admin/blog/categorias GET] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const body = await req.json().catch(() => null)
    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Nome obrigatorio' }, { status: 400 })
    }

    const sb = supabaseAdmin()
    const slug = typeof body.slug === 'string' && body.slug.trim() ? slugify(body.slug) : slugify(body.name)
    if (!slug) return NextResponse.json({ error: 'Slug invalido' }, { status: 400 })

    const { data, error } = await sb
      .from('blog_categories')
      .insert({
        slug,
        name: body.name.trim(),
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
      })
      .select('id, slug, name, description')
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Ja existe uma categoria com esse slug' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    console.error('[admin/blog/categorias POST] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
