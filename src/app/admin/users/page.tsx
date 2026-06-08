'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
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
  // S32: novos campos enriquecidos pela API
  last_sign_in_at: string | null
  last_seen_at: string | null
  collection_count: number
  anuncios_count: number
  // S40: contagem de tickets
  tickets_total: number
  tickets_open: number
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

type SortKey =
  | 'name' | 'plano' | 'collection_count' | 'anuncios_count' | 'tickets'
  | 'scan_creditos' | 'last_sign_in_at' | 'last_seen_at' | 'created_at'

const SORT_LABELS: Record<SortKey, string> = {
  name: 'usuário', plano: 'plano', collection_count: 'coleção', anuncios_count: 'anúncios',
  tickets: 'tickets', scan_creditos: 'créditos', last_sign_in_at: 'último acesso',
  last_seen_at: 'última atividade', created_at: 'cadastro',
}

const PER_PAGE = 50

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// S32: tempo relativo legível pro "Último acesso" — "agora", "há 23min", "hoje 14h",
// "ontem", "há 3d", "há 2mes", "há 1a". Optimizado pra varredura visual rápida.
function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (isNaN(date.getTime())) return '—'
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 0) return 'agora'
  const diffMin = Math.floor(diffMs / 60_000)
  const diffH   = Math.floor(diffMs / 3_600_000)
  const diffD   = Math.floor(diffMs / 86_400_000)
  if (diffMin < 1)   return 'agora'
  if (diffMin < 60)  return `há ${diffMin}m`
  if (diffH < 24 && date.toDateString() === now.toDateString()) {
    return `hoje ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  }
  if (diffD === 1)   return 'ontem'
  if (diffD < 30)    return `há ${diffD}d`
  if (diffD < 365)   return `há ${Math.floor(diffD / 30)}mes`
  return `há ${Math.floor(diffD / 365)}a`
}

function UsersView() {
  const qp = useSearchParams()
  const [filter, setFilter] = useState(qp.get('filter') || '')
  const [q, setQ]           = useState('')
  const [users, setUsers]   = useState<User[] | null>(null)
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy]   = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  async function load() {
    setLoading(true)
    const p = new URLSearchParams()
    if (filter) p.set('filter', filter)
    if (q.trim()) p.set('q', q.trim())
    p.set('page', '1')
    p.set('perPage', '1000')

    const res = await fetch(`/api/admin/users?${p}`)
    setLoading(false)
    if (!res.ok) return
    const d = await res.json()
    setUsers(d.users || [])
    setTotal(d.total || 0)
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [filter])

  function handleSearch() {
    setPage(1)
    load()
  }

  const sortedUsers = useMemo(() => {
    if (!users) return []
    const dir = sortDir === 'asc' ? 1 : -1
    const rank: Record<User['plano_efetivo'], number> = { pro: 2, trial: 1, free: 0 }
    const dateVal = (v: string | null) => (v ? new Date(v).getTime() : null)
    const arr = [...users]
    arr.sort((a, b) => {
      switch (sortBy) {
        case 'name': {
          const av = (a.display_name || a.email || '').toLowerCase()
          const bv = (b.display_name || b.email || '').toLowerCase()
          return (av < bv ? -1 : av > bv ? 1 : 0) * dir
        }
        case 'plano':
          return (rank[a.plano_efetivo] - rank[b.plano_efetivo]) * dir
        case 'tickets':
          return ((a.tickets_open - b.tickets_open) || (a.tickets_total - b.tickets_total)) * dir
        case 'last_sign_in_at':
        case 'last_seen_at':
        case 'created_at': {
          const at = dateVal(a[sortBy]); const bt = dateVal(b[sortBy])
          if (at === null && bt === null) return 0
          if (at === null) return 1   // nulos sempre por último
          if (bt === null) return -1
          return (at - bt) * dir
        }
        default: {
          const av = Number((a as Record<string, unknown>)[sortBy] ?? 0)
          const bv = Number((b as Record<string, unknown>)[sortBy] ?? 0)
          return (av - bv) * dir
        }
      }
    })
    return arr
  }, [users, sortBy, sortDir])

  const totalPagesC = Math.max(1, Math.ceil(sortedUsers.length / PER_PAGE))
  const pageClamped = Math.min(page, totalPagesC)
  const pageUsers   = sortedUsers.slice((pageClamped - 1) * PER_PAGE, pageClamped * PER_PAGE)

  function toggleSort(col: SortKey) {
    if (col === sortBy) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(col); setSortDir(col === 'name' ? 'asc' : 'desc') }
    setPage(1)
  }

  function caret(col: SortKey) {
    const active = sortBy === col
    const c = active ? '#f59e0b' : 'rgba(255,255,255,0.25)'
    const d = !active ? 'M6 8l4-4 4 4M6 12l4 4 4-4' : sortDir === 'asc' ? 'M5 12l5-5 5 5' : 'M5 8l5 5 5-5'
    return <svg width="9" height="9" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}><path d={d} stroke={c} strokeWidth={active ? 2 : 1.4} strokeLinecap="round" strokeLinejoin="round" /></svg>
  }

  function thSort(label: string, col: SortKey, align: 'left' | 'center' | 'right' = 'left') {
    const active = sortBy === col
    return (
      <th style={{ ...th, textAlign: align, cursor: 'pointer', userSelect: 'none', color: active ? '#f59e0b' : th.color }} onClick={() => toggleSort(col)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start', width: '100%' }}>
          {label}{caret(col)}
        </span>
      </th>
    )
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1380, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px', color: '#f0f0f0' }}>
          Usuários
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
          {total.toLocaleString('pt-BR')} usuário{total === 1 ? '' : 's'} · ordenado por {SORT_LABELS[sortBy]} ({sortDir === 'asc' ? 'crescente' : 'decrescente'})
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
            overflow: 'auto',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1340 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {thSort('Usuário', 'name', 'left')}
                  {thSort('Plano', 'plano', 'center')}
                  {thSort('Coleção', 'collection_count', 'right')}
                  {thSort('Anúncios', 'anuncios_count', 'right')}
                  {thSort('Tickets', 'tickets', 'right')}
                  {thSort('Créditos', 'scan_creditos', 'right')}
                  {thSort('Último acesso', 'last_sign_in_at', 'right')}
                  {thSort('Última atividade', 'last_seen_at', 'right')}
                  {thSort('Cadastro', 'created_at', 'right')}
                  <th style={{ ...th, width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {pageUsers.map(u => {
                  const p = PLANO_STYLE[u.plano_efetivo]
                  return (
                    <tr key={u.id} style={{
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                      opacity: u.is_suspended ? 0.5 : 1,
                    }}>
                      <td style={td}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
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
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
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
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: u.collection_count > 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)' }}>
                        {u.collection_count.toLocaleString('pt-BR')}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: u.anuncios_count > 0 ? '#60a5fa' : 'rgba(255,255,255,0.25)', fontWeight: u.anuncios_count > 0 ? 700 : 400 }}>
                        {u.anuncios_count.toLocaleString('pt-BR')}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {u.tickets_total === 0 ? (
                          <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>
                        ) : (
                          <span>
                            <span style={{ color: u.tickets_open > 0 ? '#f59e0b' : 'rgba(255,255,255,0.55)', fontWeight: u.tickets_open > 0 ? 700 : 400 }}>
                              {u.tickets_open}
                            </span>
                            <span style={{ color: 'rgba(255,255,255,0.3)' }}> / {u.tickets_total}</span>
                          </span>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.7)' }}>
                        {u.scan_creditos ?? 0}
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: u.last_sign_in_at ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {formatRelativeTime(u.last_sign_in_at)}
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: u.last_seen_at ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {formatRelativeTime(u.last_seen_at)}
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: 12, whiteSpace: 'nowrap' }}>
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
          {totalPagesC > 1 && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', marginTop: 20 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={pageClamped === 1}
                style={pgBtn(pageClamped === 1)}
              >
                ← Anterior
              </button>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', minWidth: 80, textAlign: 'center' }}>
                Página {pageClamped} de {totalPagesC}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPagesC, p + 1))}
                disabled={pageClamped >= totalPagesC}
                style={pgBtn(pageClamped >= totalPagesC)}
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
  padding: '12px 14px',
  fontSize: 10, fontWeight: 800,
  color: 'rgba(255,255,255,0.45)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  textAlign: 'left',
  whiteSpace: 'nowrap',
}
const td: React.CSSProperties = { padding: '12px 14px', verticalAlign: 'middle' }

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