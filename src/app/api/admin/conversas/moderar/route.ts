import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabaseServer'

/** POST /api/admin/conversas/moderar  body: { msg_id, acao: 'ocultar'|'excluir' } */
export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Servico indisponivel' }, { status: 500 })

  try {
    const body = await req.json()
    const msg_id = String(body?.msg_id || '')
    const acao = String(body?.acao || '')
    const moderador = String(body?.moderador || 'admin')
    if (!msg_id || !['ocultar', 'excluir'].includes(acao)) {
      return NextResponse.json({ error: 'Parametros invalidos.' }, { status: 400 })
    }
    const { data, error } = await sb.rpc('admin_moderar_mensagem', { p_msg_id: msg_id, p_acao: acao, p_moderador: moderador })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
