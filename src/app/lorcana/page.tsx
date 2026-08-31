/**
 * src/app/lorcana/page.tsx
 *
 * HUB / ÍNDICE de todos os sets de Disney Lorcana (F2 do contexto Lorcana).
 *
 * SERVER COMPONENT — espelho fiel de src/app/set/page.tsx (hub Pokémon),
 * adaptado: queries com game='lorcana', sem name_pt (Lorcana não tem PT),
 * sem valor catalogado (preços chegam na F3 — o slot vira "em breve").
 *
 * Enquanto o contexto está em beta fechado, TODAS as páginas são noindex
 * (a remoção é decisão da F7, junto do bloco próprio de sitemap).
 */

import type { Metadata } from 'next'
import { cache } from 'react'
import { getServiceSupabase } from '@/lib/supabaseServer'
import Link from 'next/link'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import { IconCollection } from '@/components/ui/Icons'

// ISR: regenera a cada 1h (mesmo ritmo do hub Pokémon).
export const revalidate = 3600

// ─── Tipos ─────────────────────────────────────────────────────────────────

type SetSummary = {
  id: string
  name: string
  series: string
  releaseYear: string | null
  releaseDate: string | null
  printedTotal: number | null
  logoUrl: string | null
  cardsCount: number
}

type SeriesGroup = {
  series: string
  sets: SetSummary[]
  totalCards: number
  latestRelease: string | null
}

// ─── Fetch ─────────────────────────────────────────────────────────────────

/**
 * Mesma razão do cache() no hub Pokémon: generateMetadata e a page consomem
 * o mesmo dado, e RPC/POST do supabase-js não entra na dedup de fetch do
 * Next. cache() memoiza dentro do mesmo request.
 */
const fetchAllSets = cache(async (): Promise<SeriesGroup[]> => {
  const sb = getServiceSupabase()
  if (!sb) {
    // Sem credenciais não dá pra montar a página — falhar alto em vez de servir vazio
    throw new Error('Supabase indisponivel em /lorcana')
  }

  // As duas queries não dependem uma da outra — em série eram dois RTTs
  // empilhados pra Supabase sa-east-1.
  const [setsRes, countsRes] = await Promise.all([
    sb
      .from('pokemon_sets')
      .select('id, name, series, release_date, printed_total, logo_url')
      .eq('game', 'lorcana')
      .order('release_date', { ascending: false, nullsFirst: false }),
    sb.from('pokemon_cards').select('set_id').eq('game', 'lorcana'),
  ])
  if (setsRes.error) throw new Error(setsRes.error.message)
  if (countsRes.error) throw new Error(countsRes.error.message)

  const porSet = new Map<string, number>()
  for (const c of countsRes.data ?? []) {
    porSet.set(c.set_id as string, (porSet.get(c.set_id as string) ?? 0) + 1)
  }

  const allSummaries: SetSummary[] = (setsRes.data ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    series: s.series || 'Disney Lorcana',
    releaseYear: s.release_date ? String(s.release_date).slice(0, 4) : null,
    releaseDate: s.release_date || null,
    printedTotal: s.printed_total,
    logoUrl: s.logo_url,
    cardsCount: porSet.get(s.id as string) ?? 0,
  }))

  // Agrupa por série (Lorcana hoje cabe numa série só; a estrutura fica
  // pronta pra quando a Ravensburger abrir mais linhas)
  const groupsMap = new Map<string, SeriesGroup>()
  for (const s of allSummaries) {
    if (!groupsMap.has(s.series)) {
      groupsMap.set(s.series, {
        series: s.series,
        sets: [],
        totalCards: 0,
        latestRelease: null,
      })
    }
    const grp = groupsMap.get(s.series)!
    grp.sets.push(s)
    grp.totalCards += s.cardsCount
    if (
      s.releaseDate &&
      (!grp.latestRelease || s.releaseDate > grp.latestRelease)
    ) {
      grp.latestRelease = s.releaseDate
    }
  }

  // Sort sets dentro de cada grupo (mais recentes primeiro)
  for (const grp of groupsMap.values()) {
    grp.sets.sort((a, b) => {
      if (!a.releaseDate && !b.releaseDate) return 0
      if (!a.releaseDate) return 1
      if (!b.releaseDate) return -1
      return b.releaseDate.localeCompare(a.releaseDate)
    })
  }

  // Sort grupos por release mais recente
  const groups = Array.from(groupsMap.values()).sort((a, b) => {
    if (!a.latestRelease && !b.latestRelease) return 0
    if (!a.latestRelease) return 1
    if (!b.latestRelease) return -1
    return b.latestRelease.localeCompare(a.latestRelease)
  })

  return groups
})

// ─── Helpers ───────────────────────────────────────────────────────────────

const formatNumber = (v: number) => v.toLocaleString('pt-BR')

// ─── generateMetadata ──────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  let totalSets = 0
  let totalCards = 0
  try {
    // Mesma promise que a page vai consumir — não é uma segunda ida ao banco.
    const groups = await fetchAllSets()
    totalSets = groups.reduce((sum, g) => sum + g.sets.length, 0)
    totalCards = groups.reduce((sum, g) => sum + g.totalCards, 0)
  } catch {
    // fallback nos defaults
  }

  const title = totalSets
    ? `Sets de Disney Lorcana — ${totalSets} coleções catalogadas`
    : 'Sets de Disney Lorcana'
  const description = `Explore as coleções de Disney Lorcana catalogadas na Bynx${totalCards ? `: ${formatNumber(totalCards)}+ cartas individuais` : ''}. Preços em reais chegam em breve.`

  return {
    title,
    description,
    alternates: { canonical: 'https://bynx.gg/lorcana' },
    // noindex enquanto o contexto está em beta fechado (decisão da F7)
    robots: { index: false, follow: false },
    openGraph: {
      title: `${title} | Bynx`,
      description,
      url: 'https://bynx.gg/lorcana',
      type: 'website',
      siteName: 'Bynx',
      locale: 'pt_BR',
      images: [
        {
          url: 'https://bynx.gg/og-image.jpg',
          width: 1200,
          height: 630,
          alt: 'Bynx — Sets de Disney Lorcana',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@bynxgg',
      title: `${title} | Bynx`,
      description,
    },
  }
}

// ─── Page Component ────────────────────────────────────────────────────────

export default async function LorcanaHub() {
  const groups = await fetchAllSets()

  // Stats globais
  const totalSets = groups.reduce((sum, g) => sum + g.sets.length, 0)
  const totalCards = groups.reduce((sum, g) => sum + g.totalCards, 0)
  const totalSeries = groups.length

  // ─── Schema.org CollectionPage + ItemList ─────────────────────────────
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Sets de Disney Lorcana',
    description: `${totalSets} coleções de Disney Lorcana catalogadas na Bynx`,
    url: 'https://bynx.gg/lorcana',
    inLanguage: 'pt-BR',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: totalSets,
      itemListElement: groups
        .flatMap((g) => g.sets)
        .slice(0, 30)
        .map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `https://bynx.gg/lorcana/set/${s.id}`,
          name: s.name,
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
        name: 'Lorcana',
        item: 'https://bynx.gg/lorcana',
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
        <PublicHeader />

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
                color: 'var(--ac-1)',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                marginBottom: 12,
                fontWeight: 700,
              }}
            >
              Bynx Lorcana
            </p>
            <h1
              style={{
                fontSize: 48,
                fontWeight: 900,
                letterSpacing: '-0.04em',
                marginBottom: 12,
                lineHeight: 1.05,
                background: 'var(--ac-grad)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Todos os Sets de Disney Lorcana
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
              {totalSets} {totalSets === 1 ? 'coleção catalogada' : 'coleções catalogadas'} —
              todas as cartas de Disney Lorcana organizadas por set.
              Preços em reais chegam em breve.
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
                { label: 'Sets', value: formatNumber(totalSets), color: 'var(--ac-1)' },
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
                  // Slot do "Valor catalogado" do hub Pokémon — Lorcana ainda
                  // não tem preço (F3), então o mesmo tile vira "em breve".
                  label: 'Mercado Brasileiro',
                  value: 'Em breve',
                  color: 'rgba(255,255,255,0.55)',
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
            <section
              key={grp.series}
              style={{
                marginBottom: 48,
                contentVisibility: 'auto',
                containIntrinsicSize: 'auto 1200px',
              }}
            >
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
                  {grp.series}
                </h2>
                <p
                  style={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.45)',
                  }}
                >
                  {grp.sets.length} sets ·{' '}
                  {formatNumber(grp.totalCards)} cartas
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
                    href={`/lorcana/set/${set.id}`}
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
                          alt={'Logo do set ' + set.name}
                          loading="lazy"
                          style={{
                            maxHeight: 60,
                            maxWidth: '100%',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 0 12px rgba(var(--ac-1-rgb),0.15))',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            fontSize: 28,
                            opacity: 0.3,
                          }}
                        >
                          <IconCollection size={30} color="rgba(255,255,255,0.3)" />
                        </div>
                      )}
                    </div>

                    {/* Nome */}
                    <p
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        lineHeight: 1.2,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {set.name}
                    </p>

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
                  </Link>
                ))}
              </div>
            </section>
          ))}

          {groups.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
              Catálogo em construção.
            </p>
          )}

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
                background: 'var(--ac-grad)',
                color: '#000',
                padding: '14px 32px',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 15,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Começar agora na Bynx →
            </Link>
          </div>
        </main>
        <PublicFooter />
      </div>
    </>
  )
}
