import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabaseServer'

/** GET /api/admin/conversas/[id]  -> thread completa (com original das ocultadas). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Servico indisponivel' }, { status: 500 })

  const { id } = await params
  const { data, error } = await sb.rpc('admin_ver_conversa', { p_anuncio_id: id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ mensagens: data || [] })
}
