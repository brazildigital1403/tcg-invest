'use client'

import { useEffect, useState } from 'react'

type Data = {
  empty?: boolean
  captured_at?: string
  zr_status?: string | null
  plan_name?: string | null
  usage_credits?: number
  credit_limit?: number
  remaining_credits?: number
  usage_percent?: number
  period_ends_at?: string | null
  top_ups_count?: number
  rate_per_day?: number | null
  projected_exhaust_at?: string | null
  covers_cycle?: boolean | null
  health?: 'ok' | 'warn' | 'crit'
  estimando?: boolean
  stale_hours?: number
}

const COR = { ok: '#22c55e', warn: '#f59e0b', crit: '#ef4444' }

const fmtInt = (n?: number | null) =>
  n == null ? '—' : Math.round(n).toLocaleString('pt-BR')

const fmtDiaMes = (iso?: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

const relativo = (iso?: string) => {
  if (!iso) return ''
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 48) return `há ${h}h`
  return `há ${Math.round(h / 24)}d`
}

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
  padding: '18px 20px',
  marginBottom: 20,
}

const btnRetry: React.CSSProperties = {
  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444',
  fontWeight: 700, fontSize: 12, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
}

function Header({ cor }: { cor: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, color: cor, lineHeight: 1 }}>●</span>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
        ZenRows · Crédito do scan
      </p>
    </div>
  )
}

export default function ZenRowsCard() {
  const [d, setD] = useState<Data | null>(null)
  const [erro, setErro] = useState(false)

  function load() {
    setErro(false)
    fetch('/api/admin/zenrows-usage')
      .then(async r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setD)
      .catch(() => setErro(true))
  }

  useEffect(() => { load() }, [])

  if (erro) {
    return (
      <div style={card}>
        <Header cor={COR.crit} />
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '10px 0 0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          Erro ao ler o saldo.
          <button onClick={load} style={btnRetry}>Tentar de novo</button>
        </p>
      </div>
    )
  }

  if (!d) {
    return (
      <div style={card}>
        <Header cor={COR.warn} />
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '10px 0 0' }}>Carregando…</p>
      </div>
    )
  }

  if (d.empty) {
    return (
      <div style={card}>
        <Header cor={COR.warn} />
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '10px 0 0' }}>
          Sem snapshot ainda. A Mia Servidor grava de hora em hora.
        </p>
      </div>
    )
  }

  const cor = COR[d.health || 'warn']
  const pct = Math.min(100, Math.max(0, Number(d.usage_percent) || 0))
  const diasAteCiclo = d.period_ends_at
    ? Math.max(0, Math.ceil((new Date(d.period_ends_at).getTime() - Date.now()) / 86400000))
    : null
  const stale = (d.stale_hours ?? 0) > 3

  return (
    <div style={card}>
      <Header cor={cor} />

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '10px 0 12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', color: cor, lineHeight: 1 }}>
          {fmtInt(d.remaining_credits)}
        </span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>créditos restantes</span>
      </div>

      <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: cor, borderRadius: 999, transition: 'width .2s ease' }} />
      </div>

      <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', margin: '0 0 6px' }}>
        {fmtInt(d.usage_credits)} / {fmtInt(d.credit_limit)} · {pct.toFixed(0)}% usado · fecha{' '}
        <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{fmtDiaMes(d.period_ends_at)}</strong>
        {diasAteCiclo != null ? ` · ~${diasAteCiclo} dias` : ''}
        {d.plan_name ? ` · ${d.plan_name}` : ''}
        {d.top_ups_count ? ` + ${d.top_ups_count} top-up${d.top_ups_count > 1 ? 's' : ''}` : ''}
      </p>

      <p style={{ fontSize: 12.5, margin: 0, color: cor, fontWeight: 700 }}>
        {d.estimando
          ? 'ritmo: estimando… (precisa de mais snapshots)'
          : d.covers_cycle === false
            ? `ritmo ~${fmtInt(d.rate_per_day)}/dia → acaba ${fmtDiaMes(d.projected_exhaust_at)}, ANTES de renovar`
            : `ritmo ~${fmtInt(d.rate_per_day)}/dia → cobre até ${fmtDiaMes(d.projected_exhaust_at)}`}
      </p>

      <p style={{ fontSize: 11, color: stale ? '#f59e0b' : 'rgba(255,255,255,0.3)', margin: '10px 0 0' }}>
        {stale ? '⚠ ' : ''}atualizado {relativo(d.captured_at)}
        {stale ? ' — a tarefa de hora em hora pode estar parada' : ''}
      </p>
    </div>
  )
}
