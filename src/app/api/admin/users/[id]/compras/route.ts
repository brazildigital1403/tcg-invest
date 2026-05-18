import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// GET /api/admin/users/[id]/compras
// Lista as compras (transactions) onde o usuário foi COMPRADOR.
// Hidrata com nome/email do vendedor pra facilitar render no admin.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const sb = supabaseAdmin()

    const { data: compras, error } = await sb
      .from('transactions')
      .select('id, seller_id, card_name, price, created_at')
      .eq('buyer_id', id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('[admin/users/[id]/compras GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Hidratar com nome do vendedor (1 query única em batch)
    const sellerIds = [...new Set(
      (compras || []).map(c => c.seller_id).filter(Boolean) as string[]
    )]

    let sellerMap = new Map<string, { name: string | null; email: string }>()
    if (sellerIds.length > 0) {
      const { data: sellers } = await sb
        .from('users')
        .select('id, name, email')
        .in('id', sellerIds)
      for (const s of sellers || []) {
        sellerMap.set(s.id, { name: s.name, email: s.email })
      }
    }

    const enriched = (compras || []).map(c => {
      const seller = c.seller_id ? sellerMap.get(c.seller_id) : null
      return {
        ...c,
        seller_name:  seller?.name  || null,
        seller_email: seller?.email || null,
      }
    })

    const totalGasto = enriched.reduce((sum, c) => sum + (Number(c.price) || 0), 0)

    return NextResponse.json({
      compras: enriched,
      total: enriched.length,
      total_gasto: totalGasto,
    })
  } catch (err: any) {
    console.error('[admin/users/[id]/compras GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
