import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'

/**
 * POST /api/cards/lookup
 *
 * Lookup server-side de cartas em pokemon_cards (service role). Substitui as
 * leituras de pokemon_cards que os componentes client faziam direto com a anon
 * key no browser (o "firehose" S42). Como roda server-side, a gente pode
 * revogar o SELECT anon em pokemon_cards (Fase C) sem quebrar essas telas.
 *
 * Publica (sem auth): perfil publico e marketplace sao acessiveis por anon, e o
 * conteudo e catalogo (precos), nao dado privado. Abuso e contido por:
 *   - rate-limit por IP (gate de rajada em memoria)
 *   - cap de valores por request (MAX_VALUES)
 *   - exige a lista de ids/nomes (nao da pra "dumpar tudo" como no PostgREST cru)
 *
 * Body JSON (qualquer combinacao):
 *   { ids?: string[], liga_links?: string[], names?: string[], full?: boolean }
 *
 * Retorno:
 *   200 -> { cards: Card[] }   (uniao deduplicada por id)
 *   400 -> body invalido / valores demais
 *   429 -> rate-limit
 *   500 -> erro interno
 *
 * full:true devolve a carta inteira (select *); senao, o superset de colunas de
 * preco+meta que os componentes usam (CARD_FIELDS).
 */

// Superset do PRICE_SELECT dos componentes + campos de display/meta.
// (name_pt NAO existe em pokemon_cards - e de pokemon_sets/pokedex.)
const CARD_FIELDS =
  'id, name, number, set_id, set_name, set_total, set_series, ' +
  'image_small, image_large, liga_link, supertype, rarity, base_pokemon_names, ' +
  'preco_normal, preco_foil, preco_promo, preco_reverse, preco_pokeball, ' +
  'preco_min, preco_medio, preco_max, ' +
  'preco_foil_min, preco_foil_medio, preco_foil_max, ' +
  'preco_promo_min, preco_promo_medio, preco_promo_max, ' +
  'preco_reverse_min, preco_reverse_medio, preco_reverse_max, ' +
  'preco_pokeball_min, preco_pokeball_medio, preco_pokeball_max, ' +
  'price_usd_normal, price_usd_holofoil, price_usd_reverse, ' +
  'price_eur_normal, price_eur_holofoil'

const MAX_VALUES = 5000   // teto total de valores aceitos por request
const CHUNK = 100         // lotes pro .in() (evita URL longa no PostgREST, licao do scan)

// ─── Rate-limit em memoria (gate de rajada por IP) ─────────────────────────
// Speed-bump por-instancia em serverless; camada definitiva = edge (Vercel Firewall).
const RL_WINDOW_MS = 60_000
const RL_MAX = 60         // 60 lookups por IP por minuto
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

function asArr(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  for (const x of v) {
    if (typeof x === 'string' && x.length > 0) seen.add(x)
  }
  return [...seen]
}

async function fetchBy(
  sb: ReturnType<typeof getServiceSupabase>,
  column: string,
  values: string[],
  fields: string,
): Promise<any[]> {
  if (!sb || values.length === 0) return []
  const chunks: string[][] = []
  for (let i = 0; i < values.length; i += CHUNK) chunks.push(values.slice(i, i + CHUNK))
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await sb.from('pokemon_cards').select(fields).in(column, chunk).neq('is_canary', true)
      if (error) throw error
      return data || []
    }),
  )
  return results.flat()
}

export async function POST(req: NextRequest) {
  try {
    // ─── Rate-limit ────────────────────────────────────────
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      null
    if (ip) {
      gcRL()
      if (rateLimited(ip)) {
        return NextResponse.json({ error: 'Muitos lookups. Tente em instantes.' }, { status: 429 })
      }
    }

    // ─── Body ──────────────────────────────────────────────
    let body: Record<string, any>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
    }

    const ids = asArr(body.ids)
    const ligaLinks = asArr(body.liga_links)
    const names = asArr(body.names)
    const full = body.full === true

    const total = ids.length + ligaLinks.length + names.length
    if (total === 0) return NextResponse.json({ cards: [] }, { status: 200 })
    if (total > MAX_VALUES) {
      return NextResponse.json({ error: 'Valores demais', max: MAX_VALUES }, { status: 400 })
    }

    const sb = getServiceSupabase()
    if (!sb) return NextResponse.json({ error: 'Erro interno' }, { status: 500 })

    const fields = full ? '*' : CARD_FIELDS

    const [byId, byLink, byName] = await Promise.all([
      fetchBy(sb, 'id', ids, fields),
      fetchBy(sb, 'liga_link', ligaLinks, fields),
      fetchBy(sb, 'name', names, fields),
    ])

    // União deduplicada por id
    const map = new Map<string, any>()
    for (const row of [...byId, ...byLink, ...byName]) {
      if (row && row.id != null) map.set(row.id, row)
    }

    return NextResponse.json({ cards: [...map.values()] }, { status: 200 })
  } catch (err: any) {
    console.error('[api/cards/lookup] erro', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
