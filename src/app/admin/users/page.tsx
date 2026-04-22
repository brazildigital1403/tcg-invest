'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type User = {
  id: string
  email: string
  display_name: string | null
  username: string | null
  city: string | null
  whatsapp: string | null
  is_pro: boolean
  plano_efetivo: 'pro' | 'trial' | 'free'
  trial_days_left: number
  scan_creditos: number | null
  is_suspended: boolean
  created_at: string
}

const FILTER_TABS = [
  { key: '',          label: 'Todos' },
  { key: 'pro',       label: 'Pro' },
  { key: 'trial',     label: 'Trial' },
  { key: 'free',      label: 'Free' },
  { key: 'suspended', label: 'Suspensos' },
]

const PLANO_STYLE: Record<User['plano_efetivo'], { label: string; color: string; bg: string; border: string }> = {
  pro:   { label: 'Pro',   color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)' },
  trial: { label: 'Trial', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.28)' },
  free:  { label: 'Free',  color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function UsersView() {
  const qp = useSearchParams()
  const [filter, setFilter] = useState(qp.get('filter') || '')
  const [q, setQ]           = useState('')
  const [users, setUsers]   = useState<User[] | null>(null)
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const p = new URLSearchParams()
    if (filter) p.set('filter', filter)
    if (q.trim()) p.set('q', q.trim())
    p.set('page', String(page))
    p.set('perPage', '50')

    const res = await fetch(`/api/admin/users?${p}`)
    setLoading(false)
    if (!res.ok) return
    const d = await res.json()
    setUsers(d.users || [])
    setTotal(d.total || 0)
    setTotalPages(d.totalPages || 1)
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [filter, page])

  function handleSearch() {
    setPage(1)
    load()
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px', color: '#f0f0f0' }}>
          Usuários
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
          {total.toLocaleString('pt-BR')} usuário{total === 1 ? '' : 's'} · ordenados por cadastro mais recente
        </p>
      </div>

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTER_TABS.map(t => {
          const active = filter === t.key
          const isRed = t.key === 'suspended'
          const color = active ? (isRed ? '#ef4444' : '#f59e0b') : 'rgba(255,255,255,0.55)'
          const bg    = active ? (isRed ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)') : 'transparent'
          const bd    = active ? (isRed ? 'rgba(239,68,68,0.3)'  : 'rgba(245,158,11,0.3)')  : 'rgba(255,255,255,0.08)'
          return (
            <button
              key={t.key || 'all'}
              onClick={() => { setFilter(t.key); setPage(1) }}
              style={{
                padding: '7px 14px', borderRadius: 100,
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${bd}`,
                background: bg, color,
              }}
            >
              {t.label}
            </button>
          )
        })}

        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flex: 1, maxWidth: 380 }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar por email, nome ou username..."
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 100,
              padding: '7px 14px',
              color: '#f0f0f0', fontSize: 13,
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#f0f0f0',
              padding: '7px 14px', borderRadius: 100,
              fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Buscar
          </button>
        </div>
      </div>

      {/* ── Tabela ── */}
      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Carregando...</p>
      ) : !users || users.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px dashed rgba(255,255,255,0.12)',
          borderRadius: 14, padding: '40px 20px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <>
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th style={th}>Usuário</th>
                  <th style={{ ...th, textAlign: 'center' }}>Plano</th>
                  <th style={{ ...th, textAlign: 'right' }}>Créditos scan</th>
                  <th style={{ ...th, textAlign: 'right' }}>Cadastro</th>
                  <th style={{ ...th, width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const p = PLANO_STYLE[u.plano_efetivo]
                  return (
                    <tr key={u.id} style={{
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                      opacity: u.is_suspended ? 0.5 : 1,
                    }}>
                      <td style={td}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                              {u.display_name || u.email}
                            </p>
                            {u.is_suspended && (
                              <span style={{
                                fontSize: 9, fontWeight: 800,
                                padding: '2px 8px', borderRadius: 100,
                                color: '#ef4444', background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                flexShrink: 0,
                              }}>
                                Suspenso
                              </span>
                            )}
                          </div>
                          {u.display_name && (
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                              {u.email}
                            </p>
                          )}
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          fontSize: 11, fontWeight: 800,
                          padding: '4px 10px', borderRadius: 100,
                          color: p.color, background: p.bg,
                          border: `1px solid ${p.border}`,
                        }}>
                          {p.label}{u.plano_efetivo === 'trial' && u.trial_days_left ? ` · ${u.trial_days_left}d` : ''}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.7)' }}>
                        {u.scan_creditos ?? 0}
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                        {formatDate(u.created_at)}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <Link
                          href={`/admin/users/${u.id}`}
                          style={{
                            color: '#f59e0b', fontSize: 12, fontWeight: 700,
                            textDecoration: 'none',
                            padding: '4px 10px', borderRadius: 8,
                            background: 'rgba(245,158,11,0.08)',
                            border: '1px solid rgba(245,158,11,0.2)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Paginação ── */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', marginTop: 20 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={pgBtn(page === 1)}
              >
                ← Anterior
              </button>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', minWidth: 80, textAlign: 'center' }}>
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={pgBtn(page >= totalPages)}
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}

    </div>
  )
}

const th: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 10, fontWeight: 800,
  color: 'rgba(255,255,255,0.45)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  textAlign: 'left',
}
const td: React.CSSProperties = { padding: '12px 16px', verticalAlign: 'middle' }

const pgBtn = (disabled: boolean): React.CSSProperties => ({
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)',
  padding: '6px 14px', borderRadius: 8,
  fontSize: 12, fontFamily: 'inherit',
  cursor: disabled ? 'not-allowed' : 'pointer',
})

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'rgba(255,255,255,0.4)' }}>Carregando...</div>}>
      <UsersView />
    </Suspense>
  )
}