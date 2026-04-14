'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const BG    = '#080a0f'
const BORDER = '1px solid rgba(255,255,255,0.08)'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [patrimonio, setPatrimonio] = useState<number | null>(null)

  // ── Busca patrimônio real (valor médio da coleção) ─────────────────────────
  useEffect(() => {
    async function loadPatrimonio() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return

      const { data: cards } = await supabase
        .from('user_cards')
        .select('card_name, variante')
        .eq('user_id', authData.user.id)

      if (!cards || cards.length === 0) { setPatrimonio(0); return }

      const names = cards.map((c: any) => c.card_name?.trim()).filter(Boolean)
      const { data: prices } = await supabase
        .from('card_prices')
        .select('card_name, preco_medio, preco_foil_medio, preco_promo_medio, preco_reverse_medio')
        .in('card_name', names)

      const priceMap: Record<string, any> = {}
      prices?.forEach((p: any) => { priceMap[p.card_name?.trim()] = p })

      let total = 0
      for (const card of cards) {
        const p = priceMap[card.card_name?.trim()]
        if (!p) continue
        const variante = card.variante || 'normal'
        if (variante === 'foil')    total += Number(p.preco_foil_medio || p.preco_medio || 0)
        else if (variante === 'promo')   total += Number(p.preco_promo_medio || p.preco_medio || 0)
        else if (variante === 'reverse') total += Number(p.preco_reverse_medio || p.preco_medio || 0)
        else total += Number(p.preco_medio || 0)
      }

      setPatrimonio(total)
    }

    loadPatrimonio()
  }, [pathname]) // recarrega ao trocar de página

  // ── Menu ───────────────────────────────────────────────────────────────────

  const menu = [
    { name: 'Minha Coleção', href: '/minha-colecao',         icon: '🃏' },
    { name: 'Dashboard',      href: '/dashboard-financeiro',  icon: '📊' },
    { name: 'Pokédex',        href: '/pokedex',               icon: '📖' },
    { name: 'Marketplace',    href: '/marketplace',           icon: '🛒' },
    { name: 'Minha Conta',    href: '/minha-conta',           icon: '👤' },
  ]

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: BG, color: '#f0f0f0', fontFamily: "'DM Sans', 'Sora', system-ui, sans-serif" }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: 240, background: 'rgba(255,255,255,0.02)',
        borderRight: BORDER, display: 'flex', flexDirection: 'column',
        padding: '24px 16px', flexShrink: 0,
        position: 'sticky', top: 0, height: '100vh',
      }}>
        {/* Logo */}
        <Link href="/dashboard-financeiro" style={{ textDecoration: 'none', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
              📊
            </div>
            <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.03em', color: '#f0f0f0' }}>
              TCG Manager
            </span>
          </div>
        </Link>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {menu.map((item) => {
            const active = pathname === item.href
            return (
              <Link key={item.name} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
                fontSize: 14, fontWeight: active ? 700 : 400,
                color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                borderLeft: active ? '2px solid #f59e0b' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Sair */}
        <button
          onClick={handleLogout}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 14, cursor: 'pointer', textAlign: 'left' }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
        >
          <span>↩</span> Sair
        </button>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* HEADER */}
        <header style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
          padding: '16px 32px', borderBottom: BORDER,
          background: 'rgba(255,255,255,0.01)',
          position: 'sticky', top: 0, zIndex: 50, gap: 32,
        }}>
          {/* Patrimônio */}
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Patrimônio
            </p>
            <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', background: BRAND, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {patrimonio === null ? '...' : fmt(patrimonio)}
            </p>
          </div>

          <Link href="/minha-conta" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
            Minha Conta
          </Link>
        </header>

        {/* PAGE */}
        <main style={{ flex: 1, padding: '32px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}