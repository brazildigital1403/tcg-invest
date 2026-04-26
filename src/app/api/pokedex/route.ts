import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Cache em memória — regenera a cada 1 hora
let cache: { data: any[]; ts: number } | null = null
const CACHE_TTL = 60 * 60 * 1000

export async function GET() {
  // Serve do cache se ainda válido
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({ pokemons: cache.data })
  }

  try {
    // Query 1: nomes únicos + contagem (rápido)
    const { data: counts, error } = await supabase.rpc('get_unique_base_pokemon')
    if (error || !counts) {
      console.error('[api/pokedex]', error?.message)
      return NextResponse.json({ pokemons: [] })
    }

    const pokemons = JSON.parse(typeof counts === 'string' ? counts : JSON.stringify(counts))

    // Query 2: tipos por nome base (uma query IN, sem correlação)
    const names = pokemons.map((p: any) => p.name).slice(0, 500)
    const { data: typeData } = await supabase
      .from('pokemon_cards')
      .select('base_pokemon_names, types')
      .eq('supertype', 'Pokémon')
      .not('image_small', 'is', null)
      .not('base_pokemon_names', 'is', null)
      .limit(5000)

    // Mapa: nome base → tipos
    const typeMap: Record<string, string[]> = {}
    for (const card of typeData || []) {
      for (const baseName of card.base_pokemon_names || []) {
        if (!typeMap[baseName] && card.types?.length > 0) {
          typeMap[baseName] = card.types
        }
      }
    }

    // Combina
    const result = pokemons.map((p: any) => ({
      name: p.name,
      types: typeMap[p.name] || [],
      card_count: p.card_count,
    }))

    cache = { data: result, ts: Date.now() }
    return NextResponse.json({ pokemons: result })

  } catch (e: any) {
    console.error('[api/pokedex]', e.message)
    return NextResponse.json({ pokemons: [] })
  }
}
