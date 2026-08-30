'use client'

/**
 * src/app/admin/users/acessos/page.tsx
 *
 * Tela dedicada a "quem realmente está acessando a Bynx" (pedido do Du,
 * 12/08/2026: "sinto que temos usuários mas inúmeros não entram mais").
 *
 * Reusa a mesma API de /admin/users (já traz last_sign_in_at, last_seen_at,
 * created_at pra todo mundo em 1 chamada) — sem endpoint novo. O que muda é
 * o recorte: sem as 10 colunas de cartas/pastas/anúncios que distraem da
 * pergunta "quando essa pessoa apareceu pela última vez", com data e hora
 * exatas (não só relativo) e ordenado por padrão pra jogar quem sumiu há
 * mais tempo lá em cima.
 */

import { useEffect, useState, useMemo, Suspense } from 'react'
import Link from 'next/link'

type User = {
  id: string
  email: string
  display_name: string | null
  plano_efetivo: 'pro' | 'trial' | 'free'
  is_suspended: boolean
  created_at: string
  last_sign_in_at: string | null
  last_seen_at: string | null
}

const PLANO_STYLE: Record<User['plano_efetivo'], { label: string; color: string; bg: string; border: string }> = {
  pro:   { label: 'Pro',   color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)' },
  trial: { label: 'Trial', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.28)' },
  free:  { label: 'Free',  color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)' },
}

type FilterKey = 'todos' | 'nunca' | 'inativos30' | 'inativos90' | 'ativos7'
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'todos',        label: 'Todos' },
  { key: 'ativos7',      label: 'Ativos últimos 7d' },
  { key: 'inativos30',   label: 'Inativos 30d+' },
  { key: 'inativos90',   label: 'Inativos 90d+' },
  { key: 'nunca',        label: 'Nunca acessou' },
]

type SortKey = 'name' | 'created_at' | 'last_sign_in_at' | 'last_seen_at' | 'dias_sem_acesso'
const PER_PAGE = 50
const DIA_MS = 86_400_000

function diasDesde(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (isNaN(t)) return null
  return Math.floor((Date.now() - t) / DIA_MS)
}

function fmtExact(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function AcessosView() {
  const [users, setUsers]     = useState<User[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro]       = useState(false)
  const [filter, setFilter]   = useState<FilterKey>('todos')
  const [page, setPage]       = useState(1)
  const [sortBy, setSortBy]   = useState<SortKey>('last_sign_in_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc') // asc = quem sumiu há mais tempo primeiro

  async function load() {
    setLoading(true)
    setErro(false)
    try {
      const res = await fetch('/api/admin/users?page=1&perPage=2000')
      if (!res.ok) { setErro(true); return }
      const d = await res.json()
      setUsers(d.users || [])
    } catch {
      setErro(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── Resumo de saúde de retenção ──────────────────────────────────────────
  const resumo = useMemo(() => {
    if (!users) return null
    // Os buckets aqui tem que casar com o `filtered` abaixo, senao o card diz
    // um numero e o clique nele lista outro. Estavam com `else if` encadeado
    // (exclusivo) enquanto o filtro usa `d >= 30` (inclusivo): o card mostrava
    // 200 inativos e o filtro listava 239 -- subestimava churn em 16%.
    let nunca = 0, inativos30 = 0, inativos90 = 0, ativos7 = 0
    for (const u of users) {
      const d = diasDesde(u.last_sign_in_at)
      if (d === null) { nunca++; continue }
      if (d >= 30) inativos30++
      if (d >= 90) inativos90++
      if (d <= 7) ativos7++
    }
    return { total: users.length, nunca, inativos30, inativos90, ativos7 }
  }, [users])

  const filtered = useMemo(() => {
    if (!users) return []
    return users.filter(u => {
      const d = diasDesde(u.last_sign_in_at)
      switch (filter) {
        case 'nunca':      return d === null
        case 'inativos30': return d !== null && d >= 30
        case 'inativos90': return d !== null && d >= 90
        case 'ativos7':    return d !== null && d <= 7
        default:           return true
      }
    })
  }, [users, filter])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const arr = [...filtered]
    const dateVal = (v: string | null) => (v ? new Date(v).getTime() : null)
    arr.sort((a, b) => {
      if (sortBy === 'name') {
        const av = (a.display_name || a.email || '').toLowerCase()
        const bv = (b.display_name || b.email || '').toLowerCase()
        return (av < bv ? -1 : av > bv ? 1 : 0) * dir
      }
      if (sortBy === 'dias_sem_acesso') {
        const ad = diasDesde(a.last_sign_in_at)
        const bd = diasDesde(b.last_sign_in_at)
        // nunca acessou (null) conta como "infinito" — sempre no topo do "quem sumiu mais"
        const av = ad === null ? Infinity : ad
        const bv = bd === null ? Infinity : bd
        return (av - bv) * dir
      }
      const at = dateVal(a[sortBy as 'created_at' | 'last_sign_in_at' | 'last_seen_at'])
      const bt = dateVal(b[sortBy as 'created_at' | 'last_sign_in_at' | 'last_seen_at'])
      if (at === null && bt === null) return 0
      if (at === null) return 1
      if (bt === null) return -1
      return (at - bt) * dir
    })
    return arr
  }, [filtered, sortBy, sortDir])

  const totalPages   = Math.max(1, Math.ceil(sorted.length / PER_PAGE))
  const pageClamped  = Math.min(page, totalPages)
  const pageUsers     = sorted.slice((pageClamped - 1) * PER_PAGE, pageClamped * PER_PAGE)

  function toggleSort(col: SortKey) {
    if (col === sortBy) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(col); setSortDir(col === 'name' ? 'asc' : 'asc') }
    setPage(1)
  }

  function caret(col: SortKey) {
    const active = sortBy === col
    const c = active ? '#60a5fa' : 'rgba(255,255,255,0.25)'
    const d = !active ? 'M6 8l4-4 4 4M6 12l4 4 4-4' : sortDir === 'asc' ? 'M5 12l5-5 5 5' : 'M5 8l5 5 5-5'
    return <svg width="9" height="9" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}><path d={d} stroke={c} strokeWidth={active ? 2 : 1.4} strokeLinecap="round" strokeLinejoin="round" /></svg>
  }

  function thSort(label: string, col: SortKey, align: 'left' | 'right' = 'left') {
    const active = sortBy === col
    return (
      <th style={{ ...th, textAlign: align, cursor: 'pointer', userSelect: 'none', color: active ? '#60a5fa' : th.color }} onClick={() => toggleSort(col)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: align === 'right' ? 'flex-end' : 'flex-start', width: '100%' }}>
          {label}{caret(col)}
        </span>
      </th>
    )
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <div style={{ marginBottom: 8 }}>
        <Link href="/admin/users" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
          ← Usuários
        </Link>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px', color: '#f0f0f0' }}>
          Acessos e inatividade
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
          Quem realmente está voltando à Bynx — data e hora exatas de cada acesso, não estimativa.
        </p>
      </div>

      {/* ── Resumo ── */}
      {resumo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 22 }}>
          <StatCard label="Total de usuários" value={resumo.total} color="rgba(255,255,255,0.8)" />
          <StatCard label="Ativos últimos 7d" value={resumo.ativos7} color="#22c55e" />
          <StatCard label="Inativos 30d+" value={resumo.inativos30} color="#f59e0b" />
          <StatCard label="Inativos 90d+" value={resumo.inativos90} color="#ef4444" />
          <StatCard label="Nunca acessou" value={resumo.nunca} color="rgba(255,255,255,0.5)" />
        </div>
      )}

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const active = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(1) }}
              style={{
                padding: '7px 14px', borderRadius: 100,
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${active ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.08)'}`,
                background: active ? 'rgba(96,165,250,0.12)' : 'transparent',
                color: active ? '#60a5fa' : 'rgba(255,255,255,0.55)',
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* ── Tabela ── */}
      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Carregando...</p>
      ) : erro ? (
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px dashed rgba(239,68,68,0.3)', borderRadius: 14, padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: '#ef4444', margin: '0 0 12px' }}>Não deu pra carregar os acessos.</p>
          <button onClick={load} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', fontWeight: 700, fontSize: 12, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>Tentar de novo</button>
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 14, padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Nenhum usuário nesse filtro.</p>
        </div>
      ) : (
        <>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {thSort('Usuário', 'name', 'left')}
                  <th style={{ ...th, textAlign: 'center' }}>Plano</th>
                  {thSort('Cadastro', 'created_at', 'right')}
                  {thSort('Último acesso', 'last_sign_in_at', 'right')}
                  {thSort('Dias sem acesso', 'dias_sem_acesso', 'right')}
                  {thSort('Última atividade', 'last_seen_at', 'right')}
                  <th style={{ ...th, width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {pageUsers.map(u => {
                  const p = PLANO_STYLE[u.plano_efetivo]
                  const dias = diasDesde(u.last_sign_in_at)
                  const alerta = dias === null || dias >= 90
                  return (
                    <tr key={u.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', opacity: u.is_suspended ? 0.5 : 1 }}>
                      <td style={td}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                            {u.display_name || u.email}
                          </p>
                          {u.display_name && (
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                              {u.email}
                            </p>
                          )}
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 100, color: p.color, background: p.bg, border: `1px solid ${p.border}` }}>
                          {p.label}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmtDate(u.created_at)}
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: u.last_sign_in_at ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmtExact(u.last_sign_in_at)}
                      </td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                          color: dias === null ? 'rgba(255,255,255,0.3)' : alerta ? '#ef4444' : dias >= 30 ? '#f59e0b' : 'rgba(255,255,255,0.7)',
                        }}>
                          {dias === null ? 'nunca' : `${dias}d`}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: u.last_seen_at ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmtExact(u.last_seen_at)}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <Link href={`/admin/users/${u.id}`} style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700, textDecoration: 'none', padding: '4px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', whiteSpace: 'nowrap' }}>
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', marginTop: 20 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageClamped === 1} style={pgBtn(pageClamped === 1)}>← Anterior</button>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', minWidth: 80, textAlign: 'center' }}>Página {pageClamped} de {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pageClamped >= totalPages} style={pgBtn(pageClamped >= totalPages)}>Próxima →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
        {value.toLocaleString('pt-BR')}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

const th: React.CSSProperties = {
  padding: '11px 10px', fontSize: 10, fontWeight: 800,
  color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em',
  textAlign: 'left', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = { padding: '11px 10px', verticalAlign: 'middle' }

const pgBtn = (disabled: boolean): React.CSSProperties => ({
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  color: disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)',
  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'inherit',
  cursor: disabled ? 'not-allowed' : 'pointer',
})

export default function AdminAcessosPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'rgba(255,255,255,0.4)' }}>Carregando...</div>}>
      <AcessosView />
    </Suspense>
  )
}
