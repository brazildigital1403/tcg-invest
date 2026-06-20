import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'

/**
 * POST /api/pokedex/browse
 *
 * Browse server-side do catalogo por Pokemon-base (service role). Substitui a
 * leitura direta de pokemon_cards que a /pokedex fazia com a anon key no browser
 * (firehose S42). Bounded por Pokemon (base_pokemon_names @> [nome]) entao nao e
 * vetor de dump; mesmo assim roda server-side pra permitir revogar o SELECT anon
 * em pokemon_cards (Fase C) sem quebrar a tela.
 *
 * Body: { pokemon: string }
 * Retorno: 200 { cards } | 400 body invalido | 429 rate-limit | 500 erro
 */

const RL_WINDOW_MS = 60_000
const RL_MAX = 60
const rlHits = new Map<string, { count: number; resetAt: number }>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const e = rlHits.get(ip)
  if (!e || now > e.resetAt) {
    rlHits.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS })
    return false
  }
  e.count++
  return e.count > RL_MAX
}

function gcRL() {
  if (rlHits.size < 5000) return
  const now = Date.now()
  for (const [k, v] of rlHits) {
    if (now > v.resetAt) rlHits.delete(k)
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      null
    if (ip) {
      gcRL()
      if (rateLimited(ip)) {
        return NextResponse.json({ error: 'Muitas requisicoes. Tente em instantes.' }, { status: 429 })
      }
    }

    let body: Record<string, any>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON invalido' }, { status: 400 })
    }

    const pokemon = typeof body.pokemon === 'string' ? body.pokemon.trim() : ''
    if (!pokemon) return NextResponse.json({ cards: [] }, { status: 200 })

    const sb = getServiceSupabase()
    if (!sb) return NextResponse.json({ error: 'Erro interno' }, { status: 500 })

    const { data, error } = await sb
      .from('pokemon_cards')
      .select('*')
      .contains('base_pokemon_names', [pokemon])
      .eq('supertype', 'Pokémon')
      .order('set_release_date', { ascending: false })
      .limit(1000)

    if (error) throw error

    return NextResponse.json({ cards: data || [] }, { status: 200 })
  } catch (err: any) {
    console.error('[api/pokedex/browse] erro', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
