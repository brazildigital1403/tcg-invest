'use client'

/**
 * src/components/ui/HomeVitrines.tsx
 *
 * Modulo da home em 2 colunas (1/3 cartas · 2/3 mercado):
 *  - Esquerda: a carta mais valiosa em destaque (nº1) + nº2/nº3 atras (profundidade).
 *  - Direita: painel de mercado ao vivo em ranking, com abas Em alta / Em queda
 *    (toggle 7/30 dias) e Mais valiosas. Le get_price_movers + get_top_cards.
 * No mobile as colunas empilham (espacamento e tamanhos ajustados via media query).
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type TopCard = { id: string; name: string; set_name: string | null; image_small: string | null; preco_medio: number | null }
type Mover = { window_days: number; direction: 'up' | 'down'; card_id: string; name: string; set_name: string | null; image_small: string | null; preco_atual: number | null; pct: number | null }
type Row = { card_id: string; name: string; set_name: string | null; image_small: string | null; price: number | null; pct: number | null }

const brl = (v: number) =>
  `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

const pctFmt = (v: number) => `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')}%`

function cleanName(raw: string | null): string {
  if (!raw) return ''
  return raw
    .replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
    .replace(/\s*\(\d+\/\d+\)\s*$/, '').trim()
}

function IconTrend({ up }: { up: boolean }) {
  return up ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 7 9 13 13 9 21 17" /><polyline points="15 17 21 17 21 11" /></svg>
  )
}
const IconCoin = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2 0 0 1 2.5-1.5c1.4 0 2.5.7 2.5 1.7 0 2.3-5 1.3-5 3.6 0 1 1.1 1.7 2.5 1.7a2.5 2 0 0 0 2.5-1.5" /><path d="M12 7v10" /></svg>
)

export default function HomeVitrines() {
  const [tops, setTops] = useState<TopCard[]>([])
  const [movers, setMovers] = useState<Mover[]>([])
  const [tab, setTab] = useState<'up' | 'down' | 'top'>('up')
  const [win, setWin] = useState<7 | 30>(7)

  useEffect(() => {
    supabase.rpc('get_top_cards', { lim: 6 }).then(({ data }) => setTops((data as TopCard[]) || []))
    supabase.rpc('get_price_movers', { p_limit: 8 }).then(({ data }) => setMovers((data as Mover[]) || []))
  }, [])

  if (tops.length === 0 && movers.length === 0) return null

  const front = tops[0] || null
  const backL = tops[1] || null
  const backR = tops[2] || null

  let rows: Row[] = []
  if (tab === 'top') {
    rows = tops.slice(0, 6).map((t) => ({ card_id: t.id, name: cleanName(t.name), set_name: t.set_name, image_small: t.image_small, price: t.preco_medio, pct: null }))
  } else {
    rows = movers
      .filter((m) => m.window_days === win && m.direction === tab)
      .slice(0, 6)
      .map((m) => ({ card_id: m.card_id, name: cleanName(m.name), set_name: m.set_name, image_small: m.image_small, price: m.preco_atual, pct: m.pct }))
  }

  const TabBtn = ({ id, label, icon }: { id: 'up' | 'down' | 'top'; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => setTab(id)}
      className="hv-tab"
      style={tab === id
        ? { background: 'rgba(34,197,94,0.13)', borderColor: 'rgba(34,197,94,0.35)', color: '#22c55e' }
        : { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}
    >
      {icon} {label}
    </button>
  )

  const cardImg = (src: string | null, alt: string, cls: string) =>
    src
      ? <img src={src} alt={alt} loading="lazy" className={cls} />
      : <div className={`${cls} hv-ph`} />

  return (
    <section className="hv-sec">
      <style>{`
        .hv-sec { max-width:1180px; margin:0 auto; padding:44px 24px 56px; }
        .hv-split { display:grid; grid-template-columns:1fr 2fr; gap:30px; align-items:center; }
        .hv-tab { font:inherit; font-size:13px; font-weight:700; padding:8px 14px; border-radius:10px; border:1px solid transparent; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
        .hv-showcase { position:relative; min-height:250px; display:flex; align-items:center; justify-content:center; }
        .hv-showcase::before { content:''; position:absolute; top:46%; left:50%; transform:translate(-50%,-50%); width:270px; height:270px; background:radial-gradient(circle, rgba(245,158,11,0.16), transparent 68%); pointer-events:none; }
        .hv-imgF { width:150px; height:auto; display:block; border-radius:11px; border:1px solid rgba(255,255,255,0.14); }
        .hv-imgB { width:122px; height:auto; display:block; border-radius:11px; border:1px solid rgba(255,255,255,0.14); }
        .hv-ph { aspect-ratio:5 / 7; background:#11151f; }
        .hv-front { position:relative; z-index:3; transform:rotate(-3deg); text-decoration:none; }
        .hv-backL { position:absolute; top:50%; left:50%; z-index:1; transform:translate(-50%,-50%) translateX(-84px) translateY(10px) rotate(-13deg); opacity:0.72; }
        .hv-backR { position:absolute; top:50%; left:50%; z-index:1; transform:translate(-50%,-50%) translateX(84px) translateY(10px) rotate(13deg); opacity:0.72; }
        .hv-row { display:flex; align-items:center; gap:12px; padding:10px 4px; text-decoration:none; color:inherit; border-radius:9px; }
        .hv-row + .hv-row { border-top:1px solid rgba(255,255,255,0.05); }
        .hv-row:hover { background:rgba(255,255,255,0.025); }
        @media (max-width:860px){
          .hv-sec { padding:30px 18px 44px; }
          .hv-split { grid-template-columns:1fr; gap:22px; }
          .hv-showcase { min-height:214px; }
          .hv-imgF { width:138px; }
          .hv-imgB { width:108px; }
          .hv-backL { transform:translate(-50%,-50%) translateX(-70px) translateY(8px) rotate(-13deg); }
          .hv-backR { transform:translate(-50%,-50%) translateX(70px) translateY(8px) rotate(13deg); }
        }
      `}</style>

      <div className="hv-split">

        {/* ── Coluna 1: cartas ── */}
        <div>
          <div className="hv-showcase">
            {backL && <div className="hv-backL">{cardImg(backL.image_small, cleanName(backL.name), 'hv-imgB')}</div>}
            {backR && <div className="hv-backR">{cardImg(backR.image_small, cleanName(backR.name), 'hv-imgB')}</div>}
            {front && (
              <Link href={`/carta/${front.id}`} className="hv-front" style={{ filter: 'drop-shadow(0 0 30px rgba(245,158,11,0.3))' }}>
                <span style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%) rotate(-3deg)', zIndex: 4, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#000', fontSize: 9.5, fontWeight: 900, letterSpacing: '0.05em', padding: '4px 11px', borderRadius: 20, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(245,158,11,0.4)' }}>★ MAIS VALIOSA</span>
                {cardImg(front.image_small, cleanName(front.name), 'hv-imgF')}
                {front.preco_medio != null && (
                  <span style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%) rotate(-3deg)', zIndex: 4, background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(245,158,11,0.5)', color: '#f59e0b', fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 8, whiteSpace: 'nowrap' }}>{brl(Number(front.preco_medio))}</span>
                )}
              </Link>
            )}
          </div>
          <div style={{ textAlign: 'center', marginTop: 6 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(245,158,11,0.85)' }}>Destaque do dia</div>
            <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.62)', marginTop: 3 }}>A carta mais valiosa do Brasil agora</div>
          </div>
        </div>

        {/* ── Coluna 2: mercado ── */}
        <div style={{ background: '#0a0d14', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '20px 18px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#22c55e', marginBottom: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.8)' }} /> Dados ao vivo · em reais
          </div>
          <h2 style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 5px', color: '#f5f5f5' }}>O mercado Pokémon, em reais</h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.45, margin: '0 0 16px', maxWidth: 540 }}>Preços do mercado brasileiro, atualizados todo dia. O que subiu, o que caiu e as cartas mais valiosas.</p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <TabBtn id="up" label="Em alta" icon={<IconTrend up />} />
              <TabBtn id="down" label="Em queda" icon={<IconTrend up={false} />} />
              <TabBtn id="top" label="Mais valiosas" icon={IconCoin} />
            </div>
            {tab !== 'top' && (
              <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, padding: 3, gap: 2 }}>
                {([7, 30] as const).map((d) => (
                  <button key={d} onClick={() => setWin(d)} style={{ font: 'inherit', fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 6, border: 'none', cursor: 'pointer', background: win === d ? 'rgba(245,158,11,0.15)' : 'none', color: win === d ? '#f59e0b' : 'rgba(255,255,255,0.45)' }}>{d} dias</button>
                ))}
              </div>
            )}
          </div>

          <div>
            {rows.length === 0 && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', padding: '20px 4px' }}>Sem dados para esta janela ainda.</div>
            )}
            {rows.map((r, i) => (
              <Link key={r.card_id} href={`/carta/${r.card_id}`} className="hv-row">
                <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.28)', width: 14, textAlign: 'center', flex: '0 0 auto' }}>{i + 1}</span>
                <span style={{ width: 30, height: 42, borderRadius: 4, background: '#11151f', flex: '0 0 auto', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {r.image_small && <img src={r.image_small} alt={r.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#f0f0f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.set_name || ''}</span>
                </span>
                {r.price != null && <span style={{ fontSize: 13.5, fontWeight: 800, color: '#f59e0b', textAlign: 'right', flex: '0 0 auto', whiteSpace: 'nowrap' }}>{brl(Number(r.price))}</span>}
                {r.pct != null && <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, color: '#fff', width: 60, textAlign: 'center', flex: '0 0 auto', background: r.pct > 0 ? '#16a34a' : '#dc2626' }}>{pctFmt(Number(r.pct))}</span>}
              </Link>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <Link href="/ranking" style={{ fontSize: 12.5, fontWeight: 700, color: '#f59e0b', textDecoration: 'none' }}>Ver ranking completo →</Link>
          </div>
        </div>

      </div>
    </section>
  )
}
