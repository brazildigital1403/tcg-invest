import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// R6 Commit 3: este endpoint agora é pure-read de pokemon_cards (canonical).
// Scraping LigaPokemon + upsert em card_prices foram removidos —
// pokemon_cards é populado via ZenRows nos scripts scan-*.
//
// GET /api/preco?name=...

export async function GET(req: Request) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  }

  // ── Query ────────────────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url)
  const cardName = searchParams.get('name')
  if (!cardName) {
    return NextResponse.json({ error: 'Nome não enviado' }, { status: 400 })
  }

  // ── Lookup em pokemon_cards ──────────────────────────────────────────────
  // Atenção: pokemon_cards.name não é único (mesma carta em vários sets), por
  // isso usamos .limit(1) — primeiro match vence.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: cachedRows } = await supabase
    .from('pokemon_cards')
    .select('id, name, number, rarity, artist, set_name, set_series, types, preco_normal, preco_foil')
    .eq('name', cardName)
    .limit(1)

  const cached = cachedRows?.[0]

  if (cached) {
    return NextResponse.json({
      name: cached.name,
      number: cached.number,
      tipo: Array.isArray(cached.types) ? cached.types.join(', ') : null,
      edicao: cached.set_name,
      raridade: cached.rarity,
      artista: cached.artist,
      precoNormal: cached.preco_normal,
      precoFoil: cached.preco_foil,
      source: 'cache',
    })
  }

  return NextResponse.json({
    error: 'Carta não encontrada na base.',
    name: cardName,
    source: 'not-found',
  }, { status: 404 })
}
