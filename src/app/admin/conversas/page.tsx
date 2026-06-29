'use client'

/**
 * src/app/admin/conversas/page.tsx
 *
 * Moderacao das conversas do marketplace. Lista todas as conversas + busca,
 * abre a thread completa e permite OCULTAR / EXCLUIR mensagens (com log do
 * original) e ENVIAR AVISO no sino do usuario. Protegido pelas rotas admin
 * (/api/admin/conversas*, requireAdmin via cookie httpOnly).
 */

import { useEffect, useState, useCallback } from 'react'

const GOLD = '#f59e0b'
const MUTED = 'rgba(255,255,255,0.45)'
const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const STATUS_LABEL: Record<string, string> = { disponivel: 'Disponível', reservado: 'Interesse', em_negociacao: 'Em negociação', enviado: 'Enviada', concluido: 'Concluída', cancelado: 'Cancelada' }
const STATUS_COR: Record<string, string> = { disponivel: '#94a3b8', reservado: '#f59e0b', em_negociacao: '#60a5fa', enviado: '#60a5fa', concluido: '#22c55e', cancelado: '#ef4444' }

function hora(iso: string) { try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }

type Conversa = {
  anuncio_id: string; card_name: string; card_image: string | null; price: number; status: string
  seller_id: string; seller_nome: string; seller_email: string | null
  buyer_id: string | null; buyer_nome: string | null; buyer_email: string | null
  total_msgs: number; ultima_at: string; tem_oculta: boolean
}
type Msg = {
  id: string; sender_id: string; sender_nome: string; body: string
  oculta: boolean; body_original: string | null; created_at: string; read_at: string | null
}

export default function AdminConversasPage() {
  const [q, setQ] = useState('')
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<Conversa | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [aviso, setAviso] = useState<{ user_id: string; nome: string } | null>(null)
  const [avisoTexto, setAvisoTexto] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const fetchConversas = useCallback(async (busca: string) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/conversas?q=${encodeURIComponent(busca)}`)
      const j = await r.json()
      setConversas(j.conversas || [])
    } catch { setConversas([]) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchConversas('') }, [fetchConversas])

  async function fetchThread(c: Conversa) {
    setSel(c); setLoadingThread(true); setMsgs([])
    try {
      const r = await fetch(`/api/admin/conversas/${c.anuncio_id}`)
      const j = await r.json()
      setMsgs(j.mensagens || [])
    } catch { setMsgs([]) }
    setLoadingThread(false)
  }

  async function moderar(msgId: string, acao: 'ocultar' | 'excluir') {
    const label = acao === 'excluir' ? 'EXCLUIR (apaga de vez)' : 'OCULTAR (vira "removida pela moderação")'
    if (!window.confirm(`Confirma ${label} esta mensagem? O texto original fica salvo no log de moderação.`)) return
    setBusy(true)
    try {
      const r = await fetch('/api/admin/conversas/moderar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msg_id: msgId, acao }) })
      const j = await r.json()
      if (j?.ok) { setFlash(acao === 'excluir' ? 'Mensagem excluída.' : 'Mensagem ocultada.'); if (sel) await fetchThread(sel); fetchConversas(q) }
      else setFlash(j?.erro || j?.error || 'Falha na ação.')
    } catch { setFlash('Erro de rede.') }
    setBusy(false)
    setTimeout(() => setFlash(null), 2500)
  }

  async function enviarAviso() {
    if (!aviso || !avisoTexto.trim()) return
    setBusy(true)
    try {
      const r = await fetch('/api/admin/conversas/aviso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: aviso.user_id, mensagem: avisoTexto.trim() }) })
      const j = await r.json()
      if (j?.ok) { setFlash(`Aviso enviado para ${aviso.nome}.`); setAviso(null); setAvisoTexto('') }
      else setFlash(j?.error || 'Falha ao enviar aviso.')
    } catch { setFlash('Erro de rede.') }
    setBusy(false)
    setTimeout(() => setFlash(null), 2500)
  }

  return (
    <div style={{ padding: '28px 24px', maxWidth: 1180, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px' }}>Conversas</h1>
      <p style={{ color: MUTED, fontSize: 13, margin: '0 0 20px' }}>Moderação das negociações do marketplace. Você pode <b style={{ color: '#f0f0f0' }}>ocultar</b> ou <b style={{ color: '#f0f0f0' }}>excluir</b> mensagens e <b style={{ color: '#f0f0f0' }}>enviar um aviso</b> no sino do usuário. O texto original fica registrado no log.</p>

      {flash && <div style={{ marginBottom: 14, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>{flash}</div>}

      {/* Busca */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') fetchConversas(q) }}
          placeholder="Buscar por carta, nome ou email..."
          style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#f0f0f0', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        <button onClick={() => fetchConversas(q)} style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: GOLD, fontWeight: 700, fontSize: 13, padding: '0 18px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>Buscar</button>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Lista */}
        <div style={{ width: 360, flexShrink: 0, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: MUTED, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{conversas.length} conversa(s)</div>
          <div style={{ maxHeight: 560, overflowY: 'auto' }}>
            {loading && <p style={{ padding: 24, textAlign: 'center', color: MUTED, fontSize: 13 }}>Carregando...</p>}
            {!loading && conversas.length === 0 && <p style={{ padding: 24, textAlign: 'center', color: MUTED, fontSize: 13 }}>Nenhuma conversa.</p>}
            {conversas.map(c => {
              const cor = STATUS_COR[c.status] || '#94a3b8'
              const ativa = sel?.anuncio_id === c.anuncio_id
              return (
                <div key={c.anuncio_id} onClick={() => fetchThread(c)} style={{ display: 'flex', gap: 10, padding: '11px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', background: ativa ? 'rgba(245,158,11,0.08)' : 'transparent', borderLeft: ativa ? '2px solid #f59e0b' : '2px solid transparent' }}>
                  <div style={{ width: 36, height: 50, borderRadius: 6, flexShrink: 0, overflow: 'hidden', background: 'linear-gradient(160deg,#1b1f2b,#0f1119)' }}>
                    {c.card_image && <img src={c.card_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.card_name}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: cor, flexShrink: 0 }}>{STATUS_LABEL[c.status] || c.status}</span>
                    </div>
                    <p style={{ fontSize: 11, color: MUTED, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.seller_nome} ↔ {c.buyer_nome || '—'}</p>
                    <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{c.total_msgs} msg · {hora(c.ultima_at)}{c.tem_oculta && <span style={{ color: '#ef4444', marginLeft: 6 }}>● moderada</span>}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Thread */}
        <div style={{ flex: 1, minWidth: 320, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 400 }}>
          {!sel && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 13, padding: 40 }}>Selecione uma conversa para moderar.</div>}
          {sel && (
            <>
              {/* Header da thread */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{sel.card_name} · {fmt(sel.price)}</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <ParteChip rotulo="Vendedor" nome={sel.seller_nome} email={sel.seller_email} onAvisar={() => setAviso({ user_id: sel.seller_id, nome: sel.seller_nome })} />
                  {sel.buyer_id && <ParteChip rotulo="Comprador" nome={sel.buyer_nome || '—'} email={sel.buyer_email} onAvisar={() => setAviso({ user_id: sel.buyer_id as string, nome: sel.buyer_nome || 'Comprador' })} />}
                </div>
              </div>

              {/* Mensagens */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 480 }}>
                {loadingThread && <p style={{ textAlign: 'center', color: MUTED, fontSize: 13 }}>Carregando...</p>}
                {!loadingThread && msgs.length === 0 && <p style={{ textAlign: 'center', color: MUTED, fontSize: 13 }}>Sem mensagens.</p>}
                {msgs.map(m => (
                  <div key={m.id} style={{ background: m.oculta ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${m.oculta ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>{m.sender_nome}</span>
                      <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)' }}>{hora(m.created_at)}</span>
                    </div>
                    <p style={{ fontSize: 13.5, color: m.oculta ? 'rgba(255,255,255,0.5)' : '#f0f0f0', fontStyle: m.oculta ? 'italic' : 'normal', lineHeight: 1.4 }}>{m.body}</p>
                    {m.oculta && m.body_original && (
                      <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', marginTop: 6, paddingTop: 6, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                        <b style={{ color: '#ef4444' }}>Original:</b> {m.body_original}
                      </p>
                    )}
                    {!m.oculta && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button disabled={busy} onClick={() => moderar(m.id, 'ocultar')} style={modBtn('#f59e0b')}>Ocultar</button>
                        <button disabled={busy} onClick={() => moderar(m.id, 'excluir')} style={modBtn('#ef4444')}>Excluir</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de aviso */}
      {aviso && (
        <div onClick={() => setAviso(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 460, maxWidth: '100%', background: '#0e1119', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 22 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Enviar aviso</h3>
            <p style={{ fontSize: 12.5, color: MUTED, marginBottom: 14 }}>Vai pro sino de <b style={{ color: '#f0f0f0' }}>{aviso.nome}</b>. Use pra alertar sobre conduta na negociação.</p>
            <textarea value={avisoTexto} maxLength={500} onChange={e => setAvisoTexto(e.target.value)} rows={4}
              placeholder="Ex.: Identificamos linguagem inadequada na sua conversa. Mantenha o respeito ou a conta pode ser suspensa."
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#f0f0f0', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'right', margin: '4px 0 14px' }}>{avisoTexto.length}/500</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setAviso(null)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: MUTED, fontWeight: 600, fontSize: 13, padding: '9px 16px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button disabled={busy || !avisoTexto.trim()} onClick={enviarAviso} style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', color: '#1a0e00', fontWeight: 700, fontSize: 13, padding: '9px 18px', borderRadius: 9, cursor: busy || !avisoTexto.trim() ? 'default' : 'pointer', opacity: busy || !avisoTexto.trim() ? 0.5 : 1, fontFamily: 'inherit' }}>Enviar aviso</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ParteChip({ rotulo, nome, email, onAvisar }: { rotulo: string; nome: string; email: string | null; onAvisar: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{rotulo}</p>
        <p style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{nome}</p>
        {email && <p style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{email}</p>}
      </div>
      <button onClick={onAvisar} style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', color: GOLD, fontWeight: 700, fontSize: 11.5, padding: '6px 11px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>Avisar</button>
    </div>
  )
}

function modBtn(cor: string): React.CSSProperties {
  return { background: `${cor}1f`, border: `1px solid ${cor}55`, color: cor, fontWeight: 700, fontSize: 11.5, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }
}
