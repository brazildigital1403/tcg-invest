import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

const CAMPOS: Record<string, string> = {
  normal: 'preco_medio', foil: 'preco_foil_medio', promo: 'preco_promo_medio',
  reverse: 'preco_reverse_medio', pokeball: 'preco_pokeball_medio',
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  try {
    // Busca todos os usuários únicos com cartas
    const { data: allCards } = await supabase
      .from('user_cards')
      .select('user_id, card_name, variante, quantity')

    if (!allCards || allCards.length === 0) {
      return NextResponse.json({ message: 'Nenhuma carta', snapshots: 0 })
    }

    // Agrupa por usuário
    const byUser: Record<string, any[]> = {}
    for (const card of allCards) {
      if (!byUser[card.user_id]) byUser[card.user_id] = []
      byUser[card.user_id].push(card)
    }

    let snapshots = 0
    const today = new Date().toISOString().slice(0, 10)

    for (const [userId, cards] of Object.entries(byUser)) {
      const names = [...new Set(cards.map(c => c.card_name?.trim()).filter(Boolean))]

      const { data: prices } = await supabase
        .from('card_prices')
        .select('card_name, preco_medio, preco_foil_medio, preco_promo_medio, preco_reverse_medio, preco_pokeball_medio')
        .in('card_name', names)

      const priceMap: Record<string, any> = {}
      prices?.forEach(p => { priceMap[p.card_name?.trim()] = p })

      let total = 0
      for (const card of cards) {
        const p = priceMap[card.card_name?.trim()]
        if (!p) continue
        const v = card.variante || 'normal'
        let campo = CAMPOS[v] || 'preco_medio'
        // Fallback se variante não tem preço
        if (!Number(p[campo] || 0)) {
          campo = Object.keys(CAMPOS).find(k => Number(p[CAMPOS[k]] || 0) > 0)
            ? CAMPOS[Object.keys(CAMPOS).find(k => Number(p[CAMPOS[k]] || 0) > 0)!]
            : 'preco_medio'
        }
        total += Number(p[campo] || 0) * (card.quantity || 1)
      }

      // Salva snapshot do dia (upsert — 1 por dia)
      await supabase.from('portfolio_history').upsert({
        user_id: userId,
        valor: parseFloat(total.toFixed(2)),
        recorded_at: today,
      }, { onConflict: 'user_id,recorded_at' })

      snapshots++
    }

    return NextResponse.json({ message: 'Snapshots salvos', snapshots, date: today })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}