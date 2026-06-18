'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type TopCard = { id: string; name: string; set_name: string | null; image_small: string | null; preco_medio: number | null }
type GenHero = { gen: number; gen_name: string; slug: string; name: string; cards_count: number; top_card_id: string | null; top_card_image: string | null; top_card_price: number | null }

const brl = (v: number) =>
  `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

export default function HomeVitrines() {
  const [tops, setTops] = useState<TopCard[]>([])
  const [heroes, setHeroes] = useState<GenHero[]>([])

  useEffect(() => {
    supabase.rpc('get_top_cards', { lim: 12 }).then(({ data }) => setTops((data as TopCard[]) || []))
    supabase.rpc('get_generation_heroes').then(({ data }) => setHeroes((data as GenHero[]) || []))
  }, [])

  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px 0', textAlign: 'left' }}>
      {tops.length > 0 && (
        <div style={{ marginBottom: 8 }}>
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
        <div style={{ padding: '26px 0 8px' }}>
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
