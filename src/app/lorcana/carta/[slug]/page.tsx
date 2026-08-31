/**
 * src/app/lorcana/carta/[slug]/page.tsx
 *
 * SERVER COMPONENT — espelho fiel de src/app/carta/[id]/page.tsx (página de
 * carta Pokémon), adaptado: query com game='lorcana', sem API oficial de
 * Pokémon, sem preço/variantes (F3 — o slot vira "em breve"), sem hub por
 * espécie, sem cartas relacionadas e sem afiliado Mercado Livre.
 *
 * A rota aceita a URL nova (slug) e a antiga (id): resolve por slug primeiro,
 * cai pro id, e 301 pro slug canônico quando o param não é ele.
 *
 * Interatividade de UI fica no CardClient.tsx (componente Client filho,
 * recebe props pré-fetched) — mesmo desenho da carta Pokémon.
 */

import type { Metadata } from 'next'
import { cache } from 'react'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { notFound, permanentRedirect } from 'next/navigation'
import CardClient from './CardClient'

// ISR: regenera a cada 1h (mesmo ritmo do resto do contexto Lorcana).
export const revalidate = 3600

// Sem generateStaticParams o Next trata a rota como on-demand e responde
// `no-store` — o `revalidate` acima não tem efeito nenhum. Ver o comentário
// longo em carta/[id]/page.tsx (Pokémon). Lista vazia: nada prerenderizado
// no build; cada carta visitada fica cacheada.
export async function generateStaticParams() {
  return []
}

export const dynamicParams = true

// Mesma contenção da /carta Pokémon (incidente 29/07/2026): rota dinâmica sem
// teto de duração segurava conexão do Postgres por 300s sob carga.
export const maxDuration = 20

// ─── Tipos normalizados ────────────────────────────────────────────────────

type NormalizedCard = {
  id: string
  name: string
  number: string | null
  setName: string | null
  setId: string | null
  slug: string | null
  setTotal: number | null
  setReleaseYear: string | null
  rarity: string | null
  supertype: string | null
  imageSmall: string | null
  imageLarge: string | null
}

// ─── Fetch de dados (server-side, com cache ISR) ──────────────────────────

// cache(): generateMetadata e a page consomem a mesma carta no mesmo request.
const fetchCardData = cache(
  async (idOrSlug: string): Promise<NormalizedCard | null> => {
    const sb = getServiceSupabase()
    if (!sb) return null

    const COLS =
      'id, slug, name, number, rarity, supertype, image_small, image_large, ' +
      'set_id, set_name, set_release_date'

    // Slug primeiro (URL canônica), id como fallback (links antigos).
    // `any` espelha a carta Pokémon: a string de colunas montada por
    // concatenação não passa pelo parser de tipos do supabase-js.
    let bynx: any = null
    const porSlug = await sb
      .from('pokemon_cards')
      .select(COLS)
      .eq('game', 'lorcana')
      .eq('slug', idOrSlug)
      .maybeSingle()
    bynx = porSlug.data
    if (!bynx) {
      const porId = await sb
        .from('pokemon_cards')
        .select(COLS)
        .eq('game', 'lorcana')
        .eq('id', idOrSlug)
        .maybeSingle()
      bynx = porId.data
    }

    if (!bynx) return null

    // printed_total = o número impresso NA carta, não o total com secretas.
    // Mesmo desenho da carta Pokémon.
    let printedTotal: number | null = null
    if (bynx.set_id) {
      const st = await sb
        .from('pokemon_sets')
        .select('printed_total')
        .eq('id', bynx.set_id)
        .maybeSingle()
      printedTotal = st.data?.printed_total ?? null
    }

    return {
      id: bynx.id,
      name: bynx.name || 'Carta',
      number: bynx.number || null,
      setName: bynx.set_name || null,
      setId: bynx.set_id || null,
      slug: bynx.slug || null,
      setTotal: printedTotal,
      setReleaseYear: bynx.set_release_date?.slice(0, 4) || null,
      rarity: bynx.rarity || null,
      supertype: bynx.supertype || null,
      imageSmall: bynx.image_small || null,
      imageLarge: bynx.image_large || null,
    }
  },
)

// ─── generateMetadata (dinâmico por carta) ────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const card = await fetchCardData(slug)

  // Carta não encontrada: noindex + title genérico
  if (!card) {
    return {
      title: 'Carta não encontrada',
      description: 'Esta carta não está cadastrada na Bynx.',
      alternates: { canonical: `https://bynx.gg/lorcana/carta/${slug}` },
      robots: { index: false, follow: false },
    }
  }

  // Composição do title: "Elsa - Snow Queen 42/204 — The First Chapter"
  const numStr = card.number
    ? card.setTotal
      ? ` ${card.number}/${card.setTotal}`
      : ` #${card.number}`
    : ''
  const setStr = card.setName ? ` — ${card.setName}` : ''

  const title = `${card.name}${numStr}${setStr}`
  const description = `${card.name}${numStr}${card.setName ? ` de ${card.setName}` : ''} (Disney Lorcana) na Bynx. Preços em reais chegam em breve — acompanhe a carta na sua coleção.`

  const ogImage = card.imageLarge || card.imageSmall || 'https://bynx.gg/og-image.jpg'

  return {
    title,
    description,
    alternates: {
      canonical: `https://bynx.gg/lorcana/carta/${card.slug || slug}`,
    },
    // noindex enquanto o contexto está em beta fechado (decisão da F7)
    robots: { index: false, follow: false },
    openGraph: {
      title: `${title} | Bynx.gg`,
      description,
      url: `https://bynx.gg/lorcana/carta/${card.slug || slug}`,
      type: 'website',
      siteName: 'Bynx',
      locale: 'pt_BR',
      images: [
        {
          url: ogImage,
          width: 734,
          height: 1024,
          alt: card.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@bynxgg',
      creator: '@bynxgg',
      title: `${title} | Bynx.gg`,
      description,
      images: [ogImage],
    },
    other: {
      // Hint pra crawlers de imagem
      'og:image:type': 'image/png',
    },
  }
}

// ─── Page Component (server, renderiza Schema.org + CardClient) ───────────

export default async function LorcanaCartaPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const card = await fetchCardData(slug)

  if (!card) {
    notFound()
  }

  // URL antiga (id) -> 301 pra URL nova (slug). O id continua valendo pra
  // sempre; o 301 preserva links já compartilhados.
  if (card.slug && card.slug !== slug) {
    permanentRedirect(`/lorcana/carta/${card.slug}`)
  }

  // ─── Schema.org Product (sem offers: preço chega na F3) ──────────────
  const productSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: card.name,
    image: card.imageLarge || card.imageSmall,
    sku: card.id,
    description: `${card.name}${card.setName ? ` de ${card.setName}` : ''} — Disney Lorcana`,
    brand: {
      '@type': 'Brand',
      name: 'Disney Lorcana',
    },
    category: 'Trading Card Game',
  }

  // BreadcrumbList: Início > Lorcana > [Set] > Carta
  const breadcrumbItems: { name: string; href: string }[] = [
    { name: 'Início', href: '/' },
    { name: 'Lorcana', href: '/lorcana' },
  ]
  if (card.setName && card.setId) {
    breadcrumbItems.push({ name: card.setName, href: `/lorcana/set/${card.setId}` })
  }
  breadcrumbItems.push({ name: card.name, href: `/lorcana/carta/${card.slug || card.id}` })

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
      {/* JSON-LD invisível pro user, lido pelo Googlebot */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* UI interativa (client) — recebe data pré-fetched, sem loading state */}
      <CardClient card={card} breadcrumb={breadcrumbItems} />
    </>
  )
}
