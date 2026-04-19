import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const SCRAPER_KEY = process.env.SCRAPER_API_KEY
  if (!SCRAPER_KEY) return NextResponse.json({ error: 'SCRAPER_API_KEY missing' }, { status: 503 })

  // Busca cartas sem set_name mas com card_link
  const { data: cards } = await supabase
    .from('user_cards')
    .select('id, card_name, card_link')
    .eq('user_id', userId)
    .is('set_name', null)
    .not('card_link', 'is', null)
    .limit(10) // processa 10 por vez

  if (!cards || cards.length === 0) {
    return NextResponse.json({ message: 'Todas as cartas já têm set_name', updated: 0 })
  }

  let updated = 0
  let errors = 0

  for (const card of cards) {
    try {
      const scraperUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_KEY}&url=${encodeURIComponent(card.card_link)}&country_code=br`
      const res = await fetch(scraperUrl, { signal: AbortSignal.timeout(12000) })
      if (!res.ok) { errors++; continue }
      const html = await res.text()

      // Extrai set_name do cards_editions
      let set_name: string | null = null
      const editionsMatch = html.match(/var\s+cards_editions\s*=\s*(\[[\s\S]+?\]);/)
      if (editionsMatch) {
        const editions = JSON.parse(editionsMatch[1])
        const edName = editions[0]?.name || editions[0]?.edition || editions[0]?.set
        if (edName) set_name = String(edName).trim()
      }

      // Fallback: extrai do HTML
      if (!set_name) {
        const m = html.match(/Expans[ãa]o[^<]*<[^>]*>([^<]{3,60})</)
          || html.match(/Edi[çc][ãa]o[^<]*<[^>]*>([^<]{3,60})</)
        if (m?.[1]) set_name = m[1].trim()
      }

      if (set_name) {
        await supabase.from('user_cards').update({ set_name }).eq('id', card.id)
        updated++
      } else {
        errors++
      }

      await new Promise(r => setTimeout(r, 800))
    } catch { errors++ }
  }

  const { count: remaining } = await supabase
    .from('user_cards').select('*', { count: 'exact', head: true })
    .eq('user_id', userId).is('set_name', null).not('card_link', 'is', null)

  return NextResponse.json({
    message: 'Lote processado',
    updated, errors,
    remaining: remaining || 0,
    next: remaining && remaining > 0 ? `Chame novamente para processar mais ${Math.min(remaining, 10)}` : 'Concluído!'
  })
}