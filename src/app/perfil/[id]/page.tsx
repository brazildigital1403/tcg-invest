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

      // Anúncios ativos
      const { data: listingsData } = await supabase
        .from('marketplace').select('*').eq('user_id', id).eq('status', 'disponivel')
        .order('created_at', { ascending: false })
      setListings(listingsData || [])

      // Vendas
      const { data: vendas } = await supabase
        .from('transactions').select('id, price').eq('seller_id', id)

      // Total cartas
      const { count: totalCartas } = await supabase
        .from('user_cards').select('*', { count: 'exact', head: true }).eq('user_id', id)

      // Cartas com preços — para showcase e patrimônio
      const { data: cards } = await supabase
        .from('user_cards').select('card_name, variante, quantity, card_image').eq('user_id', id)

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

        {/* ── STATS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 32 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
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