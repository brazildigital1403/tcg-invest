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
// Blocos podem gerar milhares de URLs; da folga alem do timeout padrao.
export const maxDuration = 60

export async function GET() {
  const now = new Date().toISOString()
  const sb = getSupabase()

  // ─── CONTENCAO TEMPORARIA — incidente de 29/07/2026 ───────────────────────
  //
  // Ate 28/07 a contagem de cartas estourava o statement_timeout e o codigo
  // respondia `return 0`, entao este indice anunciava UM bloco. Consertar isso
  // fez ele anunciar SETE — correto, mas convidou o crawler pras 66.890
  // paginas de carta, que sao rotas DINAMICAS e sem cache. Cada visita acorda
  // uma lambda e bate no banco; o pool de conexao esgotou e derrubou o site.
  //
  // Enquanto /carta/[id] nao for cacheavel, o indice fica limitado. Nao
  // resolve sozinho — cada bloco ainda tem CARD_CHUNK (10.000) URLs —, mas
  // reduz a superficie em ~6,7x.
  //
  // REMOVER assim que a rota de carta sair de dinamica. Sem isso, o Google
  // enxerga so as 10.000 primeiras cartas do catalogo.
  const TETO_DE_BLOCOS = 1

  let chunks = 1
  if (sb) {
    const total = await countEligibleCards(sb)
    chunks = Math.min(cardChunkCount(total), TETO_DE_BLOCOS)
  }

  const items = Array.from({ length: chunks }, (_, i) => ({
    loc: `${BASE}/sitemap/${i}.xml`,
    lastmod: now,
  }))

  return new Response(sitemapIndexXml(items), { headers: SITEMAP_HEADERS })
}
