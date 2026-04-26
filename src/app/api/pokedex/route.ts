import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  // GROUP BY no banco — retorna apenas nomes únicos com seus tipos
  const { data, error } = await supabase.rpc('get_unique_pokemon')

  if (error) {
    // Fallback: query manual
    const { data: raw } = await supabase
      .from('pokemon_cards')
      .select('name, types')
      .eq('supertype', 'Pokémon')
      .not('image_small', 'is', null)
      .not('id', 'like', 'liga-%')
      .order('name')
      .limit(10000) // busca tudo

    // Agrupa no servidor
    const map = new Map<string, any>()
    for (const card of raw || []) {
      if (!map.has(card.name)) {
        map.set(card.name, { name: card.name, types: card.types })
      }
    }

    return NextResponse.json({ pokemons: [...map.values()] })
  }

  return NextResponse.json({ pokemons: data || [] })
}
