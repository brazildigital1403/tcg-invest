import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  // Agrupa por base_pokemon_names — cada nome base é uma entrada na Pokédex
  // unnest expande arrays: "Garchomp & Giratina-GX" → aparece em Garchomp E Giratina
  const { data, error } = await supabase.rpc('get_unique_base_pokemon')

  if (error || !data) {
    console.error('[api/pokedex]', error?.message)
    return NextResponse.json({ pokemons: [] })
  }

  return NextResponse.json({ pokemons: data })
}
