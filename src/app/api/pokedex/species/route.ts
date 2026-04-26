import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

let cache: { data: any[]; ts: number } | null = null

export async function GET() {
  if (cache && Date.now() - cache.ts < 24 * 60 * 60 * 1000) {
    return NextResponse.json({ species: cache.data })
  }
  const { data } = await supabase
    .from('pokemon_species')
    .select('dex_id, name_en')
    .order('dex_id')
  cache = { data: data || [], ts: Date.now() }
  return NextResponse.json({ species: data || [] })
}
