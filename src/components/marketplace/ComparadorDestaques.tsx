'use client'

/**
 * ComparadorDestaques — Fase 1 do redesign do /comparador (estudo com agentes,
 * 13/08/2026): Manchete do dia + Radar de mercado + Sugestões de troca.
 *
 * Zero query nova: reaproveita get_price_movers/get_top_cards, as mesmas RPCs
 * que já alimentam a HomeVitrines. Nenhuma tabela nova, nenhuma escrita.
 *
 * "Alta" (boa pra soltar) sempre vira sugestão pro lado "você oferece";
 * "queda" (pegue agora) vira sugestão pro lado "você recebe" — mesma lógica
 * em toda a página (manchete, radar, pareamento).
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { montarTradeCard, type TradeCard } from './TradeAnalyzer'

type Mover = { window_days: number; direction: 'up' | 'down'; card_id: string; name: string; set_name: string | null; image_small: string | null; preco_atual: number | null; pct: number | null; slug: string | null }

const FONT = "'DM Sans', system-ui, sans-serif"

function cleanNome(raw: string | null): string {
  if (!raw) return ''
  return raw.replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/\s*\([^)]*\/[^)]*\)\s*$/, '').trim()
}

function moverToCard(m: Mover): TradeCard {
  return montarTradeCard({ id: m.card_id, name: cleanNome(m.name), set_name: m.set_name, image_small: m.image_small, preco: Number(m.preco_atual) || 0 })
}

// ─── HERO: carrossel dinâmico (pedido do Du 14/08 -- a manchete estática so
// mostrava a maior alta/queda da semana, sempre a mesma carta ate o cron
// rodar de novo). Pool de /api/marketplace/comparador-hero (3 sinais: maior
// alta/queda 7d, mais anunciada, mais adicionada a coleção), embaralhado a
// cada carregamento da página -- "mais procurada"/"mais acessada" ficaram de
// fora por enquanto (precisam de tabela de eventos nova, decisão do Du). ───

interface HeroCard {
  id: string
  name: string
  image_small: string | null
  sinal: 'alta' | 'queda' | 'anunciada' | 'adicionada' | 'procurada' | 'acessada'
  badge: string
  preco: number | null
  slug?: string | null
  cta?: 'troca' | 'ver'
}

const SINAL_INFO: Record<HeroCard['sinal'], { eyebrow: string; cor: string; bg: string; texto: string }> = {
  alta: { eyebrow: 'Em alta essa semana', cor: '#22c55e', bg: 'rgba(34,197,94,0.12)', texto: 'No Mercado Brasileiro — pode valer a pena soltar antes de esfriar.' },
  queda: { eyebrow: 'Em queda essa semana', cor: '#ef4444', bg: 'rgba(239,68,68,0.12)', texto: 'No Mercado Brasileiro — pode ser a hora de pegar antes de subir de novo.' },
  anunciada: { eyebrow: 'Bombando no marketplace', cor: '#f59e0b', bg: 'rgba(245,158,11,0.13)', texto: 'Várias pessoas anunciando essa carta agora — bom momento pra comparar preços.' },
  adicionada: { eyebrow: 'Entrando nas coleções', cor: '#60a5fa', bg: 'rgba(96,165,250,0.13)', texto: 'A carta que mais entrou em coleções esse mês — pode valer a pena ficar de olho.' },
  // Copy sem numero e sem citar pessoas de proposito: o schema, por desenho,
  // nao sabe contar pessoas distintas ao longo de varios dias (somar
  // visitantes/dia da pessoa-dia, nao pessoa).
  acessada: { eyebrow: 'Muito vista agora', cor: '#a855f7', bg: 'rgba(168,85,247,0.13)', texto: 'Uma das cartas mais abertas na Bynx nas últimas duas semanas.' },
  procurada: { eyebrow: 'Procurada nas trocas', cor: '#ec4899', bg: 'rgba(236,72,153,0.13)', texto: 'Aparece com frequência nas trocas montadas por aqui.' },
}

function embaralhar<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function HeroCarrossel({ onSeed }: { onSeed: (cardA?: TradeCard, cardB?: TradeCard) => void }) {
  const [pool, setPool] = useState<HeroCard[]>([])
  const [idx, setIdx] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/marketplace/comparador-hero')
      .then(r => r.json())
      .then(d => setPool(embaralhar(d?.pool || [])))
      .catch(() => setPool([]))
  }, [])

  useEffect(() => {
    if (pool.length < 2) return
    timerRef.current = setInterval(() => setIdx(i => (i + 1) % pool.length), 6000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [pool.length])

  function irPara(i: number) {
    setIdx(((i % pool.length) + pool.length) % pool.length)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setIdx(prev => (prev + 1) % pool.length), 6000)
  }

  if (!pool.length) return null
  const atual = pool[idx]
  const info = SINAL_INFO[atual.sinal]

  function seed() {
    const card = montarTradeCard({ id: atual.id, name: atual.name, image_small: atual.image_small, preco: atual.preco || 0 })
    if (atual.sinal === 'queda') onSeed(undefined, card)
    else onSeed(card, undefined)
  }

  return (
    <div style={{ background: 'linear-gradient(120deg, rgba(245,158,11,0.08), rgba(239,68,68,0.03))', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 16, padding: 16 }}>
      <style>{`
        @keyframes bx-hero-fade { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
        .bx-hero-slide { animation: bx-hero-fade 0.25s ease; }
        .bx-hero-arrow { width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.55); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s ease, color 0.15s ease; }
        .bx-hero-arrow:hover { background: rgba(255,255,255,0.12); color: #f0f0f0; }
        .bx-hero-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.2); cursor: pointer; transition: width 0.15s ease, background 0.15s ease; }
        .bx-hero-dot[data-on="1"] { width: 16px; border-radius: 3px; background: #f59e0b; }
      `}</style>

      <div key={atual.id} className="bx-hero-slide" style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 16, alignItems: 'center' }}>
        <div style={{ width: 96, height: 134, borderRadius: 8, overflow: 'hidden', background: 'linear-gradient(160deg,#2a2f3a,#1a1d24)', flex: 'none' }}>
          {atual.image_small && <img src={atual.image_small} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: info.cor, margin: '0 0 6px' }}>
            {info.eyebrow}
          </p>
          <p style={{ fontSize: 19, fontWeight: 700, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{atual.name}</p>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, margin: '4px 0 10px', background: info.bg, color: info.cor }}>
            {atual.badge}
          </span>
          <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', margin: '0 0 12px' }}>{info.texto}</p>
          {/* Carta sem preco de mercado (comum em set recem-lancado, que e
              justamente quando o sinal de view/busca e mais informativo) nao
              pode cair na calculadora valendo R$ 0,00 -- vira link pra carta. */}
          {atual.cta === 'ver' && atual.slug ? (
            <Link
              href={`/carta/${atual.slug}`}
              style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 700, padding: '9px 15px', borderRadius: 10, cursor: 'pointer', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#1a0e00', fontFamily: FONT, textDecoration: 'none' }}>
              Ver a carta →
            </Link>
          ) : (
            <button
              onClick={seed}
              style={{ fontSize: 12.5, fontWeight: 700, padding: '9px 15px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#1a0e00', fontFamily: FONT }}>
              Montar troca com essa carta →
            </button>
          )}
        </div>
      </div>

      {pool.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 }}>
          <button className="bx-hero-arrow" aria-label="Carta anterior" onClick={() => irPara(idx - 1)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div style={{ display: 'flex', gap: 5 }}>
            {pool.map((c, i) => (
              <span key={c.id + i} className="bx-hero-dot" data-on={i === idx ? '1' : '0'} onClick={() => irPara(i)} />
            ))}
          </div>
          <button className="bx-hero-arrow" aria-label="Próxima carta" onClick={() => irPara(idx + 1)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      )}
    </div>
  )
}

export default function ComparadorDestaques({ onSeed }: { onSeed: (cardA?: TradeCard, cardB?: TradeCard) => void }) {
  const [movers, setMovers] = useState<Mover[]>([])
  const [win, setWin] = useState<7 | 30>(7)

  useEffect(() => {
    supabase.rpc('get_price_movers', { p_limit: 8 }).then(({ data }) => setMovers((data as Mover[]) || []))
  }, [])

  const altas7 = useMemo(() => movers.filter(m => m.window_days === 7 && m.direction === 'up' && m.preco_atual), [movers])
  const quedas7 = useMemo(() => movers.filter(m => m.window_days === 7 && m.direction === 'down' && m.preco_atual), [movers])
  const altasWin = useMemo(() => movers.filter(m => m.window_days === win && m.direction === 'up' && m.preco_atual).slice(0, 5), [movers, win])
  const quedasWin = useMemo(() => movers.filter(m => m.window_days === win && m.direction === 'down' && m.preco_atual).slice(0, 5), [movers, win])

  const pares = useMemo(() => {
    const usados = new Set<string>()
    const resultado: { alta: Mover; queda: Mover }[] = []
    for (const queda of quedas7) {
      let melhor: Mover | null = null
      let menorDist = Infinity
      for (const alta of altas7) {
        if (usados.has(alta.card_id)) continue
        const dist = Math.abs((alta.preco_atual || 0) - (queda.preco_atual || 0))
        if (dist < menorDist) { menorDist = dist; melhor = alta }
      }
      if (melhor) { usados.add(melhor.card_id); resultado.push({ alta: melhor, queda }) }
      if (resultado.length >= 3) break
    }
    return resultado
  }, [altas7, quedas7])

  return (
    <div style={{ fontFamily: FONT, color: '#f0f0f0', display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
      <HeroCarrossel onSeed={onSeed} />

      {(altasWin.length > 0 || quedasWin.length > 0) && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, margin: 0, fontWeight: 700 }}>O que está se mexendo</h3>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3 }}>
              {([7, 30] as const).map(w => (
                <span key={w} onClick={() => setWin(w)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontWeight: win === w ? 700 : 400, background: win === w ? 'rgba(245,158,11,0.15)' : 'transparent', color: win === w ? '#f59e0b' : 'rgba(255,255,255,0.45)' }}>{w} dias</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#22c55e', fontWeight: 700, margin: '0 0 8px' }}>↑ Em alta</p>
              {altasWin.map(m => (
                <div key={m.card_id} onClick={() => onSeed(moverToCard(m), undefined)}
                  style={{ display: 'grid', gridTemplateColumns: '26px 1fr auto', gap: 7, alignItems: 'center', padding: '5px 3px', borderRadius: 7, cursor: 'pointer' }}>
                  <div style={{ width: 26, height: 36, borderRadius: 4, overflow: 'hidden', background: '#1a1d24', flexShrink: 0 }}>{m.image_small && <img src={m.image_small} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                  <p style={{ fontSize: 11.5, fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanNome(m.name)}</p>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#22c55e', whiteSpace: 'nowrap' }}>+{m.pct?.toFixed(0)}%</span>
                </div>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#ef4444', fontWeight: 700, margin: '0 0 8px' }}>↓ Em queda</p>
              {quedasWin.map(m => (
                <div key={m.card_id} onClick={() => onSeed(undefined, moverToCard(m))}
                  style={{ display: 'grid', gridTemplateColumns: '26px 1fr auto', gap: 7, alignItems: 'center', padding: '5px 3px', borderRadius: 7, cursor: 'pointer' }}>
                  <div style={{ width: 26, height: 36, borderRadius: 4, overflow: 'hidden', background: '#1a1d24', flexShrink: 0 }}>{m.image_small && <img src={m.image_small} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                  <p style={{ fontSize: 11.5, fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanNome(m.name)}</p>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap' }}>{m.pct?.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
          <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', margin: '10px 0 0' }}>Toque numa carta pra já jogar ela na troca aqui embaixo.</p>
        </div>
      )}

      {pares.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16 }}>
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(255,255,255,0.4)', fontWeight: 700, margin: '0 0 10px' }}>Ideias de troca</p>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {pares.map(({ alta, queda }) => (
              <div key={alta.card_id + queda.card_id} style={{ flex: '0 0 auto', width: 210, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
                <p style={{ fontSize: 9.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 700, margin: '0 0 8px' }}>Pegue agora ⇄ Boa pra soltar</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 40, height: 55, borderRadius: 5, overflow: 'hidden', background: '#1a1d24' }}>{queda.image_small && <img src={queda.image_small} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}><path d="M7 8h10M7 8l3-3M7 8l3 3M17 16H7M17 16l-3-3M17 16l-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <div style={{ width: 40, height: 55, borderRadius: 5, overflow: 'hidden', background: '#1a1d24' }}>{alta.image_small && <img src={alta.image_small} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                </div>
                <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.55)', margin: '0 0 10px' }}>{cleanNome(queda.name)} ⇄ {cleanNome(alta.name)}</p>
                <button onClick={() => onSeed(moverToCard(alta), moverToCard(queda))}
                  style={{ width: '100%', textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px dashed rgba(245,158,11,0.35)', borderRadius: 8, padding: 7, cursor: 'pointer', fontFamily: FONT }}>
                  Testar essa troca
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
