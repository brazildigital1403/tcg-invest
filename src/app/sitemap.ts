import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

/**
 * Sitemap dinâmico do Next 13+.
 *
 * - Substitui o /public/sitemap.xml estático
 * - Lista páginas estáticas + lojas ativas + cartas individuais + SETS
 * - Revalida a cada 24h (1x/dia) — equilíbrio fresh vs custo
 *
 * Acessível em: https://bynx.gg/sitemap.xml
 *
 * S38: adicionadas páginas de set (~312 URLs). Cada set vira página
 * SEO-rica que ranqueia long-tail PT-BR ("destinos de paldea",
 * "fenda paradoxal cartas", "coroa estelar lista", etc).
 */

// Regenera o sitemap 1x/dia (86400s). Sem isso, o sitemap fica cacheado
// no build e novas lojas/cartas só aparecem após próximo deploy.
export const revalidate = 86400

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
    // "organizar coleção pokemon". Pokédex de 24.000+ cartas, 1.025 Pokémons,
    // preços em reais. CTAs apontam pra cadastro com next=/minha-colecao.
    url: `${BASE}/colecionadores`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.85,
  },
  {
    // Landing SEO/Ads — Pokédex Pokémon TCG. Captura keyword exata
    // "pokédex pokemon tcg" no domínio.
    url: `${BASE}/pokedex-pokemon-tcg`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.85,
  },
  {
    // Landing SEO/Ads — Scan IA Pokémon TCG.
    url: `${BASE}/scan-ia`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.85,
  },
  {
    // Página de produto pago (gerador interno de Separadores).
    url: `${BASE}/separadores`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.8,
  },
  {
    // Ranking público de Indique e Ganhe. Atualizado mensalmente.
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

  // ─── Sets (S38) ────────────────────────────────────────────────────────────
  // Páginas de set são SEO-rich (long-tail PT-BR como "destinos de paldea",
  // "coroa estelar", "fenda paradoxal"). Cobre ambos:
  //  - Sets oficiais Pokemon TCG (em pokemon_sets, 243 rows)
  //  - Sets Liga-only (em pokemon_cards com set_name "Liga BR — XXX")
  // União dos set_id distintos.
  try {
    const { data: setsRows } = await sb
      .from('pokemon_cards')
      .select('set_id')
      .not('set_id', 'is', null)
      .limit(50000)

    const uniqueSetIds = Array.from(
      new Set(
        (setsRows || [])
          .map((r) => r.set_id as string)
          .filter((id) => id && isIdSafeForUrl(id)),
      ),
    )

    for (const setId of uniqueSetIds) {
      dynamicRoutes.push({
        url: `${BASE}/set/${setId}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }
  } catch (err) {
    console.error('[sitemap] erro ao buscar sets dinâmicos:', err)
  }

  // ─── Cartas individuais ────────────────────────────────────────────────────
  // 24.472 cartas no banco (S38). Cada carta = página long-tail rica (preços,
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
