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
// Lista as compras onde o usuário foi COMPRADOR (buyer_id) no marketplace.
// FIX: as vendas reais vivem em `marketplace` (com buyer_id + status), nao em
// `transactions` (que nunca e populada). Considera compras firmes/em andamento:
// concluido, enviado, reservado, em_negociacao. Ignora cancelado/disponivel.
// Hidrata com nome/email do vendedor (marketplace.user_id).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const sb = supabaseAdmin()

    const { data: rows, error } = await sb
      .from('marketplace')
      .select('id, user_id, card_name, card_image, price, condicao, status, created_at')
      .eq('buyer_id', id)
      .in('status', ['concluido', 'enviado', 'reservado', 'em_negociacao'])
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('[admin/users/[id]/compras GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Hidratar com nome do vendedor (marketplace.user_id) — 1 query em batch
    const sellerIds = [...new Set(
      (rows || []).map(c => c.user_id).filter(Boolean) as string[]
    )]

    const sellerMap = new Map<string, { name: string | null; email: string }>()
    if (sellerIds.length > 0) {
      const { data: sellers } = await sb
        .from('users')
        .select('id, name, email')
        .in('id', sellerIds)
      for (const s of sellers || []) {
        sellerMap.set(s.id, { name: s.name, email: s.email })
      }
    }

    const enriched = (rows || []).map(c => {
      const seller = c.user_id ? sellerMap.get(c.user_id) : null
      return {
        id: c.id,
        seller_id: c.user_id,            // mantem o shape antigo (a UI usa seller_*)
        card_name: c.card_name,
        card_image: c.card_image,
        price: c.price,
        condicao: c.condicao,
        status: c.status,
        created_at: c.created_at,
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
