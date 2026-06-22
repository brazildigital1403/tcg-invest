/**
 * src/app/set/page.tsx
 *
 * HUB / ÍNDICE de todos os sets Pokémon TCG (S38: SEO Fase 3).
 *
 * SERVER COMPONENT — renderiza a lista completa de 308 sets agrupados
 * por série (Scarlet & Violet, Sword & Shield, Sun & Moon, etc.) com
 * cards clicáveis pra /set/[id].
 *
 * Por que essa página é CRÍTICA pro SEO:
 * 1. Internal linking massivo (308 links internos → distribui PageRank)
 * 2. Hub rankeia keywords genéricas: "sets pokemon tcg", "lista
 *    expansões pokemon", "todas coleções pokemon TCG brasil"
 * 3. Acelera crawling: Googlebot acessa 1 URL e descobre as 308 outras
 * 4. UX: user explora visualmente toda a biblioteca
 *
 * Cobre AMBOS os tipos:
 * - Sets oficiais: com series, logo, release_date, name_pt
 * - Sets especiais/Liga-only: agrupados em "Coleções Especiais & Promos"
 */

import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import PublicFooter from '@/components/ui/PublicFooter'

// ISR: regenera a cada 1h. Como o catálogo cresce (scan contínuo), os agregados
// do topo (sets/cartas/valor) precisam refletir mudanças sem esperar 24h.
export const revalidate = 3600

// ─── Tipos ─────────────────────────────────────────────────────────────────

type SetSummary = {
  id: string
  name: string
  namePt: string | null
  series: string
  releaseYear: string | null
  releaseDate: string | null
  printedTotal: number | null
  logoUrl: string | null
  isLigaOnly: boolean
  cardsCount: number
  totalValueBrl: number
}

type SeriesGroup = {
  series: string
  seriesPt: string // versão amigável em PT-BR pro título
  sets: SetSummary[]
  totalCards: number
  totalValueBrl: number
  latestRelease: string | null
}

// Mapeamento PT-BR pra cabeçalho das séries
// (pra SEO direcionado a buscas brasileiras)
const SERIES_PT: Record<string, string> = {
  'Mega Evolution': 'Mega Evolução',
  'Scarlet & Violet': 'Scarlet & Violet (Escarlate & Violeta)',
  'Sword & Shield': 'Sword & Shield (Espada & Escudo)',
  'Sun & Moon': 'Sun & Moon (Sol & Lua)',
  XY: 'XY',
  'Black & White': 'Black & White',
  'HeartGold & SoulSilver': 'HeartGold & SoulSilver',
  Platinum: 'Platinum',
  POP: 'POP Series',
  'Diamond & Pearl': 'Diamond & Pearl',
  EX: 'EX Series',
  Base: 'Base Set (Clássicos 1999-2000)',
  Neo: 'Neo (Clássicos 2000-2002)',
  Gym: 'Gym (Clássicos)',
  'E-Card': 'E-Card (Clássicos)',
  NP: 'NP Series',
  WCD: 'World Championship Decks',
  Other: 'Outras Edições',
  Especiais: 'Coleções Especiais & Promos',
}

// ─── Fetch ─────────────────────────────────────────────────────────────────

// Chama a RPC de stats com algumas tentativas. O supabase-js devolve falha de
// rede em `error` (ex.: "TypeError: fetch failed") — como e transitoria, uma
// nova tentativa quase sempre passa. Evita derrubar build/runtime por blip.
async function fetchStatsWithRetry(
  sb: ReturnType<typeof createClient>,
  attempts = 3,
): Promise<any[]> {
  let lastErr: string | null = null
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await sb.rpc('set_index_stats')
    if (!error && data != null) return data as any[]
    lastErr = error?.message ?? 'retorno nulo'
    if (i < attempts - 1) {
      // backoff curto: 0.8s, 1.6s
      await new Promise((r) => setTimeout(r, 800 * (i + 1)))
    }
  }
  throw new Error(`set_index_stats indisponivel: ${lastErr}`)
}

async function fetchAllSets(): Promise<SeriesGroup[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) {
    // Sem credenciais nao da pra montar a pagina — falhar alto em vez de servir vazio
    throw new Error('Supabase env vars ausentes em /set')
  }
  const sb = createClient(supabaseUrl, supabaseAnon)

  // 1. Sets oficiais (com row em pokemon_sets)
  const { data: officialSets } = await sb
    .from('pokemon_sets')
    .select(
      'id, name, name_pt, series, release_date, printed_total, logo_url',
    )
    .order('release_date', { ascending: false, nullsFirst: false })

  // 2. Stats por set_id agregados NO BANCO (RPC) — sem cap de linhas, escala com o catálogo.
  //    Com retry pra absorver blip de rede do fetch ("TypeError: fetch failed").
  let cardStats: any[]
  try {
    cardStats = await fetchStatsWithRetry(sb)
  } catch (err) {
    // Em BUILD-TIME (prerender): NAO derrubar o deploy inteiro por uma falha de
    // rede transitoria. Renderiza fallback vazio; o ISR (revalidate) reconstroi
    // a pagina cheia na primeira regeneracao. Em RUNTIME: relanca pra manter a
    // ultima versao boa no cache (stale-while-revalidate, nunca cacheia vazio).
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      console.error('[/set] build: set_index_stats indisponivel, fallback vazio:', err)
      return []
    }
    throw err
  }

  const statsBySetId = new Map<
    string,
    { cardsCount: number; totalValueBrl: number; firstSetName?: string }
  >()
  for (const c of (cardStats as any[]) || []) {
    statsBySetId.set(c.set_id as string, {
      cardsCount: Number(c.cards_count) || 0,
      totalValueBrl: Number(c.total_value_brl) || 0,
      firstSetName: (c.sample_set_name as string | null) || undefined,
    })
  }

  // 3. Mapa de officialSet por id pra lookup O(1)
  const officialBySetId = new Map<string, any>()
  for (const s of officialSets || []) {
    officialBySetId.set(s.id as string, s)
  }

  // 4. Constrói SetSummary[] mesclando os dois
  const allSummaries: SetSummary[] = []
  for (const [setId, stats] of statsBySetId.entries()) {
    if (stats.cardsCount === 0) continue
    const official = officialBySetId.get(setId)

    if (official) {
      // Set oficial
      allSummaries.push({
        id: setId,
        name: official.name,
        namePt: official.name_pt,
        series:
          official.series === 'Liga BR'
            ? 'Especiais'
            : official.series || 'Other',
        releaseYear: official.release_date
          ? String(official.release_date).slice(0, 4)
          : null,
        releaseDate: official.release_date || null,
        printedTotal: official.printed_total,
        logoUrl: official.logo_url,
        isLigaOnly: false,
        cardsCount: stats.cardsCount,
        totalValueBrl: stats.totalValueBrl,
      })
    } else {
      // Sem row em pokemon_sets = coleção especial / Liga-only
      const cleanName =
        stats.firstSetName && !stats.firstSetName.startsWith('Liga BR')
          ? stats.firstSetName
          : `Set ${setId.toUpperCase()}`
      allSummaries.push({
        id: setId,
        name: cleanName,
        namePt: null,
        series: 'Especiais',
        releaseYear: null,
        releaseDate: null,
        printedTotal: null,
        logoUrl: null,
        isLigaOnly: true,
        cardsCount: stats.cardsCount,
        totalValueBrl: stats.totalValueBrl,
      })
    }
  }

  // 5. Agrupa por série
  const groupsMap = new Map<string, SeriesGroup>()
  for (const s of allSummaries) {
    if (!groupsMap.has(s.series)) {
      groupsMap.set(s.series, {
        series: s.series,
        seriesPt: SERIES_PT[s.series] || s.series,
        sets: [],
        totalCards: 0,
        totalValueBrl: 0,
        latestRelease: null,
      })
    }
    const grp = groupsMap.get(s.series)!
    grp.sets.push(s)
    grp.totalCards += s.cardsCount
    grp.totalValueBrl += s.totalValueBrl
    if (
      s.releaseDate &&
      (!grp.latestRelease || s.releaseDate > grp.latestRelease)
    ) {
      grp.latestRelease = s.releaseDate
    }
  }

  // 6. Sort sets dentro de cada grupo (mais recentes primeiro)
  for (const grp of groupsMap.values()) {
    grp.sets.sort((a, b) => {
      if (!a.releaseDate && !b.releaseDate) return 0
      if (!a.releaseDate) return 1
      if (!b.releaseDate) return -1
      return b.releaseDate.localeCompare(a.releaseDate)
    })
  }

  // 7. Sort grupos: Especiais sempre no final, resto por release mais recente
  const groups = Array.from(groupsMap.values()).sort((a, b) => {
    if (a.series === 'Especiais') return 1
    if (b.series === 'Especiais') return -1
    if (!a.latestRelease && !b.latestRelease) return 0
    if (!a.latestRelease) return 1
    if (!b.latestRelease) return -1
    return b.latestRelease.localeCompare(a.latestRelease)
  })

  return groups
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const formatBRL = (v: number) =>
  `R$ ${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

const formatNumber = (v: number) =>
  v.toLocaleString('pt-BR')

// ─── generateMetadata ──────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  // Stats globais pro título dinâmico
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  let totalSets = 690
  let totalCards = 54000

  if (supabaseUrl && supabaseAnon) {
    try {
      const sb = createClient(supabaseUrl, supabaseAnon)
      const { data: stats } = await sb.rpc('set_index_stats')
      const rows = (stats as any[]) || []
      if (rows.length) {
        totalSets = rows.length
        totalCards = rows.reduce((s, r) => s + (Number(r.cards_count) || 0), 0)
      }
    } catch {
      // fallback nos defaults
    }
  }

  const title = `Pokédex de Sets Pokémon TCG — ${totalSets}+ coleções catalogadas`
  const description = `Explore todas as ${totalSets}+ coleções Pokémon TCG (sets) catalogadas no Bynx. ${formatNumber(totalCards)}+ cartas individuais, preços em reais por variante, agrupadas por série: Scarlet & Violet, Sword & Shield, Sun & Moon, XY, Black & White, Sun & Moon, Base Set e mais.`

  return {
    title,
    description,
    alternates: { canonical: 'https://bynx.gg/set' },
    openGraph: {
      title: `${title} | Bynx`,
      description,
      url: 'https://bynx.gg/set',
      type: 'website',
      siteName: 'Bynx',
      locale: 'pt_BR',
      images: [
        {
          url: 'https://bynx.gg/og-image.jpg',
          width: 1200,
          height: 630,
          alt: 'Bynx — Pokédex de Sets Pokémon TCG',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@bynxgg',
      title: `${title} | Bynx`,
      description,
    },
    keywords: [
      'sets pokemon tcg',
      'expansões pokemon',
      'coleções pokemon tcg',
      'lista sets pokemon',
      'scarlet violet sets',
      'sword shield sets',
      'sun moon pokemon',
      'todas coleções pokemon tcg brasil',
      'pokémon estampas ilustradas coleções',
    ],
  }
}

// ─── Page Component ────────────────────────────────────────────────────────

export default async function SetIndexPage() {
  const groups = await fetchAllSets()

  // Stats globais
  const totalSets = groups.reduce((sum, g) => sum + g.sets.length, 0)
  const totalCards = groups.reduce((sum, g) => sum + g.totalCards, 0)
  const totalValue = groups.reduce((sum, g) => sum + g.totalValueBrl, 0)
  const totalSeries = groups.length

  // ─── Schema.org CollectionPage + ItemList ─────────────────────────────
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Pokédex de Sets Pokémon TCG',
    description: `${totalSets} coleções Pokémon TCG catalogadas no Bynx`,
    url: 'https://bynx.gg/set',
    inLanguage: 'pt-BR',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: totalSets,
      // Top 30 sets pra rich snippet (não sobrecarregar JSON-LD)
      itemListElement: groups
        .flatMap((g) => g.sets)
        .slice(0, 30)
        .map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `https://bynx.gg/set/${s.id}`,
          name: s.namePt || s.name,
        })),
    },
  }

  // BreadcrumbList
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Início',
        item: 'https://bynx.gg',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Sets',
        item: 'https://bynx.gg/set',
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div
        style={{
          minHeight: '100vh',
          background: '#080a0f',
          color: '#f0f0f0',
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <header className="bx-gutter"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(8,10,15,0.95)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <Link href="/" style={{ textDecoration: 'none' }}>
            <img
              src="/logo_BYNX.png"
              alt="Bynx"
              style={{ height: 30, width: 'auto', objectFit: 'contain' }}
            />
          </Link>
          <Link
            href="/pokedex"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              color: '#000',
              padding: '8px 18px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            Ver Pokédex
          </Link>
        </header>

        <main className="bx-gutter" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px 80px' }}>
          {/* Hero */}
          <div
            style={{
              textAlign: 'center',
              marginBottom: 48,
              paddingBottom: 32,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <p
              style={{
                fontSize: 12,
                color: '#f59e0b',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                marginBottom: 12,
                fontWeight: 700,
              }}
            >
              Pokédex de Sets
            </p>
            <h1
              style={{
                fontSize: 48,
                fontWeight: 900,
                letterSpacing: '-0.04em',
                marginBottom: 12,
                lineHeight: 1.05,
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Todos os Sets Pokémon TCG
            </h1>
            <p
              style={{
                fontSize: 16,
                color: 'rgba(255,255,255,0.5)',
                maxWidth: 720,
                margin: '0 auto 32px',
                lineHeight: 1.5,
              }}
            >
              {totalSets} coleções catalogadas em {totalSeries} séries — desde
              o Base Set de 1999 até as expansões mais recentes de{' '}
              {new Date().getFullYear()}. Preços em reais por carta e variante.
            </p>

            {/* Stats em destaque */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
                maxWidth: 760,
                margin: '0 auto',
              }}
            >
              {[
                { label: 'Sets', value: formatNumber(totalSets), color: '#f59e0b' },
                {
                  label: 'Cartas',
                  value: formatNumber(totalCards),
                  color: '#60a5fa',
                },
                {
                  label: 'Séries',
                  value: String(totalSeries),
                  color: '#22c55e',
                },
                {
                  label: 'Valor catalogado',
                  value: formatBRL(totalValue),
                  color: '#a855f7',
                },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    padding: '16px 12px',
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.4)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: 6,
                      fontWeight: 700,
                    }}
                  >
                    {s.label}
                  </p>
                  <p
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      color: s.color,
                      letterSpacing: '-0.02em',
                      lineHeight: 1,
                    }}
                  >
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Séries */}
          {groups.map((grp) => (
            <section key={grp.series} style={{ marginBottom: 48 }}>
              {/* Header da série */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 20,
                  paddingBottom: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <h2
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                  }}
                >
                  {grp.seriesPt}
                </h2>
                <p
                  style={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.45)',
                  }}
                >
                  {grp.sets.length} sets ·{' '}
                  {formatNumber(grp.totalCards)} cartas
                  {grp.totalValueBrl > 0
                    ? ` · ${formatBRL(grp.totalValueBrl)}`
                    : ''}
                </p>
              </div>

              {/* Grid de sets */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 14,
                }}
              >
                {grp.sets.map((set) => (
                  <Link
                    key={set.id}
                    href={`/set/${set.id}`}
                    style={{
                      textDecoration: 'none',
                      color: 'inherit',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      transition:
                        'transform 0.15s ease, border-color 0.15s ease, background 0.15s ease',
                    }}
                  >
                    {/* Logo (ou placeholder) */}
                    <div
                      style={{
                        height: 60,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 4,
                      }}
                    >
                      {set.logoUrl ? (
                        <img
                          src={set.logoUrl}
                          alt={'Logo do set ' + (set.namePt || set.name)}
                          loading="lazy"
                          style={{
                            maxHeight: 60,
                            maxWidth: '100%',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 0 12px rgba(245,158,11,0.15))',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            fontSize: 28,
                            opacity: 0.3,
                          }}
                        >
                          🃏
                        </div>
                      )}
                    </div>

                    {/* Nome em PT-BR (destaque) */}
                    <p
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        lineHeight: 1.2,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {set.namePt || set.name}
                    </p>

                    {/* Nome em EN (quando tem PT) */}
                    {set.namePt && (
                      <p
                        style={{
                          fontSize: 12,
                          color: 'rgba(255,255,255,0.4)',
                          marginTop: -4,
                        }}
                      >
                        {set.name}
                      </p>
                    )}

                    {/* Metadata */}
                    <p
                      style={{
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.45)',
                        marginTop: 4,
                      }}
                    >
                      {set.cardsCount} cartas
                      {set.releaseYear ? ` · ${set.releaseYear}` : ''}
                    </p>

                    {/* Valor catalogado (quando >0) */}
                    {set.totalValueBrl > 0 && (
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#60a5fa',
                          marginTop: 2,
                        }}
                      >
                        {formatBRL(set.totalValueBrl)}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          ))}

          {/* CTA footer */}
          <div
            style={{
              textAlign: 'center',
              paddingTop: 48,
              marginTop: 32,
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <p
              style={{
                fontSize: 15,
                color: 'rgba(255,255,255,0.5)',
                marginBottom: 6,
              }}
            >
              Tem cartas dessas coleções?
            </p>
            <p
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.35)',
                marginBottom: 18,
              }}
            >
              Crie sua conta grátis e organize sua coleção como portfólio
              financeiro
            </p>
            <Link
              href="/"
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                color: '#000',
                padding: '14px 32px',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 15,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Começar agora no Bynx →
            </Link>
          </div>
        </main>
        <PublicFooter />
      </div>
    </>
  )
}