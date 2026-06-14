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

    const [tickets, lojas, marketplace, usuarios, financeiro, cartas] = await Promise.all([
      novos('tickets'),
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
