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

const VARIANTE_LABEL: Record<string, string> = {
  normal: 'Normal', foil: 'Foil', promo: 'Promo', reverse: 'Reverse Foil',
}

export default function PerfilPage() {
  const params = useParams()
  const id = params?.id as string

  const [user, setUser]         = useState<any>(null)
  const [listings, setListings] = useState<any[]>([])
  const [stats, setStats]       = useState({ cartas: 0, anuncios: 0, vendas: 0, arrecadado: 0 })
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    async function load() {
      // Dados do usuário
      const { data: userData } = await supabase
        .from('users')
        .select('id, name, city, whatsapp, created_at')
        .eq('id', id)
        .single()

      if (!userData) { setNotFound(true); setLoading(false); return }
      setUser(userData)

      // Anúncios ativos
      const { data: listingsData } = await supabase
        .from('marketplace')
        .select('*')
        .eq('user_id', id)
        .eq('status', 'disponivel')
        .order('created_at', { ascending: false })
      setListings(listingsData || [])

      // Transações
      const { data: vendas } = await supabase
        .from('transactions')
        .select('id, price')
        .eq('seller_id', id)

      // Total de cartas
      const { count: totalCartas } = await supabase
        .from('user_cards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', id)

      const totalArrecadado = (vendas || []).reduce((a, v) => a + Number(v.price || 0), 0)
      setStats({
        cartas: totalCartas || 0,
        anuncios: (listingsData || []).length,
        vendas: (vendas || []).length,
        arrecadado: totalArrecadado,
      })

      setLoading(false)
    }
    load()
  }, [id])

  const membroDesde = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : ''

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <p>Carregando perfil...</p>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: '#080a0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: "'DM Sans', system-ui, sans-serif", gap: 16 }}>
      <p style={{ fontSize: 48 }}>😕</p>
      <p style={{ fontSize: 18 }}>Perfil não encontrado</p>
      <Link href="/" style={{ color: '#f59e0b', textDecoration: 'none', fontSize: 14 }}>← Voltar ao início</Link>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#080a0f', color: '#f0f0f0', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* HEADER */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(8,10,15,0.95)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <img src="/logo_BYNX.png" alt="TCG Manager" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
        </Link>
        <Link href="/" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#000', padding: '8px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
          Entrar no app
        </Link>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* PERFIL HERO */}
        <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(239,68,68,0.04))', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 20, padding: '28px', display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#000' }}>
            {iniciais(user?.name)}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>{user?.name}</h1>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {user?.city && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>📍 {user.city}</span>}
              {membroDesde && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>📅 Membro desde {membroDesde}</span>}
            </div>
          </div>
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '8px 16px', borderRadius: 10 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Para negociar</p>
            <p style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>Entre no Bynx e use o Marketplace</p>
          </div>
        </div>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Cartas na coleção', value: stats.cartas, color: '#60a5fa', icon: '🃏' },
            { label: 'Anúncios ativos',   value: stats.anuncios, color: '#f59e0b', icon: '📢' },
            { label: 'Vendas concluídas', value: stats.vendas, color: '#22c55e', icon: '✅' },
            { label: 'Avaliação',         value: stats.vendas === 0 ? 'Novo' : stats.vendas < 3 ? '⭐⭐⭐' : stats.vendas < 10 ? '⭐⭐⭐⭐' : '⭐⭐⭐⭐⭐', color: '#f59e0b', icon: '🏅', text: true },
          ].map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</p>
              <p style={{ fontSize: s.text ? 14 : 24, fontWeight: 800, color: s.color, letterSpacing: '-0.02em', marginBottom: 4 }}>{s.value}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ANÚNCIOS */}
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
          📢 Anúncios disponíveis ({stats.anuncios})
        </h2>

        {listings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>🛒</p>
            <p>Nenhum anúncio ativo no momento.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 16 }}>
            {listings.map((card: any) => (
              <div key={card.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
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
                  <Link
                    href="/"
                    style={{ display: 'block', textAlign: 'center', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#000', padding: '9px', borderRadius: 10, fontWeight: 700, fontSize: 12, textDecoration: 'none' }}
                    onClick={(e) => {
                      e.preventDefault()
                      localStorage.setItem('interesse-card-id', card.id)
                      window.location.href = '/?login=1&redirect=marketplace'
                    }}
                  >
                    🤝 Tenho interesse
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FOOTER CTA */}
        <div style={{ textAlign: 'center', marginTop: 48, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', marginBottom: 14 }}>Quer comprar ou vender cartas com segurança?</p>
          <Link href="/" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#000', padding: '12px 28px', borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-block' }}>
            Criar conta grátis no Bynx →
          </Link>
        </div>

      </main>
    </div>
  )
}