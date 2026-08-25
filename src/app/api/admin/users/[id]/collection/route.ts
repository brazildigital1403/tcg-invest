import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { valorCarta, acharPreco, COLUNAS_PRECO } from '@/lib/calcPatrimonio'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// GET /api/admin/users/[id]/collection
// Retorna as cartas do usuário com preços calculados
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const sb = supabaseAdmin()

    const { data: cards, error } = await sb
      .from('user_cards')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!cards || cards.length === 0) {
      return NextResponse.json({ cards: [], total_value: 0, total_cards: 0 })
    }

    // R6: busca preços por pokemon_api_id (canonical) em pokemon_cards.
    const ids = [...new Set(
      cards.map((c: any) => c.pokemon_api_id).filter(Boolean) as string[]
    )]

    const priceMap: Record<string, any> = {}
    if (ids.length > 0) {
      const { data: prices } = await sb
        .from('pokemon_cards')
        .select(COLUNAS_PRECO)
        .in('id', ids)
      for (const p of (prices as any[] | null) || []) {
        priceMap[p.id] = p
      }
    }

    // Fonte unica (src/lib/calcPatrimonio.ts) -- a mesma do topo e do cron.
    let totalValue = 0
    const enriched = cards.map((card: any) => {
      const preco = valorCarta(card, acharPreco(card, priceMap))
      const qty = Number(card.quantity) || 1
      const valor = preco * qty
      totalValue += valor
      return {
        id:            card.id,
        card_name:     card.card_name,
        card_image:    card.card_image,
        variante:      card.variante,
        quantity:      qty,
        rarity:        card.rarity,
        set_name:      card.set_name,
        preco_unitario: preco,
        valor_total:    valor,
        created_at:     card.created_at,
      }
    })

    return NextResponse.json({
      cards:       enriched,
      total_cards: enriched.length,
      total_value: totalValue,
    })
  } catch (err: any) {
    console.error('[admin/users/[id]/collection GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
