import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

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
        .select('id, email, name, full_name')
        .in('id', userIds)
      for (const u of users || []) {
        userMap[u.id] = { email: u.email, name: u.full_name || u.name || '' }
      }
    }

    const enriched = (tickets || []).map(t => ({
      ...t,
      user_email: userMap[t.user_id]?.email || null,
      user_name:  userMap[t.user_id]?.name  || null,
    }))

    return NextResponse.json({ tickets: enriched })
  } catch (err: any) {
    console.error('[admin/tickets GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
