import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Núcleo do sitemap da Bynx (S41).
 *
 * Substitui o antigo app/sitemap.ts (arquivo único) que batia no teto de
 * 50.000 URLs do protocolo Sitemap E no max_rows do Supabase — deixando
 * ~20 mil cartas de fora.
 *
 * Agora o sitemap é dividido:
 *   - /sitemap.xml         -> ÍNDICE (sitemapindex) — alvo do robots.txt
 *   - /sitemap/0.xml       -> estáticas + lojas + sets + 1o bloco de cartas
 *   - /sitemap/1.xml, ...  -> blocos seguintes de cartas
 *
 * Cada bloco de cartas tem no máximo CARD_CHUNK URLs, com folga sob os 50k.
 */

export const BASE = 'https://bynx.gg'

// URLs de cartas por bloco. Reduzido de 40k -> 10k (S45): blocos grandes
// estouravam o timeout da funcao Vercel na geracao (o bloco 0 chegava a ~42k
// URLs), e o Google reportava "nao foi possivel buscar o sitemap". Blocos
// menores (~7 no total) geram rapido e sao buscados sem timeout.
export const CARD_CHUNK = 10000

// ─── Rotas estáticas públicas (mesma curadoria do antigo sitemap.ts) ──────────
export type StaticRoute = {
  path: string
  changeFrequency: string
  priority: number
}

export const STATIC_ROUTES: StaticRoute[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/pokedex', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/pokemon', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/marketplace', changeFrequency: 'daily', priority: 0.9 },
  { path: '/lojas', changeFrequency: 'daily', priority: 0.85 },
  { path: '/para-lojistas', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/separadores-pokemon', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/colecionadores', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/pokedex-pokemon-tcg', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/scan-ia', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/sobre', changeFrequency: 'monthly', priority: 0.6 },
]

// ─── Helper: ID de carta seguro pra URL ───────────────────────────────────────
// Filtra cartas com chars problemáticos (% encoded, espaços, parênteses)
// que gerariam URLs quebradas. ~16 cartas malformadas no banco.
export const isIdSafeForUrl = (id: string | null | undefined): id is string =>
  !!id && !/[%(),\s]/.test(id)

// ─── XML escaping ─────────────────────────────────────────────────────────────
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function fmtPriority(p: number): string {
  return Number.isInteger(p) ? p.toFixed(1) : String(p)
}

// ─── Supabase client (anon, leitura pública) ──────────────────────────────────
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// ─── Tipos / builders de XML ──────────────────────────────────────────────────
export type UrlEntry = {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: number
}

export function urlsetXml(entries: UrlEntry[]): string {
  const body = entries
    .map((e) => {
      const parts = [`    <loc>${xmlEscape(e.loc)}</loc>`]
      if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`)
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`)
      if (typeof e.priority === 'number') {
        parts.push(`    <priority>${fmtPriority(e.priority)}</priority>`)
      }
      return `  <url>\n${parts.join('\n')}\n  </url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`
}

export function sitemapIndexXml(items: { loc: string; lastmod?: string }[]): string {
  const body = items
    .map((s) => {
      const parts = [`    <loc>${xmlEscape(s.loc)}</loc>`]
      if (s.lastmod) parts.push(`    <lastmod>${s.lastmod}</lastmod>`)
      return `  <sitemap>\n${parts.join('\n')}\n  </sitemap>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`
}

// ─── Contagem de cartas elegíveis (pra calcular nº de blocos) ─────────────────
export async function countEligibleCards(sb: SupabaseClient): Promise<number> {
  const { count, error } = await sb
    .from('pokemon_cards')
    .select('id', { count: 'exact', head: true })
    .neq('excluded_from_scan', true)
    .neq('is_canary', true)
  if (error) {
    console.error('[sitemap] erro ao contar cartas:', error)
    return 0
  }
  return count || 0
}

export function cardChunkCount(total: number): number {
  return Math.max(1, Math.ceil(total / CARD_CHUNK))
}

// ─── Cache headers padrão (24h no CDN, revalidação em background) ─────────────
export const SITEMAP_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=43200',
}

// --- Slugs de Pokemon (hubs /pokemon/[name]) ---
export async function getPokemonSlugs(sb: SupabaseClient): Promise<string[]> {
  const { data, error } = await sb
    .from('pokemon_pokedex')
    .select('slug')
    .order('cards_count', { ascending: false })
    .limit(2000)
  if (error) {
    console.error('[sitemap] erro ao buscar slugs de pokemon:', error)
    return []
  }
  return (data || [])
    .map((r: { slug: string }) => r.slug)
    .filter((x): x is string => !!x)
}
