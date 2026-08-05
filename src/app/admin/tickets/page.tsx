'use client'

import { useEffect, useState, Suspense } from 'react'
import NovaConversaModal from '@/components/admin/NovaConversaModal'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { IconBolt, IconCheck, IconClock } from '@/components/ui/Icons'

type Ticket = {
  id: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: string
  created_at: string
  last_message_at: string
  user_email: string | null
  user_name:  string | null
  last_sender: 'user' | 'admin' | null
}

const STATUS: Record<Ticket['status'], { label: string; color: string }> = {
  open:        { label: 'Aberto',       color: '#f59e0b' },
  in_progress: { label: 'Em andamento', color: '#60a5fa' },
  resolved:    { label: 'Resolvido',    color: '#22c55e' },
  closed:      { label: 'Fechado',      color: '#64748b' },
}

// Segmento por TURNO, nao por status bruto: "Aberto" hoje mistura ticket
// esperando o admin responder com ticket esperando o cliente (ex.: pedido de
// verificacao de loja, onde o admin ja falou por ultimo). A pergunta que
// importa e sempre "de quem e a vez" -- decide comparando o status com quem
// mandou a ultima mensagem (achado 05/08/2026: 1 ticket ficou 47 dias sem
// resposta, enterrado na posicao 12 de 13 na lista antiga).
type Segmento = 'precisa' | 'aguardando' | 'resolvidos' | 'tudo'

function segmentoDe(t: Ticket): 'precisa' | 'aguardando' | 'resolvido' {
  const emAberto = t.status === 'open' || t.status === 'in_progress'
  if (!emAberto) return 'resolvido'
  // Sem mensagem nenhuma (nao deveria acontecer, todo ticket nasce com uma) --
  // trata como "aguardando" pra nao gerar falsa urgencia.
  return t.last_sender === 'user' ? 'precisa' : 'aguardando'
}

const SEGMENTOS: { key: Segmento; label: string }[] = [
  { key: 'precisa',     label: 'Precisa de resposta' },
  { key: 'aguardando',  label: 'Aguardando cliente' },
  { key: 'resolvidos',  label: 'Resolvidos' },
  { key: 'tudo',        label: 'Tudo' },
]

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

// So grita "sem resposta" quando a demora e SUA -- nos outros segmentos e so
// um relogio informativo, nao um alarme.
function tempoLabel(iso: string, seg: ReturnType<typeof segmentoDe>): string {
  const rel = relativeTime(iso)
  if (seg !== 'precisa' || rel === 'agora') return rel
  return `${rel} sem resposta`
}

function TicketsView() {
  const qp = useSearchParams()
  // Deep link de status (cards do dashboard, ex. /admin/tickets?status=open)
  // continua funcionando -- filtra no servidor e pousa na aba "Tudo" pra nao
  // esconder nada do que o card prometeu. Sem query, pousa em "Precisa de
  // resposta": é a pergunta que importa 95% das vezes que alguém abre a tela.
  const statusParam = qp.get('status') || ''
  const [seg, setSeg]         = useState<Segmento>(statusParam ? 'tudo' : 'precisa')
  const [q, setQ]             = useState('')
  const [soUrgentes, setSoUrgentes] = useState(false)
  const [rows, setRows]       = useState<Ticket[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)
  const [novaAberta, setNovaAberta] = useState(false)

  // 500/rede sem try-catch caia igual a "sem tickets" -- Du achava a caixa
  // de suporte vazia quando na verdade a API tinha caido (achado 04/08/2026).
  async function load() {
    setLoading(true)
    setErro(false)
    try {
      const p = new URLSearchParams()
      if (statusParam) p.set('status', statusParam)
      if (q.trim()) p.set('q', q.trim())
      const res = await fetch(`/api/admin/tickets?${p}`)
      if (!res.ok) { setErro(true); return }
      const d = await res.json()
      setRows(d.tickets || [])
    } catch {
      setErro(true)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1100, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px', color: '#f0f0f0' }}>
            Tickets
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            Últimos 200 tickets, ordenados pela atividade mais recente.
          </p>
        </div>
        <button
          onClick={() => setNovaAberta(true)}
          style={{
            padding: '10px 18px', borderRadius: 9, fontSize: 13, fontWeight: 800,
            background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none',
            color: '#000', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >
          Falar com usuário
        </button>
      </div>

      <NovaConversaModal
        aberto={novaAberta}
        onFechar={() => setNovaAberta(false)}
        onCriado={() => load()}
      />

      {/* ── Segmentos por turno ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {SEGMENTOS.map(s => {
          const active = seg === s.key
          const contagem = rows
            ? (s.key === 'tudo' ? rows.length : rows.filter(t => (segmentoDe(t) === 'resolvido' ? 'resolvidos' : segmentoDe(t)) === s.key).length)
            : null
          const cor = s.key === 'precisa' ? '#ef4444' : s.key === 'aguardando' ? '#60a5fa' : '#f0f0f0'
          return (
            <button
              key={s.key}
              onClick={() => setSeg(s.key)}
              style={{
                padding: '7px 14px',
                borderRadius: 100,
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6,
                border: `1px solid ${active ? `${cor}55` : 'rgba(255,255,255,0.08)'}`,
                background: active ? `${cor}1f` : 'transparent',
                color: active ? cor : 'rgba(255,255,255,0.55)',
              }}
            >
              {s.label}
              {contagem !== null && (
                <span style={{ opacity: 0.65, fontWeight: 800 }}>{contagem}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Busca + prioridade ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
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
          }}
        />

        <button
          onClick={() => setSoUrgentes(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: 100,
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            border: `1px solid ${soUrgentes ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
            background: soUrgentes ? 'rgba(239,68,68,0.14)' : 'transparent',
            color: soUrgentes ? '#ef4444' : 'rgba(255,255,255,0.55)',
          }}
        >
          <IconBolt size={12} color={soUrgentes ? '#ef4444' : 'rgba(255,255,255,0.55)'} />
          Só prioridade alta
        </button>
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Carregando...</p>
      ) : erro ? (
        <div style={{
          background: 'rgba(239,68,68,0.06)',
          border: '1px dashed rgba(239,68,68,0.3)',
          borderRadius: 14, padding: '40px 20px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: '#ef4444', margin: '0 0 12px' }}>Não deu pra carregar os tickets.</p>
          <button onClick={load} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', fontWeight: 700, fontSize: 12, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>Tentar de novo</button>
        </div>
      ) : !rows || rows.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px dashed rgba(255,255,255,0.12)',
          borderRadius: 14, padding: '40px 20px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Nenhum ticket encontrado.</p>
        </div>
      ) : (() => {
        const porSegmento = rows.filter(t => seg === 'tudo' || (segmentoDe(t) === 'resolvido' ? 'resolvidos' : segmentoDe(t)) === seg)
        const visiveis = soUrgentes ? porSegmento.filter(t => t.priority === 'high') : porSegmento
        if (visiveis.length === 0) {
          const mensagem = seg === 'precisa'
            ? 'Nada esperando você agora.'
            : soUrgentes
              ? 'Nenhum ticket de prioridade alta aqui.'
              : 'Nenhum ticket neste grupo.'
          return (
            <div style={{
              background: seg === 'precisa' ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.02)',
              border: `1px dashed ${seg === 'precisa' ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 14, padding: '40px 20px',
              textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              {seg === 'precisa' && <IconCheck size={20} color="#22c55e" />}
              <p style={{ fontSize: 14, color: seg === 'precisa' ? '#22c55e' : 'rgba(255,255,255,0.4)', margin: 0, fontWeight: seg === 'precisa' ? 700 : 400 }}>
                {mensagem}
              </p>
            </div>
          )
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visiveis.map(t => {
              const s = STATUS[t.status]
              const tSeg = segmentoDe(t)
              const turno = tSeg === 'precisa'
                ? { label: 'Aguardando você', color: '#ef4444', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.35)' }
                : tSeg === 'aguardando'
                  ? { label: 'Aguardando cliente', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.28)' }
                  : null
              return (
                <Link key={t.id} href={`/admin/tickets/${t.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div
                    style={{
                      background: tSeg === 'precisa' ? 'rgba(239,68,68,0.055)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${tSeg === 'precisa' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      borderLeft: tSeg === 'precisa' ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12,
                      padding: tSeg === 'precisa' ? '14px 18px 14px 16px' : '14px 18px',
                      display: 'flex', alignItems: 'center', gap: 12,
                      opacity: tSeg === 'resolvido' ? 0.72 : 1,
                      transition: 'border-color .15s, background .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = tSeg === 'precisa' ? 'rgba(239,68,68,0.09)' : 'rgba(255,255,255,0.05)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = tSeg === 'precisa' ? 'rgba(239,68,68,0.055)' : 'rgba(255,255,255,0.03)' }}
                  >
                    {/* Badge de turno (quem precisa falar) -- so nao aparece pra resolvido/fechado,
                        onde o status abaixo ja basta */}
                    {turno && (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                        fontSize: 10, fontWeight: 800,
                        padding: '4px 9px', borderRadius: 100,
                        color: turno.color, background: turno.bg, border: `1px solid ${turno.border}`,
                        whiteSpace: 'nowrap',
                      }}>
                        {tSeg === 'precisa' && <IconClock size={10} color={turno.color} />}
                        {turno.label}
                      </span>
                    )}

                    {/* Prioridade -- so mostra o flag de Alta, senao vira ruido
                        visual numa lista onde a maioria e Normal (item 3 do
                        relatorio de auditoria, 04/08/2026) */}
                    {t.priority === 'high' && (
                      <span title="Prioridade alta" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                        background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)',
                      }}>
                        <IconBolt size={12} color="#ef4444" />
                      </span>
                    )}

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
                      <p style={{ fontSize: 11, fontWeight: tSeg === 'precisa' ? 800 : 400, color: tSeg === 'precisa' ? '#ef4444' : 'rgba(255,255,255,0.3)', margin: 0 }}>
                        {tempoLabel(t.last_message_at, tSeg)}
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )
      })()}

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