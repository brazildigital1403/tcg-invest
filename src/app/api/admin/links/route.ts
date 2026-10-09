// src/app/api/admin/links/route.ts
//
// Admin: links curtos (links_curtos). bynx.gg/<slug> -> destino com UTM.
//
// GET   -> todos (dezenas de linhas; a tela filtra em memoria).
// POST  -> cria { slug, destino, descricao? }. Slug reservado ou repetido recusa.
// PATCH -> edita { slug, destino?, descricao?, ativo? }. Sem excluir na v1:
//          desligar (`ativo`) preserva o contador e nao quebra link impresso.
//
// Escrita so com service key. A validacao e a de src/lib/linksCurtos.ts, a
// mesma que a tela repete antes de enviar.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { validarDestino, validarSlug } from '@/lib/linksCurtos'

export const dynamic = 'force-dynamic'

const COLUNAS = 'slug, destino, descricao, ativo, cliques, criado_em, atualizado_em'

function db() {
  const sb = getServiceSupabase()
  if (!sb) throw new Error('service key ausente')
  return sb
}

export async function GET(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  try {
    const { data, error } = await db().from('links_curtos').select(COLUNAS).order('criado_em', { ascending: false })
    if (error) throw new Error(error.message)
    return NextResponse.json({ links: data || [] })
  } catch (err) {
    console.error('[admin/links] erro listando:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro ao listar links' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  try {
    const body = await req.json().catch(() => ({}))
    const s = validarSlug(body.slug)
    if (!s.ok) return NextResponse.json({ error: s.erro }, { status: 400 })
    const d = validarDestino(body.destino)
    if (!d.ok) return NextResponse.json({ error: d.erro }, { status: 400 })
    const descricao = typeof body.descricao === 'string' && body.descricao.trim() ? body.descricao.trim().slice(0, 200) : null

    const { data, error } = await db()
      .from('links_curtos')
      .insert({ slug: s.slug, destino: d.destino, descricao, ativo: body.ativo !== false })
      .select(COLUNAS)
      .single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: `bynx.gg/${s.slug} já existe.` }, { status: 409 })
      throw new Error(error.message)
    }
    return NextResponse.json({ ok: true, link: data })
  } catch (err) {
    console.error('[admin/links] erro criando:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro ao salvar o link' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  try {
    const body = await req.json().catch(() => ({}))
    const slug = String(body.slug ?? '').trim().toLowerCase()
    if (!slug) return NextResponse.json({ error: 'Slug obrigatório.' }, { status: 400 })

    const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() }
    if (body.destino !== undefined) {
      const d = validarDestino(body.destino)
      if (!d.ok) return NextResponse.json({ error: d.erro }, { status: 400 })
      patch.destino = d.destino
    }
    if (body.descricao !== undefined) {
      patch.descricao = typeof body.descricao === 'string' && body.descricao.trim() ? body.descricao.trim().slice(0, 200) : null
    }
    if (body.ativo !== undefined) patch.ativo = !!body.ativo

    const { data, error } = await db().from('links_curtos').update(patch).eq('slug', slug).select(COLUNAS).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: 'Link não encontrado.' }, { status: 404 })
    return NextResponse.json({ ok: true, link: data })
  } catch (err) {
    console.error('[admin/links] erro editando:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro ao salvar o link' }, { status: 500 })
  }
}
