import { SupabaseClient } from '@supabase/supabase-js'

// Conta tickets em aberto/andamento cuja ULTIMA mensagem foi do usuario (nao
// do admin) -- "precisa de resposta" de verdade, diferente de "criado nos
// ultimos 7 dias" (um ticket de 47 dias parado sumia desse contador so por
// ser velho). Usado no badge do sidebar (/api/admin/counts) e no cockpit
// da home (/api/admin/dashboard) -- extraido pra nao divergir entre os dois.
export async function ticketsPrecisandoResposta(sb: SupabaseClient): Promise<number> {
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
