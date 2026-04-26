import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q     = searchParams.get('q')?.trim() || ''
  const setId = searchParams.get('set') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

  if (q.length < 2) return NextResponse.json({ cards: [] })

  let query = supabase
    .from('pokemon_cards')
    .select(`
      id, name, number, rarity, artist,
      image_small, image_large,
      set_id, set_name, set_series, set_release_date, set_logo, set_symbol,
      types, supertype, subtypes, hp,
      preco_normal, preco_foil, preco_promo, preco_reverse, preco_pokeball,
      preco_min, preco_medio, preco_max,
      preco_foil_min, preco_foil_medio, preco_foil_max,
      preco_promo_min, preco_promo_medio, preco_promo_max,
      preco_reverse_min, preco_reverse_medio, preco_reverse_max,
      preco_pokeball_min, preco_pokeball_medio, preco_pokeball_max,
      price_usd_normal, price_usd_holofoil, price_usd_reverse,
      price_eur_normal, price_eur_holofoil,
      liga_link, liga_updated_at, tcg_updated_at
    `)
    .ilike('name', `%${q}%`)
    // Prioriza cartas com imagem (TCG API) e ordena por data de lançamento
    .not('image_small', 'is', null)
    .order('set_release_date', { ascending: false })
    .limit(limit)

  if (setId) query = query.eq('set_id', setId)

  const { data: withImage, error } = await query

  if (error) {
    console.error('[cards/search]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Se retornou menos que o limite, completa com cartas sem imagem
  let combined = withImage || []
  if (combined.length < limit) {
    const remaining = limit - combined.length
    const existingIds = combined.map(c => c.id)

    let queryNoImg = supabase
      .from('pokemon_cards')
      .select(`
        id, name, number, rarity,
        image_small, image_large,
        set_id, set_name,
        preco_normal, preco_foil, preco_promo, preco_reverse,
        preco_min, preco_medio, preco_max,
        preco_foil_min, preco_foil_medio, preco_foil_max,
        preco_promo_min, preco_promo_medio, preco_promo_max,
        preco_reverse_min, preco_reverse_medio, preco_reverse_max,
        price_usd_normal, price_usd_holofoil,
        price_eur_normal, price_eur_holofoil,
        liga_link, liga_updated_at
      `)
      .ilike('name', `%${q}%`)
      .is('image_small', null)
      .limit(remaining)

    if (existingIds.length > 0) {
      queryNoImg = queryNoImg.not('id', 'in', `(${existingIds.map(id => `"${id}"`).join(',')})`)
    }

    const { data: noImg } = await queryNoImg
    combined = [...combined, ...(noImg || [])]
  }

  return NextResponse.json({ cards: combined, total: combined.length })
}
