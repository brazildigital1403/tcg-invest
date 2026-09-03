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
import { IconTrendingUp, IconTrendingDown, IconMarketplace } from '@/components/ui/Icons'

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
  /** Texto montado pelo servidor a partir da contagem real; vence o SINAL_INFO. */
  texto?: string
}

const SINAL_INFO: Record<HeroCard['sinal'], { eyebrow: string; cor: string; bg: string; texto: string }> = {
  alta: { eyebrow: 'Em alta essa semana', cor: 'var(--bx-green)', bg: 'rgba(34,197,94,0.12)', texto: 'No Mercado Brasileiro — pode valer a pena soltar antes de esfriar.' },
  queda: { eyebrow: 'Em queda essa semana', cor: 'var(--bx-red)', bg: 'rgba(239,68,68,0.12)', texto: 'No Mercado Brasileiro — pode ser a hora de pegar antes de subir de novo.' },
  // ★ Estes dois textos agora sao FALLBACK. O servidor manda `texto` proprio,
  // montado a partir da contagem real -- ver comparador-hero/route.ts. A copy
  // fixa dizia "varias pessoas" com um vendedor so, e chamava ate quatro
  // cartas diferentes de "a que mais entrou".
  anunciada: { eyebrow: 'Anunciada no marketplace', cor: 'var(--ac-1)', bg: 'rgba(var(--ac-1-rgb),0.13)', texto: 'Tem anúncio dessa carta aberto agora — dá pra comparar antes de fechar.' },
  adicionada: { eyebrow: 'Entrando nas coleções', cor: 'var(--bx-blue)', bg: 'rgba(96,165,250,0.13)', texto: 'Uma das cartas que mais entraram em coleções este mês — pode valer a pena ficar de olho.' },
  // Copy sem numero e sem citar pessoas de proposito: o schema, por desenho,
  // nao sabe contar pessoas distintas ao longo de varios dias (somar
  // visitantes/dia da pessoa-dia, nao pessoa).
  acessada: { eyebrow: 'Muito vista agora', cor: 'var(--bx-purple)', bg: 'rgba(168,85,247,0.13)', texto: 'Uma das cartas mais abertas na Bynx nas últimas duas semanas.' },
  procurada: { eyebrow: 'Procurada nas trocas', cor: 'var(--bx-purple)', bg: 'rgba(168,85,247,0.13)', texto: 'Aparece com frequência nas trocas montadas por aqui.' },
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
  const [carregando, setCarregando] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  /** ★ Uma interacao do usuario PARA o giro automatico pra sempre. */
  const parado = useRef(false)

  useEffect(() => {
    fetch('/api/marketplace/comparador-hero')
      .then(r => r.json())
      .then(d => setPool(embaralhar(d?.pool || [])))
      .catch(e => { console.error('[comparador] hero:', e?.message || e); setPool([]) })
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    if (pool.length < 2 || parado.current) return
    // ★ 6s era pouco: o slide tem eyebrow, nome, badge, tres linhas de texto e
    // um CTA. Medindo em producao, o carrossel trocou a carta debaixo do clique
    // duas vezes durante o teste -- e uma maquina le mais rapido que gente. 9s
    // da tempo de ler e decidir; e qualquer toque congela de vez, que e o que
    // resolve de verdade (WCAG 2.2.2: conteudo em movimento precisa poder ser
    // parado).
    timerRef.current = setInterval(() => setIdx(i => (i + 1) % pool.length), 9000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [pool.length])

  /** Congela o carrossel. Chamado por qualquer interacao com o hero. */
  function pararGiro() {
    parado.current = true
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  function irPara(i: number) {
    setIdx(((i % pool.length) + pool.length) % pool.length)
    // Antes isto REINICIAVA o timer: quem navegava a mao continuava perdendo o
    // slide pra rotacao. Agora navegar a mao desliga o automatico de vez.
    pararGiro()
  }

  // ★ CLS medido em 0,324 (o limite "ruim" do Core Web Vitals e 0,25). O
  // carrossel, o radar e o feed retornavam null ate a API responder e depois
  // injetavam ~300px NO TOPO, empurrando a pagina inteira pra baixo -- no
  // mobile isso e conteudo pulando debaixo do dedo. Reservar a altura enquanto
  // carrega custa uma caixa vazia e devolve a pagina parada.
  if (carregando) {
    return <div style={{ minHeight: 232, borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }} />
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
    <div style={{ background: 'linear-gradient(120deg, rgba(var(--ac-1-rgb),0.08), rgba(239,68,68,0.03))', border: '1px solid rgba(var(--ac-1-rgb),0.22)', borderRadius: 16, padding: 16 }}>
      <style>{`
        @keyframes bx-hero-fade { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
        .bx-hero-slide { animation: bx-hero-fade 0.2s ease; }
        .bx-hero-arrow { width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.55); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s ease, color 0.15s ease; }
        .bx-hero-arrow:hover { background: rgba(255,255,255,0.12); color: #f0f0f0; }
        .bx-hero-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.2); cursor: pointer; transition: width 0.15s ease, background 0.15s ease; }
        .bx-hero-dot[data-on="1"] { width: 16px; border-radius: 3px; background: var(--ac-1); }
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
          <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', margin: '0 0 12px' }}>{atual.texto || info.texto}</p>
          {/* Carta sem preco de mercado (comum em set recem-lancado, que e
              justamente quando o sinal de view/busca e mais informativo) nao
              pode cair na calculadora valendo R$ 0,00 -- vira link pra carta. */}
          {atual.cta === 'ver' && atual.slug ? (
            <Link
              href={`/carta/${atual.slug}`}
              className="bx-cmp-btn"
              style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 700, padding: '9px 15px', borderRadius: 10, cursor: 'pointer', background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', fontFamily: FONT, textDecoration: 'none' }}>
              Ver a carta →
            </Link>
          ) : (
            <button
              onClick={seed}
              className="bx-cmp-btn"
              style={{ fontSize: 12.5, fontWeight: 700, padding: '9px 15px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', fontFamily: FONT }}>
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
    // ★ O `error` nem era desestruturado aqui. RPC falhando virava lista
    // vazia, as duas secoes sumiam pelos condicionais la embaixo, e "a API
    // caiu" ficava visualmente IDENTICO a "a semana foi fraca" -- sem log, sem
    // sintoma, sem ninguem descobrir. Mesma armadilha do "RLS bloqueia em
    // silencio" que ja custou caro nesta casa.
    supabase.rpc('get_price_movers', { p_limit: 8 }).then(({ data, error }) => {
      if (error) console.error('[comparador] get_price_movers:', error.message)
      setMovers((data as Mover[]) || [])
    })
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
    <div style={{ fontFamily: FONT, color: 'var(--bx-text)', display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
      <style>{`
        /* ★ A pagina era a UNICA do app sem hover em nada: 13 elementos com
           cursor:pointer e zero feedback. O padrao da casa -- translateY(-2px)
           + 0.15s ease -- ja aparece em 7 arquivos do repo. */
        .bx-cmp-linha { transition: background 0.15s ease; }
        .bx-cmp-linha:hover { background: rgba(255,255,255,0.06); }
        .bx-cmp-card { transition: transform 0.15s ease, border-color 0.15s ease; }
        .bx-cmp-card:hover { transform: translateY(-2px); border-color: rgba(var(--ac-1-rgb),0.35); }
        .bx-cmp-btn { transition: filter 0.15s ease, background 0.15s ease; }
        .bx-cmp-btn:hover { filter: brightness(1.08); }
        .bx-cmp-chip { transition: background 0.15s ease, color 0.15s ease; }
        .bx-cmp-chip:hover { background: rgba(255,255,255,0.07); }
      `}</style>
      <HeroCarrossel onSeed={onSeed} />

      {(altasWin.length > 0 || quedasWin.length > 0) && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, margin: 0, fontWeight: 700 }}>O que está se mexendo</h3>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3 }}>
              {([7, 30] as const).map(w => (
                <span key={w} onClick={() => setWin(w)} className="bx-cmp-chip" style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontWeight: win === w ? 700 : 400, background: win === w ? 'rgba(var(--ac-1-rgb),0.15)' : 'transparent', color: win === w ? 'var(--ac-1)' : 'rgba(255,255,255,0.45)' }}>{w}d+</span>
              ))}
            </div>
          </div>
          {/* ★ A janela e um PISO, nao uma medida. A matview compara com o
              snapshot mais recente que tenha pelo menos N dias, e como o scan
              nao passa em toda carta toda semana, a base costuma ser bem mais
              velha -- medido: dos 12 movers no ar, um era de 7 dias e dois de
              74. Dizer "7 dias" cravado era falso; o "+" e a nota abaixo dizem
              a verdade sem precisar tocar na matview. */}
          <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', margin: '-4px 0 12px' }}>
            Variação desde a última leitura com pelo menos {win} dias — pode cobrir um período maior.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--bx-green)', fontWeight: 700, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}><IconTrendingUp size={13} color="currentColor" /> Em alta</p>
              {altasWin.map(m => (
                <div key={m.card_id} onClick={() => onSeed(moverToCard(m), undefined)}
                  className="bx-cmp-linha"
                  style={{ display: 'grid', gridTemplateColumns: '26px 1fr auto', gap: 7, alignItems: 'center', padding: '5px 3px', borderRadius: 7, cursor: 'pointer' }}>
                  <div style={{ width: 26, height: 36, borderRadius: 4, overflow: 'hidden', background: '#1a1d24', flexShrink: 0 }}>{m.image_small && <img src={m.image_small} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                  <p style={{ fontSize: 11.5, fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanNome(m.name)}</p>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--bx-green)', whiteSpace: 'nowrap' }}>+{m.pct?.toFixed(0)}%</span>
                </div>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--bx-red)', fontWeight: 700, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}><IconTrendingDown size={13} color="currentColor" /> Em queda</p>
              {quedasWin.map(m => (
                <div key={m.card_id} onClick={() => onSeed(undefined, moverToCard(m))}
                  className="bx-cmp-linha"
                  style={{ display: 'grid', gridTemplateColumns: '26px 1fr auto', gap: 7, alignItems: 'center', padding: '5px 3px', borderRadius: 7, cursor: 'pointer' }}>
                  <div style={{ width: 26, height: 36, borderRadius: 4, overflow: 'hidden', background: '#1a1d24', flexShrink: 0 }}>{m.image_small && <img src={m.image_small} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                  <p style={{ fontSize: 11.5, fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanNome(m.name)}</p>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--bx-red)', whiteSpace: 'nowrap' }}>{m.pct?.toFixed(0)}%</span>
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
                <p style={{ fontSize: 9.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 700, margin: '0 0 8px' }}>Pegue agora · Boa pra soltar</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 40, height: 55, borderRadius: 5, overflow: 'hidden', background: '#1a1d24' }}>{queda.image_small && <img src={queda.image_small} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                  <IconMarketplace size={14} color="rgba(255,255,255,0.35)" strokeWidth={1.8} style={{ flexShrink: 0 }} />
                  <div style={{ width: 40, height: 55, borderRadius: 5, overflow: 'hidden', background: '#1a1d24' }}>{alta.image_small && <img src={alta.image_small} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                </div>
                <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.55)', margin: '0 0 10px' }}>{cleanNome(queda.name)} por {cleanNome(alta.name)}</p>
                <button onClick={() => onSeed(moverToCard(alta), moverToCard(queda))}
                  className="bx-cmp-btn"
                  style={{ width: '100%', textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: 'var(--ac-1)', background: 'rgba(var(--ac-1-rgb),0.1)', border: '1px dashed rgba(var(--ac-1-rgb),0.35)', borderRadius: 8, padding: 7, cursor: 'pointer', fontFamily: FONT }}>
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
