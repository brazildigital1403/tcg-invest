'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
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
  is_suspended: boolean
  suspended_at: string | null
  suspended_reason: string | null
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
  const router = useRouter()
  const { showAlert, showConfirm, showPrompt } = useAppModal()

  const [loading, setLoading] = useState(true)
  const [user, setUser]       = useState<User | null>(null)
  const [stats, setStats]     = useState<Stats | null>(null)

  // R6 Commit 3: aba 'resync' removida (endpoint /api/admin/resync-price foi deletado).
  // Refactor futuro: criar nova aba "Re-scan ZenRows" que dispara scan sob demanda.
  const [tab, setTab] = useState<'info' | 'collection'>('info')

  const [editing, setEditing] = useState(false)
  const [editName, setEditName]       = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editCity, setEditCity]       = useState('')
  const [editWhatsapp, setEditWhatsapp] = useState('')

  const [collection, setCollection] = useState<{ cards: CollectionCard[]; total_cards: number; total_value: number } | null>(null)
  const [loadingCol, setLoadingCol] = useState(false)

  const [busy, setBusy] = useState(false)

  async function load() {
    const res = await fetch(`/api/admin/users/${id}`)
    setLoading(false)
    if (!res.ok) return
    const d = await res.json()
    setUser(d.user)
    setStats(d.stats)
    setEditName(d.user.name || '')
    setEditUsername(d.user.username || '')
    setEditCity(d.user.city || '')
    setEditWhatsapp(d.user.whatsapp || '')
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
    const input = await showPrompt({ message: 'Conceder Pro por quantos meses?', placeholder: '1, 3, 6, 12...', defaultValue: '1' })
    if (!input) return
    const months = parseInt(input)
    if (!months || months < 1 || months > 60) return showAlert('Informe um número entre 1 e 60.', 'warning')
    const ok = await showConfirm({ message: `Conceder Pro por ${months} ${months === 1 ? 'mês' : 'meses'} a ${user?.email}?` })
    if (!ok) return
    await doAction('grant_pro', months, `Pro concedido por ${months} ${months === 1 ? 'mês' : 'meses'}.`)
  }

  async function revokePro() {
    const ok = await showConfirm({
      message: `Revogar Pro de ${user?.email}? O usuário voltará ao plano Free.`,
      danger: true, confirmLabel: 'Revogar',
    })
    if (!ok) return
    await doAction('revoke_pro', null, 'Pro revogado.')
  }

  async function extendTrial() {
    const input = await showPrompt({ message: 'Estender trial por quantos dias?', placeholder: '7, 15, 30...', defaultValue: '7' })
    if (!input) return
    const days = parseInt(input)
    if (!days || days < 1 || days > 365) return showAlert('Informe um número entre 1 e 365.', 'warning')
    await doAction('extend_trial', days, `Trial estendido por ${days} ${days === 1 ? 'dia' : 'dias'}.`)
  }

  async function addCredits() {
    const input = await showPrompt({ message: 'Adicionar quantos créditos de scan?', placeholder: '5, 10, 50...', defaultValue: '10' })
    if (!input) return
    const amount = parseInt(input)
    if (!amount || amount < 1 || amount > 1000) return showAlert('Informe um número entre 1 e 1000.', 'warning')
    await doAction('add_scan_credits', amount, `+${amount} créditos de scan adicionados.`)
  }

  // ─── A3: Editar dados ─────────────────────────────────────────────────────

  async function saveEdit() {
    // Validações básicas
    if (editUsername && !/^[a-z0-9_-]{3,30}$/.test(editUsername.toLowerCase())) {
      return showAlert('Username deve ter 3-30 caracteres: letras, números, hífen ou underline.', 'warning')
    }
    if (editWhatsapp && !/^\d{10,11}$/.test(editWhatsapp.replace(/\D/g, ''))) {
      return showAlert('WhatsApp deve ter 10 ou 11 dígitos (só números).', 'warning')
    }

    await doAction('edit_profile', {
      name:     editName,
      username: editUsername.toLowerCase(),
      city:     editCity,
      whatsapp: editWhatsapp.replace(/\D/g, ''), // salva só números
    }, 'Dados atualizados.')
    setEditing(false)
  }

  // ─── A6: Suspender / Reativar ─────────────────────────────────────────────

  async function suspend() {
    const reason = await showPrompt({
      message: `Suspender a conta de ${user?.email}? O usuário não poderá mais logar. Motivo (opcional, fica registrado):`,
      placeholder: 'Violação de regras, suspeita de fraude...',
      multiline: true,
    })
    if (reason === null) return // cancelado
    await doAction('suspend', { reason }, 'Conta suspensa. O usuário não poderá mais logar.')
  }

  async function unsuspend() {
    const ok = await showConfirm({ message: `Reativar a conta de ${user?.email}?`, confirmLabel: 'Reativar' })
    if (!ok) return
    await doAction('unsuspend', null, 'Conta reativada.')
  }

  // ─── A6: Excluir definitivamente ──────────────────────────────────────────

  async function deleteAccount() {
    if (!user) return
    if (user.is_pro) {
      return showAlert('Usuário com Pro ativo. Revogue o Pro primeiro (e cancele a assinatura no Stripe antes).', 'warning')
    }

    // 1ª confirmação
    const first = await showConfirm({
      message: `⚠️ EXCLUIR PERMANENTEMENTE a conta de ${user.email}?\n\nIsso vai apagar: ${stats?.total_cards || 0} cartas, ${stats?.total_tickets || 0} tickets, notificações e anúncios.\n\nEssa ação NÃO pode ser desfeita.`,
      danger: true,
      confirmLabel: 'Sim, prosseguir',
    })
    if (!first) return

    // 2ª confirmação: digitar o email
    const typed = await showPrompt({
      message: `Para confirmar a exclusão, digite exatamente o email da conta abaixo:\n\n${user.email}`,
      placeholder: 'Digite o email para confirmar',
    })
    if (!typed) return
    if (typed.trim().toLowerCase() !== user.email.toLowerCase()) {
      return showAlert('Email de confirmação não bate. Exclusão cancelada.', 'error')
    }

    setBusy(true)
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmEmail: typed.trim() }),
    })
    setBusy(false)
    const d = await res.json()
    if (!res.ok) return showAlert(d.error || 'Erro ao excluir.', 'error')

    showAlert(d.warning || `Conta ${user.email} excluída permanentemente.`, 'success')
    setTimeout(() => router.push('/admin/users'), 1500)
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

      {/* ── Banner de suspenso ── */}
      {user.is_suspended && (
        <div style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 12, padding: '14px 18px',
          marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12,
          flexWrap: 'wrap',
        }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', margin: '0 0 2px' }}>
              ⛔ Conta suspensa
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
              Suspenso em {fmtDateTime(user.suspended_at)}
              {user.suspended_reason ? ` · Motivo: ${user.suspended_reason}` : ''}
            </p>
          </div>
          <button onClick={unsuspend} disabled={busy} style={{
            marginLeft: 'auto',
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            color: '#22c55e',
            padding: '6px 14px', borderRadius: 8,
            fontSize: 12, fontWeight: 700,
            cursor: busy ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}>
            Reativar conta
          </button>
        </div>
      )}

      {/* ── Cabeçalho ── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
            background: user.is_suspended ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #f59e0b, #ef4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800,
            color: user.is_suspended ? 'rgba(255,255,255,0.3)' : '#000',
            letterSpacing: '-0.02em',
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
              <a href={`/perfil/${user.username}`} target="_blank" rel="noopener noreferrer" style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.7)',
                padding: '8px 14px', borderRadius: 10,
                fontSize: 12, fontWeight: 600,
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}>
                Perfil público →
              </a>
            )}
          </div>
        </div>

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
      </div>

      {/* ── Aba: Info & Ações ── */}
      {tab === 'info' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }} className="user-grid">

          <div style={surface}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ ...sectionTitle, margin: 0 }}>Dados cadastrais</h3>
              {!editing ? (
                <button onClick={() => setEditing(true)} style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.7)',
                  padding: '6px 12px', borderRadius: 8,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>
                  Editar
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setEditing(false); load() }} style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.6)',
                    padding: '6px 12px', borderRadius: 8,
                    fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    Cancelar
                  </button>
                  <button onClick={saveEdit} disabled={busy} style={{
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                    border: 'none', color: '#000',
                    padding: '6px 14px', borderRadius: 8,
                    fontSize: 12, fontWeight: 800,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.5 : 1,
                    fontFamily: 'inherit',
                  }}>
                    {busy ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              )}
            </div>

            {!editing ? (
              <>
                <InfoRow label="Nome"     value={user.name || '—'} />
                <InfoRow label="Email"    value={user.email} mono />
                <InfoRow label="Username" value={user.username ? `@${user.username}` : '—'} />
                <InfoRow label="Cidade"   value={user.city || '—'} />
                <InfoRow label="WhatsApp" value={user.whatsapp || '—'} />
                <InfoRow label="CPF"      value={user.cpf ? '****' + user.cpf.slice(-4) : '—'} mono />
              </>
            ) : (
              <>
                <EditRow label="Nome" value={editName} onChange={setEditName} />
                <InfoRow label="Email (não editável)" value={user.email} mono />
                <EditRow label="Username" value={editUsername} onChange={setEditUsername} placeholder="sem @, min 3 chars" prefix="@" />
                <EditRow label="Cidade" value={editCity} onChange={setEditCity} />
                <EditRow label="WhatsApp" value={editWhatsapp} onChange={setEditWhatsapp} placeholder="11999999999" />
                <InfoRow label="CPF (não editável)" value={user.cpf ? '****' + user.cpf.slice(-4) : '—'} mono />
              </>
            )}

            <h3 style={{ ...sectionTitle, marginTop: 28 }}>Assinatura</h3>
            <InfoRow label="Status" value={user.is_pro ? 'Pro ativo' : user.plano_efetivo === 'trial' ? `Trial (${user.trial_days_left} dias)` : 'Free'} />
            <InfoRow label="Plano" value={user.plano || '—'} />
            <InfoRow label="Pro expira em"   value={fmtDateTime(user.pro_expira_em)} />
            <InfoRow label="Trial expira em" value={fmtDateTime(user.trial_expires_at)} />
          </div>

          {/* ── Ações administrativas ── */}
          <aside style={{ ...surface, position: 'sticky', top: 80 }}>
            <h3 style={sectionTitle}>⚡ Ações rápidas</h3>

            <ActionButton label="Conceder Pro"    onClick={grantPro}    color="#f59e0b" busy={busy} />
            {user.is_pro && (
              <ActionButton label="Revogar Pro"   onClick={revokePro}   color="#ef4444" busy={busy} variant="outline" />
            )}
            <ActionButton label="Estender trial"  onClick={extendTrial} color="#60a5fa" busy={busy} variant="outline" />
            <ActionButton label="+ Créditos scan" onClick={addCredits}  color="#22c55e" busy={busy} variant="outline" />

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '16px 0', paddingTop: 16 }}>
              <h3 style={{ ...sectionTitle, fontSize: 10, marginBottom: 10 }}>⚠️ Zona perigosa</h3>

              {!user.is_suspended ? (
                <ActionButton label="Suspender conta" onClick={suspend} color="#f59e0b" busy={busy} variant="outline" />
              ) : (
                <ActionButton label="Reativar conta"  onClick={unsuspend} color="#22c55e" busy={busy} variant="outline" />
              )}
              <ActionButton label="Excluir conta"   onClick={deleteAccount} color="#ef4444" busy={busy} variant="outline" />
            </div>

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 14, marginBottom: 0, lineHeight: 1.5 }}>
              <b style={{ color: '#ef4444' }}>Excluir</b> é irreversível e apaga todos os dados do usuário (cartas, tickets, etc). Use para solicitações LGPD.
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
                      <th style={thTbl}>Carta</th>
                      <th style={{ ...thTbl, textAlign: 'center' }}>Qtd</th>
                      <th style={{ ...thTbl, textAlign: 'center' }}>Variante</th>
                      <th style={{ ...thTbl, textAlign: 'right' }}>Preço un.</th>
                      <th style={{ ...thTbl, textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collection.cards.map(c => (
                      <tr key={c.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={tdTbl}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            {c.card_image && <img src={c.card_image} alt="" style={{ width: 28, height: 39, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />}
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontSize: 13, color: '#f0f0f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                                {c.card_name}
                              </p>
                              {c.set_name && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>{c.set_name}</p>}
                            </div>
                          </div>
                        </td>
                        <td style={{ ...tdTbl, textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>{c.quantity}</td>
                        <td style={{ ...tdTbl, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{c.variante || 'normal'}</td>
                        <td style={{ ...tdTbl, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.7)' }}>{fmtBRL(c.preco_unitario)}</td>
                        <td style={{ ...tdTbl, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#f59e0b', fontWeight: 700 }}>{fmtBRL(c.valor_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
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

// ─── Estilos ─────────────────────────────────────────────────────────────────

const surface: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16, padding: '24px 28px',
}

const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 800,
  textTransform: 'uppercase', letterSpacing: '0.1em',
  color: 'rgba(255,255,255,0.5)',
  margin: '0 0 16px',
}

const thTbl: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 10, fontWeight: 800,
  color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  textAlign: 'left',
}
const tdTbl: React.CSSProperties = { padding: '10px 14px', verticalAlign: 'middle' }

// ─── Componentes auxiliares ──────────────────────────────────────────────────

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
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', width: 160, flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  )
}

function EditRow({ label, value, onChange, placeholder, prefix }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  prefix?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', width: 160, flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
        {prefix && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{prefix}</span>}
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '6px 10px',
            color: '#f0f0f0', fontSize: 13,
            outline: 'none', fontFamily: 'inherit',
          }}
        />
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
        margin: 0, letterSpacing: '-0.02em',
      }}>
        {value}
      </p>
    </div>
  )
}

function ActionButton({ label, onClick, color, busy, variant = 'solid' }: {
  label: string
  onClick: () => void
  color: string
  busy: boolean
  variant?: 'solid' | 'outline'
}) {
  const outline = variant === 'outline'
  return (
    <button onClick={onClick} disabled={busy} style={{
      display: 'block', width: '100%',
      background: outline ? 'transparent' : color,
      border: `1px solid ${outline ? color + '50' : color}`,
      color: outline ? color : '#000',
      padding: '10px 14px', borderRadius: 10,
      fontSize: 13, fontWeight: 800,
      cursor: busy ? 'not-allowed' : 'pointer',
      opacity: busy ? 0.5 : 1,
      marginBottom: 8,
      fontFamily: 'inherit', textAlign: 'center',
    }}>
      {label}
    </button>
  )
}
