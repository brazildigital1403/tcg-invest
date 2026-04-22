import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendAdminReplyUserEmail } from '@/lib/email'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// POST — admin responde e opcionalmente atualiza status simultaneamente

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const message   = String(body.message || '').trim().slice(0, 10000)
    const newStatus = body.newStatus

    if (message.length < 3) return NextResponse.json({ error: 'Mensagem muito curta' }, { status: 400 })

    const sb = supabaseAdmin()

    // Confirma que ticket existe
    const { data: tickets } = await sb
      .from('tickets')
      .select('id, subject, user_id, status')
      .eq('id', id)
      .limit(1)

    if (!tickets?.[0]) return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })
    const ticket = tickets[0]

    // Insere a mensagem (sender_type admin, sem sender_id)
    const { error: mErr } = await sb.from('ticket_messages').insert({
      ticket_id:   id,
      sender_type: 'admin',
      sender_id:   null,
      content:     message,
    })
    if (mErr) {
      console.error('[admin/tickets/reply POST]', mErr.message)
      return NextResponse.json({ error: mErr.message }, { status: 500 })
    }

    // Atualiza status se pedido (o trigger não reabre por mensagem do admin)
    if (newStatus && ['open', 'in_progress', 'resolved', 'closed'].includes(newStatus)) {
      await sb
        .from('tickets')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id)
    }

    // Manda email pro user
    try {
      const { data: users } = await sb
        .from('users')
        .select('email, name, full_name')
        .eq('id', ticket.user_id)
        .limit(1)
      const u = users?.[0]
      if (u?.email) {
        await sendAdminReplyUserEmail({
          to:       u.email,
          userName: u.full_name || u.name,
          ticketId: id,
          subject:  ticket.subject,
          message,
        })
      }
    } catch (e: any) {
      console.error('[admin/tickets/reply POST] user email failed:', e?.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[admin/tickets/reply POST]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}