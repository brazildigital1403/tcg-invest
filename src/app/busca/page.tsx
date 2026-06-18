// src/app/busca/page.tsx
// Pagina de resultados de busca (UX + alvo do WebSite SearchAction da home).
// ?q= = noindex,follow (boa pratica pra busca interna; nao gera thin content).
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import PublicFooter from '@/components/ui/PublicFooter'
import AdSlot from '@/components/ui/AdSlot'
import Breadcrumb from '@/components/ui/Breadcrumb'

export const dynamic = 'force-dynamic'

type Row = {
  kind: string
  ref: string
  label: string
  sublabel: string
  image: string | null
  price: number | null
}

const brl = (v: number) =>
  `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

const POPULARES = ['Charizard', 'Pikachu', 'Mewtwo', 'Rayquaza', 'Eevee', 'Gengar', 'Umbreon', 'Lucario']

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  return createClient(url, anon)
}

async function buscar(q: string): Promise<Row[]> {
  const sb = getSb()
  if (!sb) return []
  const { data, error } = await sb.rpc('busca_global', { q, lim: 24 })
  if (error) return []
  return (data || []) as Row[]
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}): Promise<Metadata> {
  const { q } = await searchParams
  const termo = (q || '').trim()
  if (termo) {
    return {
      title: `Busca: ${termo} - Pokemon TCG | Bynx`,
      description: `Resultados para "${termo}": cartas Pokemon TCG e precos em reais no Bynx.`,
      alternates: { canonical: 'https://bynx.gg/busca' },
      robots: { index: false, follow: true },
    }
  }
  return {
    title: 'Buscar cartas Pokemon TCG e precos em reais | Bynx',
    description:
      'Busque qualquer Pokemon ou carta e veja o preco real em reais. Mais de 69 mil cartas catalogadas no Bynx.',
    alternates: { canonical: 'https://bynx.gg/busca' },
  }
}

export default async function BuscaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const termo = (q || '').trim()
  const rows = termo.length >= 2 ? await buscar(termo) : []
  const pokemons = rows.filter((r) => r.kind === 'pokemon')
  const cartas = rows.filter((r) => r.kind === 'card')

  const breadcrumbItems = [
    { name: 'Início', href: '/' },
    { name: 'Busca', href: '/busca' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#080a0f', color: '#f0f0f0', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(8,10,15,0.95)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
        </Link>
        <Link href="/pokedex" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#000', padding: '8px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
          Ver Pokédex
        </Link>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 80px' }}>
        <Breadcrumb items={breadcrumbItems} />

        <h1 style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-0.03em', margin: '20px 0 18px' }}>
          {termo ? <>Resultados para &ldquo;{termo}&rdquo;</> : 'Buscar cartas Pokémon'}
        </h1>

        <form action="/busca" method="get" style={{ display: 'flex', gap: 10, maxWidth: 620, marginBottom: 30 }}>
          <input
            type="text"
            name="q"
            defaultValue={termo}
            placeholder="Busque um Pokémon ou uma carta..."
            autoComplete="off"
            style={{ flex: 1, background: '#11141c', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '14px 18px', color: '#fff', fontSize: 16, outline: 'none' }}
          />
          <button type="submit" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#000', fontWeight: 800, border: 'none', borderRadius: 12, padding: '0 26px', fontSize: 15, cursor: 'pointer' }}>
            Buscar
          </button>
        </form>

        {!termo && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Buscas populares</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {POPULARES.map((p) => (
                <Link key={p} href={`/busca?q=${encodeURIComponent(p)}`} style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', padding: '7px 14px', borderRadius: 999, textDecoration: 'none' }}>
                  {p}
                </Link>
              ))}
            </div>
          </div>
        )}

        {termo && rows.length === 0 && (
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)' }}>
            Nenhum resultado para &ldquo;{termo}&rdquo;. Tente outro nome de Pokémon ou carta.
          </p>
        )}

        {pokemons.length > 0 && (
          <section style={{ marginBottom: 34 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>Pokémon</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {pokemons.map((p) => (
                <Link key={p.ref} href={`/pokemon/${p.ref}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: '3px solid #f59e0b', borderRadius: 12, textDecoration: 'none', color: 'inherit' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{p.sublabel}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {cartas.length > 0 && (
          <section style={{ marginBottom: 34 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>Cartas</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
              {cartas.map((c) => (
                <Link key={c.ref} href={`/carta/${c.ref}`} style={{ textDecoration: 'none', color: 'inherit', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 10, display: 'block' }}>
                  {c.image ? (
                    <img src={c.image} alt={c.label + (c.sublabel ? ' — ' + c.sublabel : '')} loading="lazy" style={{ width: '100%', borderRadius: 8, display: 'block', marginBottom: 8, aspectRatio: '63/88', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '63/88', borderRadius: 8, marginBottom: 8, background: 'rgba(255,255,255,0.04)' }} />
                  )}
                  <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.sublabel}</p>
                  {c.price && Number(c.price) > 0 && (
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', marginTop: 4 }}>{brl(Number(c.price))}</p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        <div style={{ maxWidth: 970, margin: '20px auto 0', padding: '0 4px' }}>
          <AdSlot slot="2769741949" format="auto" responsive />
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
