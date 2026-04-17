import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

// Mesmo mapeamento do preco-puppeteer
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

export async function GET(req: NextRequest) {
  // Verifica autorização (Vercel Cron ou secret manual)
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY
  if (!SCRAPER_API_KEY) return NextResponse.json({ error: 'SCRAPER_API_KEY não configurado' }, { status: 503 })

  try {
    // Busca cartas com link salvo que não foram atualizadas nas últimas 6h
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()

    const { data: cartas } = await supabase
      .from('user_cards')
      .select('card_name, card_link')
      .not('card_link', 'is', null)
      .lt('updated_at', since)
      .order('updated_at', { ascending: true })
      .limit(10) // Processa 10 por vez para não estourar o timeout

    if (!cartas || cartas.length === 0) {
      return NextResponse.json({ message: 'Nenhuma carta para atualizar.', updated: 0 })
    }

    // Remove duplicatas por card_name
    const seen = new Set<string>()
    const unique = cartas.filter(c => {
      if (!c.card_link || seen.has(c.card_name)) return false
      seen.add(c.card_name)
      return true
    })

    let updated = 0, errors = 0

    for (const carta of unique) {
      try {
        const parsedUrl = new URL(carta.card_link)

        // ScraperAPI sem render — dados já estão no HTML
        const scraperUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(parsedUrl.toString())}&country_code=br`
        const res = await fetch(scraperUrl, { signal: AbortSignal.timeout(12000) })
        if (!res.ok) { errors++; continue }

        const html = await res.text()
        if (!html || html.length < 1000) { errors++; continue }

        // Extrai cards_stock
        const stockMatch = html.match(/var\s+cards_stock\s*=\s*(\[[\s\S]+?\]);/)
          || html.match(/cards_stock\s*=\s*(\[[\s\S]+?\]);/)
        if (!stockMatch) { errors++; continue }

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
            min: parseFloat(prices[0].toFixed(2)),
            medio: parseFloat((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)),
            max: parseFloat(prices[prices.length - 1].toFixed(2)),
          }
        })

        const normal   = variantes.normal   || { min: 0, medio: 0, max: 0 }
        const foil     = variantes.foil     || { min: null, medio: null, max: null }
        const promo    = variantes.promo    || { min: null, medio: null, max: null }
        const reverse  = variantes.reverse  || { min: null, medio: null, max: null }
        const pokeball = variantes.pokeball || { min: null, medio: null, max: null }

        // Atualiza card_prices
        await supabase.from('card_prices').upsert({
          card_name: carta.card_name,
          preco_min: normal.min, preco_medio: normal.medio, preco_max: normal.max,
          preco_normal: normal.medio, preco_foil: foil.medio || 0,
          preco_foil_min: foil.min, preco_foil_medio: foil.medio, preco_foil_max: foil.max,
          preco_promo_min: promo.min, preco_promo_medio: promo.medio, preco_promo_max: promo.max,
          preco_reverse_min: reverse.min, preco_reverse_medio: reverse.medio, preco_reverse_max: reverse.max,
          preco_pokeball_min: pokeball.min, preco_pokeball_medio: pokeball.medio, preco_pokeball_max: pokeball.max,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'card_name' })

        // Salva histórico
        await supabase.from('card_price_history').insert({
          card_name: carta.card_name,
          preco_min: normal.min, preco_medio: normal.medio, preco_max: normal.max,
          preco_normal: normal.medio, preco_foil: foil.medio,
          recorded_at: new Date().toISOString(),
        })

        // Atualiza updated_at na user_cards para não reprocessar cedo demais
        await supabase.from('user_cards')
          .update({ updated_at: new Date().toISOString() })
          .eq('card_name', carta.card_name)

        updated++
        console.log(`✅ ${carta.card_name} | normal: ${normal.medio}`)

        // Pausa entre requests para não sobrecarregar ScraperAPI
        await new Promise(r => setTimeout(r, 1000))
      } catch (e: any) {
        console.log(`❌ ${carta.card_name}: ${e.message}`)
        errors++
      }
    }

    return NextResponse.json({
      message: 'Atualização concluída',
      updated,
      errors,
      total: unique.length,
      next_batch: cartas.length === 10 ? 'Há mais cartas para atualizar' : 'Todas atualizadas'
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}