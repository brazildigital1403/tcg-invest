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
import { getServiceSupabase } from '@/lib/supabaseServer'
import { notFound } from 'next/navigation'
import CardClient from './CardClient'
import CartasRelacionadas from '@/components/cards/CartasRelacionadas'
import MercadoLivre from '@/components/ui/MercadoLivre'
import { getMlAfiliadoLink } from '@/lib/mlAfiliado'
import Link from 'next/link'

function slugifyName(s: string): string {
  return s
    .replace(/♀/g, '-f')
    .replace(/♂/g, '-m')
    .toLowerCase()
    .replace(/[áàâãä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôõö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/ +/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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
  setId: string | null
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
  const sb = getServiceSupabase()
  if (sb) {
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
    setId: bynx?.set_id || tcg?.set?.id || null,
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
  const sb = getServiceSupabase()
  if (!sb) return empty
  try {
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
  const precoStr = formatBRL(card.precoMedio)

  // Title com preco em R$ no SERP (diferencial Bynx). Guarda de tamanho:
  // nome+numero+preco sempre; set so entra se couber (~50 chars antes de " | Bynx.gg").
  let title: string
  if (precoStr) {
    const baseComPreco = `${card.name}${numStr} — ${precoStr}`
    const restante = 50 - baseComPreco.length
    const sufixoSet = card.setName ? ` | ${card.setName}` : ''
    title = sufixoSet && sufixoSet.length <= restante ? baseComPreco + sufixoSet : baseComPreco
  } else {
    title = `${card.name}${numStr}${setStr}`
  }
  const description = precoStr
    ? `Quanto vale ${card.name}${numStr} de ${card.setName || 'Pokémon TCG'}? Preço médio ${precoStr}, atualizado em reais no Bynx. Veja a faixa (mín–máx), as variantes e acompanhe na sua coleção.`
    : `Quanto vale ${card.name}${numStr}${card.setName ? ` de ${card.setName}` : ''}? Veja o preço em reais, variantes, raridade e ataques, e acompanhe na sua coleção Pokémon TCG no Bynx.`

  const ogImage = card.imageLarge || card.imageSmall || 'https://bynx.gg/og-image.jpg'

  return {
    title,
    description,
    alternates: {
      canonical: `https://bynx.gg/carta/${id}`,
    },
    openGraph: {
      title: `${title} | Bynx.gg`,
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
      priceValidUntil: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10),
      url: `https://bynx.gg/carta/${card.id}`,
    }
  }

  // BreadcrumbList: ajuda navegação no Google + UX
  // Trilha (breadcrumb): Inicio > Pokedex > [Set] > Carta
  const breadcrumbItems: { name: string; href: string }[] = [
    { name: 'Início', href: '/' },
    { name: 'Sets', href: '/set' },
  ]
  if (card.setName && card.setId) {
    breadcrumbItems.push({ name: card.setName, href: `/set/${card.setId}` })
  }
  breadcrumbItems.push({ name: card.name, href: `/carta/${card.id}` })

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

  const related = await fetchRelatedCards(id)

  // Link de afiliado do Mercado Livre (acessorios; cai no 'default' se nao houver)
  const mlLink = await getMlAfiliadoLink('acessorios')

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
      {/* CardClient renderiza ad + relacionadas via children: tema dark, acima do rodape */}
      <CardClient card={card} breadcrumb={breadcrumbItems}>
        {/* Cartas relacionadas (SEO / link building) - links crawlaveis, server-rendered */}
        {related.pokemon_name && (
  <div style={{ margin: '4px 0 22px' }}>
    <Link
      href={`/pokemon/${slugifyName(related.pokemon_name)}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
        color: '#f59e0b', fontWeight: 700, fontSize: 14,
        padding: '12px 20px', borderRadius: 12, textDecoration: 'none',
      }}
    >
      Ver todas as cartas de {related.pokemon_name} &rarr;
    </Link>
  </div>
)}
        <CartasRelacionadas
          sameSet={related.same_set}
          samePokemon={related.same_pokemon}
          setName={card.setName}
          pokemonName={related.pokemon_name}
        />

        {mlLink && (
          <MercadoLivre variante="strip" url={mlLink.url} titulo={mlLink.titulo} subtitulo={mlLink.subtitulo} />
        )}
      </CardClient>
    </>
  )
}
