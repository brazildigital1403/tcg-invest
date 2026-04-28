import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

// ─── pokemon_species — lista estática, raramente muda ───────────────────────
// TTL longo (24h) + tag 'pokedex' compartilhada. Invalida junto com a Pokédex.

async function buildSpeciesData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  // Supabase PostgREST limita 1000 rows por request — busca em 2 lotes
  const [batch1, batch2] = await Promise.all([
    supabase.from('pokemon_species').select('dex_id, name_en').order('dex_id').range(0, 999),
    supabase.from('pokemon_species').select('dex_id, name_en').order('dex_id').range(1000, 1999),
  ])

  return [...(batch1.data || []), ...(batch2.data || [])]
}

const getSpeciesCached = unstable_cache(
  async () => buildSpeciesData(),
  ['pokedex-species'],
  { tags: ['pokedex'], revalidate: 24 * 60 * 60 }
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const forceRefresh = searchParams.get('refresh') === '1'

  try {
    const result = forceRefresh ? await buildSpeciesData() : await getSpeciesCached()
    return NextResponse.json({ species: result })
  } catch (e: any) {
    console.error('[api/pokedex/species]', e.message)
    return NextResponse.json({ species: [] })
  }
}
