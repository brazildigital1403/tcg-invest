'use client'

/**
 * src/components/marketplace/ChatDock.tsx
 *
 * Inbox unificado de conversas do marketplace (Chat Marketplace, S43).
 * Componente GLOBAL: montado uma vez no AppLayout, aparece em qualquer tela.
 *
 *  - Botao flutuante (FAB) canto inferior direito + selo de conversas nao-lidas.
 *  - Desktop: painel ancorado a direita (lista de conversas | conversa ativa).
 *  - Mobile: tela cheia (lista -> conversa, com voltar).
 *  - Deep-link: ?conversa=<anuncio_id> abre o dock direto naquela conversa
 *    (o sino aponta pra ca).
 *
 * Dados:
 *  - listar_conversas()              -> lista (carta, outra pessoa, ultima msg, nao_lidas, ativa)
 *  - contar_conversas_nao_lidas()    -> selo do FAB
 *  - marketplace_mensagens (RLS)     -> mensagens da conversa (polling ~6s)
 *  - enviar_mensagem / marcar_conversa_lida  -> RPCs SECURITY DEFINER
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { dispararMarco } from '@/lib/marketplaceMarco'
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
  { key: 'reservado', label: 'Interesse' }, { key: 'em_negociacao', label: 'Negociação' },
  { key: 'enviado', label: 'Enviada' }, { key: 'concluido', label: 'Recebida' },
]

function cleanName(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<').trim()
}
function horaFmt(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}
function mesmaData(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}
function dataSep(iso: string): string {
  const d = new Date(iso); const hoje = new Date(); const ontem = new Date(); ontem.setDate(hoje.getDate() - 1)
  if (d.toDateString() === hoje.toDateString()) return 'Hoje'
  if (d.toDateString() === ontem.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
function tempoCurto(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso); const hoje = new Date()
  if (d.toDateString() === hoje.toDateString()) return horaFmt(iso)
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1)
  if (d.toDateString() === ontem.toDateString()) return 'ontem'
  const dias = Math.floor((hoje.getTime() - d.getTime()) / 86400000)
  if (dias < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

type Conversa = {
  anuncio_id: string; card_name: string; card_image: string | null; price: number; status: string
  meu_papel: 'comprador' | 'vendedor'; outro_id: string | null; outro_nome: string
  ultima_msg: string | null; ultima_msg_at: string | null; ultima_msg_minha: boolean
  nao_lidas: number; ativa: boolean
}
type Msg = { id: string; anuncio_id: string; sender_id: string; body: string; created_at: string; read_at: string | null }

function useIsDesktop(): boolean {
  const [desk, setDesk] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 860px)')
    const on = () => setDesk(mq.matches); on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return desk
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function ChatDock() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const desktop = useIsDesktop()

  const [userId, setUserId] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)
  const [ativaId, setAtivaId] = useState<string | null>(null)
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [selo, setSelo] = useState(0)

  // usuario
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (active) setUserId(data.user?.id ?? null)
      } catch {
        // Ignora erro de lock do supabase-js (sb-*-auth-token roubado por outra aba/requisicao);
        // o estado de auth ainda chega via onAuthStateChange abaixo.
      }
    })()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setUserId(sess?.user?.id ?? null))
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  // deep-link ?conversa=<id>
  const paramConversa = searchParams?.get('conversa') || null
  useEffect(() => {
    if (paramConversa) { setAberto(true); setAtivaId(paramConversa) }
  }, [paramConversa])

  const carregarConversas = useCallback(async () => {
    const { data } = await supabase.rpc('listar_conversas')
    setConversas((data as Conversa[]) || [])
  }, [])

  const carregarSelo = useCallback(async () => {
    const { data } = await supabase.rpc('contar_conversas_nao_lidas')
    setSelo(typeof data === 'number' ? data : 0)
  }, [])

  // selo: polling global (mesmo com dock fechado)
  useEffect(() => {
    if (!userId) { setSelo(0); return }
    carregarSelo()
    const iv = setInterval(carregarSelo, 12000)
    const onFocus = () => carregarSelo()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(iv); window.removeEventListener('focus', onFocus) }
  }, [userId, carregarSelo])

  // lista: carrega/atualiza quando o dock esta aberto
  useEffect(() => {
    if (!aberto || !userId) return
    carregarConversas()
    const iv = setInterval(carregarConversas, 7000)
    return () => clearInterval(iv)
  }, [aberto, userId, carregarConversas])

  function abrirInbox() { setAberto(true); if (desktop) { /* mantem ativa */ } else setAtivaId(null) }
  function fecharTudo() {
    setAberto(false); setAtivaId(null)
    if (paramConversa) router.replace(pathname || '/marketplace')
  }
  function fecharThread() {
    setAtivaId(null)
    if (paramConversa) router.replace(pathname || '/marketplace')
  }
  function pickConversa(id: string) { setAtivaId(id) }

  // refresca lista/selo apos enviar ou ler
  const aposMudanca = useCallback(() => { carregarConversas(); carregarSelo() }, [carregarConversas, carregarSelo])

  if (!userId) return null

  const ativas = conversas.filter(c => c.ativa)
  const historico = conversas.filter(c => !c.ativa)

  return (
    <>
      {/* FAB */}
      {!aberto && <ChatFab count={selo} onClick={abrirInbox} />}

      {/* Dock */}
      {aberto && (
        <>
          <div onClick={fecharTudo} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9990 }} />
          <div style={desktop
            ? { position: 'fixed', top: 0, right: 0, height: '100dvh', width: 680, maxWidth: '94vw', zIndex: 9991, display: 'flex', background: '#080a0f', borderLeft: '1px solid rgba(255,255,255,0.1)', boxShadow: '-30px 0 60px -20px rgba(0,0,0,0.7)', animation: 'chatdock-in 0.4s cubic-bezier(.22,.61,.36,1)' }
            : { position: 'fixed', inset: 0, zIndex: 9991, display: 'flex', background: '#080a0f' }
          }>
            <style>{`@keyframes chatdock-in{from{transform:translateX(100%)}to{transform:translateX(0)}}@keyframes chatdock-spin{to{transform:rotate(360deg)}}`}</style>

            {/* Lista (desktop sempre; mobile so quando sem conversa ativa) */}
            {(desktop || !ativaId) && (
              <div style={{
                width: desktop ? 260 : '100%', flexShrink: 0, display: 'flex', flexDirection: 'column',
                borderRight: desktop ? '1px solid rgba(255,255,255,0.07)' : 'none', background: 'rgba(255,255,255,0.012)',
                fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0',
              }}>
                <div style={{ padding: '13px 14px', fontSize: 14, fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <span>Conversas</span>
                  <button onClick={fecharTudo} style={iconBtn}><svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg></button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {conversas.length === 0 && (
                    <p style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                      Nenhuma conversa ainda. Quando você demonstrar interesse numa carta, a conversa aparece aqui.
                    </p>
                  )}
                  {ativas.map(c => <ConversaRow key={c.anuncio_id} c={c} ativa={c.anuncio_id === ativaId} onClick={() => pickConversa(c.anuncio_id)} />)}
                  {historico.length > 0 && (
                    <>
                      <p style={{ padding: '12px 14px 6px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Histórico</p>
                      {historico.map(c => <ConversaRow key={c.anuncio_id} c={c} ativa={c.anuncio_id === ativaId} onClick={() => pickConversa(c.anuncio_id)} />)}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Thread */}
            {(desktop || ativaId) && (
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                {ativaId
                  ? <ChatThread key={ativaId} anuncioId={ativaId} userId={userId} desktop={desktop} onVoltar={fecharThread} onFechar={fecharTudo} onMudanca={aposMudanca} />
                  : <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'rgba(255,255,255,0.35)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v12H8l-4 4V4z" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                      <p style={{ fontSize: 13 }}>Selecione uma conversa</p>
                    </div>}
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

// ─── FAB ─────────────────────────────────────────────────────────────────────

function ChatFab({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <>
      <style>{`
        .bynx-chatfab { position: fixed; bottom: 22px; right: 22px; z-index: 201; }
        @media (max-width: 768px) { .bynx-chatfab { bottom: 84px; right: 16px; } }
      `}</style>
      <button onClick={onClick} aria-label="Conversas" className="bynx-chatfab" style={{
      width: 56, height: 56, borderRadius: '50%',
      background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', cursor: 'pointer',
      boxShadow: '0 10px 30px -6px rgba(245,158,11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v12H8l-4 4V4z" stroke="#1a0e00" strokeWidth="1.8" strokeLinejoin="round" /></svg>
      {count > 0 && (
        <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 22, height: 22, borderRadius: 100, background: '#ef4444', border: '2px solid #080a0f', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
    </>
  )
}

// ─── Linha da lista ──────────────────────────────────────────────────────────

function ConversaRow({ c, ativa, onClick }: { c: Conversa; ativa: boolean; onClick: () => void }) {
  const cor = STATUS_COR[c.status] || '#94a3b8'
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', cursor: 'pointer',
      borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'relative',
      background: ativa ? 'rgba(245,158,11,0.08)' : 'transparent',
      borderLeft: ativa ? '2px solid #f59e0b' : '2px solid transparent',
      fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0',
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0, overflow: 'hidden', background: 'linear-gradient(160deg,#1b1f2b,#0f1119)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {c.card_image
          ? <img src={c.card_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(245,158,11,0.3),rgba(239,68,68,0.2))' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanName(c.card_name)}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{tempoCurto(c.ultima_msg_at)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: cor, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.outro_nome}</span>
        </div>
        <p style={{
          fontSize: 11.5, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          color: c.nao_lidas > 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
          fontWeight: c.nao_lidas > 0 ? 600 : 400,
        }}>
          {c.ultima_msg_minha ? 'Você: ' : ''}{c.ultima_msg || 'Conversa iniciada'}
        </p>
      </div>
      {c.nao_lidas > 0 && (
        <span style={{ minWidth: 18, height: 18, borderRadius: 100, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#1a0e00', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>{c.nao_lidas}</span>
      )}
    </div>
  )
}

// ─── Thread (conversa) ───────────────────────────────────────────────────────

function ChatThread({ anuncioId, userId, desktop, onVoltar, onFechar, onMudanca }: {
  anuncioId: string; userId: string; desktop: boolean
  onVoltar: () => void; onFechar: () => void; onMudanca: () => void
}) {
  const router = useRouter()
  const { showConfirm, showAlert } = useAppModal()
  const [anuncio, setAnuncio] = useState<any>(null)
  const [role, setRole] = useState<'comprador' | 'vendedor' | null>(null)
  const [outroNome, setOutroNome] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [showAvaliacao, setShowAvaliacao] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const carregarAnuncio = useCallback(async () => {
    const { data: a } = await supabase.from('marketplace').select('*').eq('id', anuncioId).single()
    if (!a) return null
    const ehVendedor = a.user_id === userId
    const ehComprador = a.buyer_id === userId
    if (!ehVendedor && !ehComprador) return null
    const outroId = ehVendedor ? a.buyer_id : a.user_id
    let nomeOutro = ehVendedor ? 'Comprador' : 'Vendedor'
    if (outroId) {
      const { data: pu } = await supabase.from('public_users').select('name, username').eq('id', outroId).single()
      nomeOutro = cleanName(pu?.name) || pu?.username || nomeOutro
    }
    const { data: me } = await supabase.from('public_users').select('name, username').eq('id', userId).single()
    const meuNome = cleanName(me?.name) || me?.username || 'Você'
    const enriched = { ...a, seller_name: ehVendedor ? meuNome : nomeOutro, buyer_name: ehVendedor ? nomeOutro : meuNome }
    setAnuncio(enriched); setRole(ehVendedor ? 'vendedor' : 'comprador'); setOutroNome(nomeOutro)
    return enriched
  }, [anuncioId, userId])

  const carregarMsgs = useCallback(async () => {
    const { data } = await supabase.from('marketplace_mensagens').select('*').eq('anuncio_id', anuncioId).order('created_at', { ascending: true })
    setMsgs((data as Msg[]) || [])
  }, [anuncioId])

  const marcarLida = useCallback(async () => {
    try { await supabase.rpc('marcar_conversa_lida', { p_anuncio_id: anuncioId }) } catch { /* noop */ }
  }, [anuncioId])

  useEffect(() => {
    let active = true
    ;(async () => {
      const a = await carregarAnuncio()
      if (!active) return
      if (!a) { setLoaded(true); return }
      await carregarMsgs(); await marcarLida(); onMudanca(); setLoaded(true)
    })()
    return () => { active = false }
  }, [carregarAnuncio, carregarMsgs, marcarLida, onMudanca])

  useEffect(() => {
    const iv = setInterval(async () => {
      await carregarMsgs(); await marcarLida()
      const { data: a } = await supabase.from('marketplace').select('status, buyer_id').eq('id', anuncioId).single()
      if (a) setAnuncio((p: any) => p ? { ...p, status: a.status, buyer_id: a.buyer_id } : p)
      onMudanca()
    }, 6000)
    return () => clearInterval(iv)
  }, [anuncioId, carregarMsgs, marcarLida, onMudanca])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])

  async function enviar() {
    const corpo = texto.trim()
    if (!corpo || enviando) return
    setEnviando(true); setTexto('')
    const { error } = await supabase.rpc('enviar_mensagem', { p_anuncio_id: anuncioId, p_body: corpo })
    if (error) { showAlert('Não foi possível enviar a mensagem.', 'error'); setTexto(corpo); setEnviando(false); return }
    await carregarMsgs()
    setAnuncio((p: any) => p && p.status === 'reservado' ? { ...p, status: 'em_negociacao' } : p)
    setEnviando(false); onMudanca(); inputRef.current?.focus()
  }

  async function confirmarEnvio() {
    if (!anuncio) return
    const ok = await showConfirm({ message: `Confirma que enviou "${anuncio.card_name}" para ${outroNome}?`, confirmLabel: 'Sim, confirmei o envio', description: 'O comprador será notificado para confirmar o recebimento.' })
    if (!ok) return
    await supabase.from('marketplace').update({ status: 'enviado' }).eq('id', anuncioId)
    await dispararMarco(anuncioId, 'enviado')
    showAlert('Envio confirmado! Aguardando o comprador confirmar o recebimento.', 'success')
    await carregarAnuncio(); onMudanca()
  }

  async function confirmarRecebimento() {
    if (!anuncio) return
    const ok = await showConfirm({ message: `Confirma que recebeu "${anuncio.card_name}"?`, confirmLabel: 'Sim, recebi a carta!', description: 'A carta será adicionada à sua coleção e a venda será concluída.' })
    if (!ok) return
    await supabase.from('user_cards').insert({ user_id: userId, card_name: anuncio.card_name, card_image: anuncio.card_image || null, card_link: anuncio.card_link || null, variante: anuncio.variante || 'normal' })
    trackFirstCardAdded(userId)
    await supabase.from('user_cards').delete().eq('user_id', anuncio.user_id).eq('card_name', anuncio.card_name).limit(1)
    await supabase.from('transactions').insert({ buyer_id: userId, seller_id: anuncio.user_id, card_name: anuncio.card_name, price: anuncio.price })
    await supabase.from('marketplace').update({ status: 'concluido' }).eq('id', anuncioId)
    await dispararMarco(anuncioId, 'concluido')
    showAlert('Compra concluída! A carta foi adicionada à sua coleção.', 'success')
    await carregarAnuncio(); onMudanca()
    setTimeout(() => setShowAvaliacao(true), 700)
  }

  async function cancelar() {
    const ok = await showConfirm({ message: 'Deseja cancelar esta negociação?', danger: true, confirmLabel: 'Cancelar negociação', description: 'O anúncio voltará para a vitrine como disponível.' })
    if (!ok) return
    await supabase.from('marketplace').update({ status: 'disponivel', buyer_id: null }).eq('id', anuncioId)
    onMudanca(); onVoltar()
  }

  if (!loaded) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 30, height: 30, border: '3px solid rgba(245,158,11,0.25)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'chatdock-spin 0.8s linear infinite' }} /></div>
  if (!anuncio) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13 }}>Conversa indisponível.</div>

  const status = anuncio.status || 'reservado'
  const cor = STATUS_COR[status] || '#94a3b8'
  const currentIdx = STEPS.findIndex(s => s.key === status)
  const finalizado = status === 'cancelado' || status === 'concluido'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0' }}>
      {/* Topo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
        {!desktop && <button onClick={onVoltar} style={{ ...iconBtn, fontSize: 24, paddingRight: 2 }}>‹</button>}
        <div style={{ width: 36, height: 50, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(160deg,#1b1f2b,#0f1119)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {anuncio.card_image ? <img src={anuncio.card_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(245,158,11,0.3),rgba(239,68,68,0.2))' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanName(anuncio.card_name)}</p>
          <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>com <b style={{ color: '#f59e0b' }}>{outroNome}</b> · {fmt(anuncio.price)}</p>
        </div>
        <span style={{ fontSize: 9.5, fontWeight: 800, padding: '4px 8px', borderRadius: 100, whiteSpace: 'nowrap', background: `${cor}22`, color: cor }}>{STATUS_LABEL[status] || status}</span>
        {desktop && <button onClick={onFechar} style={iconBtn}><svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg></button>}
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
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 9, background: 'radial-gradient(120% 60% at 50% 0%, rgba(245,158,11,0.03), transparent 60%)' }}>
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
                maxWidth: '80%', padding: '9px 12px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.4, wordBreak: 'break-word', alignSelf: meu ? 'flex-end' : 'flex-start',
                ...(meu ? { background: 'linear-gradient(135deg,rgba(245,158,11,0.92),rgba(239,68,68,0.85))', color: '#1a0e00', borderBottomRightRadius: 5, fontWeight: 500 } : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.05)', borderBottomLeftRadius: 5 }),
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

      {/* Banner de ação */}
      <AcaoBanner role={role} status={status} onEnvio={confirmarEnvio} onRecebimento={confirmarRecebimento} onCancelar={cancelar} onAvaliar={() => setShowAvaliacao(true)} />

      {/* Input */}
      {!finalizado && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 12px', display: 'flex', gap: 9, alignItems: 'center', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
          <input ref={inputRef} value={texto} onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
            placeholder="Escreva uma mensagem..." maxLength={2000}
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100, padding: '11px 16px', color: '#f0f0f0', fontSize: 16, fontFamily: 'inherit', outline: 'none' }} />
          <button onClick={enviar} disabled={enviando || !texto.trim()} style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', cursor: enviando || !texto.trim() ? 'default' : 'pointer', opacity: enviando || !texto.trim() ? 0.5 : 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M3 11l18-8-8 18-2-7-8-3z" fill="#1a0e00" /></svg>
          </button>
        </div>
      )}

      {showAvaliacao && role && <AvaliacaoModal card={anuncio} userId={userId} role={role} onClose={() => setShowAvaliacao(false)} />}
    </div>
  )
}

// ─── Banner de ação ──────────────────────────────────────────────────────────

function AcaoBanner({ role, status, onEnvio, onRecebimento, onCancelar, onAvaliar }: {
  role: 'comprador' | 'vendedor' | null; status: string
  onEnvio: () => void; onRecebimento: () => void; onCancelar: () => void; onAvaliar: () => void
}) {
  const wrap = (children: React.ReactNode, cor = '#60a5fa') => (
    <div style={{ margin: '6px 14px 0', background: `${cor}12`, border: `1px solid ${cor}38`, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexShrink: 0 }}>{children}</div>
  )
  const btn = (label: string, onClick: () => void, cor = '#60a5fa') => (
    <button onClick={onClick} style={{ background: `${cor}26`, border: `1px solid ${cor}66`, color: cor, fontWeight: 700, fontSize: 12, padding: '7px 13px', borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>{label}</button>
  )
  const txt = (s: string) => <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{s}</p>

  if (status === 'concluido') return wrap(<>{txt('Negociação concluída. Que tal avaliar?')}{btn('Avaliar', onAvaliar, '#22c55e')}</>, '#22c55e')
  if (role === 'vendedor') {
    if (status === 'reservado' || status === 'em_negociacao') return wrap(<>{txt('Combinou tudo? Quando despachar:')}<div style={{ display: 'flex', gap: 8 }}>{btn('Cancelar', onCancelar, '#ef4444')}{btn('Confirmar envio', onEnvio)}</div></>)
    if (status === 'enviado') return wrap(txt('✈️ Você confirmou o envio. Aguardando o comprador receber.'))
  }
  if (role === 'comprador') {
    if (status === 'reservado' || status === 'em_negociacao') return wrap(txt('⏳ Combine os detalhes. O vendedor confirma o envio quando despachar.'), '#f59e0b')
    if (status === 'enviado') return wrap(<>{txt('Sua carta chegou?')}{btn('Confirmar recebimento', onRecebimento, '#22c55e')}</>, '#22c55e')
  }
  return null
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
  lineHeight: 1, fontFamily: 'inherit', display: 'flex', alignItems: 'center', padding: 0,
}
