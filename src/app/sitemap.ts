import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

/**
 * Sitemap dinâmico do Next 13+.
 *
 * - Substitui o /public/sitemap.xml estático
 * - Lista páginas estáticas + lojas ativas + cartas individuais
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
    // Landing B2B — captação de lojistas. Conteúdo estável, muda por
    // reposicionamento de produto (não por dado dinâmico).
    url: `${BASE}/para-lojistas`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.85,
  },
  {
    // Landing SEO/Ads — Separadores Pokémon TCG. Página pública e
    // indexável focada em ranquear "separadores fichario pokemon" e
    // direcionar tráfego pago (Google Ads, Meta Ads). Funil: ver → cadastrar
    // → comprar produto avulso R$ 14,90.
    url: `${BASE}/separadores-pokemon`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.85,
  },
  {
    // Landing SEO/Ads — funil B2C pra colecionador BR. Apresenta o app
    // pra quem busca "colecionar pokemon brasil", "app coleção pokemon",
    // "organizar coleção pokemon". Pokédex de 22.861 cartas, 1.025 Pokémons,
    // preços em reais. CTAs apontam pra cadastro com next=/minha-colecao.
    url: `${BASE}/colecionadores`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.85,
  },
  {
    // Landing SEO/Ads — Pokédex Pokémon TCG. Captura keyword exata
    // "pokédex pokemon tcg" no domínio. Apresenta o catálogo de 22.861
    // cartas com comparativo competitivo, top sets, raridades, top cartas
    // valiosas em R$ e glossário do colecionador. Funil B2C: ver -> /pokedex
    // (consulta livre) -> cadastro -> coleção.
    url: `${BASE}/pokedex-pokemon-tcg`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.85,
  },
  {
    // Landing SEO/Ads — Scan IA Pokémon TCG. Captura keywords "scanner
    // carta pokemon", "identificar carta pokemon foto", "ia reconhecer
    // pokemon tcg". Posiciona o Bynx como solução brasileira inovadora
    // (Claude Opus 4.5, multi-card, multilíngue PT/EN/JP). Funil:
    // ver -> cadastro -> compra de pacote pré-pago de scans (R$ 5,90 / 14,90 / 34,90).
    url: `${BASE}/scan-ia`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.85,
  },
  {
    // Página de produto pago (gerador interno de Separadores). Renderiza
    // preview de 9 Pokémons + CTA mesmo deslogada — indexável, tipo App
    // Store listing.
    url: `${BASE}/separadores`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.8,
  },
  {
    // Ranking público de Indique e Ganhe. Atualizado mensalmente, mostra
    // top 20 indicadores com prêmios em R$ pros Top 3. Social proof do
    // programa de viralização. Pública pra qualquer visitante ver, sem
    // exigir login. Funil: ver ranking → "como participar?" → cadastro.
    url: `${BASE}/ranking`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.7,
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

// ─── Helper: ID de carta seguro pra URL ──────────────────────────────────────
// Filtra cartas com chars problemáticos (% encoded, espaços, parênteses)
// que gerariam URLs quebradas no sitemap. ~16 cartas malformadas no banco.
const isIdSafeForUrl = (id: string | null | undefined): id is string =>
  !!id && !/[%(),\s]/.test(id)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dynamicRoutes: MetadataRoute.Sitemap = []

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Se env vars indisponíveis no build, fallback silencioso (só estáticas)
  if (!supabaseUrl || !supabaseAnon) {
    console.warn('[sitemap] env vars Supabase ausentes — só rotas estáticas')
    return STATIC_ROUTES
  }

  const sb = createClient(supabaseUrl, supabaseAnon)

  // ─── Lojas ativas ──────────────────────────────────────────────────────────
  try {
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
  } catch (err) {
    console.error('[sitemap] erro ao buscar lojas dinâmicas:', err)
  }

  // ─── Cartas individuais ────────────────────────────────────────────────────
  // 22.983 cartas no banco. Cada carta = página long-tail rica (preços,
  // variantes, set, raridade). Maior win de SEO orgânico do Bynx.
  // Filtra IDs com chars problemáticos (~16 cartas malformadas).
  try {
    const { data: cartas } = await sb
      .from('pokemon_cards')
      .select('id, liga_updated_at')
      .neq('excluded_from_scan', true)
      .limit(50000)

    for (const carta of cartas || []) {
      if (isIdSafeForUrl(carta.id)) {
        dynamicRoutes.push({
          url: `${BASE}/carta/${carta.id}`,
          lastModified: carta.liga_updated_at
            ? new Date(carta.liga_updated_at)
            : new Date(),
          changeFrequency: 'weekly',
          priority: 0.5,
        })
      }
    }
  } catch (err) {
    console.error('[sitemap] erro ao buscar cartas dinâmicas:', err)
  }

  return [...STATIC_ROUTES, ...dynamicRoutes]
}