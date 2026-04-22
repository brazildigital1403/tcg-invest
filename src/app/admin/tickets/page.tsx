'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type Ticket = {
  id: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: string
  created_at: string
  last_message_at: string
  user_email: string | null
  user_name:  string | null
}

const STATUS_TABS = [
  { key: '',            label: 'Todos' },
  { key: 'open',        label: 'Abertos' },
  { key: 'in_progress', label: 'Em andamento' },
  { key: 'resolved',    label: 'Resolvidos' },
  { key: 'closed',      label: 'Fechados' },
]

const STATUS: Record<Ticket['status'], { label: string; color: string }> = {
  open:        { label: 'Aberto',       color: '#f59e0b' },
  in_progress: { label: 'Em andamento', color: '#60a5fa' },
  resolved:    { label: 'Resolvido',    color: '#22c55e' },
  closed:      { label: 'Fechado',      color: '#64748b' },
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'agora'
  if (mins  < 60) return `${mins}min`
  if (hours < 24) return `${hours}h`
  if (days  < 7)  return `${days}d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function TicketsView() {
  const qp = useSearchParams()
  const [status, setStatus]   = useState(qp.get('status') || '')
  const [q, setQ]             = useState('')
  const [rows, setRows]       = useState<Ticket[] | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    if (q.trim()) p.set('q', q.trim())
    const res = await fetch(`/api/admin/tickets?${p}`)
    setLoading(false)
    if (!res.ok) return
    const d = await res.json()
    setRows(d.tickets || [])
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [status])

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1100, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px', color: '#f0f0f0' }}>
          Tickets
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
          Últimos 200 tickets, ordenados pela atividade mais recente.
        </p>
      </div>

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        {STATUS_TABS.map(t => {
          const active = status === t.key
          return (
            <button
              key={t.key || 'all'}
              onClick={() => setStatus(t.key)}
              style={{
                padding: '7px 14px',
                borderRadius: 100,
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                border: `1px solid ${active ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`,
                background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                color: active ? '#f59e0b' : 'rgba(255,255,255,0.55)',
              }}
            >
              {t.label}
            </button>
          )
        })}

        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
          onBlur={load}
          placeholder="Buscar por assunto..."
          style={{
            flex: 1, minWidth: 180,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 100,
            padding: '7px 14px',
            color: '#f0f0f0', fontSize: 13,
            outline: 'none',
            fontFamily: 'inherit',
            marginLeft: 'auto',
          }}
        />
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Carregando...</p>
      ) : !rows || rows.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px dashed rgba(255,255,255,0.12)',
          borderRadius: 14, padding: '40px 20px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Nenhum ticket encontrado.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(t => {
            const s = STATUS[t.status]
            return (
              <Link key={t.id} href={`/admin/tickets/${t.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    padding: '14px 18px',
                    display: 'flex', alignItems: 'center', gap: 14,
                    transition: 'border-color .15s, background .15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(245,158,11,0.25)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  }}
                >
                  {/* Dot de status */}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: s.color, flexShrink: 0,
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 14, fontWeight: 700,
                      color: '#f0f0f0', margin: '0 0 3px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {t.subject}
                    </p>
                    <p style={{
                      fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {t.user_name || t.user_email || 'Usuário sem dados'}
                    </p>
                  </div>

                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: s.color, margin: '0 0 2px' }}>
                      {s.label}
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                      {relativeTime(t.last_message_at)}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

    </div>
  )
}

export default function AdminTicketsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'rgba(255,255,255,0.4)' }}>Carregando...</div>}>
      <TicketsView />
    </Suspense>
  )
}