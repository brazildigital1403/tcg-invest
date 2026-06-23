'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Point = { snapshot_date: string; preco_min: number | null; preco_medio: number | null; preco_max: number | null }

const fmtFull = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

const fmtCompact = (v: number) => {
  if (v >= 1000) return 'R$ ' + (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.', ',') + 'k'
  return 'R$ ' + Math.round(v)
}

const fmtDate = (s: string) => {
  const parts = s.split('-')
  return parts[2] + '/' + parts[1]
}

const RANGES = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '6m', days: 180 },
]

export default function PriceHistory({ cardId }: { cardId: string }) {
  const [all, setAll] = useState<Point[]>([])
  const [loaded, setLoaded] = useState(false)
  const [range, setRange] = useState(180)

  useEffect(() => {
    let active = true
    supabase.rpc('get_card_price_history', { p_id: cardId, p_days: 365 }).then(({ data }) => {
      if (!active) return
      setAll((data as Point[]) || [])
      setLoaded(true)
    })
    return () => { active = false }
  }, [cardId])

  const pts = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - range)
    const iso = cutoff.toISOString().slice(0, 10)
    return all.filter((p) => p.snapshot_date >= iso && p.preco_medio != null)
  }, [all, range])

  if (!loaded || all.length === 0) return null

  const showToggle = all.length > 1
  const single = pts.length <= 1

  const W = 600, H = 180, padL = 8, padR = 8, padT = 14, padB = 4
  const innerW = W - padL - padR, innerH = H - padT - padB
  const n = pts.length
  const mins = pts.map((p) => Number(p.preco_min != null ? p.preco_min : p.preco_medio))
  const maxs = pts.map((p) => Number(p.preco_max != null ? p.preco_max : p.preco_medio))
  let lo = mins.length ? Math.min.apply(null, mins) : 0
  let hi = maxs.length ? Math.max.apply(null, maxs) : 1
  if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1 }
  if (lo === hi) { lo = lo * 0.95; hi = hi * 1.05 || 1 }
  const span = hi - lo || 1
  const xOf = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const yOf = (v: number) => padT + innerH - ((v - lo) / span) * innerH

  const lineMedio = pts.map((p, i) => xOf(i) + ',' + yOf(Number(p.preco_medio))).join(' ')
  const bandTop = pts.map((p, i) => xOf(i) + ',' + yOf(Number(p.preco_max != null ? p.preco_max : p.preco_medio))).join(' ')
  const bandBot = pts.map((p, i) => xOf(n - 1 - i) + ',' + yOf(Number(pts[n - 1 - i].preco_min != null ? pts[n - 1 - i].preco_min : pts[n - 1 - i].preco_medio))).join(' ')
  const bandPath = n > 1 ? bandTop + ' ' + bandBot : ''

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px 20px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Histórico de preço</p>
        {showToggle && (
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3 }}>
            {RANGES.map((r) => (
              <button key={r.days} onClick={() => setRange(r.days)} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: range === r.days ? 'rgba(245,158,11,0.18)' : 'transparent', color: range === r.days ? '#f59e0b' : 'rgba(255,255,255,0.45)' }}>{r.label}</button>
            ))}
          </div>
        )}
      </div>

      {single ? (
        pts.length === 0 ? (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '8px 0' }}>Sem registros nesse período.</p>
        ) : (
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <p style={{ fontSize: 26, fontWeight: 900, color: '#60a5fa', letterSpacing: '-0.02em' }}>{fmtFull(Number(pts[0].preco_medio))}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6, lineHeight: 1.5 }}>Registrado em {fmtDate(pts[0].snapshot_date)}. O histórico passa a ser salvo todos os dias &mdash; volte em breve para acompanhar a evolução do preço.</p>
          </div>
        )
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 180, display: 'block' }}>
            {[0, 0.5, 1].map((t) => {
              const y = padT + innerH - t * innerH
              return <line key={t} x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            })}
            {bandPath && <polygon points={bandPath} fill="rgba(96,165,250,0.10)" stroke="none" />}
            <polyline points={lineMedio} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => <circle key={i} cx={xOf(i)} cy={yOf(Number(p.preco_medio))} r="2.5" fill="#60a5fa" />)}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
            <span>{fmtDate(pts[0].snapshot_date)}</span>
            <span>{fmtCompact(lo)} - {fmtCompact(hi)}</span>
            <span>{fmtDate(pts[n - 1].snapshot_date)}</span>
          </div>

          <div style={{ marginTop: 14, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <th style={{ textAlign: 'left', fontWeight: 600, padding: '4px 0' }}>Data</th>
                  <th style={{ textAlign: 'right', fontWeight: 600, padding: '4px 8px' }}>Min</th>
                  <th style={{ textAlign: 'right', fontWeight: 600, padding: '4px 8px' }}>Médio</th>
                  <th style={{ textAlign: 'right', fontWeight: 600, padding: '4px 0' }}>Max</th>
                </tr>
              </thead>
              <tbody>
                {pts.slice(-6).reverse().map((p, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ textAlign: 'left', padding: '6px 0', color: 'rgba(255,255,255,0.7)' }}>{fmtDate(p.snapshot_date)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', color: '#22c55e' }}>{p.preco_min != null ? fmtFull(Number(p.preco_min)) : '-'}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', color: '#60a5fa', fontWeight: 700 }}>{p.preco_medio != null ? fmtFull(Number(p.preco_medio)) : '-'}</td>
                    <td style={{ textAlign: 'right', padding: '6px 0', color: '#f59e0b' }}>{p.preco_max != null ? fmtFull(Number(p.preco_max)) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
