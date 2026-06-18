// src/app/api/busca/route.ts
// Endpoint de busca (typeahead da home + uso interno). Chama a RPC busca_global.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()

  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return NextResponse.json({ results: [], error: 'config' }, { status: 500 })
  }

  const sb = createClient(url, anon)
  const { data, error } = await sb.rpc('busca_global', { q, lim: 6 })

  if (error) {
    return NextResponse.json({ results: [], error: error.message }, { status: 500 })
  }

  const rows = (data || []) as Array<{
    kind: string; ref: string; label: string; sublabel: string; image: string | null; price: number | null
  }>
  // Pokemon primeiro (leva pro hub com todas as cartas), depois cartas
  const pokemons = rows.filter((r) => r.kind === 'pokemon')
  const cartas = rows.filter((r) => r.kind === 'card')
  const results = [...pokemons, ...cartas].map((r) => ({
    kind: r.kind,
    ref: r.ref,
    label: r.label,
    sublabel: r.sublabel,
    image: r.image,
    price: r.price,
    href: r.kind === 'pokemon' ? `/pokemon/${r.ref}` : `/carta/${r.ref}`,
  }))

  return NextResponse.json(
    { results },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
