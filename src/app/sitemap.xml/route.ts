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

  // O indice anuncia um bloco por CARD_CHUNK cartas elegiveis.
  //
  // Historico que vale lembrar antes de mexer aqui: ate 28/07/2026 a contagem
  // estourava o statement_timeout e o codigo respondia `return 0`, entao isto
  // anunciava UM bloco — o Google enxergava so as 10.000 primeiras cartas.
  // Consertada a contagem, passou a anunciar sete, e o crawler encontrou as
  // 66.890 paginas de carta. Como /carta/[id] era rota DINAMICA sem cache,
  // cada visita acordava uma lambda e batia no banco: o pool esgotou e
  // derrubou o site (incidente de 29/07).
  //
  // Voltou ao numero real depois que as tres rotas de conteudo ganharam
  // `generateStaticParams` e passaram a servir do CDN. A licao nao e "sitemap
  // pequeno e mais seguro" — e que anunciar URL so e seguro quando a rota
  // correspondente aguenta ser varrida.
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
