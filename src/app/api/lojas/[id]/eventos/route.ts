/**
 * /api/lojas/[id]/eventos
 *
 *   GET  -> lista eventos da loja (owner ou admin; inclui rascunhos)
 *   POST -> cria evento (owner ou admin)
 *
 * Auth: autenticarOwnerOuAdmin (cookie HMAC do admin OU Bearer do dono).
 * A página pública NÃO usa este endpoint — lê direto a tabela (RLS: só publicado).
 */

import { NextRequest, NextResponse } from 'next/server'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'
import { montarEvento } from '@/lib/loja-eventos'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params
    const auth = await autenticarOwnerOuAdmin(req, lojaId, 'id, nome, owner_user_id')
    if ('error' in auth) return auth.error
    const { sb, loja } = auth

    const { data, error } = await sb
      .from('loja_eventos')
      .select('*')
      .eq('loja_id', lojaId)
      .order('data_inicio', { ascending: false })

    if (error) {
      console.error('[api/lojas/[id]/eventos GET]', error.message)
      return NextResponse.json({ error: 'Erro ao buscar eventos' }, { status: 500 })
    }

    return NextResponse.json({
      loja: { id: (loja as any).id, nome: (loja as any).nome },
      eventos: data || [],
    })
  } catch (err: any) {
    console.error('[api/lojas/[id]/eventos GET] inesperado', err?.message)
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params
    const auth = await autenticarOwnerOuAdmin(req, lojaId, 'id, owner_user_id')
    if ('error' in auth) return auth.error
    const { sb } = auth

    const body = await req.json().catch(() => ({}))
    const v = montarEvento(body, false)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

    const { data, error } = await sb
      .from('loja_eventos')
      .insert({ ...v.value, loja_id: lojaId })
      .select('*')
      .single()

    if (error) {
      console.error('[api/lojas/[id]/eventos POST]', error.message)
      return NextResponse.json({ error: 'Erro ao criar evento' }, { status: 500 })
    }

    return NextResponse.json({ evento: data }, { status: 201 })
  } catch (err: any) {
    console.error('[api/lojas/[id]/eventos POST] inesperado', err?.message)
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 })
  }
}
