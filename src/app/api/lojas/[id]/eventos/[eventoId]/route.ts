/**
 * /api/lojas/[id]/eventos/[eventoId]
 *
 *   PATCH  -> edita evento (owner ou admin)
 *   DELETE -> remove evento (owner ou admin)
 *
 * Auth: autenticarOwnerOuAdmin. O guard `.eq('loja_id', lojaId)` garante que
 * o evento pertence à loja indicada (não dá pra editar evento de outra loja).
 */

import { NextRequest, NextResponse } from 'next/server'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'
import { montarEvento } from '@/lib/loja-eventos'

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; eventoId: string }> }
) {
  try {
    const { id: lojaId, eventoId } = await ctx.params
    const auth = await autenticarOwnerOuAdmin(req, lojaId, 'id, owner_user_id')
    if ('error' in auth) return auth.error
    const { sb } = auth

    const body = await req.json().catch(() => ({}))
    const v = montarEvento(body, true)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

    const { data, error } = await sb
      .from('loja_eventos')
      .update(v.value)
      .eq('id', eventoId)
      .eq('loja_id', lojaId)
      .select('*')
      .maybeSingle()

    if (error) {
      console.error('[api/lojas/[id]/eventos/[eventoId] PATCH]', error.message)
      return NextResponse.json({ error: 'Erro ao atualizar evento' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })

    return NextResponse.json({ evento: data })
  } catch (err: any) {
    console.error('[api/lojas/[id]/eventos/[eventoId] PATCH] inesperado', err?.message)
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; eventoId: string }> }
) {
  try {
    const { id: lojaId, eventoId } = await ctx.params
    const auth = await autenticarOwnerOuAdmin(req, lojaId, 'id, owner_user_id')
    if ('error' in auth) return auth.error
    const { sb } = auth

    const { error, count } = await sb
      .from('loja_eventos')
      .delete({ count: 'exact' })
      .eq('id', eventoId)
      .eq('loja_id', lojaId)

    if (error) {
      console.error('[api/lojas/[id]/eventos/[eventoId] DELETE]', error.message)
      return NextResponse.json({ error: 'Erro ao remover evento' }, { status: 500 })
    }
    if (!count) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[api/lojas/[id]/eventos/[eventoId] DELETE] inesperado', err?.message)
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 })
  }
}
