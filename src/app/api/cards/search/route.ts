import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q     = searchParams.get('q')?.trim() || ''
  const setId = searchParams.get('set') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

  if (q.length < 2) return NextResponse.json({ cards: [] })

  // Busca fuzzy via RPC busca_cartas: tolera typo (trigram), acento e busca por
  // numero (ex: "Pikachu 190"). Usa o indice idx_pokemon_cards_name_trgm.
  // Ordena por: numero exato > similaridade de nome > tem imagem > lancamento.
  const { data, error } = await supabase.rpc('busca_cartas', {
    q,
    lim: limit,
    set_filter: setId || null,
  })

  if (error) {
    console.error('[cards/search]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ cards: data || [], total: (data || []).length })
}
