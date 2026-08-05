import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { sendAdminNovaConversaEmail } from '@/lib/email'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// Lista todos os tickets com dados do usuário (nome/email)
// Filtros via query string: ?status=open|in_progress|resolved|closed  &q=busca

export async function GET(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const q      = searchParams.get('q')?.trim()

    const sb = supabaseAdmin()
    let query = sb
      .from('tickets')
      .select('id, subject, status, priority, created_at, last_message_at, user_id')
      .order('last_message_at', { ascending: false })
      .limit(200)

    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      query = query.eq('status', status)
    }
    if (q) {
      query = query.ilike('subject', `%${q}%`)
    }

    const { data: tickets, error } = await query
    if (error) {
      console.error('[admin/tickets GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Hidrata com email/nome do usuário (1 query batch)
    const userIds = [...new Set((tickets || []).map(t => t.user_id))]
    const userMap: Record<string, { email: string; name: string }> = {}
    if (userIds.length > 0) {
      const { data: users } = await sb
        .from('users')
        .select('id, email, name')
        .in('id', userIds)
      for (const u of users || []) {
        userMap[u.id] = { email: u.email, name: u.name || '' }
      }
    }

    // Hidrata com quem mandou a ULTIMA mensagem de cada ticket -- e o sinal
    // que decide de quem e a vez de responder (redesign 05/08/2026). Sem
    // isso a lista nao distingue um ticket esperando o ADMIN responder de
    // um esperando o USUARIO (ex.: pedido de verificacao de loja) -- os dois
    // ficavam com o mesmo status "Aberto".
    // Query global ordenada por created_at desc: a primeira ocorrencia de
    // cada ticket_id na iteracao e sempre a mensagem mais recente dele.
    const ticketIds = (tickets || []).map(t => t.id)
    const lastSenderMap: Record<string, string> = {}
    if (ticketIds.length > 0) {
      const { data: msgs } = await sb
        .from('ticket_messages')
        .select('ticket_id, sender_type, created_at')
        .in('ticket_id', ticketIds)
        .order('created_at', { ascending: false })
        .limit(2000)
      for (const m of msgs || []) {
        if (!lastSenderMap[m.ticket_id]) lastSenderMap[m.ticket_id] = m.sender_type
      }
    }

    const enriched = (tickets || []).map(t => ({
      ...t,
      user_email: userMap[t.user_id]?.email || null,
      user_name:  userMap[t.user_id]?.name  || null,
      last_sender: lastSenderMap[t.id] || null,
    }))

    return NextResponse.json({ tickets: enriched })
  } catch (err: any) {
    console.error('[admin/tickets GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ─── POST — a EQUIPE abre uma conversa com um usuario ────────────────────────
//
// Por que reusar ticket em vez de criar um "enviar email" separado: o ticket
// ja tem thread, e-mail de ida, tela em /suporte/[id] pro usuario responder, e
// a resposta dele volta pro painel de admin. Um disparo avulso de e-mail
// mandaria a resposta pra uma caixa que ninguem le, e a conversa nao ficaria
// registrada na conta da pessoa.
//
// Caso que motivou: pedir documento/informacao pro dono de uma loja antes de
// aprova-la. Nao havia canal nenhum pra isso.
//
// Body: { userId?, email?, subject, message }  — um dos dois identificadores.

export async function POST(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const body = await req.json().catch(() => ({}))
    const subject = String(body.subject || '').trim().slice(0, 200)
    const message = String(body.message || '').trim().slice(0, 10000)
    const userId  = String(body.userId || '').trim()
    const email   = String(body.email || '').trim().toLowerCase()

    if (subject.length < 3)  return NextResponse.json({ error: 'Assunto muito curto' }, { status: 400 })
    if (message.length < 10) return NextResponse.json({ error: 'Mensagem muito curta' }, { status: 400 })
    if (!userId && !email)   return NextResponse.json({ error: 'Informe o usuario (id ou e-mail)' }, { status: 400 })

    const sb = supabaseAdmin()

    // Resolve o destinatario. E-mail e o caminho pratico: a tela de lojas ja
    // tem o e-mail do dono na mao, e o id nao.
    const q = sb.from('users').select('id, email, name').limit(1)
    const { data: users, error: uErr } = userId
      ? await q.eq('id', userId)
      : await q.ilike('email', email)

    if (uErr) {
      console.error('[admin/tickets POST] lookup', uErr.message)
      return NextResponse.json({ error: 'Falha ao buscar usuario' }, { status: 500 })
    }
    const destinatario = users?.[0]
    if (!destinatario) {
      return NextResponse.json({ error: 'Usuario nao encontrado com esse e-mail/id' }, { status: 404 })
    }

    // 1. Cria o ticket EM NOME do usuario (user_id = destinatario), pra ele
    //    enxergar a conversa em /suporte como qualquer outra.
    const { data: criados, error: tErr } = await sb
      .from('tickets')
      .insert({ user_id: destinatario.id, subject })
      .select('id, subject')
      .limit(1)

    if (tErr || !criados?.[0]) {
      console.error('[admin/tickets POST] insert ticket', tErr?.message)
      return NextResponse.json({ error: tErr?.message || 'Falha ao criar conversa' }, { status: 500 })
    }
    const ticket = criados[0]

    // 2. Primeira mensagem, do lado ADMIN (mesmo padrao do reply)
    const { error: mErr } = await sb.from('ticket_messages').insert({
      ticket_id:   ticket.id,
      sender_type: 'admin',
      sender_id:   null,
      content:     message,
    })
    if (mErr) {
      console.error('[admin/tickets POST] insert message', mErr.message)
      return NextResponse.json({ error: mErr.message }, { status: 500 })
    }

    // 3. Avisa o usuario. Se o e-mail falhar, a conversa JA existe e aparece
    //    pra ele no app — por isso nao derruba a resposta, mas o erro fica
    //    registrado (o helper enviar() loga o motivo).
    let emailEnviado = false
    try {
      if (destinatario.email) {
        const { error } = await sendAdminNovaConversaEmail({
          to:       destinatario.email,
          userName: destinatario.name,
          ticketId: ticket.id,
          subject:  ticket.subject,
          message,
        })
        emailEnviado = !error
      }
    } catch (e: any) {
      console.error('[admin/tickets POST] email falhou:', e?.message)
    }

    return NextResponse.json({
      ok: true,
      ticketId: ticket.id,
      para: destinatario.email,
      emailEnviado,
    })
  } catch (err: any) {
    console.error('[admin/tickets POST]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
