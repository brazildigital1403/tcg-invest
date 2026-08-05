import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function GET(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const sb = supabaseAdmin()
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const novos = async (table: string): Promise<number> => {
      const { count } = await sb.from(table).select('*', { count: 'exact', head: true }).gte('created_at', since)
      return count || 0
    }
    const cartasPendentes = async (): Promise<number> => {
      const { count } = await sb.from('card_requests').select('*', { count: 'exact', head: true }).eq('status', 'pendente')
      return count || 0
    }
    // Badge do sidebar contava "tickets criados nos ultimos 7 dias" -- nao
    // dizia nada sobre precisar de resposta (um ticket de 47 dias sem
    // resposta some do contador so por ser velho). Troca pra contar quem
    // esta no segmento "Precisa de resposta" da lista (05/08/2026): status
    // em aberto E a ultima mensagem foi do usuario, nao do admin.
    const ticketsPrecisandoResposta = async (): Promise<number> => {
      const { data: abertos } = await sb.from('tickets').select('id').in('status', ['open', 'in_progress'])
      const ids = (abertos || []).map(t => t.id)
      if (ids.length === 0) return 0
      const { data: msgs } = await sb
        .from('ticket_messages')
        .select('ticket_id, sender_type, created_at')
        .in('ticket_id', ids)
        .order('created_at', { ascending: false })
        .limit(2000)
      const ultimoPorTicket: Record<string, string> = {}
      for (const m of msgs || []) {
        if (!ultimoPorTicket[m.ticket_id]) ultimoPorTicket[m.ticket_id] = m.sender_type
      }
      return Object.values(ultimoPorTicket).filter(s => s === 'user').length
    }

    const [tickets, lojas, marketplace, usuarios, financeiro, cartas] = await Promise.all([
      ticketsPrecisandoResposta(),
      novos('lojas'),
      novos('marketplace'),
      novos('users'),
      novos('transactions'),
      cartasPendentes(),
    ])

    return NextResponse.json({ cartas, tickets, lojas, marketplace, usuarios, financeiro })
  } catch (err: any) {
    console.error('[admin/counts]', err?.message)
    return NextResponse.json({ cartas: 0, tickets: 0, lojas: 0, marketplace: 0, usuarios: 0, financeiro: 0 })
  }
}
