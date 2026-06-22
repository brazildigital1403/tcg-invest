'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Sug = { kind: string; ref: string; label: string; sublabel: string; image: string | null; price: number | null; href: string }

const brl = (v: number) =>
  `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

const CHIPS = ['Charizard', 'Pikachu', 'Mewtwo', 'Rayquaza', 'Eevee', 'Gengar', 'Umbreon', 'Lucario']

export default function HomeSearchBand() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Sug[]>([])
  const [open, setOpen] = useState(false)

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
    <div style={{ width: '100%', maxWidth: 660, margin: '0 auto 56px', textAlign: 'center' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
      <style>{`
        .hsb-chips { display:flex; flex-wrap:nowrap; gap:8px; justify-content:center; margin:16px auto 0; overflow-x:auto; padding-bottom:2px; scrollbar-width:none; }
        .hsb-chips::-webkit-scrollbar { display:none; }
        .hsb-chip { flex:0 0 auto; white-space:nowrap; font-size:13px; color:rgba(255,255,255,0.7); background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09); padding:7px 14px; border-radius:999px; text-decoration:none; }
        @media (max-width:680px){ .hsb-chips { justify-content:flex-start; } }
      `}</style>

      <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 10 }}>
        Busque qualquer <span style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pokémon ou carta</span>
      </h2>
      <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', marginBottom: 22 }}>
        Veja o preço real em reais, atualizado, de cada carta do Pokémon TCG.
      </p>

      <div style={{ position: 'relative' }}>
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

      <div className="hsb-chips">
        {CHIPS.map((c) => (
          <Link key={c} href={`/pokemon/${c.toLowerCase()}`} className="hsb-chip">{c}</Link>
        ))}
      </div>
    </div>
  )
}
