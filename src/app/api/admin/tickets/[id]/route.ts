import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTicketStatusChangedEmail } from '@/lib/email'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// ─── GET — detalhe completo do ticket (com user e mensagens) ─────────────────

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const sb = supabaseAdmin()

    const { data: tickets, error: tErr } = await sb
      .from('tickets')
      .select('id, subject, status, priority, created_at, last_message_at, user_id')
      .eq('id', id)
      .limit(1)
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
    if (!tickets?.[0]) return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })

    const ticket = tickets[0]

    // Info do usuário
    const { data: users } = await sb
      .from('users')
      .select('id, email, name, full_name, city, whatsapp, is_pro, plano, trial_expires_at, created_at')
      .eq('id', ticket.user_id)
      .limit(1)
    const userInfo = users?.[0] || null

    // Mensagens
    const { data: messages } = await sb
      .from('ticket_messages')
      .select('id, sender_type, content, created_at')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      ticket: {
        ...ticket,
        user_email: userInfo?.email || null,
        user_name:  userInfo?.full_name || userInfo?.name || null,
        user_info:  userInfo,
      },
      messages: messages || [],
    })
  } catch (err: any) {
    console.error('[admin/tickets/[id] GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ─── PATCH — muda status/priority; opcionalmente notifica o user ─────────────

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const { status, priority, notify } = body

    const patch: any = { updated_at: new Date().toISOString() }
    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      patch.status = status
    }
    if (priority && ['low', 'normal', 'high'].includes(priority)) {
      patch.priority = priority
    }
    if (Object.keys(patch).length === 1) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 })
    }

    const sb = supabaseAdmin()
    const { data: updated, error } = await sb
      .from('tickets')
      .update(patch)
      .eq('id', id)
      .select('id, subject, status, user_id')
      .limit(1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!updated?.[0]) return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })

    // Notifica o user se solicitado e se mudou status
    if (notify && patch.status) {
      try {
        const { data: users } = await sb
          .from('users')
          .select('email, name, full_name')
          .eq('id', updated[0].user_id)
          .limit(1)
        const u = users?.[0]
        if (u?.email) {
          await sendTicketStatusChangedEmail({
            to:       u.email,
            userName: u.full_name || u.name,
            ticketId: id,
            subject:  updated[0].subject,
            status:   patch.status,
          })
        }
      } catch (e: any) {
        console.error('[admin/tickets/[id] PATCH] notify email failed:', e?.message)
      }
    }

    return NextResponse.json({ ticket: updated[0] })
  } catch (err: any) {
    console.error('[admin/tickets/[id] PATCH]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}