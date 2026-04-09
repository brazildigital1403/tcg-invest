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
    // quando não tem nome, não quebra a API
    return NextResponse.json({ message: 'OK - sem nome (rota chamada sem parâmetro)' })
  }

  const { data, error } = await supabase
    .from('card_prices')
    .select('*')
    .ilike('card_name', `%${cardName}%`)
    .order('updated_at', { ascending: true })

  if (error) {
    console.error('SUPABASE ERROR:', error)
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 })
  }

  const history = data.map(item => ({
    date: item.updated_at,
    normal: item.preco_normal,
    foil: item.preco_foil,
  }))

  if (history.length > 0) {
    return NextResponse.json({
      name: cardName,
      history,
      total: history.length,
      source: 'historico'
    })
  }

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
