'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { authFetch } from '@/lib/authFetch'
import AppLayout from '@/components/ui/AppLayout'
import { useAppModal } from '@/components/ui/useAppModal'
import { IconChat } from '@/components/ui/Icons'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Ticket = {
  id: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: string
  created_at: string
  last_message_at: string
}

type Message = {
  id: string
  sender_type: 'user' | 'admin'
  content: string
  created_at: string
}

// ─── Config visual de status ─────────────────────────────────────────────────

const STATUS: Record<Ticket['status'], { label: string; color: string; bg: string; border: string }> = {
  open:        { label: 'Aberto',       color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)' },
  in_progress: { label: 'Em andamento', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.28)' },
  resolved:    { label: 'Resolvido',    color: '#22c55e', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.28)' },
  closed:      { label: 'Fechado',      color: '#64748b', bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.28)' },
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { showAlert } = useAppModal()

  const [loading, setLoading]     = useState(true)
  const [ticket, setTicket]       = useState<Ticket | null>(null)
  const [messages, setMessages]   = useState<Message[]>([])
  const [reply, setReply]         = useState('')
  const [sending, setSending]     = useState(false)

  async function load() {
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) { router.push('/login'); return }

    const res = await authFetch(`/api/tickets/${id}`)
    if (!res.ok) {
      setLoading(false)
      return
    }
    const data = await res.json()
    setTicket(data.ticket)
    setMessages(data.messages || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function enviarResposta() {
    if (!reply.trim() || reply.trim().length < 3) {
      return showAlert('Escreva um pouquinho mais na resposta.', 'warning')
    }
    setSending(true)
    const res = await authFetch(`/api/tickets/${id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: reply }),
    })
    setSending(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return showAlert(err.error || 'Erro ao enviar resposta.', 'error')
    }
    setReply('')
    load() // recarrega a conversa
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'rgba(255,255,255,0.3)', flexDirection: 'column', gap: 12 }}>
          <IconChat size={32} color="rgba(255,255,255,0.4)" />
          <p style={{ fontSize: 14 }}>Carregando conversa...</p>
        </div>
      </AppLayout>
    )
  }

  // ── Não encontrado ─────────────────────────────────────────────────────────

  if (!ticket) {
    return (
      <AppLayout>
        <div style={{ maxWidth: 760, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif", textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>Ticket não encontrado.</p>
          <Link href="/suporte" style={{ color: '#f59e0b', fontSize: 14, textDecoration: 'none' }}>← Voltar para Suporte</Link>
        </div>
      </AppLayout>
    )
  }

  const s = STATUS[ticket.status]
  const isClosed = ticket.status === 'closed'

  return (
    <AppLayout>
      <div style={{ maxWidth: 760, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

        {/* ── Voltar ── */}
        <Link
          href="/suporte"
          style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}
        >
          ← Voltar para Suporte
        </Link>

        {/* ── Cabeçalho do ticket ── */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '20px 24px',
          marginBottom: 16,
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
              padding: '5px 12px', borderRadius: 100,
              color: s.color, background: s.bg,
              border: `1px solid ${s.border}`,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {s.label}
            </span>
          </div>
        </div>

        {/* ── Thread de mensagens ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {messages.map(m => {
            const isAdmin = m.sender_type === 'admin'
            return (
              <div
                key={m.id}
                style={{
                  background: isAdmin ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isAdmin ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12,
                  padding: '16px 18px',
                }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 10,
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: isAdmin ? '#f59e0b' : 'rgba(255,255,255,0.5)',
                  }}>
                    {isAdmin ? '✦ Equipe Bynx' : 'Você'}
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

        {/* ── Form de resposta (ou aviso se fechado) ── */}
        {isClosed ? (
          <div style={{
            background: 'rgba(100,116,139,0.08)',
            border: '1px solid rgba(100,116,139,0.22)',
            borderRadius: 12,
            padding: '16px 20px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
              Este ticket foi fechado. Se precisar de ajuda, abra um novo em{' '}
              <Link href="/suporte" style={{ color: '#f59e0b', textDecoration: 'none', fontWeight: 700 }}>Suporte</Link>.
            </p>
          </div>
        ) : (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 18,
          }}>
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder={ticket.status === 'resolved'
                ? 'Responder aqui reabre o ticket automaticamente...'
                : 'Escreva sua resposta...'}
              rows={5}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '12px 14px',
                color: '#f0f0f0',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                minHeight: 110,
                resize: 'vertical',
                marginBottom: 12,
              }}
            />
            <button
              onClick={enviarResposta}
              disabled={sending || !reply.trim()}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                border: 'none', color: '#000',
                padding: '10px 22px', borderRadius: 10,
                fontSize: 14, fontWeight: 800,
                cursor: (sending || !reply.trim()) ? 'not-allowed' : 'pointer',
                opacity: (sending || !reply.trim()) ? 0.5 : 1,
                fontFamily: 'inherit',
              }}
            >
              {sending ? 'Enviando...' : 'Enviar resposta'}
            </button>
          </div>
        )}

      </div>
    </AppLayout>
  )
}