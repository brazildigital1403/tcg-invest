import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { notifyAll, notify } from '@/lib/notify'
import { getServiceSupabase } from '@/lib/supabaseServer'

/**
 * POST /api/admin/notificacoes/broadcast
 * Dispara uma notificacao no sino.
 *   - Sem `email` no body  -> NOVIDADE para TODOS (notifyAll -> RPC broadcast).
 *   - Com `email` no body   -> AVISO para 1 usuario (resolve id pelo email).
 * Protegido por requireAdmin.
 * Body: { title, message, link?, email? }
 */
export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth

  try {
    const body = await req.json()
    const title = String(body?.title || '').trim()
    const message = String(body?.message || '').trim()
    const link = String(body?.link || '').trim()
    const email = String(body?.email || '').trim()

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

    // ── Alvo: um usuario especifico (por email) ──
    if (email) {
      const sb = getServiceSupabase()
      if (!sb) {
        return NextResponse.json({ error: 'Servico indisponivel.' }, { status: 503 })
      }
      const { data: u } = await sb.from('users').select('id').ilike('email', email).limit(1)
      if (!u?.[0]) {
        return NextResponse.json({ error: 'Nenhum usuario encontrado com esse e-mail.' }, { status: 404 })
      }
      const ok = await notify(u[0].id, 'aviso', title, message, data)
      if (!ok) {
        return NextResponse.json({ error: 'Falha ao enviar a notificacao.' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, enviados: 1 })
    }

    // ── Alvo: todos os usuarios (broadcast) ──
    const enviados = await notifyAll('novidade', title, message, data)
    if (enviados === 0) {
      return NextResponse.json({ error: 'Nada foi enviado (servico indisponivel ou sem usuarios).' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, enviados })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
