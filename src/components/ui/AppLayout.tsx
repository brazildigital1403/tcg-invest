'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const BRAND  = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const BG     = '#080a0f'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

const menu = [
  { name: 'Coleção',     full: 'Minha Coleção',  href: '/minha-colecao',       icon: '🃏' },
  { name: 'Dashboard',   full: 'Dashboard',       href: '/dashboard-financeiro', icon: '📊' },
  { name: 'Pokédex',     full: 'Pokédex',         href: '/pokedex',              icon: '📖' },
  { name: 'Marketplace', full: 'Marketplace',     href: '/marketplace',          icon: '🛒' },
  { name: 'Conta',       full: 'Minha Conta',     href: '/minha-conta',          icon: '👤' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const [patrimonio, setPatrimonio] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return
      const { data: cards } = await supabase
        .from('user_cards').select('card_name, variante').eq('user_id', authData.user.id)
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
        const v = card.variante || 'normal'
        if (v === 'foil')         total += Number(p.preco_foil_medio    || p.preco_medio || 0)
        else if (v === 'promo')   total += Number(p.preco_promo_medio   || p.preco_medio || 0)
        else if (v === 'reverse') total += Number(p.preco_reverse_medio || p.preco_medio || 0)
        else                      total += Number(p.preco_medio || 0)
      }
      setPatrimonio(total)
    }
    load()
    setDrawerOpen(false)
  }, [pathname])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const currentPage = menu.find(m => m.href === pathname)

  return (
    <>
      {/* ── CSS ── */}
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; overflow-x: hidden; }

        .tcg-root {
          display: flex;
          min-height: 100vh;
          background: ${BG};
          color: #f0f0f0;
          font-family: 'DM Sans', system-ui, sans-serif;
        }

        /* ── SIDEBAR — desktop ── */
        .tcg-sidebar {
          width: 220px;
          flex-shrink: 0;
          background: rgba(255,255,255,0.02);
          border-right: 1px solid rgba(255,255,255,0.08);
          display: flex;
          flex-direction: column;
          padding: 20px 12px;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
        }

        .tcg-main-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow-x: hidden;
        }

        /* ── HEADER ── */
        .tcg-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(8,10,15,0.97);
          backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 100;
          gap: 12px;
        }

        .tcg-header-logo { display: none; }
        .tcg-header-menu-btn { display: none; }

        /* ── CONTENT ── */
        .tcg-content {
          flex: 1;
          padding: 24px;
          overflow-x: hidden;
        }

        /* ── BOTTOM NAV — mobile ── */
        .tcg-bottom-nav { display: none; }

        /* ── DRAWER — mobile ── */
        .tcg-drawer-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          z-index: 300;
          backdrop-filter: blur(4px);
        }
        .tcg-drawer {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 260px;
          background: #0d0f14;
          border-right: 1px solid rgba(255,255,255,0.1);
          z-index: 301;
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          transform: translateX(-100%);
          transition: transform 0.25s ease;
        }
        .tcg-drawer.open { transform: translateX(0); }

        /* ── MOBILE ── */
        @media (max-width: 768px) {
          .tcg-sidebar          { display: none !important; }
          .tcg-header-logo      { display: flex !important; }
          .tcg-header-menu-btn  { display: flex !important; }
          .tcg-header-account   { display: none !important; }
          .tcg-content          { padding: 16px 12px 100px; }
          .tcg-bottom-nav       { display: flex !important; }
          .tcg-drawer-overlay   { display: block; }
        }
      `}</style>

      <div className="tcg-root">

        {/* ── SIDEBAR desktop ── */}
        <aside className="tcg-sidebar">
          <Link href="/dashboard-financeiro" style={{ textDecoration: 'none', marginBottom: 28 }}>
            <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 32, width: 'auto', objectFit: 'contain', display: 'block' }} />
          </Link>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            {menu.map(item => {
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
                  fontSize: 14, fontWeight: active ? 700 : 400,
                  color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                  background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                  borderLeft: active ? '2px solid #f59e0b' : '2px solid transparent',
                }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  {item.full}
                </Link>
              )
            })}
          </nav>

          <button onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 14, cursor: 'pointer' }}>
            <span>↩</span> Sair
          </button>
        </aside>

        {/* ── MAIN ── */}
        <div className="tcg-main-col">

          {/* HEADER */}
          <header className="tcg-header">
            {/* Hamburguer — mobile */}
            <button className="tcg-header-menu-btn" onClick={() => setDrawerOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'none', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
              <span style={{ display: 'block', width: 22, height: 2, background: '#f0f0f0', borderRadius: 2 }} />
              <span style={{ display: 'block', width: 22, height: 2, background: '#f0f0f0', borderRadius: 2 }} />
              <span style={{ display: 'block', width: 22, height: 2, background: '#f0f0f0', borderRadius: 2 }} />
            </button>

            {/* Logo — mobile */}
            <div className="tcg-header-logo" style={{ display: 'none', alignItems: 'center', gap: 8, flex: 1 }}>
              <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
            </div>

            {/* Patrimônio */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1 }}>Patrimônio</p>
              <p style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', background: BRAND, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', whiteSpace: 'nowrap' }}>
                {patrimonio === null ? '...' : fmt(patrimonio)}
              </p>
            </div>

            {/* Minha Conta — desktop */}
            <Link href="/minha-conta" className="tcg-header-account"
              style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', flexShrink: 0 }}>
              Minha Conta
            </Link>
          </header>

          {/* CONTEÚDO */}
          <main className="tcg-content">
            {children}
          </main>
        </div>

        {/* ── BOTTOM NAV mobile ── */}
        <nav className="tcg-bottom-nav" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
          background: 'rgba(8,10,15,0.98)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          alignItems: 'stretch',
        }}>
          {menu.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, padding: '8px 4px 10px',
                textDecoration: 'none',
                color: active ? '#f59e0b' : 'rgba(255,255,255,0.35)',
                borderTop: active ? '2px solid #f59e0b' : '2px solid transparent',
              }}>
                <span style={{ fontSize: 19 }}>{item.icon}</span>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
                  {item.name}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* ── DRAWER mobile ── */}
        {drawerOpen && (
          <div className="tcg-drawer-overlay" onClick={() => setDrawerOpen(false)}>
            <div className="tcg-drawer open" onClick={e => e.stopPropagation()}>
              {/* Header drawer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
                </div>
                <button onClick={() => setDrawerOpen(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                  ✕
                </button>
              </div>

              {/* Patrimônio no drawer */}
              <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Patrimônio</p>
                <p style={{ fontSize: 20, fontWeight: 800, background: BRAND, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {patrimonio === null ? '...' : fmt(patrimonio)}
                </p>
              </div>

              {/* Nav links */}
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                {menu.map(item => {
                  const active = pathname === item.href
                  return (
                    <Link key={item.href} href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 12, textDecoration: 'none',
                        fontSize: 15, fontWeight: active ? 700 : 400,
                        color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                        background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                        border: active ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
                      }}>
                      <span style={{ fontSize: 20 }}>{item.icon}</span>
                      {item.full}
                      {active && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />}
                    </Link>
                  )
                })}
              </nav>

              {/* Sair */}
              <button onClick={handleLogout}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', marginTop: 8, borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 14, cursor: 'pointer', width: '100%' }}>
                <span>↩</span> Sair da conta
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  )
}