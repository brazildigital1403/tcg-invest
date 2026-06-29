import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { notifyAll } from '@/lib/notify'

/**
 * POST /api/admin/notificacoes/broadcast
 * Dispara uma notificacao de NOVIDADE para TODOS os usuarios (fan-out via
 * notifyAll -> RPC broadcast_notification). Protegido por requireAdmin.
 * Body: { title, message, link? }
 */
export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth

  try {
    const body = await req.json()
    const title = String(body?.title || '').trim()
    const message = String(body?.message || '').trim()
    const link = String(body?.link || '').trim()

    if (!title || !message) {
      return NextResponse.json({ error: 'Titulo e mensagem sao obrigatorios.' }, { status: 400 })
    }
    if (title.length > 120) {
      return NextResponse.json({ error: 'Titulo muito longo (maximo 120 caracteres).' }, { status: 400 })
    }
    if (message.length > 500) {
      return NextResponse.json({ error: 'Mensagem muito longa (maximo 500 caracteres).' }, { status: 400 })
    }

    const data = link ? { link } : {}
    const enviados = await notifyAll('novidade', title, message, data)

    if (enviados === 0) {
      return NextResponse.json({ error: 'Nada foi enviado (servico indisponivel ou sem usuarios).' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, enviados })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
