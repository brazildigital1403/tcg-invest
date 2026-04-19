import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  try {
    // Busca todos os sets da TCG API
    const res = await fetch('https://api.pokemontcg.io/v2/sets?pageSize=250&orderBy=-releaseDate')
    const data = await res.json()

    if (!data?.data?.length) {
      return NextResponse.json({ error: 'TCG API sem dados' }, { status: 503 })
    }

    const sets = data.data.map((s: any) => ({
      id: s.id,
      name: s.name,
      series: s.series || null,
      total: s.total || 0,
      printed_total: s.printedTotal || null,
      logo_url: s.images?.logo || null,
      symbol_url: s.images?.symbol || null,
      release_date: s.releaseDate || null,
    }))

    // Upsert todos os sets
    const { error } = await supabase
      .from('pokemon_sets')
      .upsert(sets, { onConflict: 'id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ message: 'Sets sincronizados', total: sets.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}