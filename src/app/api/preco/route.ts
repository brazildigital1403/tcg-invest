import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const cardName = searchParams.get('name')

  if (!cardName) {
    return NextResponse.json({ error: 'Nome não enviado' })
  }

  // 🔎 CACHE
  const { data: cached } = await supabase
    .from('card_prices')
    .select('*')
    .eq('card_name', cardName)
    .single()

  if (cached) {
    return NextResponse.json({
      name: cached.card_name,
      number: cached.number,
      tipo: cached.tipo,
      edicao: cached.edicao,
      raridade: cached.raridade,
      artista: cached.artista,
      precoNormal: cached.preco_normal,
      precoFoil: cached.preco_foil,
      source: 'cache',
    })
  }

  try {
    const res = await fetch(`https://www.ligapokemon.com.br/?view=cards/card&card=${encodeURIComponent(cardName)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html',
      },
    })

    const html = await res.text()

    // Nome
    const nameMatch = html.match(/class="item-name">\s*([^<]+)\s*</)
    const fullName = nameMatch ? nameMatch[1].trim() : null

    const numberMatch = fullName?.match(/\(([^)]+)\)/)
    const number = numberMatch ? numberMatch[1] : null

    const numberParam = number ? number.split('/')[0] : ''

    const finalUrl = `https://www.ligapokemon.com.br/?view=cards/card&card=${encodeURIComponent(cardName)}&num=${numberParam}`

    const resFull = await fetch(finalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html',
      },
    })

    const htmlFull = await resFull.text()
    console.log('DEBUG extras_n:', htmlFull.includes('extras_n'))
    console.log('DEBUG price-min:', htmlFull.includes('price-min'))

    if (!htmlFull.includes('extras_n') && !htmlFull.includes('price-min')) {
      return NextResponse.json({
        name: fullName,
        number,
        tipo,
        edicao: null,
        raridade: null,
        artista: null,
        precoNormal: null,
        precoFoil: null,
        source: 'no-html-prices',
        message: 'LigaPokemon não entrega preços no HTML. Precisamos usar API interna ou outra fonte.'
      })
    }

    const tipoMatch = htmlFull.match(/<span class="title">Tipo<\/span>\s*<span>([^<]+)<\/span>/)
    const tipo = tipoMatch ? tipoMatch[1].trim() : null

    const edicaoMatch = htmlFull.match(/cards-details-edition">.*?>([^<]+)</)
    const edicao = edicaoMatch ? edicaoMatch[1].trim() : null

    const raridadeMatch = htmlFull.match(/cards-details-rarity">.*?>([^<]+)</)
    const raridade = raridadeMatch ? raridadeMatch[1].trim() : null

    const artistaMatch = htmlFull.match(/cards-details-artist">([^<]+)</)
    const artista = artistaMatch ? artistaMatch[1].trim() : null

    // Preços
    const normalMatch = htmlFull.match(/extras_n[\s\S]*?price-min[^>]*>\s*R\$\s?([\d.,]+)/i)
    const precoNormal = normalMatch ? normalMatch[1] : null

    const foilMatch = htmlFull.match(/extras_f[\s\S]*?price-min[^>]*>\s*R\$\s?([\d.,]+)/i)
    const precoFoil = foilMatch ? foilMatch[1] : null

    await supabase.from('card_prices').upsert([
      {
        card_name: fullName,
        number,
        tipo,
        edicao,
        raridade,
        artista,
        preco_normal: precoNormal ? precoNormal.replace(',', '.') : null,
        preco_foil: precoFoil ? precoFoil.replace(',', '.') : null,
        updated_at: new Date().toISOString(),
      },
    ], { onConflict: 'card_name' })

    return NextResponse.json({
      name: fullName,
      number,
      tipo,
      edicao,
      raridade,
      artista,
      precoNormal,
      precoFoil,
      source: 'scraping',
    })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar dados' })
  }
}