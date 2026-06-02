'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Metrics = {
  tickets: { open: number; in_progress: number; resolved: number; last7: number }
  users:   { total: number; new7d: number; pro: number; trial: number }
  cards:   { total: number; catalogValue: number; registeredValue: number }
  topCards: { card_name: string; variante: string | null; preco_medio: number; owner_name: string; owner_username: string | null }[]
  topCollectors: { name: string; username: string | null; total_cartas: number }[]
}

const fmtBRL = (n: number) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function AdminDashboard() {
  const [m, setM] = useState<Metrics | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/admin/metrics')
      .then(async r => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(setM)
      .catch(() => setError(true))
  }, [])

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px', color: '#f0f0f0' }}>
          Visão geral
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
          Métricas atualizadas em tempo real.
        </p>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          color: '#ef4444',
          padding: '12px 16px',
          borderRadius: 10,
          fontSize: 13,
          marginBottom: 20,
        }}>
          Erro ao carregar métricas. Tenta recarregar a página.
        </div>
      )}

      {/* ── Tickets ── */}
      <SectionTitle>Tickets</SectionTitle>
      <Grid>
        <Card label="Abertos"       value={m?.tickets.open}        color="#f59e0b" href="/admin/tickets?status=open" />
        <Card label="Em andamento"  value={m?.tickets.in_progress} color="#60a5fa" href="/admin/tickets?status=in_progress" />
        <Card label="Resolvidos"    value={m?.tickets.resolved}    color="#22c55e" href="/admin/tickets?status=resolved" />
        <Card label="Novos (7d)"    value={m?.tickets.last7}       color="#a78bfa" />
      </Grid>

      {/* ── Usuários ── */}
      <SectionTitle>Usuários</SectionTitle>
      <Grid>
        <Card label="Total"         value={m?.users.total} color="#f0f0f0" />
        <Card label="Novos (7d)"    value={m?.users.new7d} color="#22c55e" />
        <Card label="Plano Pro"     value={m?.users.pro}   color="#f59e0b" />
        <Card label="Trial ativo"   value={m?.users.trial} color="#60a5fa" />
      </Grid>

      {/* ── Conteúdo ── */}
      <SectionTitle>Conteúdo</SectionTitle>
      <Grid>
        <Card label="Cartas cadastradas"           value={m?.cards.total?.toLocaleString('pt-BR')} color="#f59e0b" />
        <Card label="Valor das cartas cadastradas"  value={m ? fmtBRL(m.cards.registeredValue) : undefined} color="#22c55e" />
        <Card label="Valor do catálogo"             value={m ? fmtBRL(m.cards.catalogValue) : undefined} color="#60a5fa" />
      </Grid>

      {/* Top 10 lado a lado no desktop, empilhado no mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, alignItems: 'start' }}>
        <div>
          <SectionTitle>Top 10 cartas mais valiosas (por dono)</SectionTitle>
          <RankList
            rows={m?.topCards?.map((c, i) => ({
              rank: i + 1,
              main: c.card_name + (c.variante && c.variante !== 'normal' ? ` · ${c.variante}` : ''),
              sub: c.owner_username ? `@${c.owner_username} · ${c.owner_name}` : c.owner_name,
              href: c.owner_username ? `/perfil/${c.owner_username}` : undefined,
              right: fmtBRL(c.preco_medio),
              rightColor: '#22c55e',
            }))}
          />
        </div>
        <div>
          <SectionTitle>Top 10 colecionadores (por nº de cartas)</SectionTitle>
          <RankList
            rows={m?.topCollectors?.map((c, i) => ({
              rank: i + 1,
              main: c.name,
              sub: c.username ? `@${c.username}` : '—',
              href: c.username ? `/perfil/${c.username}` : undefined,
              right: `${Number(c.total_cartas).toLocaleString('pt-BR')} cartas`,
              rightColor: '#f59e0b',
            }))}
          />
        </div>
      </div>

      <div style={{ marginTop: 32, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href="/admin/tickets" style={btnPrimary}>Gerenciar tickets</Link>
      </div>

    </div>
  )
}

// ─── Componentes auxiliares ──────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 11, fontWeight: 800,
      textTransform: 'uppercase', letterSpacing: '0.1em',
      color: 'rgba(255,255,255,0.4)',
      margin: '28px 0 12px', paddingLeft: 2,
    }}>{children}</h2>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 12,
    }}>
      {children}
    </div>
  )
}

function Card({ label, value, color, href }: { label: string; value: any; color: string; href?: string }) {
  const inner = (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding: '18px 20px',
      transition: 'border-color .15s, background .15s',
      cursor: href ? 'pointer' : 'default',
      height: '100%',
    }}
    onMouseEnter={href ? (e) => {
      e.currentTarget.style.borderColor = `${color}55`
      e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
    } : undefined}
    onMouseLeave={href ? (e) => {
      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
      e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
    } : undefined}
    >
      <p style={{
        fontSize: 10, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.09em',
        color: 'rgba(255,255,255,0.4)',
        margin: '0 0 10px',
      }}>{label}</p>
      <p style={{
        fontSize: 28, fontWeight: 800,
        letterSpacing: '-0.03em',
        color,
        margin: 0, lineHeight: 1,
      }}>{value ?? '—'}</p>
    </div>
  )
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link> : inner
}

type RankRowData = { rank: number; main: string; sub: string; right: string; rightColor: string; href?: string }

function RankList({ rows }: { rows?: RankRowData[] }) {
  const wrap = (txt: string) => (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px 20px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{txt}</div>
  )
  if (!rows) return wrap('Carregando…')
  if (rows.length === 0) return wrap('Sem dados ainda.')

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
      {rows.map((r, i) => {
        const inner = (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.35)', width: 22, flexShrink: 0 }}>{r.rank}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, color: '#f0f0f0', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.main}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '2px 0 0' }}>{r.sub}</p>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: r.rightColor, flexShrink: 0 }}>{r.right}</span>
          </div>
        )
        return r.href
          ? <Link key={i} href={r.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>
          : <div key={i}>{inner}</div>
      })}
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
  color: '#000',
  padding: '10px 20px',
  borderRadius: 10,
  fontWeight: 800,
  textDecoration: 'none',
  fontSize: 13,
}