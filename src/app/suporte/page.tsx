'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { authFetch } from '@/lib/authFetch'
import AppLayout from '@/components/ui/AppLayout'
import { useAppModal } from '@/components/ui/useAppModal'
import { IconChat, IconPlus } from '@/components/ui/Icons'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Ticket = {
  id: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'normal' | 'high'
  created_at: string
  last_message_at: string
}

// ─── Config visual de status ─────────────────────────────────────────────────

const STATUS: Record<Ticket['status'], { label: string; color: string; bg: string; border: string }> = {
  open:         { label: 'Aberto',       color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)' },
  in_progress:  { label: 'Em andamento', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.28)' },
  resolved:     { label: 'Resolvido',    color: '#22c55e', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.28)' },
  closed:       { label: 'Fechado',      color: '#64748b', bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.28)' },
}

// ─── Tokens — iguais ao padrão de Minha Conta ────────────────────────────────

const SURFACE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: '24px 28px',
  marginBottom: 16,
}

const INPUT: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '12px 16px',
  color: '#f0f0f0',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: "'DM Sans', system-ui, sans-serif",
}

const LABEL: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 6,
  display: 'block',
}

// ─── Formatação relativa de data ─────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'agora'
  if (mins  < 60) return `há ${mins} min`
  if (hours < 24) return `há ${hours}h`
  if (days  < 7)  return `há ${days}d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function SuportePage() {
  const router = useRouter()
  const { showAlert } = useAppModal()

  const [loading, setLoading]   = useState(true)
  const [tickets, setTickets]   = useState<Ticket[]>([])
  const [showForm, setShowForm] = useState(false)
  const [subject, setSubject]   = useState('')
  const [message, setMessage]   = useState('')
  const [sending, setSending]   = useState(false)

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) { router.push('/login'); return }

      const res = await authFetch('/api/tickets')
      if (!res.ok) {
        setLoading(false)
        return
      }
      const data = await res.json()
      setTickets(data.tickets || [])
      setLoading(false)
    }
    load()
  }, [router])

  async function criarTicket() {
    if (!subject.trim() || subject.trim().length < 3) {
      return showAlert('Descreva o assunto em pelo menos 3 caracteres.', 'warning')
    }
    if (!message.trim() || message.trim().length < 10) {
      return showAlert('Conta um pouco mais no corpo da mensagem (mínimo 10 caracteres).', 'warning')
    }
    setSending(true)
    const res = await authFetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, message }),
    })
    setSending(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return showAlert(err.error || 'Erro ao criar ticket. Tenta de novo?', 'error')
    }
    const data = await res.json()
    setSubject('')
    setMessage('')
    setShowForm(false)
    showAlert('Ticket criado! Responderemos o mais rápido possível.', 'success')
    // Recarrega a lista já com o novo
    setTickets(prev => [data.ticket, ...prev])
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'rgba(255,255,255,0.3)', flexDirection: 'column', gap: 12 }}>
          <IconChat size={32} color="rgba(255,255,255,0.4)" />
          <p style={{ fontSize: 14 }}>Carregando seus tickets...</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div style={{ maxWidth: 760, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

        {/* ── Cabeçalho ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 4px' }}>Suporte</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
              Tire dúvidas, reporte bugs ou peça ajuda com sua coleção.
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                border: 'none', color: '#000',
                padding: '11px 20px', borderRadius: 10,
                fontSize: 14, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'inherit',
              }}
            >
              <IconPlus size={16} color="#000" /> Novo ticket
            </button>
          )}
        </div>

        {/* ── Form de novo ticket ── */}
        {showForm && (
          <div style={{ ...SURFACE, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', margin: 0 }}>Abrir novo ticket</p>
              <button
                onClick={() => { setShowForm(false); setSubject(''); setMessage('') }}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', padding: '4px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancelar
              </button>
            </div>

            <label style={LABEL}>Assunto</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Ex: Carta que importei veio sem preço"
              maxLength={200}
              style={{ ...INPUT, marginBottom: 14 }}
            />

            <label style={LABEL}>Descrição</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Conta o que aconteceu com o máximo de detalhes possível — print ajuda muito!"
              rows={6}
              style={{ ...INPUT, minHeight: 140, resize: 'vertical', fontFamily: 'inherit', marginBottom: 18 }}
            />

            <button
              onClick={criarTicket}
              disabled={sending}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                border: 'none', color: '#000',
                padding: '11px 24px', borderRadius: 10,
                fontSize: 14, fontWeight: 800,
                cursor: sending ? 'wait' : 'pointer',
                opacity: sending ? 0.6 : 1,
                fontFamily: 'inherit',
              }}
            >
              {sending ? 'Enviando...' : 'Enviar ticket'}
            </button>
          </div>
        )}

        {/* ── Lista de tickets ── */}
        {tickets.length === 0 ? (
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.12)',
            borderRadius: 16,
            padding: '48px 24px',
            textAlign: 'center',
          }}>
            <IconChat size={36} color="rgba(255,255,255,0.25)" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 6px' }}>
              Nenhum ticket ainda
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
              Clique em <strong style={{ color: '#f59e0b' }}>Novo ticket</strong> se precisar de ajuda.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tickets.map(t => {
              const s = STATUS[t.status]
              return (
                <Link
                  key={t.id}
                  href={`/suporte/${t.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12,
                      padding: '16px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'
                      e.currentTarget.style.background = 'rgba(245,158,11,0.03)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 15, fontWeight: 700, color: '#f0f0f0',
                        margin: '0 0 4px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {t.subject}
                      </p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                        Última atualização {relativeTime(t.last_message_at)}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 800,
                      padding: '5px 12px', borderRadius: 100,
                      color: s.color, background: s.bg,
                      border: `1px solid ${s.border}`,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}>
                      {s.label}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

      </div>
    </AppLayout>
  )
}