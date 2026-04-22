'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useAppModal } from '@/components/ui/useAppModal'

type User = {
  id: string
  email: string
  name: string | null
  display_name: string | null
  username: string | null
  cpf: string | null
  city: string | null
  whatsapp: string | null
  is_pro: boolean
  plano: string | null
  plano_efetivo: 'pro' | 'trial' | 'free'
  trial_days_left: number
  trial_expires_at: string | null
  pro_expira_em: string | null
  scan_creditos: number | null
  created_at: string
}

type Stats = { total_cards: number; total_tickets: number }

type CollectionCard = {
  id: string
  card_name: string
  card_image: string | null
  variante: string | null
  quantity: number
  rarity: string | null
  set_name: string | null
  preco_unitario: number
  valor_total: number
}

const PLANO_STYLE: Record<User['plano_efetivo'], { label: string; color: string; bg: string; border: string }> = {
  pro:   { label: 'Pro',   color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)' },
  trial: { label: 'Trial', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.28)' },
  free:  { label: 'Free',  color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)' },
}

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const fmtDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtDateTime = (iso?: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AdminUserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { showAlert, showConfirm, showPrompt } = useAppModal()

  const [loading, setLoading] = useState(true)
  const [user, setUser]       = useState<User | null>(null)
  const [stats, setStats]     = useState<Stats | null>(null)

  // Aba ativa
  const [tab, setTab] = useState<'info' | 'collection' | 'resync'>('info')

  // Coleção (lazy load)
  const [collection, setCollection] = useState<{ cards: CollectionCard[]; total_cards: number; total_value: number } | null>(null)
  const [loadingCol, setLoadingCol] = useState(false)

  // Busy de ações
  const [busy, setBusy] = useState(false)

  // Resync
  const [resyncCardName, setResyncCardName] = useState('')
  const [resyncResult, setResyncResult]     = useState<any>(null)

  async function load() {
    const res = await fetch(`/api/admin/users/${id}`)
    setLoading(false)
    if (!res.ok) return
    const d = await res.json()
    setUser(d.user)
    setStats(d.stats)
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [id])

  async function loadCollection() {
    if (collection) return
    setLoadingCol(true)
    const res = await fetch(`/api/admin/users/${id}/collection`)
    setLoadingCol(false)
    if (!res.ok) return
    const d = await res.json()
    setCollection(d)
  }

  // ─── Ações ────────────────────────────────────────────────────────────────

  async function doAction(action: string, value: any, successMsg: string) {
    setBusy(true)
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, value }),
    })
    setBusy(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return showAlert(err.error || 'Erro ao executar ação.', 'error')
    }
    showAlert(successMsg, 'success')
    await load()
  }

  async function grantPro() {
    const input = await showPrompt({
      message: 'Conceder Pro por quantos meses?',
      placeholder: '1, 3, 6, 12...',
      defaultValue: '1',
    })
    if (!input) return
    const months = parseInt(input)
    if (!months || months < 1 || months > 60) {
      return showAlert('Informe um número entre 1 e 60.', 'warning')
    }
    const ok = await showConfirm({
      message: `Conceder Pro por ${months} ${months === 1 ? 'mês' : 'meses'} a ${user?.email}?`,
    })
    if (!ok) return
    await doAction('grant_pro', months, `Pro concedido por ${months} ${months === 1 ? 'mês' : 'meses'}.`)
  }

  async function revokePro() {
    const ok = await showConfirm({
      message: `Revogar Pro de ${user?.email}? O usuário voltará ao plano Free.`,
      danger: true,
      confirmLabel: 'Revogar',
    })
    if (!ok) return
    await doAction('revoke_pro', null, 'Pro revogado.')
  }

  async function extendTrial() {
    const input = await showPrompt({
      message: 'Estender trial por quantos dias?',
      placeholder: '7, 15, 30...',
      defaultValue: '7',
    })
    if (!input) return
    const days = parseInt(input)
    if (!days || days < 1 || days > 365) {
      return showAlert('Informe um número entre 1 e 365.', 'warning')
    }
    await doAction('extend_trial', days, `Trial estendido por ${days} ${days === 1 ? 'dia' : 'dias'}.`)
  }

  async function addCredits() {
    const input = await showPrompt({
      message: 'Adicionar quantos créditos de scan?',
      placeholder: '5, 10, 50...',
      defaultValue: '10',
    })
    if (!input) return
    const amount = parseInt(input)
    if (!amount || amount < 1 || amount > 1000) {
      return showAlert('Informe um número entre 1 e 1000.', 'warning')
    }
    await doAction('add_scan_credits', amount, `+${amount} créditos de scan adicionados.`)
  }

  // ─── Resync de preços ─────────────────────────────────────────────────────

  async function doResync() {
    if (!resyncCardName.trim()) {
      return showAlert('Informe o nome exato da carta.', 'warning')
    }
    setBusy(true)
    setResyncResult(null)
    const res = await fetch('/api/admin/resync-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardName: resyncCardName.trim() }),
    })
    setBusy(false)
    const d = await res.json()
    if (!res.ok) {
      return showAlert(d.error || 'Erro ao ressincronizar.', 'error')
    }
    setResyncResult(d)
    showAlert(`Preços atualizados para "${d.cardName}".`, 'success')
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={{ padding: 40, color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Sans', textAlign: 'center' }}>Carregando...</div>
  }

  if (!user) {
    return (
      <div style={{ padding: 40, fontFamily: 'DM Sans', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
        <p>Usuário não encontrado.</p>
        <Link href="/admin/users" style={{ color: '#f59e0b', fontSize: 14, textDecoration: 'none' }}>← Voltar</Link>
      </div>
    )
  }

  const p = PLANO_STYLE[user.plano_efetivo]

  return (
    <div style={{ padding: '28px 24px', maxWidth: 1100, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <Link href="/admin/users" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', gap: 6, marginBottom: 14 }}>
        ← Voltar para Usuários
      </Link>

      {/* ── Cabeçalho ── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{
            width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, color: '#000', letterSpacing: '-0.02em',
          }}>
            {(user.display_name || user.email).charAt(0).toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 4px', color: '#f0f0f0' }}>
              {user.display_name || 'Sem nome'}
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 8px', wordBreak: 'break-all' }}>
              {user.email}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11, fontWeight: 800,
                padding: '4px 10px', borderRadius: 100,
                color: p.color, background: p.bg,
                border: `1px solid ${p.border}`,
              }}>
                Plano {p.label}{user.plano_efetivo === 'trial' && user.trial_days_left ? ` · ${user.trial_days_left}d restantes` : ''}
              </span>
              {user.username && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: '4px 10px', borderRadius: 100, background: 'rgba(255,255,255,0.04)' }}>
                  @{user.username}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {user.username && (
              <a
                href={`/perfil/${user.username}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.7)',
                  padding: '8px 14px', borderRadius: 10,
                  fontSize: 12, fontWeight: 600,
                  textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                Perfil público →
              </a>
            )}
          </div>
        </div>

        {/* Stats rápidas */}
        <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
          <MiniStat label="Cartas na coleção" value={stats?.total_cards?.toLocaleString('pt-BR') ?? '—'} />
          <MiniStat label="Créditos de scan"  value={user.scan_creditos?.toString() || '0'} />
          <MiniStat label="Tickets abertos"   value={stats?.total_tickets?.toString() || '0'} />
          <MiniStat label="Membro desde"      value={fmtDate(user.created_at)} />
        </div>
      </div>

      {/* ── Abas ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <TabButton active={tab === 'info'}       onClick={() => setTab('info')}>Dados & Ações</TabButton>
        <TabButton active={tab === 'collection'} onClick={() => { setTab('collection'); loadCollection() }}>Coleção</TabButton>
        <TabButton active={tab === 'resync'}     onClick={() => setTab('resync')}>Resync de preços</TabButton>
      </div>

      {/* ── Aba: Info & Ações ── */}
      {tab === 'info' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }} className="user-grid">

          {/* ── Dados cadastrais ── */}
          <div style={surface}>
            <h3 style={sectionTitle}>Dados cadastrais</h3>
            <InfoRow label="Nome"          value={user.name || '—'} />
            <InfoRow label="Email"         value={user.email} mono />
            <InfoRow label="Username"      value={user.username ? `@${user.username}` : '—'} />
            <InfoRow label="Cidade"        value={user.city || '—'} />
            <InfoRow label="WhatsApp"      value={user.whatsapp || '—'} />
            <InfoRow label="CPF"           value={user.cpf ? '****' + user.cpf.slice(-4) : '—'} mono />

            <h3 style={{ ...sectionTitle, marginTop: 28 }}>Assinatura</h3>
            <InfoRow label="Status" value={user.is_pro ? 'Pro ativo' : user.plano_efetivo === 'trial' ? `Trial (${user.trial_days_left} dias)` : 'Free'} />
            <InfoRow label="Plano" value={user.plano || '—'} />
            <InfoRow label="Pro expira em"   value={fmtDateTime(user.pro_expira_em)} />
            <InfoRow label="Trial expira em" value={fmtDateTime(user.trial_expires_at)} />
          </div>

          {/* ── Ações administrativas ── */}
          <aside style={{ ...surface, position: 'sticky', top: 80 }}>
            <h3 style={sectionTitle}>⚡ Ações rápidas</h3>

            <ActionButton label="Conceder Pro"     onClick={grantPro}     color="#f59e0b" busy={busy} />
            {user.is_pro && (
              <ActionButton label="Revogar Pro"    onClick={revokePro}    color="#ef4444" busy={busy} variant="outline" />
            )}
            <ActionButton label="Estender trial"   onClick={extendTrial}  color="#60a5fa" busy={busy} variant="outline" />
            <ActionButton label="+ Créditos scan"  onClick={addCredits}   color="#22c55e" busy={busy} variant="outline" />

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 16, marginBottom: 0, lineHeight: 1.5 }}>
              Todas as ações são gravadas com a data/hora atual. Conceder Pro estende a partir da data de expiração existente se ainda estiver ativo.
            </p>
          </aside>
        </div>
      )}

      {/* ── Aba: Coleção ── */}
      {tab === 'collection' && (
        <div style={surface}>
          {loadingCol ? (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Carregando coleção...</p>
          ) : !collection || collection.cards.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Este usuário não tem cartas cadastradas.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 24, marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
                <MiniStat label="Total de cartas" value={collection.total_cards.toLocaleString('pt-BR')} />
                <MiniStat label="Valor estimado"  value={fmtBRL(collection.total_value)} highlight />
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={th}>Carta</th>
                      <th style={{ ...th, textAlign: 'center' }}>Qtd</th>
                      <th style={{ ...th, textAlign: 'center' }}>Variante</th>
                      <th style={{ ...th, textAlign: 'right' }}>Preço un.</th>
                      <th style={{ ...th, textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collection.cards.map(c => (
                      <tr key={c.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            {c.card_image && <img src={c.card_image} alt="" style={{ width: 28, height: 39, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />}
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontSize: 13, color: '#f0f0f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                                {c.card_name}
                              </p>
                              {c.set_name && (
                                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>{c.set_name}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ ...td, textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>{c.quantity}</td>
                        <td style={{ ...td, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{c.variante || 'normal'}</td>
                        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.7)' }}>
                          {fmtBRL(c.preco_unitario)}
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#f59e0b', fontWeight: 700 }}>
                          {fmtBRL(c.valor_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Aba: Resync ── */}
      {tab === 'resync' && (
        <div style={surface}>
          <h3 style={sectionTitle}>Forçar atualização de preço</h3>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 20 }}>
            Ressincroniza os preços de uma carta específica com a LigaPokemon, sem esperar o cron das 3h. Útil quando um usuário reporta preço desatualizado.
          </p>

          <label style={label}>Nome exato da carta</label>
          <input
            value={resyncCardName}
            onChange={e => setResyncCardName(e.target.value)}
            placeholder="Ex: Charizard ex (SVP 131)"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, padding: '12px 14px',
              color: '#f0f0f0', fontSize: 14,
              outline: 'none', boxSizing: 'border-box',
              fontFamily: 'inherit', marginBottom: 14,
            }}
          />

          <button
            onClick={doResync}
            disabled={busy || !resyncCardName.trim()}
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              border: 'none', color: '#000',
              padding: '10px 22px', borderRadius: 10,
              fontSize: 13, fontWeight: 800,
              cursor: (busy || !resyncCardName.trim()) ? 'not-allowed' : 'pointer',
              opacity: (busy || !resyncCardName.trim()) ? 0.5 : 1,
              fontFamily: 'inherit',
            }}
          >
            {busy ? 'Ressincronizando...' : 'Forçar atualização'}
          </button>

          {resyncResult && (
            <div style={{
              marginTop: 22, padding: 16,
              background: 'rgba(34,197,94,0.05)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 10,
            }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
                ✓ Atualizado: {resyncResult.cardName}
              </p>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
                {Object.entries(resyncResult.variantes || {}).map(([k, v]: [string, any]) => (
                  <div key={k} style={{ marginBottom: 4 }}>
                    <strong style={{ color: '#f59e0b' }}>{k}:</strong> min {fmtBRL(v.min)} · médio {fmtBRL(v.medio)} · max {fmtBRL(v.max)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .user-grid {
            grid-template-columns: 1fr !important;
          }
          aside[style*="position: sticky"] {
            position: static !important;
          }
        }
      `}</style>
    </div>
  )
}

// ─── Componentes auxiliares ──────────────────────────────────────────────────

const surface: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16, padding: '24px 28px',
}

const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 800,
  textTransform: 'uppercase', letterSpacing: '0.1em',
  color: 'rgba(255,255,255,0.5)',
  margin: '0 0 16px', paddingBottom: 0,
}

const label: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 6, display: 'block',
}

const th: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 10, fontWeight: 800,
  color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  textAlign: 'left',
}
const td: React.CSSProperties = { padding: '10px 14px', verticalAlign: 'middle' }

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 16px',
      background: 'transparent',
      border: 'none',
      borderBottom: active ? '2px solid #f59e0b' : '2px solid transparent',
      marginBottom: -1,
      color: active ? '#f59e0b' : 'rgba(255,255,255,0.5)',
      fontSize: 13, fontWeight: active ? 700 : 500,
      cursor: 'pointer',
      fontFamily: 'inherit',
    }}>
      {children}
    </button>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', width: 140, flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  )
}

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px', fontWeight: 700 }}>
        {label}
      </p>
      <p style={{
        fontSize: highlight ? 20 : 16,
        fontWeight: highlight ? 800 : 700,
        color: highlight ? '#f59e0b' : '#f0f0f0',
        margin: 0,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </p>
    </div>
  )
}

function ActionButton({
  label, onClick, color, busy, variant = 'solid',
}: {
  label: string
  onClick: () => void
  color: string
  busy: boolean
  variant?: 'solid' | 'outline'
}) {
  const outline = variant === 'outline'
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        display: 'block', width: '100%',
        background: outline ? 'transparent' : color,
        border: `1px solid ${outline ? color + '50' : color}`,
        color: outline ? color : '#000',
        padding: '10px 14px', borderRadius: 10,
        fontSize: 13, fontWeight: 800,
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.5 : 1,
        marginBottom: 8,
        fontFamily: 'inherit',
        textAlign: 'center',
      }}
    >
      {label}
    </button>
  )
}