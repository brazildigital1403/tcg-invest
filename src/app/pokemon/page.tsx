/**
 * src/app/pokemon/page.tsx
 *
 * SERVER COMPONENT (S41: SEO Fase 4 — Índice de Pokémon).
 *
 * Hub-pai dos hubs /pokemon/[name]. Lista os 1025 Pokémon agrupados por
 * geração (Kanto -> Paldea), cada um linkando pra sua ficha. Dá crawlability
 * (1025 links internos), navegação e completa a hierarquia de breadcrumb.
 */

import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import PublicFooter from '@/components/ui/PublicFooter'
import Breadcrumb from '@/components/ui/Breadcrumb'

export const revalidate = 3600

type Dex = {
  slug: string
  name: string
  national_dex: number | null
  primary_type: string | null
  cards_count: number
}

const TIPO_COR: Record<string, string> = {
  Fire: '#ef4444', Water: '#3b82f6', Grass: '#22c55e', Lightning: '#eab308',
  Psychic: '#a855f7', Fighting: '#f97316', Darkness: '#64748b',
  Metal: '#94a3b8', Fairy: '#ec4899', Dragon: '#6366f1', Colorless: '#d1d5db',
}

const GERACOES: { nome: string; min: number; max: number }[] = [
  { nome: 'Geração 1 — Kanto', min: 1, max: 151 },
  { nome: 'Geração 2 — Johto', min: 152, max: 251 },
  { nome: 'Geração 3 — Hoenn', min: 252, max: 386 },
  { nome: 'Geração 4 — Sinnoh', min: 387, max: 493 },
  { nome: 'Geração 5 — Unova', min: 494, max: 649 },
  { nome: 'Geração 6 — Kalos', min: 650, max: 721 },
  { nome: 'Geração 7 — Alola', min: 722, max: 809 },
  { nome: 'Geração 8 — Galar', min: 810, max: 905 },
  { nome: 'Geração 9 — Paldea', min: 906, max: 1025 },
]

// Sprite do Pokemon (mesma fonte do /pokedex): pokemondb p/ #1-1000, PokeAPI
// official-artwork p/ #1001-1025. Usado com loading=lazy + referrerPolicy=no-referrer.
function getPokemonSprite(name: string, dexId: number): string {
  if (dexId <= 0) return ''
  if (dexId >= 1001) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexId}.png`
  }
  const urlName = name
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/\u2640/g, '-f')
    .replace(/\u2642/g, '-m')
    .replace(/[\u00e9\u00e8\u00ea\u00eb]/g, 'e')
    .replace(/[.:]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
  return `https://img.pokemondb.net/sprites/home/normal/${urlName}.png`
}

async function fetchAllPokemon(): Promise<Dex[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return []
  const sb = createClient(url, anon)
  const { data, error } = await sb
    .from('pokemon_pokedex')
    .select('slug, name, national_dex, primary_type, cards_count')
    .order('national_dex', { ascending: true })
    .limit(2000)
  if (error) {
    console.error('[pokemon-index] erro:', error)
    return []
  }
  return (data || []) as Dex[]
}

export async function generateMetadata(): Promise<Metadata> {
  const title = 'Todos os Pokémon no TCG — cartas e preços dos 1025 Pokémon'
  const description =
    'Explore todos os 1025 Pokémon no Pokémon TCG: veja todas as cartas de cada Pokémon, da Geração 1 (Kanto) à 9 (Paldea), com preços em reais e a carta mais valiosa de cada um no Bynx.'
  return {
    title,
    description,
    alternates: { canonical: 'https://bynx.gg/pokemon' },
    openGraph: {
      title: `${title} | Bynx`,
      description,
      url: 'https://bynx.gg/pokemon',
      type: 'website',
      siteName: 'Bynx',
      locale: 'pt_BR',
      images: [{ url: 'https://bynx.gg/og-image.jpg', alt: 'Todos os Pokémon no TCG — Bynx' }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@bynxgg',
      title: `${title} | Bynx`,
      description,
      images: ['https://bynx.gg/og-image.jpg'],
    },
  }
}

export default async function PokemonIndexPage() {
  const all = await fetchAllPokemon()

  const grupos = GERACOES.map((g) => ({
    ...g,
    lista: all.filter((p) => p.national_dex != null && p.national_dex >= g.min && p.national_dex <= g.max),
  })).filter((g) => g.lista.length > 0)

  const semDex = all.filter((p) => p.national_dex == null)
  if (semDex.length > 0) {
    grupos.push({ nome: 'Outros', min: 0, max: 0, lista: semDex })
  }

  const breadcrumbItems = [
    { name: 'Início', href: '/' },
    { name: 'Pokémon', href: '/pokemon' },
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
    name: 'Todos os Pokémon no Pokémon TCG',
    description: `Índice dos ${all.length} Pokémon catalogados no Bynx, com suas cartas e preços.`,
    url: 'https://bynx.gg/pokemon',
    inLanguage: 'pt-BR',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: all.length,
      itemListElement: all.slice(0, 30).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://bynx.gg/pokemon/${p.slug}`,
        name: p.name,
      })),
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div style={{ minHeight: '100vh', background: '#080a0f', color: '#f0f0f0', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
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

        <main className="bx-gutter" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 80px' }}>
          <Breadcrumb items={breadcrumbItems} />

          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, margin: '22px 0 10px' }}>
            Todos os Pokémon no TCG
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(255,255,255,0.6)', maxWidth: 760, marginBottom: 6 }}>
            O Bynx cataloga {all.length} Pokémon no Pokémon TCG, da Geração 1 (Kanto) até a 9 (Paldea). Escolha um Pokémon
            para ver todas as suas cartas atravessando as eras, a faixa de preço em reais e a carta mais valiosa.
          </p>

          {grupos.map((g) => (
            <section key={g.nome} style={{ marginTop: 34 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.03em' }}>{g.nome}</h2>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{g.lista.length} Pokémon</span>
                <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(186px, 1fr))', gap: 10 }}>
                {g.lista.map((p) => {
                  const cor = (p.primary_type && TIPO_COR[p.primary_type]) || '#f59e0b'
                  return (
                    <Link
                      key={p.slug}
                      href={`/pokemon/${p.slug}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        textDecoration: 'none',
                        color: 'inherit',
                        background: 'rgba(255,255,255,0.025)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderLeft: `3px solid ${cor}`,
                        borderRadius: 10,
                        padding: '9px 12px',
                      }}
                    >
                      <img
                        src={getPokemonSprite(p.name, p.national_dex || 0)}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        width={40}
                        height={40}
                        style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', minWidth: 34 }}>
                        {p.national_dex ? `#${String(p.national_dex).padStart(3, '0')}` : ''}
                      </span>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{p.cards_count}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}

          <div style={{ textAlign: 'center', paddingTop: 48, marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>
              Organize sua coleção Pokémon TCG como portfólio financeiro
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
