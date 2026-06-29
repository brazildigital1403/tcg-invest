'use client'

/**
 * src/app/marketplace/negociacao/[id]/page.tsx
 *
 * Conversa on-platform do marketplace (Chat Marketplace, S43).
 * Tela cheia dedicada a uma negociacao (anuncio + comprador + vendedor).
 *
 * Substitui a "revelacao do WhatsApp": o "Tenho interesse" passa a abrir
 * esta tela. Mensagens via RPCs SECURITY DEFINER:
 *   - enviar_mensagem(p_anuncio_id, p_body)  -> grava + avanca status + toca o sino
 *   - marcar_conversa_lida(p_anuncio_id)     -> marca recebidas + notificacoes lidas
 * Leitura das mensagens via RLS (so as 2 partes). Atualizacao por polling (~6s).
 *
 * Acoes do negocio (Confirmar envio / recebimento / cancelar / avaliar) tambem
 * vivem aqui dentro, alem do card do marketplace.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { useAppModal } from '@/components/ui/useAppModal'
import AvaliacaoModal from '@/components/marketplace/AvaliacaoModal'
import { trackFirstCardAdded } from '@/lib/analytics'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

const STATUS_LABEL: Record<string, string> = {
  disponivel: 'Disponível', reservado: 'Interesse', em_negociacao: 'Em negociação',
  enviado: 'Carta enviada', concluido: 'Concluída', cancelado: 'Cancelada',
}
const STATUS_COR: Record<string, string> = {
  disponivel: '#94a3b8', reservado: '#f59e0b', em_negociacao: '#60a5fa',
  enviado: '#60a5fa', concluido: '#22c55e', cancelado: '#ef4444',
}

const STEPS = [
  { key: 'reservado',     label: 'Interesse' },
  { key: 'em_negociacao', label: 'Negociação' },
  { key: 'enviado',       label: 'Enviada' },
  { key: 'concluido',     label: 'Recebida' },
]

function cleanName(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<').trim()
}

function horaFmt(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

function mesmaData(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function dataSep(iso: string): string {
  const d = new Date(iso); const hoje = new Date()
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1)
  if (d.toDateString() === hoje.toDateString()) return 'Hoje'
  if (d.toDateString() === ontem.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

type Msg = {
  id: string; anuncio_id: string; sender_id: string
  body: string; created_at: string; read_at: string | null
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function NegociacaoPage() {
  const params = useParams()
  const router = useRouter()
  const anuncioId = String((params as any)?.id || '')
  const { openLogin } = useAuthModal()
  const { showConfirm, showAlert } = useAppModal()

  const [userId, setUserId]   = useState<string | null>(null)
  const [loaded, setLoaded]   = useState(false)
  const [anuncio, setAnuncio] = useState<any>(null)
  const [role, setRole]       = useState<'comprador' | 'vendedor' | null>(null)
  const [outroNome, setOutroNome] = useState('')
  const [msgs, setMsgs]       = useState<Msg[]>([])
  const [texto, setTexto]     = useState('')
  const [enviando, setEnviando] = useState(false)
  const [showAvaliacao, setShowAvaliacao] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  // carrega o anuncio + nomes + papel
  const carregarAnuncio = useCallback(async (uid: string) => {
    const { data: a } = await supabase.from('marketplace').select('*').eq('id', anuncioId).single()
    if (!a) { router.replace('/marketplace'); return null }
    const ehVendedor  = a.user_id === uid
    const ehComprador = a.buyer_id === uid
    if (!ehVendedor && !ehComprador) { router.replace('/marketplace'); return null }

    const outroId = ehVendedor ? a.buyer_id : a.user_id
    let nomeOutro = ehVendedor ? 'Comprador' : 'Vendedor'
    if (outroId) {
      const { data: pu } = await supabase.from('public_users').select('name, username').eq('id', outroId).single()
      nomeOutro = cleanName(pu?.name) || pu?.username || nomeOutro
    }
    const { data: me } = await supabase.from('public_users').select('name, username').eq('id', uid).single()
    const meuNome = cleanName(me?.name) || me?.username || 'Você'

    const enriched = {
      ...a,
      seller_name: ehVendedor ? meuNome : nomeOutro,
      buyer_name:  ehVendedor ? nomeOutro : meuNome,
    }
    setAnuncio(enriched)
    setRole(ehVendedor ? 'vendedor' : 'comprador')
    setOutroNome(nomeOutro)
    return enriched
  }, [anuncioId, router])

  const carregarMsgs = useCallback(async () => {
    const { data } = await supabase.from('marketplace_mensagens')
      .select('*').eq('anuncio_id', anuncioId).order('created_at', { ascending: true })
    setMsgs((data as Msg[]) || [])
  }, [anuncioId])

  const marcarLida = useCallback(async () => {
    try { await supabase.rpc('marcar_conversa_lida', { p_anuncio_id: anuncioId }) } catch { /* noop */ }
  }, [anuncioId])

  // mount
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id ?? null
      if (!active) return
      setUserId(uid)
      if (!uid) { setLoaded(true); openLogin?.(); return }
      const a = await carregarAnuncio(uid)
      if (!active || !a) { setLoaded(true); return }
      await carregarMsgs()
      await marcarLida()
      setLoaded(true)
    })()
    return () => { active = false }
  }, [carregarAnuncio, carregarMsgs, marcarLida, openLogin])

  // polling ~6s
  useEffect(() => {
    if (!userId || !anuncio) return
    const iv = setInterval(async () => {
      await carregarMsgs()
      await marcarLida()
      const { data: a } = await supabase.from('marketplace').select('status, buyer_id').eq('id', anuncioId).single()
      if (a) setAnuncio((prev: any) => prev ? { ...prev, status: a.status, buyer_id: a.buyer_id } : prev)
    }, 6000)
    return () => clearInterval(iv)
  }, [userId, anuncio, anuncioId, carregarMsgs, marcarLida])

  // autoscroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])

  // re-marca lida quando a aba volta ao foco
  useEffect(() => {
    const onFocus = () => { if (userId && anuncio) { carregarMsgs(); marcarLida() } }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [userId, anuncio, carregarMsgs, marcarLida])

  async function enviar() {
    const corpo = texto.trim()
    if (!corpo || enviando) return
    setEnviando(true)
    setTexto('')
    const { error } = await supabase.rpc('enviar_mensagem', { p_anuncio_id: anuncioId, p_body: corpo })
    if (error) {
      showAlert('Não foi possível enviar a mensagem. Tente novamente.', 'error')
      setTexto(corpo); setEnviando(false); return
    }
    await carregarMsgs()
    setAnuncio((prev: any) => prev && prev.status === 'reservado' ? { ...prev, status: 'em_negociacao' } : prev)
    setEnviando(false)
    inputRef.current?.focus()
  }

  // ─── Ações do negócio ────────────────────────────────────────────────────
  async function confirmarEnvio() {
    if (!anuncio) return
    const ok = await showConfirm({
      message: `Confirma que enviou "${anuncio.card_name}" para ${outroNome}?`,
      confirmLabel: 'Sim, confirmei o envio',
      description: 'O comprador será notificado para confirmar o recebimento.',
    })
    if (!ok) return
    await supabase.from('marketplace').update({ status: 'enviado' }).eq('id', anuncioId)
    // TODO(passo d): notificar comprador (sino + email) via servidor
    showAlert('Envio confirmado! Aguardando o comprador confirmar o recebimento.', 'success')
    if (userId) await carregarAnuncio(userId)
  }

  async function confirmarRecebimento() {
    if (!anuncio || !userId) return
    const ok = await showConfirm({
      message: `Confirma que recebeu "${anuncio.card_name}"?`,
      confirmLabel: 'Sim, recebi a carta!',
      description: 'A carta será adicionada à sua coleção e a venda será concluída.',
    })
    if (!ok) return

    await supabase.from('user_cards').insert({
      user_id: userId, card_name: anuncio.card_name,
      card_image: anuncio.card_image || null, card_link: anuncio.card_link || null,
      variante: anuncio.variante || 'normal',
    })
    trackFirstCardAdded(userId)
    await supabase.from('user_cards').delete()
      .eq('user_id', anuncio.user_id).eq('card_name', anuncio.card_name).limit(1)
    await supabase.from('transactions').insert({
      buyer_id: userId, seller_id: anuncio.user_id,
      card_name: anuncio.card_name, price: anuncio.price,
    })
    await supabase.from('marketplace').update({ status: 'concluido' }).eq('id', anuncioId)
    // TODO(passo d): notificar vendedor (sino + email) via servidor

    showAlert('Compra concluída! A carta foi adicionada à sua coleção.', 'success')
    await carregarAnuncio(userId)
    setTimeout(() => setShowAvaliacao(true), 700)
  }

  async function cancelar() {
    const ok = await showConfirm({
      message: 'Deseja cancelar esta negociação?',
      danger: true, confirmLabel: 'Cancelar negociação',
      description: 'O anúncio voltará para a vitrine como disponível.',
    })
    if (!ok) return
    await supabase.from('marketplace').update({ status: 'disponivel', buyer_id: null }).eq('id', anuncioId)
    router.replace('/marketplace?tab=negociacoes')
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  if (!loaded) {
    return (
      <div style={fullCenter}>
        <div style={{ width: 34, height: 34, border: '3px solid rgba(245,158,11,0.25)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!userId) {
    return (
      <div style={fullCenter}>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Entre para ver esta negociação.</p>
        <button onClick={() => openLogin?.()} style={btnPrimary}>Entrar</button>
      </div>
    )
  }

  if (!anuncio) {
    return (
      <div style={fullCenter}>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Negociação não encontrada.</p>
        <button onClick={() => router.replace('/marketplace')} style={btnPrimary}>Voltar ao marketplace</button>
      </div>
    )
  }

  const status = anuncio.status || 'reservado'
  const cor = STATUS_COR[status] || '#94a3b8'
  const currentIdx = STEPS.findIndex(s => s.key === status)
  const finalizado = status === 'cancelado' || status === 'concluido'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60, background: '#080a0f',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0',
    }}>
      {/* Topo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
        <button onClick={() => router.push('/marketplace?tab=negociacoes')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 26, lineHeight: 1, cursor: 'pointer', padding: '0 2px 2px 0', fontFamily: 'inherit' }}>‹</button>
        <div style={{ width: 38, height: 53, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(160deg,#1b1f2b,#0f1119)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {anuncio.card_image
            ? <img src={anuncio.card_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(245,158,11,0.3),rgba(239,68,68,0.2))' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanName(anuncio.card_name)}</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
            com <b style={{ color: '#f59e0b', fontWeight: 700 }}>{outroNome}</b> · {fmt(anuncio.price)}
          </p>
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 9px', borderRadius: 100, whiteSpace: 'nowrap', background: `${cor}22`, color: cor }}>{STATUS_LABEL[status] || status}</span>
      </div>

      {/* Timeline */}
      {!finalizado && currentIdx >= 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', padding: '9px 16px 7px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.012)', flexShrink: 0 }}>
          {STEPS.map((s, i) => {
            const done = i < currentIdx, now = i === currentIdx
            const c = done ? '#22c55e' : now ? '#60a5fa' : 'rgba(255,255,255,0.15)'
            return (
              <div key={s.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative' }}>
                {i < STEPS.length - 1 && <div style={{ position: 'absolute', top: 4, left: '50%', width: '100%', height: 2, background: done ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.1)' }} />}
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: c, boxShadow: now ? '0 0 0 4px rgba(96,165,250,0.18)' : 'none', zIndex: 1 }} />
                <span style={{ fontSize: 9, fontWeight: 600, color: done ? 'rgba(34,197,94,0.75)' : now ? '#60a5fa' : 'rgba(255,255,255,0.32)' }}>{s.label}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Mensagens */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 9, background: 'radial-gradient(120% 60% at 50% 0%, rgba(245,158,11,0.03), transparent 60%)' }}>
        {msgs.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 260, color: 'rgba(255,255,255,0.4)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Comece a conversa</p>
            <p style={{ fontSize: 12.5, lineHeight: 1.5 }}>Combine valor, condição e envio direto por aqui — sem sair do Bynx.</p>
          </div>
        )}
        {msgs.map((m, i) => {
          const meu = m.sender_id === userId
          const showSep = i === 0 || !mesmaData(msgs[i - 1].created_at, m.created_at)
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {showSep && <span style={{ alignSelf: 'center', fontSize: 10, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)', padding: '3px 10px', borderRadius: 100, margin: '2px 0' }}>{dataSep(m.created_at)}</span>}
              <div style={{
                maxWidth: '80%', padding: '9px 12px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.4, wordBreak: 'break-word',
                alignSelf: meu ? 'flex-end' : 'flex-start',
                ...(meu
                  ? { background: 'linear-gradient(135deg,rgba(245,158,11,0.92),rgba(239,68,68,0.85))', color: '#1a0e00', borderBottomRightRadius: 5, fontWeight: 500 }
                  : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.05)', borderBottomLeftRadius: 5 }),
              }}>
                {m.body}
                <div style={{ fontSize: 9.5, marginTop: 4, textAlign: 'right', opacity: meu ? 0.6 : 0.55, color: meu ? '#3a1d00' : 'inherit' }}>
                  {horaFmt(m.created_at)}
                  {meu && <span style={{ marginLeft: 4, color: m.read_at ? '#1769ff' : '#3a1d00', fontWeight: 700 }}>{m.read_at ? '✓✓' : '✓'}</span>}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Banner de ação do negócio */}
      <AcaoBanner
        role={role} status={status}
        onEnvio={confirmarEnvio} onRecebimento={confirmarRecebimento}
        onCancelar={cancelar} onAvaliar={() => setShowAvaliacao(true)}
      />

      {/* Input */}
      {!finalizado && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 12px', display: 'flex', gap: 9, alignItems: 'center', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
          <input
            ref={inputRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
            placeholder="Escreva uma mensagem..."
            maxLength={2000}
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100, padding: '11px 16px', color: '#f0f0f0', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
          />
          <button onClick={enviar} disabled={enviando || !texto.trim()} style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', cursor: enviando || !texto.trim() ? 'default' : 'pointer', opacity: enviando || !texto.trim() ? 0.5 : 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M3 11l18-8-8 18-2-7-8-3z" fill="#1a0e00" /></svg>
          </button>
        </div>
      )}

      {showAvaliacao && role && (
        <AvaliacaoModal card={anuncio} userId={userId} role={role} onClose={() => setShowAvaliacao(false)} />
      )}
    </div>
  )
}

// ─── Banner de ação ──────────────────────────────────────────────────────────

function AcaoBanner({ role, status, onEnvio, onRecebimento, onCancelar, onAvaliar }: {
  role: 'comprador' | 'vendedor' | null
  status: string
  onEnvio: () => void; onRecebimento: () => void; onCancelar: () => void; onAvaliar: () => void
}) {
  const wrap = (children: React.ReactNode, cor = '#60a5fa') => (
    <div style={{ margin: '6px 14px 0', background: `${cor}12`, border: `1px solid ${cor}38`, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexShrink: 0 }}>
      {children}
    </div>
  )
  const btn = (label: string, onClick: () => void, cor = '#60a5fa') => (
    <button onClick={onClick} style={{ background: `${cor}26`, border: `1px solid ${cor}66`, color: cor, fontWeight: 700, fontSize: 12, padding: '7px 13px', borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>{label}</button>
  )
  const txt = (s: string) => <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{s}</p>

  if (status === 'concluido')
    return wrap(<>{txt('Negociação concluída. Que tal avaliar?')}{btn('Avaliar', onAvaliar, '#22c55e')}</>, '#22c55e')

  if (role === 'vendedor') {
    if (status === 'reservado' || status === 'em_negociacao')
      return wrap(<>{txt('Combinou tudo? Quando despachar:')}<div style={{ display: 'flex', gap: 8 }}>{btn('Cancelar', onCancelar, '#ef4444')}{btn('Confirmar envio', onEnvio)}</div></>)
    if (status === 'enviado')
      return wrap(txt('✈️ Você confirmou o envio. Aguardando o comprador receber.'))
  }

  if (role === 'comprador') {
    if (status === 'reservado' || status === 'em_negociacao')
      return wrap(txt('⏳ Combine os detalhes. O vendedor confirma o envio quando despachar.'), '#f59e0b')
    if (status === 'enviado')
      return wrap(<>{txt('Sua carta chegou?')}{btn('Confirmar recebimento', onRecebimento, '#22c55e')}</>, '#22c55e')
  }

  return null
}

// ─── Estilos compartilhados ───────────────────────────────────────────────────

const fullCenter: React.CSSProperties = {
  position: 'fixed', inset: 0, background: '#080a0f', display: 'flex',
  flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
  fontFamily: "'DM Sans', system-ui, sans-serif",
}
const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', color: '#1a0e00',
  fontWeight: 700, fontSize: 13, padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
  fontFamily: 'inherit',
}
