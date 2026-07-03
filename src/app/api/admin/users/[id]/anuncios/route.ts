import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// GET /api/admin/users/[id]/anuncios
// Lista todos os anúncios postados pelo usuário (ativos, vendidos, removidos).
// Inclui flags `is_removido` e `is_vendido` pra facilitar render no admin.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const sb = supabaseAdmin()

    const { data: anuncios, error } = await sb
      .from('marketplace')
      .select('id, card_id, card_name, card_image, card_link, price, status, variante, condicao, descricao, created_at, removido_em, removido_motivo, buyer_id')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('[admin/users/[id]/anuncios GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const enriched = (anuncios || []).map(a => ({
      ...a,
      is_removido: !!a.removido_em,
      is_vendido: a.status === 'concluido',
    }))

    return NextResponse.json({
      anuncios: enriched,
      total: enriched.length,
      ativos:   enriched.filter(a => !a.removido_em && a.status === 'disponivel').length,
      vendidos: enriched.filter(a => a.status === 'concluido').length,
      removidos: enriched.filter(a => !!a.removido_em).length,
    })
  } catch (err: any) {
    console.error('[admin/users/[id]/anuncios GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
