'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type TopCard = { id: string; name: string; set_name: string | null; image_small: string | null; preco_medio: number | null }
type GenHero = { gen: number; gen_name: string; slug: string; name: string; cards_count: number; top_card_id: string | null; top_card_image: string | null; top_card_price: number | null }
type Sug = { kind: string; ref: string; label: string; sublabel: string; image: string | null; price: number | null; href: string }

const brl = (v: number) =>
  `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

const CHIPS = ['Charizard', 'Pikachu', 'Mewtwo', 'Rayquaza', 'Eevee', 'Gengar', 'Umbreon', 'Lucario']

export default function HomeDiscovery() {
  const router = useRouter()
  const [tops, setTops] = useState<TopCard[]>([])
  const [heroes, setHeroes] = useState<GenHero[]>([])
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Sug[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    supabase.rpc('get_top_cards', { lim: 12 }).then(({ data }) => setTops((data as TopCard[]) || []))
    supabase.rpc('get_generation_heroes').then(({ data }) => setHeroes((data as GenHero[]) || []))
  }, [])

  useEffect(() => {
    const t = q.trim()
    if (t.length < 2) { setResults([]); return }
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/busca?q=${encodeURIComponent(t)}`)
        const d = await r.json()
        setResults(d.results || [])
        setOpen(true)
      } catch {}
    }, 220)
    return () => clearTimeout(id)
  }, [q])

  const irBusca = () => { const t = q.trim(); if (t) router.push(`/busca?q=${encodeURIComponent(t)}`) }

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Bynx',
    url: 'https://bynx.gg',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: 'https://bynx.gg/busca?q={search_term_string}' },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <section style={{ background: '#080a0f', color: '#f0f0f0', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 20px 8px', textAlign: 'center' }}>
        <span style={{ display: 'inline-block', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.28)', color: '#f59e0b', fontSize: 12.5, fontWeight: 600, padding: '6px 15px', borderRadius: 999, marginBottom: 18 }}>
          + de 69 mil cartas catalogadas
        </span>
        <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 10 }}>
          Busque qualquer <span style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pokémon ou carta</span>
        </div>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 22 }}>
          Veja o preço real em reais, atualizado, de cada carta do Pokémon TCG.
        </p>

        <div style={{ position: 'relative', maxWidth: 600, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#11141c', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: '5px 6px 5px 18px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => { if (results.length) setOpen(true) }}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={(e) => { if (e.key === 'Enter') irBusca() }}
              placeholder="Busque um Pokémon ou uma carta..."
              autoComplete="off"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 16, padding: '14px 0', fontFamily: 'inherit' }}
            />
            <button onClick={irBusca} style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#000', fontWeight: 800, border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>Buscar</button>
          </div>

          {open && results.length > 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: '#11141c', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, overflow: 'hidden', zIndex: 40, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', textAlign: 'left' }}>
              {results.map((r, i) => (
                <button key={r.kind + r.ref + i} onMouseDown={() => router.push(r.href)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', color: '#fff', fontFamily: 'inherit' }}>
                  {r.kind === 'card' && r.image
                    ? <img src={r.image} alt="" style={{ width: 30, height: 42, objectFit: 'contain', borderRadius: 4, flex: '0 0 auto' }} />
                    : <span style={{ width: 30, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flex: '0 0 auto' }}>{r.kind === 'pokemon' ? '⚡' : '🃏'}</span>}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.kind === 'pokemon' ? 'Pokémon · ' : ''}{r.sublabel}</span>
                  </span>
                  {r.price ? <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', flex: '0 0 auto' }}>{brl(Number(r.price))}</span> : null}
                </button>
              ))}
              <button onMouseDown={irBusca} style={{ display: 'block', width: '100%', textAlign: 'center', padding: '11px', background: 'rgba(245,158,11,0.08)', border: 'none', color: '#f59e0b', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Ver todos os resultados →</button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 560, margin: '16px auto 0' }}>
          {CHIPS.map((c) => (
            <Link key={c} href={`/pokemon/${c.toLowerCase()}`} style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', padding: '7px 14px', borderRadius: 999, textDecoration: 'none' }}>{c}</Link>
          ))}
        </div>
      </div>

      {tops.length > 0 && (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em' }}>As mais valiosas em reais</h2>
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 14 }}>
            {tops.map((c) => (
              <Link key={c.id} href={`/carta/${c.id}`} style={{ flex: '0 0 184px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ background: '#0c0f17', padding: '16px 16px 8px', display: 'flex', justifyContent: 'center' }}>
                  {c.image_small && <img src={c.image_small} alt={c.name} loading="lazy" style={{ width: 128, height: 178, objectFit: 'contain', borderRadius: 6 }} />}
                </div>
                <div style={{ padding: '4px 14px 16px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', margin: '2px 0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.set_name || ''}</div>
                  {c.preco_medio != null && <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b' }}>{brl(Number(c.preco_medio))}</div>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {heroes.length > 0 && (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '34px 24px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em' }}>Explore por geração</h2>
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <Link href="/pokemon" style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, textDecoration: 'none' }}>Todos os Pokémon →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
            {heroes.map((h) => (
              <Link key={h.gen} href={`/pokemon/${h.slug}`} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}>
                <div style={{ background: '#0c0f17', padding: '14px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
                  <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 800, color: '#f59e0b', background: 'rgba(0,0,0,0.5)', padding: '3px 8px', borderRadius: 6 }}>Gen {h.gen} · {h.gen_name}</span>
                  {h.top_card_image && <img src={h.top_card_image} alt={h.name} loading="lazy" style={{ width: 110, height: 153, objectFit: 'contain', borderRadius: 6 }} />}
                </div>
                <div style={{ padding: '10px 14px 14px' }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{h.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{h.cards_count} cartas</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
