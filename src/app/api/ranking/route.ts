import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { searchParams } = new URL(req.url)
  const cardName = searchParams.get('name')

  if (!cardName) {
    // quando não tem nome, não quebra a API
    return NextResponse.json({ message: 'OK - sem nome (rota chamada sem parâmetro)' })
  }

  // 🔎 CACHE — R6: lookup em pokemon_cards (canonical) por nome.
  // Atenção: pokemon_cards.name não é único (mesma carta em vários sets), por
  // isso usamos .limit(1) — primeiro match vence.
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

  // ─── ⚠️ LEGACY abaixo — chamada ao puppeteer + upsert em card_prices ───
  // R6 Commit 3 vai remover este bloco. pokemon_cards já é populado via
  // ZenRows; se cair aqui é carta que não está catalogada.
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    const puppeteerRes = await fetch(
      `${baseUrl}/api/preco-puppeteer?name=${encodeURIComponent(cardName)}`
    )

    const data = await puppeteerRes.json()

    if (!data || data.error) {
      return NextResponse.json({ error: 'Erro ao buscar via puppeteer' })
    }

    // 💾 salvar no banco (cache)
    await supabase.from('card_prices').upsert([
      {
        card_name: data.name,
        number: data.number,
        tipo: data.tipo,
        edicao: data.edicao,
        raridade: data.raridade,
        artista: data.artista,
        preco_normal: data.precoNormal,
        preco_foil: data.precoFoil,
        updated_at: new Date().toISOString(),
      },
    ], { onConflict: 'card_name' })

    return NextResponse.json({
      ...data,
      source: 'puppeteer',
    })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar dados' })
  }
}
