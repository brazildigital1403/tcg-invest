'use client'

/**
 * TradeAnalyzer — "Essa troca tá equilibrada?"
 *
 * Reaproveitável: usado standalone em /comparador e embutido no ChatDock
 * (pré-carregado com a carta do anúncio em negociação). Calculadora pura —
 * não salva nada, não abre negociação. Preço vem do Mercado Brasileiro que
 * a Bynx já calcula por carta (mesma cascata de fallback do AnunciarModal:
 * BRL normal -> foil -> reverse -> promo -> USD convertido).
 */

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface TradeCard {
  id: string
  name: string
  set_name?: string | null
  image_small?: string | null
  preco: number
  fonte: 'BRL' | 'USD'
}

interface Props {
  /** Pré-carrega o lado "você oferece" — usado pelo ChatDock com a carta do anúncio. */
  initialCardA?: TradeCard | null
  /** Presente = renderiza como modal overlay (ChatDock). Ausente = inline (página /comparador). */
  onClose?: () => void
}

// ─── Estilos (mesmo padrão do AnunciarModal/ChatDock) ───────────────────────

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const FONT = "'DM Sans', system-ui, sans-serif"

const col: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 260,
}
const addBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  fontSize: 12.5, color: '#f59e0b', fontWeight: 700, background: 'rgba(245,158,11,0.1)',
  border: '1px dashed rgba(245,158,11,0.4)', borderRadius: 10, padding: '11px 12px', cursor: 'pointer',
}
const cardRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '34px 1fr auto auto', alignItems: 'center', gap: 10,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 11, padding: '8px 10px',
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function cleanNome(raw: string) {
  return (raw || '').replace(/\s*\(\d+\/\d+\)\s*$/, '').trim()
}

/** Mesma cascata de preço do AnunciarModal: BRL primeiro, USD convertido como último recurso. */
async function precificar(card: any, usdRate: number): Promise<{ preco: number; fonte: 'BRL' | 'USD' }> {
  const brl = Number(card.preco_medio) || Number(card.preco_normal) || Number(card.preco_foil_medio)
    || Number(card.preco_reverse_medio) || Number(card.preco_promo_medio) || 0
  if (brl > 0) return { preco: brl, fonte: 'BRL' }
  const usd = Number(card.price_usd_holofoil) || Number(card.price_usd_normal) || 0
  if (usd > 0) return { preco: usd * usdRate, fonte: 'USD' }
  return { preco: 0, fonte: 'BRL' }
}

// ─── Busca de carta (mesma RPC do AddCardModal, smart_search_cards_v5) ──────

const PAGE_SIZE = 12

function BuscaCarta({ onPick, onCancel }: { onPick: (c: TradeCard) => void; onCancel: () => void }) {
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<any[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [usdRate, setUsdRate] = useState(6.0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/exchange-rate').then(r => r.json()).then(d => { if (d?.usd) setUsdRate(d.usd) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (termo.trim().length < 2) { setResultados([]); setHasMore(false); return }
    setBuscando(true)
    debounceRef.current = setTimeout(async () => {
      const { data, error } = await supabase.rpc('smart_search_cards_v5', { q: termo, limit_n: PAGE_SIZE, offset_n: 0 })
      const rows = error ? [] : (data || [])
      setResultados(rows)
      setOffset(rows.length)
      setHasMore(rows.length === PAGE_SIZE)
      setBuscando(false)
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [termo])

  async function carregarMais() {
    if (carregandoMais || !hasMore) return
    setCarregandoMais(true)
    const { data, error } = await supabase.rpc('smart_search_cards_v5', { q: termo, limit_n: PAGE_SIZE, offset_n: offset })
    const rows: any[] = error ? [] : (data || [])
    setResultados(prev => {
      const vistos = new Set(prev.map((c: any) => c.id))
      return [...prev, ...rows.filter((c: any) => !vistos.has(c.id))]
    })
    setOffset(prev => prev + rows.length)
    setHasMore(rows.length === PAGE_SIZE)
    setCarregandoMais(false)
  }

  async function escolher(card: any) {
    const { preco, fonte } = await precificar(card, usdRate)
    onPick({ id: card.id, name: cleanNome(card.name_pt || card.name), set_name: card.set_name_pt || card.set_name, image_small: card.image_small, preco, fonte })
  }

  return (
    <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 10 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: resultados.length ? 8 : 0 }}>
        <input
          autoFocus value={termo} onChange={e => setTermo(e.target.value)}
          placeholder="Nome da carta..." maxLength={60}
          style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, padding: '9px 12px', color: '#f0f0f0', fontSize: 13, fontFamily: FONT, outline: 'none' }}
        />
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', padding: '0 4px' }}>Cancelar</button>
      </div>
      {buscando && <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', margin: '4px 2px' }}>Buscando…</p>}
      {resultados.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}
          onScroll={e => {
            const el = e.currentTarget
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) carregarMais()
          }}>
          {resultados.map(r => (
            <div key={r.id} onClick={() => escolher(r)}
              style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 8, cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ width: 28, height: 39, borderRadius: 4, overflow: 'hidden', background: '#1a1d24', flexShrink: 0 }}>
                {r.image_small && <img src={r.image_small} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanNome(r.name_pt || r.name)}</p>
                <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.set_name_pt || r.set_name}</p>
              </div>
              {r.number && (
                <span style={{ fontSize: 10.5, fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 6, padding: '2px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {r.number}{r.set_total ? `/${r.set_total}` : ''}
                </span>
              )}
            </div>
          ))}
          {carregandoMais && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', margin: '4px 0 0' }}>Carregando mais…</p>}
          {!carregandoMais && hasMore && (
            <button onClick={carregarMais} style={{ background: 'none', border: 'none', color: '#f59e0b', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: '6px 0', fontFamily: FONT }}>
              Carregar mais resultados
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Coluna (um lado da troca) ───────────────────────────────────────────────

function Coluna({ label, cartas, onAdd, onRemove, buscaAberta, onAbrirBusca, onFecharBusca }: {
  label: string
  cartas: TradeCard[]
  onAdd: (c: TradeCard) => void
  onRemove: (id: string) => void
  buscaAberta: boolean
  onAbrirBusca: () => void
  onFecharBusca: () => void
}) {
  const total = cartas.reduce((s, c) => s + c.preco, 0)
  return (
    <div style={col}>
      <span style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{label}</span>
      {cartas.map(c => (
        <div key={c.id} style={cardRow}>
          <div style={{ width: 34, height: 47, borderRadius: 5, overflow: 'hidden', background: 'linear-gradient(160deg,#2a2f3a,#1a1d24)', flexShrink: 0 }}>
            {c.image_small && <img src={c.image_small} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</p>
            <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.set_name}</p>
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', color: c.fonte === 'USD' ? '#60a5fa' : '#f0f0f0' }}>{fmt(c.preco)}</span>
          <button onClick={() => onRemove(c.id)} aria-label="Remover" style={{ width: 20, height: 20, borderRadius: '50%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
      ))}

      {buscaAberta
        ? <BuscaCarta onPick={c => { onAdd(c); onFecharBusca() }} onCancel={onFecharBusca} />
        : (
          <button onClick={onAbrirBusca} style={addBtn}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            Adicionar carta
          </button>
        )}

      <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px dashed rgba(255,255,255,0.12)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Total</span>
        <span style={{ fontSize: 20, fontWeight: 800 }}>{fmt(total)}</span>
      </div>
    </div>
  )
}

// ─── Componente principal ───────────────────────────────────────────────────

export default function TradeAnalyzer({ initialCardA, onClose }: Props) {
  const [ladoA, setLadoA] = useState<TradeCard[]>(initialCardA ? [initialCardA] : [])
  const [ladoB, setLadoB] = useState<TradeCard[]>([])
  const [buscaAberta, setBuscaAberta] = useState<'A' | 'B' | null>(null)

  const totalA = ladoA.reduce((s, c) => s + c.preco, 0)
  const totalB = ladoB.reduce((s, c) => s + c.preco, 0)
  const media = (totalA + totalB) / 2
  const diff = totalB - totalA
  const pct = media > 0 ? (diff / media) * 100 : 0
  const temAmbos = ladoA.length > 0 && ladoB.length > 0

  let verdict: { tom: 'ok' | 'warn' | 'bad'; titulo: string; texto: string } | null = null
  if (temAmbos) {
    const abs = Math.abs(pct)
    if (abs < 10) {
      verdict = { tom: 'ok', titulo: 'Troca equilibrada', texto: `Diferença de ${abs.toFixed(0)}% — dentro da faixa considerada justa pelos dois lados.` }
    } else {
      const tom = abs < 30 ? 'warn' : 'bad'
      verdict = {
        tom,
        titulo: diff > 0
          ? `Você está levando ${fmt(diff)} a mais`
          : `Você está perdendo ${fmt(Math.abs(diff))} nessa troca`,
        texto: `${abs.toFixed(0)}% de diferença${tom === 'bad' ? ' — vale reconsiderar os termos' : ''}. Preço pelo Mercado Brasileiro — condição e graduação da carta física podem mudar o valor real.`,
      }
    }
  }

  const barA = media > 0 ? (totalA / (totalA + totalB || 1)) * 100 : 50
  const verdictBg = verdict?.tom === 'ok' ? 'rgba(34,197,94,0.12)' : verdict?.tom === 'bad' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)'
  const verdictBorder = verdict?.tom === 'ok' ? 'rgba(34,197,94,0.35)' : verdict?.tom === 'bad' ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)'
  const verdictColor = verdict?.tom === 'ok' ? '#22c55e' : verdict?.tom === 'bad' ? '#ef4444' : '#f59e0b'

  const conteudo = (
    <div style={{ fontFamily: FONT, color: '#f0f0f0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 1fr', gap: 14, alignItems: 'start' }}>
        <Coluna label="Você oferece" cartas={ladoA}
          onAdd={c => setLadoA(p => [...p, c])} onRemove={id => setLadoA(p => p.filter(c => c.id !== id))}
          buscaAberta={buscaAberta === 'A'} onAbrirBusca={() => setBuscaAberta('A')} onFecharBusca={() => setBuscaAberta(null)} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 8h10M7 8l3-3M7 8l3 3M17 16H7M17 16l-3-3M17 16l-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>

        <Coluna label="Você recebe" cartas={ladoB}
          onAdd={c => setLadoB(p => [...p, c])} onRemove={id => setLadoB(p => p.filter(c => c.id !== id))}
          buscaAberta={buscaAberta === 'B'} onAbrirBusca={() => setBuscaAberta('B')} onFecharBusca={() => setBuscaAberta(null)} />
      </div>

      {temAmbos && (
        <div style={{ height: 6, borderRadius: 4, overflow: 'hidden', display: 'flex', marginTop: 16, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ width: `${barA}%`, background: BRAND }} />
          <div style={{ width: `${100 - barA}%`, background: 'rgba(255,255,255,0.15)' }} />
        </div>
      )}

      {verdict && (
        <div style={{ marginTop: 16, borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, background: verdictBg, border: `1px solid ${verdictBorder}` }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: verdictBg, color: verdictColor }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 8v5M12 16h.01M12 3l9 16H3l9-16Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <p style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 2px' }}>{verdict.titulo}</p>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', margin: 0 }}>{verdict.texto}</p>
          </div>
        </div>
      )}

      {!temAmbos && (
        <p style={{ textAlign: 'center', fontSize: 12.5, color: 'rgba(255,255,255,0.35)', marginTop: 16 }}>
          Adicione pelo menos uma carta em cada lado pra ver o veredito.
        </p>
      )}
    </div>
  )

  if (!onClose) return conteudo

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '86vh', overflowY: 'auto', padding: 22, boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontSize: 16, fontWeight: 700, margin: 0, fontFamily: FONT, color: '#f0f0f0' }}>Analisar troca</p>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
        {conteudo}
      </div>
    </div>
  )
}
