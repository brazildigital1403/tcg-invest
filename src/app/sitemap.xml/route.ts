import {
  BASE,
  SITEMAP_HEADERS,
  cardChunkCount,
  countEligibleCards,
  getSupabase,
  sitemapIndexXml,
} from '@/lib/sitemap-core'

/**
 * ÍNDICE do sitemap — servido em /sitemap.xml (alvo do robots.txt).
 *
 * Lista cada bloco /sitemap/{i}.xml. O nº de blocos é calculado pela
 * contagem real de cartas elegíveis, então escala sozinho com o catálogo.
 */
export const revalidate = 86400

export async function GET() {
  const now = new Date().toISOString()
  const sb = getSupabase()

  let chunks = 1
  if (sb) {
    const total = await countEligibleCards(sb)
    chunks = cardChunkCount(total)
  }

  const items = Array.from({ length: chunks }, (_, i) => ({
    loc: `${BASE}/sitemap/${i}.xml`,
    lastmod: now,
  }))

  return new Response(sitemapIndexXml(items), { headers: SITEMAP_HEADERS })
}
