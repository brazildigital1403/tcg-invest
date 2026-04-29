import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

/**
 * Sitemap dinâmico do Next 13+.
 *
 * - Substitui o /public/sitemap.xml estático
 * - Lista páginas estáticas + lojas ativas dinamicamente do Supabase
 * - É regenerado a cada build (ou no run-time, dependendo da config)
 *
 * Acessível em: https://bynx.gg/sitemap.xml
 */

const BASE = 'https://bynx.gg'

// ─── Páginas estáticas públicas ──────────────────────────────────────────────

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  {
    url: `${BASE}/`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 1.0,
  },
  {
    url: `${BASE}/pokedex`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.9,
  },
  {
    url: `${BASE}/marketplace`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.9,
  },
  {
    url: `${BASE}/lojas`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.85,
  },
  {
    url: `${BASE}/login`,
    lastModified: new Date(),
    changeFrequency: 'yearly',
    priority: 0.3,
  },
  {
    url: `${BASE}/cadastro`,
    lastModified: new Date(),
    changeFrequency: 'yearly',
    priority: 0.4,
  },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dynamicRoutes: MetadataRoute.Sitemap = []

  // ─── Lojas ativas ───────────────────────────────────────────────────────────
  // Tenta buscar lojas do Supabase. Se falhar (ex: env vars no build), apenas
  // não inclui — o sitemap continua com as rotas estáticas.
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseAnon) {
      const sb = createClient(supabaseUrl, supabaseAnon)
      const { data: lojas } = await sb
        .from('lojas')
        .select('slug, updated_at')
        .eq('status', 'ativa')
        .limit(1000)

      for (const loja of lojas || []) {
        if (loja.slug) {
          dynamicRoutes.push({
            url: `${BASE}/lojas/${loja.slug}`,
            lastModified: loja.updated_at ? new Date(loja.updated_at) : new Date(),
            changeFrequency: 'weekly',
            priority: 0.6,
          })
        }
      }
    }
  } catch (err) {
    // Falha silenciosa: sitemap continua com rotas estáticas
    console.error('[sitemap] erro ao buscar lojas dinâmicas:', err)
  }

  return [...STATIC_ROUTES, ...dynamicRoutes]
}
