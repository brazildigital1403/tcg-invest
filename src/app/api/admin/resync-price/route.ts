import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

// Mesmo mapeamento do cron-precos (mantemos alinhado)
const EXTRAS_MAP: Record<number, string> = {
  0: 'normal', 2: 'foil', 3: 'reverse', 14: 'promo', 47: 'pokeball',
  1: 'foil', 4: 'reverse', 15: 'special',
}

function parsePrice(v: string | number | null | undefined): number | null {
  if (v == null) return null
  const s = String(v).trim()
  const n = parseFloat(s)
  if (isNaN(n) || n <= 0) return null
  if (!s.includes('.') && !s.includes(',')) return parseFloat((n / 100).toFixed(2))
  return parseFloat(n.toFixed(2))
}

// POST /api/admin/resync-price
// Body: { cardName?: string, cardLink?: string }
// Pelo menos um dos dois é obrigatório.
// Se só cardName for passado, busca o link no banco.

export async function POST(req: NextRequest) {
  const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY
  if (!SCRAPER_API_KEY) {
    return NextResponse.json({ error: 'SCRAPER_API_KEY não configurado' }, { status: 503 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    let cardName = String(body.cardName || '').trim()
    let cardLink = String(body.cardLink || '').trim()

    if (!cardName && !cardLink) {
      return NextResponse.json({ error: 'Informe cardName ou cardLink' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Se não veio o link, procura uma user_card com esse nome
    if (!cardLink) {
      const { data } = await supabase
        .from('user_cards')
        .select('card_name, card_link')
        .eq('card_name', cardName)
        .not('card_link', 'is', null)
        .limit(1)

      if (!data?.[0]?.card_link) {
        return NextResponse.json({
          error: `Nenhum link encontrado pra carta "${cardName}". Forneça o cardLink manualmente.`
        }, { status: 404 })
      }
      cardLink = data[0].card_link
      cardName = data[0].card_name
    }

    const parsedUrl = new URL(cardLink)
    const scraperUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(parsedUrl.toString())}&country_code=br`

    const res = await fetch(scraperUrl, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) {
      return NextResponse.json({ error: `Scraper retornou status ${res.status}` }, { status: 502 })
    }

    const html = await res.text()
    if (!html || html.length < 1000) {
      return NextResponse.json({ error: 'HTML do scraper veio vazio ou muito pequeno' }, { status: 502 })
    }

    const stockMatch = html.match(/var\s+cards_stock\s*=\s*(\[[\s\S]+?\]);/)
      || html.match(/cards_stock\s*=\s*(\[[\s\S]+?\]);/)
    if (!stockMatch) {
      return NextResponse.json({ error: 'Não foi possível extrair os preços da página' }, { status: 502 })
    }

    const stock: Array<{ extras: number; precoFinal: string }> = JSON.parse(stockMatch[1])
    const byExtra: Record<number, number[]> = {}
    stock.forEach(s => {
      const key = s.extras ?? 0
      if (!byExtra[key]) byExtra[key] = []
      const price = parsePrice(s.precoFinal)
      if (price && price > 0) byExtra[key].push(price)
    })

    const variantes: Record<string, { min: number; medio: number; max: number }> = {}
    Object.entries(byExtra).forEach(([key, prices]) => {
      const name = EXTRAS_MAP[parseInt(key)] || `extra_${key}`
      prices.sort((a, b) => a - b)
      variantes[name] = {
        min:   parseFloat(prices[0].toFixed(2)),
        medio: parseFloat((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)),
        max:   parseFloat(prices[prices.length - 1].toFixed(2)),
      }
    })

    const normal   = variantes.normal   || { min: 0, medio: 0, max: 0 }
    const foil     = variantes.foil     || { min: null, medio: null, max: null }
    const promo    = variantes.promo    || { min: null, medio: null, max: null }
    const reverse  = variantes.reverse  || { min: null, medio: null, max: null }
    const pokeball = variantes.pokeball || { min: null, medio: null, max: null }

    // Grava no card_prices
    await supabase.from('card_prices').upsert({
      card_name: cardName,
      preco_min: normal.min, preco_medio: normal.medio, preco_max: normal.max,
      preco_normal: normal.medio, preco_foil: foil.medio || 0,
      preco_foil_min: foil.min, preco_foil_medio: foil.medio, preco_foil_max: foil.max,
      preco_promo_min: promo.min, preco_promo_medio: promo.medio, preco_promo_max: promo.max,
      preco_reverse_min: reverse.min, preco_reverse_medio: reverse.medio, preco_reverse_max: reverse.max,
      preco_pokeball_min: pokeball.min, preco_pokeball_medio: pokeball.medio, preco_pokeball_max: pokeball.max,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'card_name' })

    // Histórico
    await supabase.from('card_price_history').insert({
      card_name: cardName,
      preco_min: normal.min, preco_medio: normal.medio, preco_max: normal.max,
      preco_normal: normal.medio, preco_foil: foil.medio,
      recorded_at: new Date().toISOString(),
    })

    // Atualiza updated_at nas user_cards pra não reprocessar
    await supabase.from('user_cards')
      .update({ updated_at: new Date().toISOString() })
      .eq('card_name', cardName)

    return NextResponse.json({
      ok: true,
      cardName,
      variantes,
    })
  } catch (err: any) {
    console.error('[admin/resync-price]', err?.message)
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 })
  }
}