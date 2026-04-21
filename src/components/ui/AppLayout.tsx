'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { IconCollection, IconDashboard, IconPokedex, IconMarketplace, IconAccount, IconLogout, IconBell, IconBellDot, IconInstagram, IconDiscord, IconWhatsApp } from '@/components/ui/Icons'
import { marcarTodasLidas } from '@/lib/notificacoes'

const BRAND  = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const BG     = '#080a0f'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

const menu = [
  { name: 'Coleção',     full: 'Minha Coleção',  href: '/minha-colecao',       Icon: IconCollection },
  { name: 'Dashboard',   full: 'Dashboard',       href: '/dashboard-financeiro', Icon: IconDashboard  },
  { name: 'Pokédex',     full: 'Pokédex',         href: '/pokedex',              Icon: IconPokedex    },
  { name: 'Marketplace', full: 'Marketplace',     href: '/marketplace',          Icon: IconMarketplace},
  { name: 'Conta',       full: 'Minha Conta',     href: '/minha-conta',          Icon: IconAccount    },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const [patrimonio, setPatrimonio] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notifs, setNotifs] = useState<any[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return
      const { data: cards } = await supabase
        .from('user_cards').select('card_name, variante, quantity').eq('user_id', authData.user.id)
      if (!cards || cards.length === 0) { setPatrimonio(0); return }
      const names = cards.map((c: any) => c.card_name?.trim()).filter(Boolean)
      const { data: prices } = await supabase
        .from('card_prices')
        .select('card_name, preco_medio, preco_foil_medio, preco_promo_medio, preco_reverse_medio, preco_pokeball_medio')
        .in('card_name', names)
      const priceMap: Record<string, any> = {}
      prices?.forEach((p: any) => { priceMap[p.card_name?.trim()] = p })
      const CAMPOS: Record<string, string> = {
        normal: 'preco_medio', foil: 'preco_foil_medio', promo: 'preco_promo_medio',
        reverse: 'preco_reverse_medio', pokeball: 'preco_pokeball_medio',
      }
      let total = 0
      for (const card of cards) {
        const p = priceMap[card.card_name?.trim()]
        if (!p) continue
        const qty = (card as any).quantity || 1
        let v = card.variante || 'normal'
        // Se a variante salva não tem preço, pega a primeira que tem
        if (!Number(p[CAMPOS[v]] || 0)) {
          v = Object.keys(CAMPOS).find(k => Number(p[CAMPOS[k]] || 0) > 0) || 'normal'
        }
        total += Number(p[CAMPOS[v]] || 0) * qty
      }
      setPatrimonio(total)

      // Verifica trial
      const { data: userData } = await supabase
        .from('users').select('is_pro, trial_expires_at').eq('id', authData.user.id).single()
      if (userData && !userData.is_pro && userData.trial_expires_at) {
        const expiry = new Date(userData.trial_expires_at)
        if (expiry > new Date()) {
          const days = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          setTrialDaysLeft(days)
        }
      }

      // Carrega notificações não lidas
      const { data: notifsData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', authData.user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(20)
      setNotifs(notifsData || [])
    }
    load()
    setDrawerOpen(false)
    setNotifOpen(false)
  }, [pathname])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const currentPage = menu.find(m => m.href === pathname)

  return (
    <>
      {/* ── CSS ── */}
      {notifOpen && <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 599 }} />}

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
                  <item.Icon size={16} color={active ? "#f59e0b" : "rgba(255,255,255,0.45)"} />
                  {item.full}
                </Link>
              )
            })}
          </nav>

          <button onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 14, cursor: 'pointer' }}>
            <IconLogout size={15} color="rgba(255,255,255,0.3)" /> Sair
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

            {/* Trial badge */}
            {trialDaysLeft !== null && (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '4px 10px', flexShrink: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', whiteSpace: 'nowrap' }}>
                  ⭐ Pro Trial · {trialDaysLeft}d restante{trialDaysLeft !== 1 ? 's' : ''}
                </p>
              </div>
            )}

            {/* Patrimônio */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1 }}>Patrimônio</p>
              <p style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', background: BRAND, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', whiteSpace: 'nowrap' }}>
                {patrimonio === null ? '...' : fmt(patrimonio)}
              </p>
            </div>

          {/* Sino de notificações */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setNotifOpen(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
{notifs.length > 0 ? <IconBellDot size={22} color="rgba(255,255,255,0.8)" /> : <IconBell size={22} color="rgba(255,255,255,0.8)" />}
                {notifs.length > 0 && (
                  <span style={{ position: 'absolute', top: 0, right: 0, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #080a0f' }}>
                    {notifs.length > 9 ? '9+' : notifs.length}
                  </span>
                )}
              </button>

              {/* Dropdown de notificações */}
              {notifOpen && (
                <div style={{ position: 'fixed', top: 56, right: 12, width: 'min(320px, calc(100vw - 24px))', background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, boxShadow: '0 16px 48px rgba(0,0,0,0.6)', zIndex: 600, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 72px)' }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: 13, fontWeight: 700 }}>Notificações {notifs.length > 0 && <span style={{ fontSize: 11, color: '#ef4444' }}>({notifs.length})</span>}</p>
                    {notifs.length > 0 && (
                      <button
                        onClick={async () => {
                          const { data: authData } = await supabase.auth.getUser()
                          if (authData.user) {
                            await marcarTodasLidas(authData.user.id)
                            setNotifs([])
                          }
                        }}
                        style={{ background: 'none', border: 'none', color: '#f59e0b', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }} onWheel={e => e.stopPropagation()}>
                    {notifs.length === 0 ? (
                      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                        <IconBell size={28} color="rgba(255,255,255,0.2)" style={{ marginBottom: 8 }} />
                        <p style={{ fontSize: 13 }}>Nenhuma notificação</p>
                        <p style={{ fontSize: 11, marginTop: 4, color: 'rgba(255,255,255,0.2)' }}>Avisamos quando suas cartas variarem ±10%</p>
                      </div>
                    ) : (
                      notifs.map(n => {
                        const subiu = n.type === 'valorizacao'
                        const color = subiu ? '#22c55e' : '#ef4444'
                        const bg = subiu ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)'
                        const icon = subiu ? '▲' : '▼'
                        return (
                          <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: bg, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 16, color, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</p>
                              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{n.message}</p>
                              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
                                {new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

          </header>

          {/* CONTEÚDO */}
          <main className="tcg-content">
            {children}
          </main>

          {/* ── FOOTER ── */}
          <footer style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '24px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}>
            {/* Logo */}
            <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 24, width: 'auto', objectFit: 'contain', opacity: 0.7 }} />

            {/* Social icons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <a href="https://instagram.com/bynx.gg" target="_blank" rel="noopener noreferrer"
                style={{ color: 'rgba(255,255,255,0.35)', transition: 'color 0.15s', display: 'flex' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
                <IconInstagram size={18} color="currentColor" />
              </a>
              <a href="https://discord.gg/bynx" target="_blank" rel="noopener noreferrer"
                style={{ color: 'rgba(255,255,255,0.35)', transition: 'color 0.15s', display: 'flex' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
                <IconDiscord size={18} color="currentColor" />
              </a>
              <a href="https://wa.me/bynx" target="_blank" rel="noopener noreferrer"
                style={{ color: 'rgba(255,255,255,0.35)', transition: 'color 0.15s', display: 'flex' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
                <IconWhatsApp size={18} color="currentColor" />
              </a>
            </div>

            {/* Copyright */}
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
              © 2026 Bynx · Feito para colecionadores brasileiros de Pokémon TCG
            </p>
          </footer>

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
                <item.Icon size={19} color={active ? '#f59e0b' : 'rgba(255,255,255,0.35)'} />
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
                      <item.Icon size={20} color={active ? '#fff' : 'rgba(255,255,255,0.5)'} />
                      {item.full}
                      {active && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />}
                    </Link>
                  )
                })}
              </nav>

              {/* Sair */}
              <button onClick={handleLogout}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', marginTop: 8, borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 14, cursor: 'pointer', width: '100%' }}>
                <IconLogout size={16} color="#ef4444" /> Sair da conta
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  )
}