'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

function iniciais(name: string) {
  const parts = (name || '').trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const BG = '#080a0f'
const SURFACE = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 }

const VARIANTE_LABEL: Record<string, string> = {
  normal: 'Normal', foil: 'Foil', promo: 'Promo', reverse: 'Reverse Foil', pokeball: 'Pokeball Foil'
}
const VARIANTE_COLOR: Record<string, string> = {
  normal: '#60a5fa', foil: '#f59e0b', promo: '#a78bfa', reverse: '#34d399', pokeball: '#fb923c'
}

function getPrecoVariante(price: any, variante: string): number {
  if (!price) return 0
  switch (variante) {
    case 'foil':     return price.preco_foil_medio     || price.preco_medio || 0
    case 'promo':    return price.preco_promo_medio    || price.preco_medio || 0
    case 'reverse':  return price.preco_reverse_medio  || price.preco_medio || 0
    case 'pokeball': return price.preco_pokeball_medio || price.preco_medio || 0
    default:         return price.preco_medio || 0
  }
}

export default function PerfilPage() {
  const params = useParams()
  const id = params?.id as string

  const [user, setUser]           = useState<any>(null)
  const [listings, setListings]   = useState<any[]>([])
  const [showcase, setShowcase]   = useState<any[]>([])
  const [patrimonio, setPatrimonio] = useState(0)
  const [portfolioHistory, setPortfolioHistory] = useState<any[]>([])
  const [setProgress, setSetProgress] = useState<any[]>([])
  const [stats, setStats]         = useState({ cartas: 0, anuncios: 0, vendas: 0 })
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)

  useEffect(() => {
    if (!id) return
    async function load() {
      // Suporta username OU UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      const query = supabase.from('users').select('id, name, city, whatsapp, created_at, username')
      const { data: userData } = isUUID
        ? await query.eq('id', id).single()
        : await query.eq('username', id).single()

      if (!userData) { setNotFound(true); setLoading(false); return }

      // Redireciona UUID → username se disponível (no browser)
      if (isUUID && userData.username && typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/perfil/${userData.username}`)
      }
      setUser(userData)

      const uid = userData.id // sempre usa o UUID real

      // Anúncios ativos
      const { data: listingsData } = await supabase
        .from('marketplace').select('*').eq('user_id', uid).eq('status', 'disponivel')
        .order('created_at', { ascending: false })
      setListings(listingsData || [])

      // Vendas
      const { data: vendas } = await supabase
        .from('transactions').select('id, price').eq('seller_id', uid)

      // Total cartas
      const { count: totalCartas } = await supabase
        .from('user_cards').select('*', { count: 'exact', head: true }).eq('user_id', uid)

      // Cartas com preços — para showcase e patrimônio
      const { data: cards } = await supabase
        .from('user_cards').select('card_name, variante, quantity, card_image, set_name').eq('user_id', uid)

      if (cards && cards.length > 0) {
        const names = cards.map(c => c.card_name?.trim()).filter(Boolean)
        const { data: prices } = await supabase
          .from('card_prices')
          .select('card_name, preco_medio, preco_foil_medio, preco_promo_medio, preco_reverse_medio, preco_pokeball_medio, preco_foil_max, preco_promo_max, preco_reverse_max, preco_pokeball_max, preco_max')
          .in('card_name', names)

        const priceMap: Record<string, any> = {}
        prices?.forEach(p => { priceMap[p.card_name?.trim()] = p })

        // Patrimônio
        let total = 0
        for (const card of cards) {
          const p = priceMap[card.card_name?.trim()]
          if (!p) continue
          total += getPrecoVariante(p, card.variante || 'normal') * (card.quantity || 1)
        }
        setPatrimonio(total)

        // Showcase: 6 cartas mais caras pelo maior valor
        const withPrices = cards.map(c => {
          const p = priceMap[c.card_name?.trim()]
          const varMax = c.variante === 'foil'     ? (p?.preco_foil_max     || p?.preco_max || 0)
            : c.variante === 'promo'    ? (p?.preco_promo_max    || p?.preco_max || 0)
            : c.variante === 'reverse'  ? (p?.preco_reverse_max  || p?.preco_max || 0)
            : c.variante === 'pokeball' ? (p?.preco_pokeball_max || p?.preco_max || 0)
            : (p?.preco_max || 0)
          return { ...c, maxValue: Number(varMax || 0), medioValue: getPrecoVariante(p, c.variante || 'normal') }
        }).filter(c => c.maxValue > 0 || c.card_image)
          .sort((a, b) => b.maxValue - a.maxValue)
          .slice(0, 6)

        setShowcase(withPrices)
      }

      setStats({
        cartas: totalCartas || 0,
        anuncios: (listingsData || []).length,
        vendas: (vendas || []).length,
      })

      // Histórico de patrimônio
      const { data: history } = await supabase
        .from('portfolio_history')
        .select('valor, recorded_at')
        .eq('user_id', uid)
        .order('recorded_at', { ascending: true })
        .limit(60)
      setPortfolioHistory(history || [])

      // Progresso por set
      if (cards && cards.length > 0) {
        // Agrupa cartas do usuário por set_name
        const setMap: Record<string, number> = {}
        for (const c of cards) {
          if (c.set_name) setMap[c.set_name] = (setMap[c.set_name] || 0) + 1
        }
        
        if (Object.keys(setMap).length > 0) {
          const setNames = Object.keys(setMap)
          // Busca sets pelo nome PT ou nome EN
          const { data: setsDataPt } = await supabase
            .from('pokemon_sets')
            .select('id, name, name_pt, total, printed_total, logo_url, symbol_url, series, release_date')
            .in('name_pt', setNames)

          const { data: setsDataEn } = await supabase
            .from('pokemon_sets')
            .select('id, name, name_pt, total, printed_total, logo_url, symbol_url, series, release_date')
            .in('name', setNames)

          const allSetsData = [...(setsDataPt || []), ...(setsDataEn || [])]

          // Monta progresso
          const progress = setNames.map(name => {
            // Tenta match por name_pt primeiro, depois por name
            const setInfo = allSetsData.find(s => s.name_pt === name || s.name === name)
            return {
              name,
              collected: setMap[name],
              total: setInfo?.total || setInfo?.printed_total || null,
              logo_url: setInfo?.logo_url || null,
              symbol_url: setInfo?.symbol_url || null,
              series: setInfo?.series || null,
              release_date: setInfo?.release_date || null,
            }
          }).sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''))

          setSetProgress(progress)
        }
      }

      setLoading(false)
    }
    load()
  }, [id])

  const membroDesde = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : ''

  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <p>Carregando perfil...</p>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: "'DM Sans', system-ui, sans-serif", gap: 16 }}>
      <p style={{ fontSize: 48 }}>😕</p>
      <p style={{ fontSize: 18 }}>Perfil não encontrado</p>
      <Link href="/" style={{ color: '#f59e0b', textDecoration: 'none', fontSize: 14 }}>← Voltar ao início</Link>
    </div>
  )

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

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* ── HERO ── */}
        <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(239,68,68,0.04))', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 24, padding: '28px 32px', display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{ width: 80, height: 80, borderRadius: '50%', flexShrink: 0, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: '#000', boxShadow: '0 0 32px rgba(245,158,11,0.3)' }}>
            {iniciais(user?.name)}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 180 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>{user?.name}</h1>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {user?.city && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>📍 {user.city}</span>}
              {membroDesde && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>📅 Membro desde {membroDesde}</span>}
            </div>
          </div>

          {/* Patrimônio */}
          {patrimonio > 0 && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '14px 20px', borderRadius: 14, textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>💰 Coleção estimada</p>
              <p style={{ fontSize: 22, fontWeight: 800, background: BRAND, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em' }}>{fmt(patrimonio)}</p>
            </div>
          )}
        </div>

        {/* ── PATRIMÔNIO HISTÓRICO ── */}
        {portfolioHistory.length >= 2 && (() => {
          const values = portfolioHistory.map(h => Number(h.valor))
          const minVal = Math.min(...values)
          const maxVal = Math.max(...values)
          const range = maxVal - minVal || 1
          const W = 600, H = 120, PAD = 16
          const points = values.map((v, i) => {
            const x = PAD + (i / (values.length - 1)) * (W - PAD * 2)
            const y = H - PAD - ((v - minVal) / range) * (H - PAD * 2)
            return `${x},${y}`
          }).join(' ')
          const first = values[0], last = values[values.length - 1]
          const variacao = first > 0 ? ((last - first) / first) * 100 : 0
          const cor = variacao >= 0 ? '#22c55e' : '#ef4444'
          const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
          return (
            <div style={{ ...SURFACE, padding: '20px 24px', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>📈 Histórico do Patrimônio</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.02em' }}>{fmt(last)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: variacao >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: cor }}>
                    {variacao >= 0 ? '▲' : '▼'} {Math.abs(variacao).toFixed(1)}% no período
                  </span>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>
                    {fmtDate(portfolioHistory[0].recorded_at)} → {fmtDate(portfolioHistory[portfolioHistory.length - 1].recorded_at)}
                  </p>
                </div>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                <defs>
                  <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={cor} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={cor} stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {/* Área preenchida */}
                <polygon
                  points={`${PAD},${H - PAD} ${points} ${W - PAD},${H - PAD}`}
                  fill="url(#pg)"
                />
                {/* Linha */}
                <polyline points={points} fill="none" stroke={cor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {/* Ponto final */}
                {(() => {
                  const last = points.split(' ').pop()!
                  const [lx, ly] = last.split(',').map(Number)
                  return <circle cx={lx} cy={ly} r="5" fill={cor} stroke="#080a0f" strokeWidth="2" />
                })()}
              </svg>
            </div>
          )
        })()}

        {/* ── STATS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'Cartas na coleção', value: stats.cartas, color: '#60a5fa', icon: '🃏' },
            { label: 'Anúncios ativos',   value: stats.anuncios, color: '#f59e0b', icon: '📢' },
            { label: 'Vendas concluídas', value: stats.vendas, color: '#22c55e', icon: '✅' },
            { label: 'Reputação', value: stats.vendas === 0 ? 'Novo' : stats.vendas < 3 ? '⭐⭐⭐' : stats.vendas < 10 ? '⭐⭐⭐⭐' : '⭐⭐⭐⭐⭐', color: '#f59e0b', icon: '🏅', text: true },
          ].map((s, i) => (
            <div key={i} style={{ ...SURFACE, padding: '20px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</p>
              <p style={{ fontSize: (s as any).text ? 16 : 26, fontWeight: 800, color: s.color, letterSpacing: '-0.02em', marginBottom: 4 }}>{s.value}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── SHOWCASE — 6 cartas mais valiosas ── */}
        {showcase.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              🏆 Cartas mais valiosas
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 14 }}>
              {showcase.map((card, i) => {
                const vColor = VARIANTE_COLOR[card.variante || 'normal'] || '#60a5fa'
                const vLabel = VARIANTE_LABEL[card.variante || 'normal'] || 'Normal'
                return (
                  <div key={card.card_name + i} style={{ ...SURFACE, overflow: 'hidden', position: 'relative', transition: 'transform 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = ''}
                  >
                    {/* Ranking badge */}
                    {i < 3 && (
                      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, width: 24, height: 24, borderRadius: '50%', background: i === 0 ? '#f59e0b' : i === 1 ? 'rgba(255,255,255,0.4)' : '#cd7c3b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#000' }}>
                        {i + 1}
                      </div>
                    )}
                    {/* Imagem */}
                    {card.card_image
                      ? <img src={card.card_image} alt={card.card_name} style={{ width: '100%', display: 'block' }} />
                      : <div style={{ paddingBottom: '140%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 32 }}>🃏</span></div>
                    }
                    {/* Info */}
                    <div style={{ padding: '10px 12px' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#f0f0f0', lineHeight: 1.3, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.card_name}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: `${vColor}18`, color: vColor, border: `1px solid ${vColor}40` }}>{vLabel}</span>
                        {card.maxValue > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>{fmt(card.maxValue)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── PROGRESSO POR COLEÇÃO ── */}
        {setProgress.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
              📦 Progresso por coleção
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {setProgress.map((s, i) => {
                const pct = s.total ? Math.min(100, Math.round((s.collected / s.total) * 100)) : null
                return (
                  <div key={i} style={{ ...SURFACE, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Logo ou símbolo do set */}
                    <div style={{ width: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {s.logo_url ? (
                        <img src={s.logo_url} alt={s.name}
                          style={{ maxWidth: 64, maxHeight: 36, objectFit: 'contain', opacity: 0.9 }}
                          onError={e => {
                            const t = e.target as HTMLImageElement
                            t.style.display = 'none'
                            const next = t.nextElementSibling as HTMLElement
                            if (next) next.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      {s.symbol_url ? (
                        <img src={s.symbol_url} alt={s.name}
                          style={{ width: 28, height: 28, objectFit: 'contain', display: s.logo_url ? 'none' : 'block', opacity: 0.7 }}
                        />
                      ) : (
                        !s.logo_url && <span style={{ fontSize: 24 }}>📦</span>
                      )}
                    </div>

                    {/* Info + barra */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</p>
                          {s.series && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{s.series}</p>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? '#22c55e' : '#f59e0b' }}>
                            {s.collected}{s.total ? `/${s.total}` : ''}
                          </span>
                          {pct !== null && (
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>{pct}%</span>
                          )}
                        </div>
                      </div>

                      {/* Barra de progresso */}
                      {pct !== null && (
                        <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 99, transition: 'width 0.6s ease',
                            width: `${pct}%`,
                            background: pct === 100
                              ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                              : pct >= 50
                              ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                              : 'linear-gradient(90deg, #60a5fa, #3b82f6)',
                          }} />
                        </div>
                      )}
                    </div>

                    {/* Badge 100% */}
                    {pct === 100 && (
                      <span style={{ fontSize: 18, flexShrink: 0 }}>🏆</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── ANÚNCIOS ── */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
            📢 Anúncios disponíveis ({stats.anuncios})
          </h2>

          {listings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'rgba(255,255,255,0.25)', ...SURFACE }}>
              <p style={{ fontSize: 32, marginBottom: 10 }}>🛒</p>
              <p style={{ fontSize: 14 }}>Nenhum anúncio ativo no momento.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
              {listings.map((card: any) => (
                <div key={card.id} style={{ ...SURFACE, overflow: 'hidden' }}>
                  {card.card_image
                    ? <img src={card.card_image} alt={card.card_name} style={{ width: '100%', display: 'block' }} />
                    : <div style={{ paddingBottom: '140%', background: 'rgba(255,255,255,0.04)' }} />
                  }
                  <div style={{ padding: '12px 14px' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>{card.card_name}</p>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 100, color: 'rgba(255,255,255,0.5)' }}>{VARIANTE_LABEL[card.variante] || 'Normal'}</span>
                      <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 100, color: 'rgba(255,255,255,0.5)' }}>{card.condicao || 'NM'}</span>
                    </div>
                    <p style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b', letterSpacing: '-0.02em', marginBottom: 10 }}>{fmt(Number(card.price))}</p>
                    <Link href="/" style={{ display: 'block', textAlign: 'center', background: BRAND, color: '#000', padding: '9px', borderRadius: 10, fontWeight: 700, fontSize: 12, textDecoration: 'none' }}
                      onClick={e => { e.preventDefault(); localStorage.setItem('interesse-card-id', card.id); window.location.href = '/?login=1&redirect=marketplace' }}>
                      🤝 Tenho interesse
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── CTA ── */}
        <div style={{ textAlign: 'center', paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>Organize sua coleção e negocie com segurança</p>
          <Link href="/" style={{ background: BRAND, color: '#000', padding: '13px 32px', borderRadius: 14, fontWeight: 800, fontSize: 15, textDecoration: 'none', display: 'inline-block', boxShadow: '0 0 24px rgba(245,158,11,0.25)' }}>
            Criar conta grátis no Bynx →
          </Link>
        </div>

      </main>
    </div>
  )
}