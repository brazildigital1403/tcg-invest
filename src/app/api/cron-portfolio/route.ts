import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calcPatrimonio, COLUNAS_PRECO } from '@/lib/calcPatrimonio'

export const maxDuration = 60


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
    // R6: trazemos pokemon_api_id pra usar como chave de lookup em pokemon_cards.
    const { data: allCards } = await supabase
      .from('user_cards')
      .select('user_id, pokemon_api_id, card_id, card_link, variante, quantity, graduada, valor_graduada')

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
      // R6: busca preços por pokemon_api_id (canonical) em pokemon_cards.
      const ids = [...new Set(
        cards.map(c => c.pokemon_api_id).filter(Boolean) as string[]
      )]

      let priceMap: Record<string, any> = {}
      if (ids.length > 0) {
        const { data: prices } = await supabase
          .from('pokemon_cards')
          .select(COLUNAS_PRECO)
          .in('id', ids)
        ;(prices as any[] | null)?.forEach((p: any) => { priceMap[p.id] = p })
      }

      // Fonte unica (src/lib/calcPatrimonio.ts) -- a mesma que o topo usa.
      // Sem cotacao aqui de proposito: o cron nao deve depender de API externa
      // pra fechar o snapshot do dia. Sao 5 cartas de 5.041 que so tem preco
      // em USD; elas entram como zero no historico, igual a antes.
      const { valor: total } = calcPatrimonio(cards as any[], priceMap)

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
