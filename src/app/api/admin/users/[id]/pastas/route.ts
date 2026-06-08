import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// GET /api/admin/users/[id]/pastas
// Retorna as pastas do usuário com qtd de cartas e patrimonio calculados.
// Usa o RPC admin_user_pastas (mesma valoracao do minhas_pastas, parametrizado por user_id).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const sb = supabaseAdmin()

    const { data, error } = await sb.rpc('admin_user_pastas', { p_user_id: id })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const pastas = (data || []) as Array<{ qtd_cartas: number; patrimonio: number }>
    const total_cards = pastas.reduce((s, p) => s + (Number(p.qtd_cartas) || 0), 0)
    const total_value = pastas.reduce((s, p) => s + (Number(p.patrimonio) || 0), 0)

    return NextResponse.json({
      pastas,
      total: pastas.length,
      total_cards,
      total_value,
    })
  } catch (err: any) {
    console.error('[admin/users/[id]/pastas GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
