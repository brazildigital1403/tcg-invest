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

  // Uma query só, lendo da matview mv_base_pokemon_tipos: nome + contagem +
  // tipo representativo (a moda das cartas daquele Pokémon no TCG).
  //
  // Antes eram duas queries, e a segunda puxava 5.000 cartas cruas pro lambda
  // com "primeira carta vence", sobre ~54k elegíveis: cobria 673 dos 1.025
  // nomes, então 34% da Pokédex saía sem badge, e o tipo exibido era sorteado.
  //
  // A moda NÃO pode ser calculada por request: exige seq scan em pokemon_cards
  // (187 MB). Com buffer quente dá 144ms e engana; frio estoura o
  // statement_timeout de 8s do papel authenticator e derruba a página.
  // Por isso o cálculo vive numa matview, atualizada de hora em hora pelo
  // pg_cron (job refresh_base_pokemon_tipos, :32). Aqui é index scan, 19
  // buffers, ~8ms — mil vezes abaixo do limite.
  const { data: counts, error } = await supabase.rpc('get_base_pokemon_com_tipos')
  if (error || !counts) {
    // ATENÇÃO: aqui NÃO pode retornar []. Esta função roda dentro de
    // unstable_cache — um retorno vazio vira entrada de cache válida e a Pokédex
    // fica em branco por 1h (revalidate: 3600), em todas as instâncias, e o
    // vazio sobrevive a deploy porque o Data Cache da Vercel é compartilhado
    // entre deployments. Uma falha de 1 segundo virava 1 hora de página vazia.
    // Lançando o erro, nada é gravado e a próxima request tenta de novo.
    console.error('[api/pokedex] rpc error:', error?.message)
    throw new Error(`rpc get_base_pokemon_com_tipos falhou: ${error?.message ?? 'sem dados'}`)
  }

  const pokemons = JSON.parse(typeof counts === 'string' ? counts : JSON.stringify(counts))

  const resultado = pokemons.map((p: any) => ({
    name: p.name,
    types: p.types || [],
    card_count: p.card_count,
  }))

  // Rede de segurança: lista vazia nunca é resposta legítima (a Pokédex tem
  // ~1025 nomes). Se vier vazia, é falha — lança pra não virar cache.
  if (resultado.length === 0) {
    throw new Error('[api/pokedex] resultado vazio, nao vai pro cache')
  }

  return resultado
}

// Wrapper cacheado. Tag 'pokedex' permite invalidação targetada.
// `revalidate: 3600` é o fallback caso ninguém chame revalidateTag (1h).
//
// A chave foi pra -v2 de propósito: a entrada antiga ('pokedex-base') ficou
// gravada com [] e o Data Cache da Vercel é compartilhado entre deployments,
// então redeploy não limpava. Trocar a chave orfana a entrada podre na hora,
// sem depender de revalidateTag (que exige sessão de admin).
const getPokedexCached = unstable_cache(
  async () => buildPokedexData(),
  ['pokedex-base-v3'],
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
