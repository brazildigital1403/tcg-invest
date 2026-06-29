import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { notify } from '@/lib/notify'

/** POST /api/admin/conversas/aviso  body: { user_id, mensagem }  -> aviso no sino. */
export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  try {
    const body = await req.json()
    const user_id = String(body?.user_id || '')
    const mensagem = String(body?.mensagem || '').trim()
    if (!user_id || !mensagem) {
      return NextResponse.json({ error: 'Usuario e mensagem sao obrigatorios.' }, { status: 400 })
    }
    if (mensagem.length > 500) {
      return NextResponse.json({ error: 'Mensagem muito longa (maximo 500).' }, { status: 400 })
    }
    const ok = await notify(user_id, 'aviso', 'Aviso da moderacao', mensagem, { origem: 'moderacao' })
    if (!ok) return NextResponse.json({ error: 'Nao foi possivel enviar o aviso.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
