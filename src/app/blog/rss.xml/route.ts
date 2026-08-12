import { fetchLatestPublishedPosts } from '@/lib/blog'
import { xmlEscape, SITEMAP_HEADERS } from '@/lib/sitemap-core'

export const revalidate = 3600

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function GET() {
  const posts = await fetchLatestPublishedPosts(20)
  const now = new Date().toUTCString()

  const items = posts
    .map((p) => {
      const link = `https://bynx.gg/blog/${p.slug}`
      const desc = p.excerpt || stripHtml(p.content.find((b) => b.type === 'paragraph')?.html || '').slice(0, 300)
      return `  <item>
    <title>${xmlEscape(p.title)}</title>
    <link>${xmlEscape(link)}</link>
    <guid isPermaLink="true">${xmlEscape(link)}</guid>
    <pubDate>${p.published_at ? new Date(p.published_at).toUTCString() : now}</pubDate>
    <description>${xmlEscape(desc)}</description>
  </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Blog Bynx</title>
    <link>https://bynx.gg/blog</link>
    <description>Cartas, sets, mercado e coleção — tudo sobre Pokémon TCG no Brasil.</description>
    <language>pt-BR</language>
    <lastBuildDate>${now}</lastBuildDate>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: { ...SITEMAP_HEADERS, 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
