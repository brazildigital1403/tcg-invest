import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendNewTicketAdminEmail } from '@/lib/email'

// ─── Helper: auth do usuário via Bearer ──────────────────────────────────────

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

// ─── Supabase com service key (bypassa RLS quando necessário) ────────────────

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// ─── GET — lista os tickets do usuário ───────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const sb = supabaseAdmin()
    const { data, error } = await sb
      .from('tickets')
      .select('id, subject, status, priority, created_at, last_message_at')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[tickets GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ tickets: data || [] })
  } catch (err: any) {
    console.error('[tickets GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ─── POST — cria novo ticket + primeira mensagem ─────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const subject = String(body.subject || '').trim().slice(0, 200)
    const message = String(body.message || '').trim().slice(0, 10000)

    if (subject.length < 3 || message.length < 10) {
      return NextResponse.json({ error: 'Assunto e mensagem obrigatórios' }, { status: 400 })
    }

    const sb = supabaseAdmin()

    // 1. Cria o ticket
    const { data: createdTickets, error: tErr } = await sb
      .from('tickets')
      .insert({ user_id: user.id, subject })
      .select('id, subject, status, priority, created_at, last_message_at')
      .limit(1)

    if (tErr || !createdTickets?.[0]) {
      console.error('[tickets POST] ticket insert', tErr?.message)
      return NextResponse.json({ error: tErr?.message || 'Falha ao criar ticket' }, { status: 500 })
    }
    const ticket = createdTickets[0]

    // 2. Insere a primeira mensagem
    const { error: mErr } = await sb.from('ticket_messages').insert({
      ticket_id:   ticket.id,
      sender_type: 'user',
      sender_id:   user.id,
      content:     message,
    })
    if (mErr) {
      console.error('[tickets POST] message insert', mErr.message)
      return NextResponse.json({ error: mErr.message }, { status: 500 })
    }

    // 3. Notifica o admin por email (não bloqueia a resposta se falhar)
    if (process.env.ADMIN_EMAIL) {
      try {
        const { data: uData } = await sb
          .from('users')
          .select('email, name, full_name')
          .eq('id', user.id)
          .limit(1)
        const userRow = uData?.[0]
        await sendNewTicketAdminEmail({
          to:        process.env.ADMIN_EMAIL,
          ticketId:  ticket.id,
          subject:   ticket.subject,
          message,
          userEmail: userRow?.email || user.email || '(sem email)',
          userName:  userRow?.full_name || userRow?.name,
        })
      } catch (e: any) {
        console.error('[tickets POST] admin email failed:', e?.message)
      }
    }

    return NextResponse.json({ ticket })
  } catch (err: any) {
    console.error('[tickets POST]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}