import {
  BASE,
  CARD_CHUNK,
  SITEMAP_HEADERS,
  STATIC_ROUTES,
  getSupabase,
  getPokemonSlugs,
  isIdSafeForUrl,
  urlsetXml,
  type UrlEntry,
} from '@/lib/sitemap-core'

/**
 * BLOCOS do sitemap — servidos em /sitemap/0.xml, /sitemap/1.xml, ...
 *
 * Bloco 0: rotas estáticas + lojas ativas + sets + 1o bloco de cartas.
 * Blocos seguintes: só cartas (paginadas por .range, ordenadas por id).
 *
 * Next 16: params é uma Promise. A URL chega como "0.xml" -> tiramos o .xml.
 *
 * S41: sets vêm de sitemap_set_ids() (SELECT DISTINCT set_id, ~400ms via anon).
 * A antiga set_index_stats() fazia aggregate pesado (SUM/MIN) e estourava o
 * statement_timeout do role anon (erro 57014), zerando os sets no sitemap.
 */
export const revalidate = 86400

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params
  const parsed = parseInt(String(rawId).replace(/\.xml$/, ''), 10)
  const chunkIndex = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0

  const now = new Date().toISOString()
  const entries: UrlEntry[] = []
  const sb = getSupabase()

  // Bloco 0 carrega as páginas estáticas + lojas + sets (além das cartas)
  if (chunkIndex === 0) {
    for (const r of STATIC_ROUTES) {
      entries.push({
        loc: `${BASE}${r.path}`,
        lastmod: now,
        changefreq: r.changeFrequency,
        priority: r.priority,
      })
    }

    if (sb) {
      // Lojas ativas
      try {
        const { data: lojas, error: lojasErr } = await sb
          .from('lojas')
          .select('slug, updated_at')
          .eq('status', 'ativa')
          .limit(1000)
        if (lojasErr) console.error('[sitemap] erro lojas:', lojasErr)
        for (const loja of lojas || []) {
          if (loja.slug) {
            entries.push({
              loc: `${BASE}/lojas/${loja.slug}`,
              lastmod: loja.updated_at
                ? new Date(loja.updated_at).toISOString()
                : now,
              changefreq: 'weekly',
              priority: 0.6,
            })
          }
        }
      } catch (err) {
        console.error('[sitemap] erro ao buscar lojas:', err)
      }

      // Sets (sitemap_set_ids retorna os set_id distintos do catálogo, leve)
      try {
        const { data: setsRows, error: setsErr } = await sb.rpc('sitemap_set_ids')
        if (setsErr) console.error('[sitemap] erro sets rpc:', setsErr)
        const setIds = ((setsRows as Array<{ set_id: string }>) || [])
          .map((r) => r.set_id)
          .filter((sid) => sid && isIdSafeForUrl(sid))
        for (const sid of setIds) {
          entries.push({
            loc: `${BASE}/set/${sid}`,
            lastmod: now,
            changefreq: 'weekly',
            priority: 0.7,
          })
        }
      } catch (err) {
        console.error('[sitemap] erro ao buscar sets:', err)
      }
    }
  }

  // Hubs de Pokemon (/pokemon/[name]) - somente no bloco 0
  if (chunkIndex === 0 && sb) {
    try {
      const slugs = await getPokemonSlugs(sb)
      for (const slug of slugs) {
        entries.push({
          loc: `${BASE}/pokemon/${slug}`,
          lastmod: now,
          changefreq: 'weekly',
          priority: 0.7,
        })
      }
    } catch (err) {
      console.error('[sitemap] erro ao buscar pokemon:', err)
    }
  }

  // Bloco de cartas deste chunk (paginado por range, ordenado por id)
  if (sb) {
    const from = chunkIndex * CARD_CHUNK
    const to = from + CARD_CHUNK - 1
    try {
      const { data: cartas, error: cartasErr } = await sb
        .from('pokemon_cards')
        .select('id, liga_updated_at')
        .neq('excluded_from_scan', true)
        .order('id', { ascending: true })
        .range(from, to)
      if (cartasErr) console.error('[sitemap] erro cartas:', cartasErr)
      for (const carta of cartas || []) {
        if (isIdSafeForUrl(carta.id)) {
          entries.push({
            loc: `${BASE}/carta/${carta.id}`,
            lastmod: carta.liga_updated_at
              ? new Date(carta.liga_updated_at).toISOString()
              : now,
            changefreq: 'weekly',
            priority: 0.5,
          })
        }
      }
    } catch (err) {
      console.error('[sitemap] erro ao buscar cartas:', err)
    }
  }

  return new Response(urlsetXml(entries), { headers: SITEMAP_HEADERS })
}
