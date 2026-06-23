'use client'

import { useState, useEffect, useCallback } from 'react'

const GOLD = '#f59e0b'
const MUTED = 'rgba(255,255,255,0.45)'

interface Req {
  id: string
  tipo: string
  numero: string | null
  nome: string | null
  colecao: string | null
  card_id: string | null
  erro_tipo: string | null
  descricao: string | null
  termo_busca: string | null
  origem: string
  user_id: string | null
  status: string
  notificado: boolean
  created_at: string
  user_email: string | null
  user_name: string | null
  card: { id: string; name: string; number: string | null; set_name: string | null; image_small: string | null } | null
}

const STATUS_OPTS = [
  { v: 'pendente', label: 'Pendente', color: '#f59e0b' },
  { v: 'em_analise', label: 'Em analise', color: '#60a5fa' },
  { v: 'adicionada', label: 'Adicionada', color: '#22c55e' },
  { v: 'rejeitada', label: 'Rejeitada', color: '#ef4444' },
]

function fmtData(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function AdminCardRequestsPage() {
  const [reqs, setReqs] = useState<Req[]>([])
  const [loading, setLoading] = useState(true)
  const [fStatus, setFStatus] = useState('pendente')
  const [fTipo, setFTipo] = useState('')
  const [fOrigem, setFOrigem] = useState('')
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [notifying, setNotifying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (fStatus) params.set('status', fStatus)
    if (fTipo) params.set('tipo', fTipo)
    if (fOrigem) params.set('origem', fOrigem)
    if (q.trim()) params.set('q', q.trim())
    try {
      const r = await fetch(`/api/admin/card-requests?${params.toString()}`)
      const d = await r.json()
      setReqs(d.requests || [])
    } catch { setReqs([]) }
    setLoading(false)
  }, [fStatus, fTipo, fOrigem, q])

  useEffect(() => { load() }, [load])

  async function enviarResumo() {
    if (!confirm('Enviar e-mail-resumo para os usuarios com cartas marcadas como Adicionada e ainda nao avisadas? Cada usuario recebe um unico e-mail com todas as cartas dele.')) return
    setNotifying(true)
    try {
      const r = await fetch('/api/admin/card-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const d = await r.json()
      if (d.ok) alert(`${d.emails} e-mail(s) enviado(s) para ${d.usuarios} usuario(s) - ${d.cartas} carta(s).`)
      else alert(d.error || 'Falha ao enviar.')
      await load()
    } catch { alert('Erro ao enviar resumo.') }
    setNotifying(false)
  }

  const dup: Record<string, Set<string>> = {}
  for (const r of reqs) {
    const key = `${(r.nome || '').toLowerCase().trim()}|${(r.numero || '').trim()}`
    if (!dup[key]) dup[key] = new Set()
    if (r.user_id) dup[key].add(r.user_id)
  }
  const dupCount = (r: Req) => dup[`${(r.nome || '').toLowerCase().trim()}|${(r.numero || '').trim()}`]?.size || 1

  async function setStatus(id: string, status: string) {
    setSaving(id)
    try {
      await fetch('/api/admin/card-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id], status }),
      })
      await load()
    } catch {}
    setSaving(null)
  }

  const pillStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 12, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
    background: active ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${active ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
    color: active ? GOLD : MUTED,
  })

  function FilterRow({ value, set, opts }: { value: string; set: (v: string) => void; opts: { v: string; label: string }[] }) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {opts.map(o => (
          <button key={o.v} onClick={() => set(o.v)} style={pillStyle(value === o.v)}>{o.label}</button>
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 20px 60px', maxWidth: 1280, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f0f0f0', margin: 0 }}>Cartas faltando / erros</h1>
        <span style={{ fontSize: 13, color: MUTED }}>{loading ? 'carregando...' : `${reqs.length} pedido${reqs.length !== 1 ? 's' : ''}`}</span>
        <button onClick={enviarResumo} disabled={notifying}
          style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, padding: '9px 16px', borderRadius: 8, cursor: notifying ? 'default' : 'pointer', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#000', border: 'none', opacity: notifying ? 0.6 : 1, whiteSpace: 'nowrap' }}>
          {notifying ? 'Enviando...' : 'Enviar resumo (e-mail)'}
        </button>
      </div>
      <p style={{ fontSize: 13, color: MUTED, margin: '0 0 18px' }}>Marque cada carta como <strong style={{ color: '#22c55e' }}>Adicionada</strong> conforme catalogar. Depois clique em <strong style={{ color: GOLD }}>Enviar resumo</strong>: cada usuario recebe UM unico e-mail com todas as cartas dele (nunca um e-mail por carta).</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        <FilterRow value={fStatus} set={setFStatus} opts={[{ v: '', label: 'Todos' }, ...STATUS_OPTS.map(s => ({ v: s.v, label: s.label }))]} />
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <FilterRow value={fTipo} set={setFTipo} opts={[{ v: '', label: 'Tipo: todos' }, { v: 'faltando', label: 'Faltando' }, { v: 'erro', label: 'Erro' }]} />
          <FilterRow value={fOrigem} set={setFOrigem} opts={[{ v: '', label: 'Origem: todas' }, { v: 'form', label: 'Form' }, { v: 'auto', label: 'Auto' }]} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar nome/numero/termo..."
            style={{ fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 12px', color: '#f0f0f0', outline: 'none', minWidth: 220 }} />
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              {['Tipo', 'Carta', 'O que', 'Origem', 'Pediram', 'Usuario', 'Descricao', 'Data', 'Status'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: MUTED, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && reqs.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 28, textAlign: 'center', color: MUTED }}>Nenhum pedido com esses filtros.</td></tr>
            )}
            {reqs.map(r => {
              const isErro = r.tipo === 'erro'
              const n = dupCount(r)
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: isErro ? 'rgba(239,68,68,0.12)' : 'rgba(96,165,250,0.12)', color: isErro ? '#ff9bb0' : '#7fc4ff' }}>
                      {isErro ? 'Erro' : 'Faltando'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {r.card?.image_small && (
                        <img src={r.card.image_small} alt="" style={{ width: 28, height: 39, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#f0f0f0', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
                          {r.card?.name || r.nome || (r.termo_busca ? `"${r.termo_busca}"` : '—')}
                          {r.numero ? <span style={{ color: MUTED, fontWeight: 400 }}> · {r.numero}</span> : null}
                        </div>
                        {(r.card?.set_name || r.colecao) && (
                          <div style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{r.card?.set_name || r.colecao}</div>
                        )}
                        {r.card_id && <div style={{ fontSize: 10, color: 'rgba(245,158,11,0.6)' }}>{r.card_id}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: isErro ? '#ff9bb0' : MUTED, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{r.erro_tipo || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', color: MUTED }}>{r.origem === 'auto' ? 'Auto' : 'Form'}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: n > 1 ? GOLD : MUTED, fontWeight: n > 1 ? 700 : 400, whiteSpace: 'nowrap' }}>{n > 1 ? `${n}x` : '1x'}</td>
                  <td style={{ padding: '10px 12px', minWidth: 140 }}>
                    <div style={{ color: '#f0f0f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{r.user_name || '—'}</div>
                    <div style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{r.user_email || ''}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)', maxWidth: 220 }}>
                    <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.descricao || ''}>{r.descricao || '—'}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: MUTED, whiteSpace: 'nowrap', fontSize: 12 }}>{fmtData(r.created_at)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <select value={r.status} disabled={saving === r.id} onChange={e => setStatus(r.id, e.target.value)}
                      style={{ fontSize: 12, fontWeight: 600, background: '#15161e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 8px', color: STATUS_OPTS.find(s => s.v === r.status)?.color || '#f0f0f0', cursor: 'pointer', opacity: saving === r.id ? 0.5 : 1 }}>
                      {STATUS_OPTS.map(s => <option key={s.v} value={s.v} style={{ background: '#15161e', color: '#f0f0f0' }}>{s.label}</option>)}
                    </select>
                    {r.notificado && <div style={{ fontSize: 9, color: '#22c55e', marginTop: 3 }}>✓ avisado</div>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
