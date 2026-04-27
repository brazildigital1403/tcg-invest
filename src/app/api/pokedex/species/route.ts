import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

let cache: { data: any[]; ts: number } | null = null

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const forceRefresh = searchParams.get('refresh') === '1'

  if (!forceRefresh && cache && Date.now() - cache.ts < 24 * 60 * 60 * 1000) {
    return NextResponse.json({ species: cache.data })
  }

  // Supabase PostgREST limita 1000 rows por request — busca em 2 lotes
  const [batch1, batch2] = await Promise.all([
    supabase.from('pokemon_species').select('dex_id, name_en').order('dex_id').range(0, 999),
    supabase.from('pokemon_species').select('dex_id, name_en').order('dex_id').range(1000, 1999),
  ])

  const all = [...(batch1.data || []), ...(batch2.data || [])]
  cache = { data: all, ts: Date.now() }
  return NextResponse.json({ species: all })
}
