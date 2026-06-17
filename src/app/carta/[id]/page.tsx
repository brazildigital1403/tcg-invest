/**
 * src/app/carta/[id]/page.tsx
 *
 * SERVER COMPONENT (S38: SEO Fase 1).
 *
 * Antes (S33-S37): `'use client'` puro, sem SSR. Resultado: title genérico,
 * canonical apontando pra "/" (vazado do layout root) e SEM Schema.org Product.
 * Google nunca indexou as ~22k páginas de carta.
 *
 * Agora (S38): fetch server-side da carta (pokemontcg.io + Supabase),
 * generateMetadata dinâmico por carta (title/desc/OG/canonical específicos),
 * Product schema.org com oferta em BRL, ISR 24h. Interatividade UI fica
 * no CardClient.tsx (componente Client filho, recebe props pré-fetched).
 *
 * SEO crítico:
 * - canonical: `https://bynx.gg/carta/{id}` (não mais "/")
 * - title: "Charizard ex 199/091 — Destinos de Paldea | Bynx"
 * - description: inclui preço médio em BRL pra atrair clique
 * - schema.org Product + AggregateOffer (rich snippet com R$ no Google)
 */

import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import CardClient from './CardClient'
import AdSlot from '@/components/ui/AdSlot'
import CartasRelacionadas from '@/components/cards/CartasRelacionadas'

// ─── ISR: revalida cada 24h ───────────────────────────────────────────────
// Preço dinâmico mas estável; 24h equilibra freshness vs custo Vercel.
// On-demand revalidate via /api/revalidate quando scan atualiza preço.
export const revalidate = 86400

// ─── Tipos normalizados (merge pokemontcg.io + Supabase) ──────────────────

type NormalizedCard = {
  id: string
  name: string
  number: string | null
  setName: string | null
  setTotal: number | null
  setReleaseYear: string | null
  rarity: string | null
  hp: number | null
  types: string[]
  imageSmall: string | null
  imageLarge: string | null
  attacks: Array<{ name: string; text?: string; damage?: string }> | null
  // Preço (apenas Bynx tem)
  precoMin: number | null
  precoMedio: number | null
  precoMax: number | null
}

// ─── Helper: normaliza attacks (pode vir como array da API TCG, ou como
// string JSON serializada vinda do Supabase/Bynx). Garante sempre array|null. ─
function normalizeAttacks(
  raw: unknown,
): Array<{ name: string; text?: string; damage?: string }> | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    return raw as Array<{ name: string; text?: string; damage?: string }>
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

// ─── Fetch de dados (server-side, com cache ISR) ──────────────────────────

async function fetchCardData(id: string): Promise<NormalizedCard | null> {
  // Tentativa 1: API Pokémon TCG oficial (dados de jogo: ataques, hp, etc.)
  const tcgRes = await fetch(`https://api.pokemontcg.io/v2/cards/${id}`, {
    headers: { 'X-Api-Key': process.env.POKEMON_API_KEY || '' },
    next: { revalidate: 86400, tags: [`card:${id}`] },
  }).catch(() => null)

  const tcgJson: any = tcgRes?.ok ? await tcgRes.json().catch(() => null) : null
  const tcg = tcgJson?.data || null

  // Tentativa 2: Supabase (preços + dados de Liga-only)
  let bynx: any = null
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (supabaseUrl && supabaseAnon) {
    const sb = createClient(supabaseUrl, supabaseAnon)
    const { data } = await sb
      .from('pokemon_cards')
      .select(
        'id, name, number, set_id, set_name, set_release_date, set_total, ' +
          'rarity, hp, types, image_small, image_large, attacks, ' +
          'preco_min, preco_medio, preco_max',
      )
      .eq('id', id)
      .maybeSingle()
    bynx = data
  }

  // Se nenhuma fonte achou, é 404
  if (!tcg && !bynx) return null

  // Merge: TCG api tem dados de jogo melhores (image grande, ataques),
  // Bynx tem preço em BRL. Combina os dois.
  return {
    id,
    name: tcg?.name || bynx?.name || 'Carta',
    number: tcg?.number || bynx?.number || null,
    setName: tcg?.set?.name || bynx?.set_name || null,
    setTotal: tcg?.set?.printedTotal || bynx?.set_total || null,
    setReleaseYear:
      tcg?.set?.releaseDate?.slice(0, 4) ||
      bynx?.set_release_date?.slice(0, 4) ||
      null,
    rarity: tcg?.rarity || bynx?.rarity || null,
    hp: tcg?.hp ? Number(tcg.hp) : bynx?.hp || null,
    types: tcg?.types || bynx?.types || [],
    imageSmall: tcg?.images?.small || bynx?.image_small || null,
    imageLarge: tcg?.images?.large || bynx?.image_large || null,
    attacks: normalizeAttacks(tcg?.attacks || bynx?.attacks),
    precoMin: bynx?.preco_min ? Number(bynx.preco_min) : null,
    precoMedio: bynx?.preco_medio ? Number(bynx.preco_medio) : null,
    precoMax: bynx?.preco_max ? Number(bynx.preco_max) : null,
  }
}

// --- Cartas relacionadas (link building / SEO) ---
type MiniCard = {
  id: string
  name: string
  number: string | null
  image_small: string | null
  set_name: string | null
}
type RelatedCards = {
  pokemon_name: string | null
  same_set: MiniCard[]
  same_pokemon: MiniCard[]
}

async function fetchRelatedCards(id: string): Promise<RelatedCards> {
  const empty: RelatedCards = { pokemon_name: null, same_set: [], same_pokemon: [] }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) return empty
  try {
    const sb = createClient(supabaseUrl, supabaseAnon)
    const { data, error } = await sb.rpc('get_related_cards', { p_id: id, p_limit: 8 })
    if (error || !data) return empty
    const d = data as { pokemon_name?: string | null; same_set?: MiniCard[]; same_pokemon?: MiniCard[] }
    return {
      pokemon_name: d.pokemon_name ?? null,
      same_set: Array.isArray(d.same_set) ? d.same_set : [],
      same_pokemon: Array.isArray(d.same_pokemon) ? d.same_pokemon : [],
    }
  } catch {
    return empty
  }
}

// ─── Helper: formata BRL ───────────────────────────────────────────────────

const formatBRL = (v: number | null) =>
  v ? `R$ ${v.toFixed(2).replace('.', ',')}` : null

// ─── generateMetadata (DINÂMICO POR CARTA — KEY do SEO) ───────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const card = await fetchCardData(id)

  // Carta não encontrada: noindex + title genérico
  if (!card) {
    return {
      title: 'Carta não encontrada',
      description: 'Esta carta não está cadastrada no Bynx.',
      alternates: { canonical: `https://bynx.gg/carta/${id}` },
      robots: { index: false, follow: false },
    }
  }

  // Composição do title: "Charizard ex 199/091 — Destinos de Paldea"
  const numStr = card.number
    ? card.setTotal
      ? ` ${card.number}/${card.setTotal}`
      : ` #${card.number}`
    : ''
  const setStr = card.setName ? ` — ${card.setName}` : ''
  const title = `${card.name}${numStr}${setStr}`

  // Description com preço (CTR↑ no Google) ou fallback
  const precoStr = formatBRL(card.precoMedio)
  const description = precoStr
    ? `${card.name}${numStr} de ${card.setName || 'Pokémon TCG'} custa em média ${precoStr} no Bynx. Veja variantes (Normal, Holo, Reverse, Foil), histórico de preços e adicione à sua coleção brasileira.`
    : `${card.name}${numStr}${card.setName ? ` de ${card.setName}` : ''}. Veja variantes, ataques, raridade e adicione à sua coleção Pokémon TCG no Bynx — preços em reais.`

  const ogImage = card.imageLarge || card.imageSmall || 'https://bynx.gg/og-image.jpg'

  return {
    title,
    description,
    alternates: {
      canonical: `https://bynx.gg/carta/${id}`,
    },
    openGraph: {
      title: `${title} | Bynx`,
      description,
      url: `https://bynx.gg/carta/${id}`,
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
      title: `${title} | Bynx`,
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

export default async function CartaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = await fetchCardData(id)

  if (!card) {
    notFound()
  }

  // ─── Schema.org Product (Rich Snippet no Google: mostra R$ na busca) ─
  const productSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: card.name,
    image: card.imageLarge || card.imageSmall,
    sku: card.id,
    description: `${card.name}${card.setName ? ` de ${card.setName}` : ''} — Pokémon TCG`,
    brand: {
      '@type': 'Brand',
      name: 'Pokémon TCG',
    },
    category: 'Trading Card Game',
  }

  // Adiciona AggregateOffer só se tiver preço (evita lowPrice undefined)
  if (card.precoMedio) {
    productSchema.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'BRL',
      lowPrice: card.precoMin ?? card.precoMedio,
      highPrice: card.precoMax ?? card.precoMedio,
      offerCount: 1,
      availability: 'https://schema.org/InStock',
      url: `https://bynx.gg/carta/${card.id}`,
    }
  }

  // BreadcrumbList: ajuda navegação no Google + UX
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
        name: card.name,
        item: `https://bynx.gg/carta/${card.id}`,
      },
    ],
  }

  const related = await fetchRelatedCards(id)

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
      <CardClient card={card} />

      {/* Anuncio in-article (AdSense) - entre a carta e as cartas relacionadas */}
      <div style={{ width: '100%', maxWidth: 760, alignSelf: 'center', margin: '8px 0 32px', padding: '0 16px' }}>
        <AdSlot slot="8406341305" layout="in-article" format="fluid" />
      </div>

      {/* Cartas relacionadas (SEO / link building) - links crawlaveis, server-rendered */}
      <CartasRelacionadas
        sameSet={related.same_set}
        samePokemon={related.same_pokemon}
        setName={card.setName}
        pokemonName={related.pokemon_name}
      />
    </>
  )
}
