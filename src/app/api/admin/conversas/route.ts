import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabaseServer'

/** GET /api/admin/conversas?q=  -> lista todas as conversas (moderacao). */
export async function GET(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Servico indisponivel' }, { status: 500 })

  const q = req.nextUrl.searchParams.get('q')?.trim() || null
  const { data, error } = await sb.rpc('admin_listar_conversas', { p_q: q })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ conversas: data || [] })
}
