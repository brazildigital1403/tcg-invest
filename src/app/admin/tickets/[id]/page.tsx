'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useAppModal } from '@/components/ui/useAppModal'

type UserInfo = {
  id: string
  email: string
  name?: string
  full_name?: string
  city?: string
  whatsapp?: string
  is_pro?: boolean
  plano?: string
  trial_expires_at?: string | null
  created_at?: string
}

type Ticket = {
  id: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: string
  created_at: string
  last_message_at: string
  user_email: string | null
  user_name:  string | null
  user_info:  UserInfo | null
}

type Message = {
  id: string
  sender_type: 'user' | 'admin'
  content: string
  created_at: string
}

const STATUS: Record<Ticket['status'], { label: string; color: string; bg: string; border: string }> = {
  open:        { label: 'Aberto',       color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)' },
  in_progress: { label: 'Em andamento', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.28)' },
  resolved:    { label: 'Resolvido',    color: '#22c55e', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.28)' },
  closed:      { label: 'Fechado',      color: '#64748b', bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.28)' },
}

function formatDateTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminTicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { showAlert, showConfirm } = useAppModal()

  const [loading, setLoading]   = useState(true)
  const [ticket, setTicket]     = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [reply, setReply]       = useState('')
  const [newStatus, setNewStatus] = useState<'' | Ticket['status']>('')
  const [sending, setSending]   = useState(false)

  async function load() {
    const res = await fetch(`/api/admin/tickets/${id}`)
    setLoading(false)
    if (!res.ok) return
    const d = await res.json()
    setTicket(d.ticket)
    setMessages(d.messages || [])
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [id])

  async function enviarResposta() {
    if (!reply.trim() || reply.trim().length < 3) {
      return showAlert('Escreva uma resposta um pouco maior.', 'warning')
    }
    setSending(true)
    const res = await fetch(`/api/admin/tickets/${id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: reply, newStatus: newStatus || undefined }),
    })
    setSending(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return showAlert(err.error || 'Erro ao enviar resposta.', 'error')
    }
    setReply('')
    setNewStatus('')
    await load()
    showAlert('Resposta enviada e email disparado.', 'success')
  }

  async function mudarStatus(to: Ticket['status']) {
    const ok = await showConfirm({
      message: `Mudar status para "${STATUS[to].label}" e notificar o usuário por email?`,
      confirmLabel: 'Sim, mudar',
    })
    if (!ok) return

    const res = await fetch(`/api/admin/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: to, notify: true }),
    })
    if (!res.ok) return showAlert('Erro ao atualizar status.', 'error')
    await load()
    showAlert(`Status atualizado para "${STATUS[to].label}".`, 'success')
  }

  if (loading) {
    return <div style={{ padding: 40, color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Sans', textAlign: 'center' }}>Carregando...</div>
  }

  if (!ticket) {
    return (
      <div style={{ padding: 40, fontFamily: 'DM Sans', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
        <p>Ticket não encontrado.</p>
        <Link href="/admin/tickets" style={{ color: '#f59e0b', fontSize: 14, textDecoration: 'none' }}>← Voltar</Link>
      </div>
    )
  }

  const s = STATUS[ticket.status]
  const u = ticket.user_info

  const isTrial = u?.trial_expires_at && new Date(u.trial_expires_at) > new Date() && !u?.is_pro
  const planoLabel = u?.is_pro ? `Pro${u.plano ? ` · ${u.plano}` : ''}` : isTrial ? 'Trial' : 'Free'
  const planoColor = u?.is_pro ? '#f59e0b' : isTrial ? '#60a5fa' : 'rgba(255,255,255,0.5)'

  return (
    <div style={{ padding: '28px 24px', maxWidth: 1100, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <Link href="/admin/tickets" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', gap: 6, marginBottom: 14 }}>
        ← Voltar para Tickets
      </Link>

      {/* ── Cabeçalho ── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '20px 24px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 6px', color: '#f0f0f0' }}>
              {ticket.subject}
            </h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
              Criado em {formatDateTime(ticket.created_at)}
            </p>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 800,
            padding: '6px 14px', borderRadius: 100,
            color: s.color, background: s.bg,
            border: `1px solid ${s.border}`,
          }}>
            {s.label}
          </span>
        </div>

        {/* Ações de status */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {(['open', 'in_progress', 'resolved', 'closed'] as const)
            .filter(k => k !== ticket.status)
            .map(k => (
              <button key={k} onClick={() => mudarStatus(k)} style={{
                padding: '6px 12px', borderRadius: 100,
                fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${STATUS[k].border}`,
                background: 'transparent',
                color: STATUS[k].color,
                transition: 'background .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = STATUS[k].bg }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                → {STATUS[k].label}
              </button>
            ))}
        </div>
      </div>

      {/* ── Grid: Thread + Painel do usuário ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 280px',
        gap: 16,
        alignItems: 'start',
      }}
      className="admin-ticket-grid"
      >
        {/* ── Thread de mensagens + Form ── */}
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {messages.map(m => {
              const isAdmin = m.sender_type === 'admin'
              return (
                <div key={m.id} style={{
                  background: isAdmin ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isAdmin ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12, padding: '14px 18px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{
                      fontSize: 10, fontWeight: 800,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      color: isAdmin ? '#f59e0b' : 'rgba(255,255,255,0.6)',
                    }}>
                      {isAdmin ? '✦ Equipe Bynx' : ticket.user_name || 'Usuário'}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                      · {formatDateTime(m.created_at)}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 14, lineHeight: 1.6,
                    color: 'rgba(255,255,255,0.85)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {m.content}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Form de resposta */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: 16,
          }}>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, display: 'block' }}>
              Responder ao usuário
            </label>
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Escreva uma resposta profissional e clara..."
              rows={6}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '12px 14px',
                color: '#f0f0f0', fontSize: 14,
                outline: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit',
                minHeight: 120, resize: 'vertical',
                marginBottom: 12,
              }}
            />

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value as any)}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  padding: '9px 12px',
                  color: '#f0f0f0', fontSize: 13,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <option value="">Manter status</option>
                <option value="in_progress">Mudar para: Em andamento</option>
                <option value="resolved">Mudar para: Resolvido</option>
                <option value="closed">Mudar para: Fechado</option>
              </select>

              <button
                onClick={enviarResposta}
                disabled={sending || !reply.trim()}
                style={{
                  marginLeft: 'auto',
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  border: 'none', color: '#000',
                  padding: '10px 22px', borderRadius: 10,
                  fontSize: 13, fontWeight: 800,
                  cursor: (sending || !reply.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (sending || !reply.trim()) ? 0.5 : 1,
                  fontFamily: 'inherit',
                }}
              >
                {sending ? 'Enviando...' : 'Enviar resposta'}
              </button>
            </div>

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 10, marginBottom: 0 }}>
              Um email será enviado ao usuário com a resposta.
            </p>
          </div>
        </div>

        {/* ── Painel do usuário ── */}
        <aside style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: 18,
          position: 'sticky', top: 80,
        }}>
          <p style={{
            fontSize: 10, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.09em',
            color: 'rgba(255,255,255,0.4)',
            margin: '0 0 14px',
          }}>Quem abriu</p>

          <p style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0', margin: '0 0 4px' }}>
            {ticket.user_name || ticket.user_email || 'Usuário desconhecido'}
          </p>
          {ticket.user_email && ticket.user_name && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '0 0 14px', wordBreak: 'break-all' }}>
              {ticket.user_email}
            </p>
          )}
          {!ticket.user_name && ticket.user_email && <div style={{ height: 14 }} />}

          <div style={{
            display: 'inline-block',
            padding: '4px 10px', borderRadius: 100,
            fontSize: 11, fontWeight: 700,
            color: planoColor,
            background: `${planoColor}14`,
            border: `1px solid ${planoColor}30`,
            marginBottom: 14,
          }}>
            Plano {planoLabel}
          </div>

          <InfoRow label="Cidade"     value={u?.city || '—'} />
          <InfoRow label="WhatsApp"   value={u?.whatsapp || '—'} />
          <InfoRow label="Membro desde" value={formatDate(u?.created_at)} />

          {u?.id && (
            <Link
              href={`/perfil/${u.id}`}
              target="_blank"
              style={{
                display: 'block', marginTop: 14,
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: 'rgba(255,255,255,0.7)',
                fontSize: 12, fontWeight: 600,
                textAlign: 'center', textDecoration: 'none',
              }}
            >
              Ver perfil público →
            </Link>
          )}
        </aside>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .admin-ticket-grid {
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 2px' }}>{label}</p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0, wordBreak: 'break-word' }}>{value}</p>
    </div>
  )
}