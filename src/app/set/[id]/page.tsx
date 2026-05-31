/**
 * src/app/set/[id]/page.tsx
 *
 * SERVER COMPONENT (S38: SEO Fase 2 — Páginas de Set).
 *
 * Cria uma página indexável por SET de Pokémon TCG. Cobre dois tipos:
 *  1. Sets oficiais (245): IDs como `sv4`, `base1`, `swsh1` — pegam metadata
 *     de pokemon_sets (logo, name_pt, series, release_date).
 *  2. Sets Liga-only (67): IDs como `paf`, `mep`, `par` — fallback usa o
 *     set_name das próprias cartas (ex: "Liga BR — PAF").
 *
 * SEO bem feito por set:
 * - Title: "Fenda Paradoxal (Paradox Rift) (2023) — 266 cartas | Bynx"
 * - Description: "Fenda Paradoxal: 266 cartas Pokémon TCG da série
 *   Scarlet & Violet. Valor total catalogado: R$ 8.598,70..."
 * - canonical: https://bynx.gg/set/sv4
 * - OG image: logo do set (quando oficial)
 * - Schema.org CollectionPage + ItemList das primeiras 20 cartas
 *
 * Long-tail SEO esperado: "destinos de paldea", "fenda paradoxal cartas",
 * "set scarlet violet brasil", "lista cartas obsidiana em chamas", etc.
 */

import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PublicFooter from '@/components/ui/PublicFooter'

// ISR: regenera cada 24h. Set é estável (cartas raramente mudam), mas
// preços agregados sim — 24h é equilíbrio entre freshness e custo.
export const revalidate = 86400

// ─── Tipos ─────────────────────────────────────────────────────────────────

type SetData = {
  id: string
  name: string
  namePt: string | null
  series: string | null
  printedTotal: number | null
  releaseDate: string | null
  logoUrl: string | null
  isLigaOnly: boolean
  cardsCount: number
  totalValueBrl: number
}

type CardLite = {
  id: string
  name: string
  number: string | null
  image_small: string | null
  rarity: string | null
  preco_medio: number | null
}

// ─── Fetch server-side (com ISR cache) ─────────────────────────────────────

async function fetchSetData(
  id: string,
): Promise<{ set: SetData | null; cards: CardLite[] }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) {
    return { set: null, cards: [] }
  }
  const sb = createClient(supabaseUrl, supabaseAnon)

  // 1. Tenta buscar metadata em pokemon_sets (sets oficiais)
  const { data: officialSet } = await sb
    .from('pokemon_sets')
    .select(
      'id, name, name_pt, series, printed_total, release_date, logo_url',
    )
    .eq('id', id)
    .maybeSingle()

  // 2. Busca cartas desse set (ordenadas por number)
  // Limit 500: maior set tem ~300 cartas, sobra folga
  const { data: cardsRaw } = await sb
    .from('pokemon_cards')
    .select(
      'id, name, number, image_small, rarity, preco_medio, set_name',
    )
    .eq('set_id', id)
    .order('number', { ascending: true, nullsFirst: false })
    .limit(500)

  const cards = (cardsRaw || []) as Array<CardLite & { set_name?: string }>

  if (cards.length === 0 && !officialSet) {
    return { set: null, cards: [] }
  }

  // Determina natureza do set
  const firstSetName = cards[0]?.set_name
  const isLigaOnly = !officialSet && !!firstSetName?.startsWith('Liga BR')

  // Calcula valor total catalogado
  const totalValueBrl = cards.reduce(
    (sum, c) => sum + (Number(c.preco_medio) || 0),
    0,
  )

  // Compõe SetData
  const setData: SetData = officialSet
    ? {
        id: officialSet.id,
        name: officialSet.name,
        namePt: officialSet.name_pt,
        series: officialSet.series,
        printedTotal: officialSet.printed_total,
        releaseDate: officialSet.release_date,
        logoUrl: officialSet.logo_url,
        isLigaOnly: false,
        cardsCount: cards.length,
        totalValueBrl,
      }
    : {
        id,
        name: firstSetName || `Set ${id.toUpperCase()}`,
        namePt: null,
        series: null,
        printedTotal: null,
        releaseDate: null,
        logoUrl: null,
        isLigaOnly,
        cardsCount: cards.length,
        totalValueBrl,
      }

  // Remove o set_name auxiliar antes de retornar
  const cleanCards: CardLite[] = cards.map(({ set_name, ...rest }) => rest)

  return { set: setData, cards: cleanCards }
}

// ─── Helper ────────────────────────────────────────────────────────────────

const formatBRL = (v: number) =>
  `R$ ${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

// ─── generateMetadata (key pro SEO) ────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const { set } = await fetchSetData(id)

  if (!set || set.cardsCount === 0) {
    return {
      title: 'Set não encontrado',
      description: 'Este set não foi encontrado no Bynx.',
      alternates: { canonical: `https://bynx.gg/set/${id}` },
      robots: { index: false, follow: false },
    }
  }

  // Display name: "Fenda Paradoxal (Paradox Rift)" se tem PT, "Paradox Rift" só
  const displayName = set.namePt ? `${set.namePt} (${set.name})` : set.name

  // Ano: " (2023)" se tem release_date, "" se não
  const yearStr = set.releaseDate ? ` (${set.releaseDate.slice(0, 4)})` : ''

  const title = `${displayName}${yearStr} — ${set.cardsCount} cartas`

  const valueStr =
    set.totalValueBrl > 0
      ? ` Valor total catalogado: ${formatBRL(set.totalValueBrl)}.`
      : ''

  const seriesStr = set.series ? ` da série ${set.series}` : ''

  const description = `${displayName}: ${set.cardsCount} cartas Pokémon TCG${seriesStr}.${valueStr} Veja todas as cartas, preços em reais por variante e adicione à sua coleção no Bynx.`

  const ogImage = set.logoUrl || 'https://bynx.gg/og-image.jpg'

  return {
    title,
    description,
    alternates: { canonical: `https://bynx.gg/set/${id}` },
    openGraph: {
      title: `${title} | Bynx`,
      description,
      url: `https://bynx.gg/set/${id}`,
      type: 'website',
      siteName: 'Bynx',
      locale: 'pt_BR',
      images: [{ url: ogImage, alt: set.name }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@bynxgg',
      title: `${title} | Bynx`,
      description,
      images: [ogImage],
    },
  }
}

// ─── Page Component ────────────────────────────────────────────────────────

export default async function SetPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { set, cards } = await fetchSetData(id)

  if (!set || cards.length === 0) {
    notFound()
  }

  // ─── Schema.org CollectionPage + ItemList (rich snippet no Google) ─
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: set.namePt || set.name,
    description: `Set ${set.name} com ${set.cardsCount} cartas Pokémon TCG`,
    url: `https://bynx.gg/set/${set.id}`,
    inLanguage: 'pt-BR',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: set.cardsCount,
      // Limit 20: rich snippet do Google mostra até 10, vamos com 20 pra
      // dar mais sinal de hierarquia sem sobrecarregar payload.
      itemListElement: cards.slice(0, 20).map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://bynx.gg/carta/${c.id}`,
        name: c.name,
      })),
    },
  }

  // BreadcrumbList: Bynx > Pokédex > {Set}
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Bynx',
        item: 'https://bynx.gg',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Pokédex',
        item: 'https://bynx.gg/pokedex',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: set.namePt || set.name,
        item: `https://bynx.gg/set/${set.id}`,
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
        <header
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

        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 80px' }}>
          {/* Hero do set */}
          <div
            style={{
              display: 'flex',
              gap: 24,
              marginBottom: 32,
              alignItems: 'center',
              flexWrap: 'wrap',
              padding: '24px 0',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {set.logoUrl && (
              <img
                src={set.logoUrl}
                alt={set.name}
                style={{
                  height: 80,
                  maxWidth: 200,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 24px rgba(245,158,11,0.2))',
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 240 }}>
              <h1
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  letterSpacing: '-0.04em',
                  marginBottom: 6,
                  lineHeight: 1.1,
                }}
              >
                {set.namePt || set.name}
              </h1>
              {set.namePt && (
                <p
                  style={{
                    fontSize: 15,
                    color: 'rgba(255,255,255,0.5)',
                    marginBottom: 10,
                  }}
                >
                  {set.name}
                </p>
              )}
              <p
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.55)',
                  marginBottom: 8,
                }}
              >
                {set.cardsCount} cartas
                {set.series ? ` · ${set.series}` : ''}
                {set.releaseDate ? ` · ${set.releaseDate.slice(0, 4)}` : ''}
                {set.isLigaOnly ? ' · Cartas exclusivas Liga BR' : ''}
              </p>
              {set.totalValueBrl > 0 && (
                <p
                  style={{
                    fontSize: 14,
                    color: '#f59e0b',
                    fontWeight: 800,
                    marginTop: 8,
                  }}
                >
                  Valor total catalogado: {formatBRL(set.totalValueBrl)}
                </p>
              )}
            </div>
          </div>

          {/* Grid de cartas */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 14,
            }}
          >
            {cards.map((card) => (
              <Link
                key={card.id}
                href={`/carta/${card.id}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: 10,
                  display: 'block',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
              >
                {card.image_small ? (
                  <img
                    src={card.image_small}
                    alt={card.name}
                    loading="lazy"
                    style={{
                      width: '100%',
                      borderRadius: 8,
                      display: 'block',
                      marginBottom: 8,
                      aspectRatio: '63/88',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '63/88',
                      borderRadius: 8,
                      marginBottom: 8,
                      background: 'rgba(255,255,255,0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 32,
                      opacity: 0.3,
                    }}
                  >
                    🃏
                  </div>
                )}
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 2,
                    lineHeight: 1.2,
                  }}
                >
                  {card.name}
                </p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  {card.number && set.printedTotal
                    ? `${card.number}/${set.printedTotal}`
                    : card.number
                      ? `#${card.number}`
                      : ''}
                  {card.rarity ? ` · ${card.rarity}` : ''}
                </p>
                {card.preco_medio && Number(card.preco_medio) > 0 && (
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#60a5fa',
                      marginTop: 4,
                    }}
                  >
                    {formatBRL(Number(card.preco_medio))}
                  </p>
                )}
              </Link>
            ))}
          </div>

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
                fontSize: 13,
                color: 'rgba(255,255,255,0.3)',
                marginBottom: 14,
              }}
            >
              Gerencie toda sua coleção {set.namePt || set.name} como portfólio
              financeiro
            </p>
            <Link
              href="/"
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                color: '#000',
                padding: '12px 28px',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Criar conta grátis no Bynx →
            </Link>
          </div>
        </main>
        <PublicFooter />
      </div>
    </>
  )
}
