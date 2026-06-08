'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { setLabel } from '@/lib/setLabel'

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const BG = '#080a0f'
const SURFACE = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 }
const PAGE = 9
const VARIANTE_LABEL: Record<string, string> = {
  normal: 'Normal', foil: 'Foil', promo: 'Promo', reverse: 'Reverse Foil', pokeball: 'Pokeball Foil',
}

type Card = {
  user_card_id: string; card_name: string; card_image: string | null; set_name: string | null
  rarity: string | null; variante: string; quantity: number; posicao: number; unit: number | null
}

export default function PastaPublica() {
  const params = useParams()
  const id = params?.id as string
  const pastaId = params?.pastaId as string

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [view, setView] = useState<'grid' | 'pasta'>('pasta')

  useEffect(() => {
    if (!pastaId) return
    ;(async () => {
      const { data: res } = await supabase.rpc('pasta_publica', { p_pasta_id: pastaId })
      if (!res) { setNotFound(true); setLoading(false); return }
      setData(res)
      setView(res?.pasta?.view_mode === 'grid' ? 'grid' : 'pasta')
      if (typeof document !== 'undefined' && res?.pasta?.nome) {
        document.title = `${res.pasta.nome} · ${res.owner?.name || 'Bynx'} · Bynx`
      }
      setLoading(false)
    })()
  }, [pastaId])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <p>Carregando pasta...</p>
    </div>
  )

  if (notFound || !data) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: "'DM Sans', system-ui, sans-serif", gap: 16, padding: 24, textAlign: 'center' }}>
      <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)' }}>Pasta não encontrada</p>
      <p style={{ fontSize: 14, maxWidth: 360, lineHeight: 1.5 }}>Esta pasta não existe ou não está pública.</p>
      <Link href="/" style={{ color: '#f59e0b', textDecoration: 'none', fontSize: 14 }}>← Voltar ao início</Link>
    </div>
  )

  const pasta = data.pasta
  const owner = data.owner
  const stats = data.stats || {}
  const cards: Card[] = (data.cards || []) as Card[]
  const ocultar = !!owner?.ocultar_valores

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#f0f0f0', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* HEADER */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(8,10,15,0.97)', position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(12px)' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
        </Link>
        <Link href="/" style={{ background: BRAND, color: '#000', padding: '8px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
          Entrar no app
        </Link>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* Voltar ao perfil */}
        <Link href={`/perfil/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', marginBottom: 16 }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Perfil de {owner?.name || owner?.username}
        </Link>

        {/* Capa */}
        {pasta.imagem_url && (
          <div style={{ width: '100%', height: 180, borderRadius: 18, overflow: 'hidden', marginBottom: 18, border: '1px solid rgba(255,255,255,0.08)' }}>
            <img src={pasta.imagem_url} alt={pasta.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {/* Título + stats */}
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>{pasta.nome}</h1>
        {pasta.descricao && <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 14 }}>{pasta.descricao}</p>}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
          <div style={{ ...SURFACE, padding: '12px 18px' }}>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Cartas</p>
            <p style={{ fontSize: 20, fontWeight: 800 }}>{stats.qtd || 0}</p>
          </div>
          {!ocultar && stats.patrimonio != null && Number(stats.patrimonio) > 0 && (
            <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 16, padding: '12px 18px' }}>
              <p style={{ fontSize: 10, color: 'rgba(96,165,250,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Valor estimado</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#60a5fa' }}>{fmt(Number(stats.patrimonio))}</p>
            </div>
          )}
        </div>

        {/* Toggle Grade / Fichário */}
        {cards.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 3, width: 'fit-content' }}>
            <button onClick={() => setView('pasta')} style={{ background: view === 'pasta' ? 'rgba(245,158,11,0.15)' : 'transparent', border: 'none', color: view === 'pasta' ? '#f59e0b' : 'rgba(255,255,255,0.4)', padding: '6px 14px', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Fichário</button>
            <button onClick={() => setView('grid')} style={{ background: view === 'grid' ? 'rgba(245,158,11,0.15)' : 'transparent', border: 'none', color: view === 'grid' ? '#f59e0b' : 'rgba(255,255,255,0.4)', padding: '6px 14px', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Grade</button>
          </div>
        )}

        {cards.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.3)' }}>
            <p style={{ fontSize: 40, marginBottom: 10 }}>🃏</p>
            <p style={{ fontSize: 15 }}>Esta pasta ainda não tem cartas.</p>
          </div>
        )}

        {/* GRADE */}
        {view === 'grid' && cards.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
            {cards.map((c) => (
              <div key={c.user_card_id} style={{ ...SURFACE, overflow: 'hidden' }}>
                <div style={{ aspectRatio: '63/88', background: '#0d0f14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {c.card_image ? <img src={c.card_image} alt={c.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 28 }}>🃏</span>}
                </div>
                <div style={{ padding: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.card_name.replace(/\s*\([^)]*\)/, '')}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{setLabel(c.set_name) || '—'}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, gap: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>{VARIANTE_LABEL[c.variante] || c.variante}</span>
                    {c.quantity > 1 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>x{c.quantity}</span>}
                  </div>
                  {!ocultar && c.unit != null && Number(c.unit) > 0 && (
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginTop: 6 }}>{fmt(Number(c.unit))}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FICHÁRIO (read-only) */}
        {view === 'pasta' && cards.length > 0 && <ReadOnlyBinder cards={cards} />}

        {/* CTA */}
        <div style={{ textAlign: 'center', paddingTop: 40, marginTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>Crie e organize suas próprias pastas no Bynx</p>
          <Link href="/" style={{ background: BRAND, color: '#000', padding: '13px 32px', borderRadius: 14, fontWeight: 800, fontSize: 15, textDecoration: 'none', display: 'inline-block', boxShadow: '0 0 24px rgba(245,158,11,0.25)' }}>
            Criar conta grátis no Bynx →
          </Link>
        </div>

      </main>
    </div>
  )
}

/* ───────── Fichário read-only (álbum, sem edição) ───────── */
function ReadOnlyBinder({ cards }: { cards: Card[] }) {
  const [isMobile, setIsMobile] = useState(false)
  const [spread, setSpread] = useState(0)
  const flipDir = useState<'next' | 'prev'>('next')[0]
  const [dir, setDir] = useState<'next' | 'prev'>('next')

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const f = () => setIsMobile(mq.matches)
    f(); mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])

  const pagesPerView = isMobile ? 1 : 2
  const byPos = new Map<number, Card>()
  cards.forEach(c => { if (c.posicao != null) byPos.set(c.posicao, c) })
  const maxPos = cards.reduce((m, c) => Math.max(m, c.posicao ?? -1), -1)
  const lastCardPage = maxPos >= 0 ? Math.floor(maxPos / PAGE) : -1
  const totalSpreads = Math.max(1, maxPos >= 0 ? Math.floor(lastCardPage / pagesPerView) + 1 : 1)

  useEffect(() => { if (spread > totalSpreads - 1) setSpread(Math.max(0, totalSpreads - 1)) }, [totalSpreads]) // eslint-disable-line

  function go(d: 1 | -1) {
    setSpread(s => {
      const n = s + d
      if (n < 0 || n > totalSpreads - 1) return s
      setDir(d === 1 ? 'next' : 'prev')
      return n
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [totalSpreads]) // eslint-disable-line

  const pagesToShow: number[] = []
  for (let k = 0; k < pagesPerView; k++) pagesToShow.push(spread * pagesPerView + k)

  return (
    <div>
      <style>{`
        @keyframes pbNext { from { opacity:0.35; transform: translateX(46px) rotateY(-10deg) } to { opacity:1; transform:none } }
        @keyframes pbPrev { from { opacity:0.35; transform: translateX(-46px) rotateY(10deg) } to { opacity:1; transform:none } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14 }}>
        <button onClick={() => go(-1)} disabled={spread <= 0} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: spread <= 0 ? 'rgba(255,255,255,0.2)' : '#f0f0f0', cursor: spread <= 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', minWidth: 70, textAlign: 'center' }}>Abertura {spread + 1}/{totalSpreads}</span>
        <button onClick={() => go(1)} disabled={spread >= totalSpreads - 1} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: spread >= totalSpreads - 1 ? 'rgba(255,255,255,0.2)' : '#f0f0f0', cursor: spread >= totalSpreads - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      <div style={{ perspective: 1600 }}>
        <div key={spread} style={{ display: 'grid', gridTemplateColumns: pagesPerView === 2 ? '1fr 1fr' : '1fr', gap: pagesPerView === 2 ? 0 : 16, maxWidth: pagesPerView === 2 ? 760 : 380, margin: '0 auto', animation: `${dir === 'prev' ? 'pbPrev' : 'pbNext'} 0.35s ease` }}>
          {pagesToShow.map((pg, idx) => (
            <div key={pg} style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: pagesPerView === 2 ? (idx === 0 ? '14px 4px 4px 14px' : '4px 14px 14px 4px') : 14, padding: 12, boxShadow: pagesPerView === 2 ? (idx === 0 ? 'inset -10px 0 16px -12px rgba(0,0,0,0.7)' : 'inset 10px 0 16px -12px rgba(0,0,0,0.7)') : 'none' }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>Página {pg + 1}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {Array.from({ length: PAGE }).map((_, slot) => {
                  const globalIndex = pg * PAGE + slot
                  const card = byPos.get(globalIndex)
                  return (
                    <div key={globalIndex} title={card?.card_name} style={{ position: 'relative', aspectRatio: '63/88', borderRadius: 8, background: card ? '#0d0f14' : 'rgba(255,255,255,0.015)', border: card ? '1px solid rgba(255,255,255,0.1)' : '1.5px dashed rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      {card && (card.card_image
                        ? <img src={card.card_image} alt={card.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 24 }}>🃏</div>)}
                      {card && card.quantity > 1 && (
                        <span style={{ position: 'absolute', bottom: 5, left: 5, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: 'rgba(0,0,0,0.7)', color: '#fff' }}>x{card.quantity}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}