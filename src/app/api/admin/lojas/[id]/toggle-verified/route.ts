import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// POST /api/admin/lojas/[id]/toggle-verified
// Alterna flag `verificada`. Não envia email (mudança silenciosa).

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const sb = supabaseAdmin()

    // Busca valor atual
    const { data: lojas } = await sb
      .from('lojas')
      .select('id, verificada')
      .eq('id', id)
      .limit(1)
    if (!lojas?.[0]) return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })

    const novoValor = !lojas[0].verificada

    const { data: updated, error } = await sb
      .from('lojas')
      .update({
        verificada: novoValor,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .limit(1)

    if (error) {
      console.error('[admin/lojas/[id]/toggle-verified]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ loja: updated?.[0], verificada: novoValor })
  } catch (err: any) {
    console.error('[admin/lojas/[id]/toggle-verified POST]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
