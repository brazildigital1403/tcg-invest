import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// GET /api/admin/users/[id]/collection
// Retorna as cartas do usuário com preços calculados
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
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

    // Busca preços
    const names = [...new Set(cards.map((c: any) => c.card_name?.trim()).filter(Boolean))]
    const { data: prices } = await sb
      .from('card_prices')
      .select('card_name, preco_medio, preco_foil_medio, preco_promo_medio, preco_reverse_medio, preco_pokeball_medio')
      .in('card_name', names)

    const priceMap: Record<string, any> = {}
    for (const p of prices || []) {
      priceMap[p.card_name?.trim()] = p
    }

    const CAMPOS: Record<string, string> = {
      normal:   'preco_medio',
      foil:     'preco_foil_medio',
      promo:    'preco_promo_medio',
      reverse:  'preco_reverse_medio',
      pokeball: 'preco_pokeball_medio',
    }

    let totalValue = 0
    const enriched = cards.map((card: any) => {
      const p = priceMap[card.card_name?.trim()]
      let preco = 0
      if (p) {
        let v = card.variante || 'normal'
        if (!Number(p[CAMPOS[v]] || 0)) {
          v = Object.keys(CAMPOS).find(k => Number(p[CAMPOS[k]] || 0) > 0) || 'normal'
        }
        preco = Number(p[CAMPOS[v]] || 0)
      }
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