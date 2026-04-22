import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendUserReplyAdminEmail } from '@/lib/email'

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await sb.auth.getUser(token)
  return user
}

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// ─── POST — usuário responde em um ticket ────────────────────────────────────

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { id } = await ctx.params
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const message = String(body.message || '').trim().slice(0, 10000)
    if (message.length < 3) return NextResponse.json({ error: 'Mensagem muito curta' }, { status: 400 })

    const sb = supabaseAdmin()

    // Confirma que o ticket existe E pertence ao user
    const { data: tickets } = await sb
      .from('tickets')
      .select('id, subject, user_id, status')
      .eq('id', id)
      .limit(1)

    if (!tickets?.[0]) return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })
    if (tickets[0].user_id !== user.id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }
    if (tickets[0].status === 'closed') {
      return NextResponse.json({ error: 'Este ticket está fechado' }, { status: 400 })
    }

    // Insere a resposta — o trigger no banco atualiza last_message_at e reabre se estava resolved
    const { error: mErr } = await sb.from('ticket_messages').insert({
      ticket_id:   id,
      sender_type: 'user',
      sender_id:   user.id,
      content:     message,
    })
    if (mErr) {
      console.error('[tickets/reply POST]', mErr.message)
      return NextResponse.json({ error: mErr.message }, { status: 500 })
    }

    // Notifica o admin (não bloqueia)
    if (process.env.ADMIN_EMAIL) {
      try {
        const { data: uData } = await sb
          .from('users')
          .select('email, name, full_name')
          .eq('id', user.id)
          .limit(1)
        const userRow = uData?.[0]
        await sendUserReplyAdminEmail({
          to:        process.env.ADMIN_EMAIL,
          ticketId:  id,
          subject:   tickets[0].subject,
          message,
          userEmail: userRow?.email || user.email || '(sem email)',
          userName:  userRow?.full_name || userRow?.name,
        })
      } catch (e: any) {
        console.error('[tickets/reply POST] admin email failed:', e?.message)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[tickets/reply POST]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}