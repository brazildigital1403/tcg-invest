/**
 * src/app/pokemon/[name]/page.tsx
 *
 * SERVER COMPONENT (S41: SEO Fase 4 — Hub por Pokémon).
 *
 * Página indexável por POKÉMON (ex.: /pokemon/charizard). Agrega TODAS as
 * cartas de um Pokémon atravessando todas as eras do TCG, via base_pokemon_names.
 * Vira autoridade pra "quanto vale charizard", "todas as cartas do pikachu", etc.
 *
 * Dados:
 *  - get_pokemon_hub(slug)       -> cabeçalho (tipo, dex, contagens, faixa de preço, carta top)
 *  - get_pokemon_hub_cards(slug) -> todas as cartas ordenadas por data/preço
 *
 * Mesmo UI do site: header, Breadcrumb, AdSlot, PublicFooter, card no estilo /set.
 */

import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PublicFooter from '@/components/ui/PublicFooter'
import AdSlot from '@/components/ui/AdSlot'
import Breadcrumb from '@/components/ui/Breadcrumb'

export const revalidate = 3600

// ─── Tipos ─────────────────────────────────────────────────────────────────

type Hub = {
  slug: string
  name: string
  national_dex: number | null
  name_pt: string | null
  primary_type: string | null
  cards_count: number
  sets_count: number
  preco_min: number | null
  preco_max: number | null
  preco_avg: number | null
  first_year: string | null
  last_year: string | null
  top_card_id: string | null
  top_card_name: string | null
  top_card_set: string | null
  top_card_image: string | null
  top_card_number: string | null
  top_card_price: number | null
}

type HubCard = {
  id: string
  name: string
  number: string | null
  image_small: string | null
  set_id: string | null
  set_name: string | null
  set_series: string | null
  set_release_date: string | null
  preco_min: number | null
  preco_medio: number | null
  preco_max: number | null
  rarity: string | null
}

// ─── Tabelas de apoio ──────────────────────────────────────────────────────

const TIPO_PT: Record<string, string> = {
  Fire: 'Fogo', Water: 'Água', Grass: 'Planta', Lightning: 'Elétrico',
  Psychic: 'Psíquico', Fighting: 'Lutador', Darkness: 'Sombrio',
  Metal: 'Metálico', Fairy: 'Fada', Dragon: 'Dragão', Colorless: 'Incolor',
}

const TIPO_COR: Record<string, string> = {
  Fire: '#ef4444', Water: '#3b82f6', Grass: '#22c55e', Lightning: '#eab308',
  Psychic: '#a855f7', Fighting: '#f97316', Darkness: '#64748b',
  Metal: '#94a3b8', Fairy: '#ec4899', Dragon: '#6366f1', Colorless: '#d1d5db',
}

const brl = (v: number) =>
  `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

// ─── Fetch ─────────────────────────────────────────────────────────────────

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  return createClient(url, anon)
}

async function fetchHub(slug: string): Promise<{ hub: Hub | null; cards: HubCard[] }> {
  const sb = getSb()
  if (!sb) return { hub: null, cards: [] }

  const { data: hubRows, error: hubErr } = await sb.rpc('get_pokemon_hub', { p_slug: slug })
  if (hubErr) throw hubErr
  const hub = (hubRows && hubRows[0]) as Hub | undefined
  if (!hub) return { hub: null, cards: [] }

  const { data: cards, error: cardsErr } = await sb.rpc('get_pokemon_hub_cards', { p_slug: slug })
  if (cardsErr) throw cardsErr

  return { hub, cards: (cards || []) as HubCard[] }
}

// ─── Texto de SEO gerado por dados (único por Pokémon) ─────────────────────

function textoSEO(h: Hub): string {
  const tipo = (h.primary_type && TIPO_PT[h.primary_type]) || h.primary_type || ''
  const p: string[] = []

  let abertura = `${h.name} é um Pokémon`
  if (tipo) abertura += ` do tipo ${tipo}`
  if (h.national_dex) abertura += ` e ocupa o número ${h.national_dex} da Pokédex Nacional`
  abertura += '.'
  p.push(abertura)

  const umaCarta = h.cards_count === 1
  let cat = `No Pokémon TCG, o Bynx cataloga ${h.cards_count} cart${umaCarta ? 'a' : 'as'} do ${h.name}`
  if (h.sets_count) cat += ` distribuída${umaCarta ? '' : 's'} por ${h.sets_count} coleç${h.sets_count === 1 ? 'ão' : 'ões'}`
  if (h.first_year && h.last_year) {
    cat += h.first_year === h.last_year
      ? `, lançada${umaCarta ? '' : 's'} em ${h.first_year}`
      : `, lançadas entre ${h.first_year} e ${h.last_year}`
  }
  cat += '.'
  p.push(cat)

  if (h.preco_min && h.preco_max) {
    let pr = `Os preços de mercado vão de ${brl(Number(h.preco_min))} a ${brl(Number(h.preco_max))}`
    if (h.preco_avg) pr += `, com média de ${brl(Number(h.preco_avg))}`
    pr += '.'
    p.push(pr)
  }

  if (h.top_card_name && h.top_card_set) {
    p.push(`A carta mais valiosa do ${h.name} catalogada é a ${h.top_card_name}, do set ${h.top_card_set}.`)
  }

  return p.join(' ')
}

// ─── generateMetadata ──────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>
}): Promise<Metadata> {
  const { name } = await params
  const slug = decodeURIComponent(name).toLowerCase()
  const { hub } = await fetchHub(slug)

  if (!hub) {
    return {
      title: 'Pokémon não encontrado',
      description: 'Este Pokémon não foi encontrado no Bynx.',
      alternates: { canonical: `https://bynx.gg/pokemon/${slug}` },
      robots: { index: false, follow: false },
    }
  }

  const tipo = (hub.primary_type && TIPO_PT[hub.primary_type]) || hub.primary_type || ''
  const dexStr = hub.national_dex ? ` (Pokédex Nacional nº ${hub.national_dex})` : ''
  const title = `${hub.name} — ${hub.cards_count} cartas Pokémon TCG e preços em reais`

  const faixa =
    hub.preco_min && hub.preco_max
      ? ` Preços de ${brl(Number(hub.preco_min))} a ${brl(Number(hub.preco_max))}.`
      : ''
  const eras =
    hub.first_year && hub.last_year && hub.first_year !== hub.last_year
      ? ` de ${hub.first_year} a ${hub.last_year}`
      : ''
  const description =
    `Todas as ${hub.cards_count} cartas do ${hub.name}${dexStr} no Pokémon TCG: ${hub.sets_count} coleções${eras}.${faixa} Veja a carta mais valiosa, preços por carta e organize sua coleção no Bynx.`

  const ogImage = hub.top_card_image || 'https://bynx.gg/og-image.jpg'

  return {
    title,
    description,
    alternates: { canonical: `https://bynx.gg/pokemon/${slug}` },
    openGraph: {
      title: `${title} | Bynx`,
      description,
      url: `https://bynx.gg/pokemon/${slug}`,
      type: 'website',
      siteName: 'Bynx',
      locale: 'pt_BR',
      images: [{ url: ogImage, alt: `Cartas do ${hub.name} no Pokémon TCG${tipo ? ' (' + tipo + ')' : ''}` }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@bynxgg',
      title: `${title} | Bynx`,
      description,
      images: [ogImage],
    },
    keywords: [
      `${hub.name} pokemon tcg`,
      `cartas ${hub.name}`,
      `quanto vale ${hub.name}`,
      `${hub.name} preço`,
      `todas as cartas de ${hub.name}`,
    ],
  }
}

// ─── Página ────────────────────────────────────────────────────────────────

export default async function PokemonHubPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = await params
  const slug = decodeURIComponent(name).toLowerCase()
  const { hub, cards } = await fetchHub(slug)

  if (!hub) notFound()

  const tipo = (hub.primary_type && TIPO_PT[hub.primary_type]) || hub.primary_type || ''
  const tipoCor = (hub.primary_type && TIPO_COR[hub.primary_type]) || '#f59e0b'

  // Agrupa as cartas por série (era), preservando a ordem (mais recente primeiro)
  const grupos: { series: string; cards: HubCard[]; anos: string }[] = []
  const idx = new Map<string, number>()
  for (const c of cards) {
    const key = c.set_series || 'Outras coleções'
    if (!idx.has(key)) {
      idx.set(key, grupos.length)
      grupos.push({ series: key, cards: [], anos: '' })
    }
    grupos[idx.get(key)!].cards.push(c)
  }
  for (const g of grupos) {
    const anos = g.cards
      .map((c) => (c.set_release_date ? c.set_release_date.slice(0, 4) : ''))
      .filter(Boolean)
    if (anos.length) {
      const mn = anos.reduce((a, b) => (a < b ? a : b))
      const mx = anos.reduce((a, b) => (a > b ? a : b))
      g.anos = mn === mx ? mn : `${mn}–${mx}`
    }
  }

  // Faixa de preço (posição da média na barra)
  const pmin = Number(hub.preco_min) || 0
  const pmax = Number(hub.preco_max) || 0
  const pavg = Number(hub.preco_avg) || 0
  const avgPct = pmax > pmin ? Math.min(96, Math.max(4, ((pavg - pmin) / (pmax - pmin)) * 100)) : 50

  const erasStr =
    hub.first_year && hub.last_year
      ? hub.first_year === hub.last_year
        ? hub.first_year
        : `${hub.first_year}–${hub.last_year}`
      : ''

  // ─── Schemas ──────────────────────────────────────────────────────────
  const breadcrumbItems = [
    { name: 'Início', href: '/' },
    { name: 'Pokémon', href: '/pokemon' },
    { name: hub.name, href: `/pokemon/${hub.slug}` },
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
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Cartas de ${hub.name}`,
    description: `${hub.cards_count} cartas do ${hub.name} no Pokémon TCG, com preços em reais.`,
    url: `https://bynx.gg/pokemon/${hub.slug}`,
    inLanguage: 'pt-BR',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: hub.cards_count,
      itemListElement: cards.slice(0, 30).map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://bynx.gg/carta/${c.id}`,
        name: c.name,
      })),
    },
  }

  const heroAlt =
    `Carta ${hub.top_card_name || hub.name}` +
    (hub.top_card_number ? ` ${hub.top_card_number}` : '') +
    (hub.top_card_set ? ` do set ${hub.top_card_set}` : '') +
    ' — Pokémon TCG | Bynx'

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div style={{ minHeight: '100vh', background: '#080a0f', color: '#f0f0f0', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
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
            <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
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
          <Breadcrumb items={breadcrumbItems} />

          {/* Hero / dossiê */}
          <div
            style={{
              display: 'flex',
              gap: 34,
              marginTop: 22,
              paddingBottom: 30,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              flexWrap: 'wrap',
            }}
          >
            {hub.top_card_image && (
              <Link
                href={hub.top_card_id ? `/carta/${hub.top_card_id}` : '#'}
                style={{ position: 'relative', flex: '0 0 200px', textDecoration: 'none' }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 10,
                    left: -6,
                    zIndex: 2,
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                    color: '#000',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    padding: '5px 11px',
                    borderRadius: 6,
                    boxShadow: '0 6px 18px rgba(239,68,68,0.4)',
                  }}
                >
                  ★ MAIS VALIOSA
                </span>
                <img
                  src={hub.top_card_image}
                  alt={heroAlt}
                  style={{
                    width: 200,
                    borderRadius: 14,
                    display: 'block',
                    boxShadow: '0 0 50px rgba(245,158,11,0.3), 0 20px 50px rgba(0,0,0,0.55)',
                  }}
                />
                {hub.top_card_price && Number(hub.top_card_price) > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 10,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(0,0,0,0.82)',
                      border: '1px solid rgba(245,158,11,0.4)',
                      borderRadius: 10,
                      padding: '5px 13px',
                      fontSize: 15,
                      fontWeight: 800,
                      color: '#f59e0b',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {brl(Number(hub.top_card_price))}
                  </span>
                )}
              </Link>
            )}

            <div style={{ flex: 1, minWidth: 280 }}>
              {tipo && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: tipoCor,
                    background: `${tipoCor}1a`,
                    border: `1px solid ${tipoCor}40`,
                    borderRadius: 999,
                    padding: '5px 12px',
                    marginBottom: 12,
                  }}
                >
                  {tipo}
                </span>
              )}
              <h1 style={{ fontSize: 46, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 14 }}>
                {hub.name}
              </h1>

              <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', marginBottom: 22 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>{hub.cards_count}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>cartas</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>{hub.sets_count}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>sets</div>
                </div>
                {erasStr && (
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>{erasStr}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>eras</div>
                  </div>
                )}
                {hub.national_dex && (
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>#{hub.national_dex}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pokédex</div>
                  </div>
                )}
              </div>

              {pmin > 0 && pmax > 0 && (
                <div
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14,
                    padding: '14px 16px',
                    marginBottom: 18,
                    maxWidth: 520,
                  }}
                >
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Faixa de preço de mercado
                  </div>
                  <div style={{ position: 'relative', height: 8, borderRadius: 99, background: 'linear-gradient(90deg, #22c55e, #60a5fa, #f59e0b, #ef4444)' }}>
                    <div style={{ position: 'absolute', top: -4, left: `${avgPct}%`, width: 3, height: 16, background: '#fff', borderRadius: 2, boxShadow: '0 0 8px rgba(255,255,255,0.6)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 13, fontWeight: 700 }}>
                    <span style={{ color: '#22c55e' }}>{brl(pmin)}</span>
                    {pavg > 0 && <span style={{ color: 'rgba(255,255,255,0.6)' }}>média {brl(pavg)}</span>}
                    <span style={{ color: '#ef4444' }}>{brl(pmax)}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link
                  href="/"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                    color: '#000',
                    fontWeight: 700,
                    fontSize: 14,
                    padding: '12px 22px',
                    borderRadius: 11,
                    textDecoration: 'none',
                  }}
                >
                  Tenho um {hub.name} →
                </Link>
                <Link
                  href="/"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.75)',
                    fontWeight: 600,
                    fontSize: 14,
                    padding: '12px 22px',
                    borderRadius: 11,
                    textDecoration: 'none',
                  }}
                >
                  🔔 Acompanhar preço
                </Link>
              </div>
            </div>
          </div>

          {/* Texto de SEO (sobre o Pokémon) */}
          <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(255,255,255,0.65)', maxWidth: 820, margin: '26px 0 4px' }}>
            {textoSEO(hub)}
          </p>

          {/* Anúncio display */}
          <div style={{ maxWidth: 970, margin: '26px auto 8px', padding: '0 4px' }}>
            <AdSlot slot="2769741949" format="auto" responsive />
          </div>

          {/* A jornada */}
          <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', marginTop: 34, marginBottom: 4 }}>
            A jornada do {hub.name}
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 26 }}>
            Todas as cartas do {hub.name} atravessando as eras do Pokémon TCG.
          </p>

          {grupos.map((g) => (
            <section key={g.series} style={{ marginBottom: 34 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em' }}>{g.series}</h3>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  {g.anos ? `${g.anos} · ` : ''}{g.cards.length} cart{g.cards.length === 1 ? 'a' : 'as'}
                </span>
                <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
                {g.cards.map((card) => (
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
                        alt={card.name + (card.number ? ' ' + card.number : '') + (card.set_name ? ' — ' + card.set_name : '')}
                        loading="lazy"
                        style={{ width: '100%', borderRadius: 8, display: 'block', marginBottom: 8, aspectRatio: '63/88', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '100%', aspectRatio: '63/88', borderRadius: 8, marginBottom: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, opacity: 0.3 }}>
                        🃏
                      </div>
                    )}
                    <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {card.name}
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {card.set_name || ''}{card.number ? ` · #${card.number}` : ''}
                    </p>
                    {card.preco_medio && Number(card.preco_medio) > 0 && (
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', marginTop: 4 }}>
                        {brl(Number(card.preco_medio))}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          ))}

          {/* CTA footer */}
          <div style={{ textAlign: 'center', paddingTop: 48, marginTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>
              Tem cartas do {hub.name}? Organize sua coleção como portfólio financeiro
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
