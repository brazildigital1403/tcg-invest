import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

// ─── Cache compartilhado entre lambdas via tag 'pokedex' ────────────────────
//
// Antes: cache em memória por instância (TTL 1h, fragmentado entre lambdas).
// Agora: unstable_cache do Next 16 — uma chave global, todas as instâncias
// servem o mesmo snapshot. Invalida via revalidateTag('pokedex') no admin
// (ver POST /api/admin/pokedex/invalidate) ou no webhook de scan/Stripe.

// Função pura (sem `req`) que faz a query pesada — passada pra unstable_cache.
async function buildPokedexData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  // Uma query só: nomes únicos + contagem + tipo representativo.
  //
  // Antes eram duas. A segunda puxava 5.000 cartas cruas pro lambda e montava o
  // mapa de tipos com "primeira carta vence", sem order by — sobre ~54k cartas
  // elegíveis. Media: os 5.000 cobriam 673 dos 1.025 nomes, então 34% da Pokédex
  // saía sem badge, e o tipo que aparecia era sorteado entre as variantes daquele
  // Pokémon no TCG (Ekans tem carta Grass, Fire, Darkness e Psychic).
  //
  // Agora a RPC devolve a MODA do tipo, calculada no banco. 1.025 nomes, 1 sem tipo.
  const { data: counts, error } = await supabase.rpc('get_unique_base_pokemon')
  if (error || !counts) {
    console.error('[api/pokedex] rpc error:', error?.message)
    return []
  }

  const pokemons = JSON.parse(typeof counts === 'string' ? counts : JSON.stringify(counts))

  return pokemons.map((p: any) => ({
    name: p.name,
    types: p.types || [],
    card_count: p.card_count,
  }))
}

// Wrapper cacheado. Tag 'pokedex' permite invalidação targetada.
// `revalidate: 3600` é o fallback caso ninguém chame revalidateTag (1h).
const getPokedexCached = unstable_cache(
  async () => buildPokedexData(),
  ['pokedex-base'],
  { tags: ['pokedex'], revalidate: 3600 }
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  // ?refresh=1 ainda funciona pra debug/admin: ignora cache, faz query fresca.
  // Mas o caminho normal de invalidação agora é revalidateTag('pokedex').
  const forceRefresh = searchParams.get('refresh') === '1'

  try {
    const result = forceRefresh ? await buildPokedexData() : await getPokedexCached()
    return NextResponse.json({ pokemons: result, cached: !forceRefresh })
  } catch (e: any) {
    console.error('[api/pokedex]', e.message)
    return NextResponse.json({ pokemons: [] })
  }
}
