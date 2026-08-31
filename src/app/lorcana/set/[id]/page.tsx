/**
 * src/app/lorcana/set/[id]/page.tsx
 *
 * SERVER COMPONENT — espelho fiel de src/app/set/[id]/page.tsx (página de
 * set Pokémon), adaptado: queries com game='lorcana', sem name_pt (Lorcana
 * não tem PT), sem afiliado Mercado Livre e sem preço por carta (F3 — o
 * slot de valor total vira "em breve").
 *
 * Enquanto o contexto está em beta fechado, TODAS as páginas são noindex.
 */

import type { Metadata } from 'next'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { cache } from 'react'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { IconCollection } from '@/components/ui/Icons'

// ISR: regenera a cada 1h (mesmo ritmo do resto do contexto Lorcana).
export const revalidate = 3600

// Mesma contenção da /carta (incidente 29/07/2026): rota dinâmica sem teto de
// duração segurava conexão do Postgres por 300s sob carga.
export const maxDuration = 20

// Sem generateStaticParams o Next trata a rota como on-demand e responde
// `no-store` — o `revalidate` acima não tem efeito nenhum. Ver o comentário
// longo em carta/[id]/page.tsx (Pokémon). Lista vazia: nada prerenderizado no
// build, mas cada set visitado fica cacheado.
export async function generateStaticParams() {
  return []
}

export const dynamicParams = true

// ─── Tipos ─────────────────────────────────────────────────────────────────

type SetData = {
  id: string
  name: string
  series: string | null
  printedTotal: number | null
  releaseDate: string | null
  logoUrl: string | null
  cardsCount: number
}

type CardLite = {
  id: string
  slug: string | null
  name: string
  number: string | null
  image_small: string | null
  rarity: string | null
}

// ─── Fetch server-side (com ISR cache) ─────────────────────────────────────

// cache(): generateMetadata e a page consomem o mesmo dado dentro do request.
const fetchSetData = cache(
  async (id: string): Promise<{ set: SetData | null; cards: CardLite[] }> => {
    const sb = getServiceSupabase()
    if (!sb) {
      return { set: null, cards: [] }
    }

    // As duas queries não dependem uma da outra — em série eram dois RTTs
    // empilhados pra Supabase sa-east-1. Teto de 1000 espelha a página
    // Pokémon (maior set Lorcana hoje fica bem abaixo disso).
    const [setRes, cardsRes] = await Promise.all([
      sb
        .from('pokemon_sets')
        .select('id, name, series, printed_total, release_date, logo_url')
        .eq('id', id)
        .eq('game', 'lorcana')
        .maybeSingle(),
      sb
        .from('pokemon_cards')
        .select('id, slug, name, number, image_small, rarity')
        .eq('set_id', id)
        .eq('game', 'lorcana')
        .order('number', { ascending: true, nullsFirst: false })
        .limit(1000),
    ])

    const officialSet = setRes.data
    const cards = (cardsRes.data || []) as CardLite[]

    if (!officialSet) {
      return { set: null, cards: [] }
    }

    const setData: SetData = {
      id: officialSet.id,
      name: officialSet.name,
      series: officialSet.series || null,
      printedTotal: officialSet.printed_total,
      releaseDate: officialSet.release_date,
      logoUrl: officialSet.logo_url,
      cardsCount: cards.length,
    }

    return { set: setData, cards }
  },
)

// ─── generateMetadata ──────────────────────────────────────────────────────

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
      description: 'Este set não foi encontrado na Bynx.',
      alternates: { canonical: `https://bynx.gg/lorcana/set/${id}` },
      robots: { index: false, follow: false },
    }
  }

  // Ano: " (2023)" se tem release_date, "" se não
  const yearStr = set.releaseDate ? ` (${set.releaseDate.slice(0, 4)})` : ''

  const title = `${set.name}${yearStr} — ${set.cardsCount} cartas`

  const description = `${set.name}: ${set.cardsCount} cartas de Disney Lorcana. Veja todas as cartas do set na Bynx — preços em reais chegam em breve.`

  const ogImage = set.logoUrl || 'https://bynx.gg/og-image.jpg'

  return {
    title,
    description,
    alternates: { canonical: `https://bynx.gg/lorcana/set/${id}` },
    // noindex enquanto o contexto está em beta fechado (decisão da F7)
    robots: { index: false, follow: false },
    openGraph: {
      title: `${title} | Bynx`,
      description,
      url: `https://bynx.gg/lorcana/set/${id}`,
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

export default async function LorcanaSetPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { set, cards } = await fetchSetData(id)

  if (!set || cards.length === 0) {
    notFound()
  }

  // ─── Schema.org CollectionPage + ItemList ─────────────────────────────
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: set.name,
    description: `Set ${set.name} com ${set.cardsCount} cartas de Disney Lorcana`,
    url: `https://bynx.gg/lorcana/set/${set.id}`,
    inLanguage: 'pt-BR',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: set.cardsCount,
      itemListElement: cards.slice(0, 20).map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://bynx.gg/lorcana/carta/${c.slug || c.id}`,
        name: c.name,
      })),
    },
  }

  // Trilha (breadcrumb): Início > Lorcana > Set
  const breadcrumbItems: { name: string; href: string }[] = [
    { name: 'Início', href: '/' },
    { name: 'Lorcana', href: '/lorcana' },
    { name: set.name, href: `/lorcana/set/${set.id}` },
  ]

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `https://bynx.gg${it.href}`,
    })),
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

        <main className="bx-gutter" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 80px' }}>
          <Breadcrumb items={breadcrumbItems} />
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
                alt={'Logo do set ' + set.name + ' — Disney Lorcana'}
                style={{
                  height: 80,
                  maxWidth: 200,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 24px rgba(var(--ac-1-rgb),0.2))',
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
                {set.name}
              </h1>
              <p
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.55)',
                  marginBottom: 8,
                }}
              >
                {set.cardsCount} cartas
                {set.printedTotal ? ` · ${set.printedTotal} numeradas` : ''}
                {set.series ? ` · ${set.series}` : ''}
                {set.releaseDate ? ` · ${set.releaseDate.slice(0, 4)}` : ''}
              </p>
              {/* Slot do "Valor total catalogado" da página Pokémon — Lorcana
                  ainda não tem preço (F3), então o mesmo slot vira "em breve". */}
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--ac-1)',
                  fontWeight: 800,
                  marginTop: 8,
                }}
              >
                Mercado Brasileiro: preços em reais chegam em breve
              </p>
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
                href={`/lorcana/carta/${card.slug || card.id}`}
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
                  /* `unoptimized`: as imagens de Lorcana vêm de
                     cards.lorcast.io, host fora do remotePatterns — o
                     otimizador da Vercel recusaria a URL. Continua lazy. */
                  <Image
                    src={card.image_small}
                    alt={card.name + (card.number ? ' ' + card.number + (set.printedTotal ? '/' + set.printedTotal : '') : '') + ' — ' + set.name}
                    width={300}
                    height={419}
                    loading="lazy"
                    sizes="(max-width: 768px) 30vw, 160px"
                    unoptimized
                    style={{
                      width: '100%',
                      height: 'auto',
                      borderRadius: 8,
                      display: 'block',
                      marginBottom: 8,
                      aspectRatio: '5/7',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '5/7',
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
                    <IconCollection size={30} color="rgba(255,255,255,0.3)" />
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
              Gerencie toda sua coleção {set.name} como portfólio
              financeiro
            </p>
            <Link
              href="/"
              style={{
                background: 'var(--ac-grad)',
                color: '#000',
                padding: '12px 28px',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Criar conta grátis na Bynx →
            </Link>
          </div>
        </main>
        <PublicFooter />
      </div>
    </>
  )
}
