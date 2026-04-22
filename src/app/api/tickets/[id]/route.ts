import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

// ─── GET — detalhe de um ticket + mensagens ──────────────────────────────────

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { id } = await ctx.params
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const sb = supabaseAdmin()

    // Busca o ticket e valida que pertence ao user
    const { data: tickets, error: tErr } = await sb
      .from('tickets')
      .select('id, subject, status, priority, created_at, last_message_at, user_id')
      .eq('id', id)
      .limit(1)

    if (tErr) {
      console.error('[tickets/[id] GET]', tErr.message)
      return NextResponse.json({ error: tErr.message }, { status: 500 })
    }
    if (!tickets?.[0]) return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })
    if (tickets[0].user_id !== user.id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Busca as mensagens do ticket
    const { data: messages, error: mErr } = await sb
      .from('ticket_messages')
      .select('id, sender_type, content, created_at')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })

    if (mErr) {
      console.error('[tickets/[id] GET msgs]', mErr.message)
      return NextResponse.json({ error: mErr.message }, { status: 500 })
    }

    // Retorna sem o user_id (uso interno)
    const { user_id: _ignore, ...ticketPublic } = tickets[0]
    return NextResponse.json({ ticket: ticketPublic, messages: messages || [] })
  } catch (err: any) {
    console.error('[tickets/[id] GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}