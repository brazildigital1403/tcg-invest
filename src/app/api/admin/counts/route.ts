import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { ticketsPrecisandoResposta } from '@/lib/adminTickets'

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
    // Anuncio novo tem que respeitar o soft-delete, senao o badge conta o que ja
    // foi removido: na semana de 27/07 mostraria 19 quando so 9 sobreviveram.
    const novosAnuncios = async (): Promise<number> => {
      const { count } = await sb.from('marketplace').select('*', { count: 'exact', head: true })
        .gte('created_at', since).is('removido_em', null)
      return count || 0
    }
    // O badge de Lojas existe pra chamar atencao pro que PRECISA de acao, nao
    // pro que e recente -- mesma regra que adminTickets.ts ja aplica a tickets.
    // Havia 1 loja pendente ha 34 dias com o badge zerado.
    const lojasPendentes = async (): Promise<number> => {
      const { count } = await sb.from('lojas').select('*', { count: 'exact', head: true }).eq('status', 'pendente')
      return count || 0
    }
    const cartasPendentes = async (): Promise<number> => {
      const { count } = await sb.from('card_requests').select('*', { count: 'exact', head: true }).eq('status', 'pendente')
      return count || 0
    }
    // Servico de bancada: pedido que espera acao da Bynx (orcar, receber,
    // tratar, enviar). Mesma regra de turnoServico em src/lib/servicos.ts.
    const servicosComABynx = async (): Promise<number> => {
      const { count } = await sb.from('servico_solicitacoes').select('*', { count: 'exact', head: true })
        .in('status', ['aguardando_orcamento', 'recebida', 'em_bancada', 'descansando', 'pronta', 'enviada'])
      return count || 0
    }
    const [tickets, lojas, marketplace, usuarios, financeiro, cartas, servicos] = await Promise.all([
      ticketsPrecisandoResposta(sb),
      lojasPendentes(),
      novosAnuncios(),
      novos('users'),
      // Era novos('transactions'), e a tabela nunca recebeu uma linha (a escrita
      // pelo navegador batia na RLS) -- o badge de Financeiro vivia zerado. A tela
      // /admin/financeiro le `lancamentos`, que e o que conta aqui.
      novos('lancamentos'),
      cartasPendentes(),
      servicosComABynx(),
    ])

    return NextResponse.json({ cartas, tickets, lojas, marketplace, usuarios, financeiro, servicos })
  } catch (err: any) {
    console.error('[admin/counts]', err?.message)
    return NextResponse.json({ cartas: 0, tickets: 0, lojas: 0, marketplace: 0, usuarios: 0, financeiro: 0, servicos: 0 })
  }
}
