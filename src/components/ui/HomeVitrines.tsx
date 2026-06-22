'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type TopCard = { id: string; name: string; set_name: string | null; image_small: string | null; preco_medio: number | null }
type GenHero = { gen: number; gen_name: string; slug: string; name: string; cards_count: number; top_card_id: string | null; top_card_image: string | null; top_card_price: number | null }
type Mover = { window_days: number; direction: 'up' | 'down'; card_id: string; name: string; set_name: string | null; image_small: string | null; preco_atual: number | null; pct: number | null }

const brl = (v: number) =>
  `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

const pctFmt = (v: number) => `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')}%`

function IconTrend({ up }: { up: boolean }) {
  return up ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 7 9 13 13 9 21 17" /><polyline points="15 17 21 17 21 11" /></svg>
  )
}

const IconStar = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6l2.95 5.98 6.6.96-4.77 4.65 1.13 6.57L12 17.7l-5.9 3.06 1.13-6.57L2.45 9.54l6.6-.96z" /></svg>
)
const IconGrid = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
)

function SectionTitle({ icon, title, caption }: { icon: React.ReactNode; title: string; caption: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
      <span style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(245,158,11,0.13)', border: '1px solid rgba(245,158,11,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', flex: '0 0 auto' }}>{icon}</span>
      <div>
        <h2 style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-0.03em', margin: 0, lineHeight: 1.15 }}>{title}</h2>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{caption}</div>
      </div>
    </div>
  )
}

export default function HomeVitrines() {
  const [tops, setTops] = useState<TopCard[]>([])
  const [heroes, setHeroes] = useState<GenHero[]>([])
  const [movers, setMovers] = useState<Mover[]>([])
  const [win, setWin] = useState<7 | 30>(7)

  useEffect(() => {
    supabase.rpc('get_top_cards', { lim: 10 }).then(({ data }) => setTops((data as TopCard[]) || []))
    supabase.rpc('get_generation_heroes').then(({ data }) => setHeroes((data as GenHero[]) || []))
    supabase.rpc('get_price_movers', { p_limit: 10 }).then(({ data }) => setMovers((data as Mover[]) || []))
  }, [])

  const altas = movers.filter((m) => m.window_days === win && m.direction === 'up')
  const quedas = movers.filter((m) => m.window_days === win && m.direction === 'down')
  const temMovers = movers.length > 0

  const grupos = [
    { key: 'up', list: altas, label: 'Em alta', color: '#22c55e', up: true },
    { key: 'down', list: quedas, label: 'Em queda', color: '#ef4444', up: false },
  ] as const

  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px 0', textAlign: 'left' }}>

      {temMovers && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em' }}>Em alta e em queda</h2>
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 3, gap: 2 }}>
              {([7, 30] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setWin(d)}
                  style={{ font: 'inherit', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', background: win === d ? 'rgba(245,158,11,0.15)' : 'none', color: win === d ? '#f59e0b' : 'rgba(255,255,255,0.45)' }}
                >
                  {d} dias
                </button>
              ))}
            </div>
          </div>

          {grupos.map((grp) => grp.list.length > 0 && (
            <div key={grp.key} style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: grp.color, margin: '14px 0 12px' }}>
                <IconTrend up={grp.up} /> {grp.label}
              </div>
              <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 14 }}>
                {grp.list.map((m) => (
                  <Link key={m.card_id} href={`/carta/${m.card_id}`} style={{ flex: '0 0 168px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ position: 'relative', background: '#0c0f17', padding: '14px 14px 8px', display: 'flex', justifyContent: 'center' }}>
                      {m.image_small && <img src={m.image_small} alt={m.name} loading="lazy" style={{ width: 120, height: 167, objectFit: 'contain', borderRadius: 6 }} />}
                      <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 11.5, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: grp.up ? '#16a34a' : '#dc2626', color: '#fff' }}>
                        {m.pct != null ? pctFmt(Number(m.pct)) : ''}
                      </span>
                    </div>
                    <div style={{ padding: '4px 14px 14px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                      <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', margin: '2px 0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.set_name || ''}</div>
                      {m.preco_atual != null && <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b' }}>{brl(Number(m.preco_atual))}</div>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(tops.length > 0 || heroes.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 26, alignItems: 'start' }}>

          {tops.length > 0 && (
            <div style={{ minWidth: 0 }}>
              <SectionTitle icon={IconStar} title="As mais valiosas em reais" caption="As cartas mais caras do Brasil" />
              <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 14 }}>
                {tops.map((c) => (
                  <Link key={c.id} href={`/carta/${c.id}`} style={{ flex: '0 0 200px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ background: '#0c0f17', padding: '18px 18px 10px', display: 'flex', justifyContent: 'center' }}>
                      {c.image_small && <img src={c.image_small} alt={c.name} loading="lazy" style={{ width: 142, height: 198, objectFit: 'contain', borderRadius: 6 }} />}
                    </div>
                    <div style={{ padding: '6px 16px 18px' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '2px 0 9px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.set_name || ''}</div>
                      {c.preco_medio != null && <div style={{ fontSize: 17, fontWeight: 800, color: '#f59e0b' }}>{brl(Number(c.preco_medio))}</div>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {heroes.length > 0 && (
            <div style={{ minWidth: 0 }}>
              <SectionTitle icon={IconGrid} title="Explore por geração" caption="De Kanto a Paldea" />
              <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 14 }}>
                {heroes.map((h) => (
                  <Link key={h.gen} href={`/pokemon/${h.slug}`} style={{ flex: '0 0 200px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ background: '#0c0f17', padding: '18px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
                      <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 800, color: '#f59e0b', background: 'rgba(0,0,0,0.5)', padding: '3px 8px', borderRadius: 6 }}>Gen {h.gen} · {h.gen_name}</span>
                      {h.top_card_image && <img src={h.top_card_image} alt={h.name} loading="lazy" style={{ width: 134, height: 186, objectFit: 'contain', borderRadius: 6 }} />}
                    </div>
                    <div style={{ padding: '12px 16px 16px' }}>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{h.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{h.cards_count} cartas</div>
                    </div>
                  </Link>
                ))}
              </div>
              <div style={{ textAlign: 'right', marginTop: 2 }}>
                <Link href="/pokemon" style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, textDecoration: 'none' }}>Todos os Pokémon →</Link>
              </div>
            </div>
          )}

        </div>
      )}
    </section>
  )
}
