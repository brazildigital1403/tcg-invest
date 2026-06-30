'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconDashboard, IconChat, IconAccount, IconLogout, IconBell } from '@/components/ui/Icons'
import WorldSwitcher from '@/components/ui/WorldSwitcher'
import { supabase } from '@/lib/supabaseClient'

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'

// Icone de loja inline (storefront)
function IconStore({ size = 16, color = 'rgba(255,255,255,0.45)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 7l1-3h12l1 3" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 7v2a2 2 0 0 0 4 0V7" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 7v2a2 2 0 0 0 4 0V7" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 7v2a2 2 0 0 0 4 0V7" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15 7v2a2 2 0 0 0 2 0V7" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 10v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-6" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// Icone de marketplace inline (tag/etiqueta)
function IconMarketplaceAdmin({ size = 16, color = 'rgba(255,255,255,0.45)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2.5L17.5 10L10 17.5L2.5 10V2.5H10Z" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6.5" cy="6.5" r="1.2" stroke={color} strokeWidth="1.4"/>
    </svg>
  )
}

// Icone de carteira/financeiro inline
function IconWalletAdmin({ size = 16, color = 'rgba(255,255,255,0.45)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="5.5" width="15" height="11" rx="2" stroke={color} strokeWidth="1.4" />
      <path d="M2.5 9h15" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="14" cy="12.5" r="1" fill={color} />
      <path d="M5 5.5V4a1 1 0 0 1 1.3-.95l8 2.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Icone de cartas faltando/erros inline (carta + alerta)
function IconCardAlert({ size = 16, color = 'rgba(255,255,255,0.45)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="4" width="11" height="13" rx="2" stroke={color} strokeWidth="1.4"/>
      <path d="M5.5 8h5M5.5 11h3.5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="15" cy="6.5" r="3" fill="#0b0c10" stroke={color} strokeWidth="1.4"/>
      <path d="M15 5.3v1.5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="15" cy="8.1" r="0.5" fill={color}/>
    </svg>
  )
}

// Chevron para recolher/expandir
function IconChevron({ collapsed, color = 'rgba(255,255,255,0.55)' }: { collapsed: boolean; color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {collapsed
        ? <path d="M7 4l6 6-6 6" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        : <path d="M13 4l-6 6 6 6" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>}
    </svg>
  )
}

function IconConversasAdmin({ size = 16, color = 'rgba(255,255,255,0.45)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M2 4h11v7H6l-4 3V4z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M7 11v1.5A1.5 1.5 0 008.5 14H14l4 3v-9.5A1.5 1.5 0 0016.5 6H15" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  )
}

type MenuItem = { label: string; href: string; Icon: any; countKey?: string; attention?: boolean }

const adminMenu: MenuItem[] = [
  { label: 'Dashboard', href: '/admin', Icon: IconDashboard },
  { label: 'Tickets', href: '/admin/tickets', Icon: IconChat, countKey: 'tickets' },
  { label: 'Cartas', href: '/admin/card-requests', Icon: IconCardAlert, countKey: 'cartas', attention: true },
  { label: 'Lojas', href: '/admin/lojas', Icon: IconStore, countKey: 'lojas' },
  { label: 'Marketplace', href: '/admin/marketplace', Icon: IconMarketplaceAdmin, countKey: 'marketplace' },
  { label: 'Usuários', href: '/admin/users', Icon: IconAccount, countKey: 'usuarios' },
  { label: 'Financeiro', href: '/admin/financeiro', Icon: IconWalletAdmin, countKey: 'financeiro' },
  { label: 'Avisos', href: '/admin/notificacoes', Icon: IconBell },
  { label: 'Conversas', href: '/admin/conversas', Icon: IconConversasAdmin, countKey: 'conversas' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [collapsed, setCollapsed] = useState(false)
  const [temLoja, setTemLoja] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase.from('lojas').select('id').eq('owner_user_id', user.id).limit(1)
        if (alive) setTemLoja(!!(data && data.length))
      } catch {}
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    try { setCollapsed(localStorage.getItem('adm-sidebar-collapsed') === '1') } catch {}
  }, [])

  useEffect(() => {
    if (pathname === '/admin/login') return
    let alive = true
    fetch('/api/admin/counts')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setCounts(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [pathname])

  if (pathname === '/admin/login') return <>{children}</>

  function toggleSidebar() {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem('adm-sidebar-collapsed', next ? '1' : '0') } catch {}
      return next
    })
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; overflow-x: hidden; }

        .adm-root {
          display: flex;
          min-height: 100vh;
          background: #080a0f;
          color: #f0f0f0;
          font-family: 'DM Sans', system-ui, sans-serif;
        }

        .adm-sidebar {
          flex-shrink: 0;
          background: rgba(255,255,255,0.02);
          border-right: 1px solid rgba(255,255,255,0.08);
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          overflow-x: hidden;
          transition: width 0.15s ease, padding 0.15s ease;
        }

        .adm-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow-x: hidden;
        }

        .adm-header {
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

        .adm-header-logo { display: none; }
        .adm-bottom-nav { display: none; }
        .adm-content { flex: 1; overflow-x: hidden; }

        @media (max-width: 768px) {
          .adm-sidebar { display: none !important; }
          .adm-header-logo { display: flex !important; }
          .adm-bottom-nav { display: flex !important; }
          .adm-content { padding-bottom: 80px; }
        }
      `}</style>

      <div className="adm-root">

        <aside className="adm-sidebar" style={{ width: collapsed ? 64 : 220, minWidth: collapsed ? 64 : 220, padding: collapsed ? '20px 8px' : '20px 12px' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 8, marginBottom: collapsed ? 16 : 6, minHeight: 30 }}>
            {!collapsed && (
              <Link href="/admin" style={{ textDecoration: 'none' }}>
                <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 28, width: 'auto', objectFit: 'contain', display: 'block' }} />
              </Link>
            )}
            <button onClick={toggleSidebar} title={collapsed ? 'Expandir menu' : 'Recolher menu'} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}>
              <IconChevron collapsed={collapsed} />
            </button>
          </div>

          {!collapsed && (
            <div style={{
              fontSize: 10, fontWeight: 800,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              background: BRAND,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              marginBottom: 24, paddingLeft: 2,
            }}>
              Painel Admin
            </div>
          )}

          {/* World switcher App|Admin */}
          {!collapsed && <WorldSwitcher current="admin" temLoja={temLoja} mb={18} />}

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, marginTop: collapsed ? 4 : 0 }}>
            {adminMenu.map(item => {
              const active = item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
              const badge = item.countKey ? (counts[item.countKey] || 0) : 0
              return (
                <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} style={{
                  display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: collapsed ? '11px 0' : '10px 12px', borderRadius: 10, textDecoration: 'none',
                  fontSize: 14, fontWeight: active ? 700 : 400,
                  color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                  background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                  borderLeft: active ? '2px solid #f59e0b' : '2px solid transparent',
                  position: 'relative',
                }}>
                  <item.Icon size={16} color={active ? '#f59e0b' : 'rgba(255,255,255,0.45)'} />
                  {!collapsed && item.label}
                  {badge > 0 && (collapsed ? (
                    <span style={{ position: 'absolute', top: 5, right: 7, background: item.attention ? '#ef4444' : 'rgba(255,255,255,0.4)', color: '#fff', fontSize: 8, fontWeight: 800, padding: '0 4px', borderRadius: 999, lineHeight: '13px', minWidth: 13, textAlign: 'center' }}>{badge > 9 ? '9+' : badge}</span>
                  ) : (
                    <span style={{ marginLeft: 'auto', background: item.attention ? '#ef4444' : 'rgba(255,255,255,0.1)', color: item.attention ? '#fff' : 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 999, minWidth: 18, textAlign: 'center' }}>{badge}</span>
                  ))}
                </Link>
              )
            })}
          </nav>

          <Link href="/dashboard-financeiro" title={collapsed ? 'Voltar ao app' : undefined} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '10px 0' : '10px 12px', borderRadius: 10,
            textDecoration: 'none',
            color: 'rgba(255,255,255,0.4)',
            fontSize: 13, fontWeight: 500,
            marginBottom: 4,
          }}>
            {collapsed ? '←' : '← Voltar ao app'}
          </Link>

          <button onClick={handleLogout} title={collapsed ? 'Sair do admin' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '10px 0' : '10px 12px', borderRadius: 10,
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.3)',
              fontSize: 14, cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
            }}>
            <IconLogout size={15} color="rgba(255,255,255,0.3)" /> {!collapsed && 'Sair do admin'}
          </button>
        </aside>

        <div className="adm-main">

          <header className="adm-header">
            <div className="adm-header-logo" style={{ display: 'none', alignItems: 'center', gap: 8, flex: 1 }}>
              <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 26, width: 'auto', objectFit: 'contain' }} />
              <span style={{
                fontSize: 9, fontWeight: 800,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                background: BRAND,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                Admin
              </span>
              <div style={{ marginLeft: 4 }}><WorldSwitcher current="admin" temLoja={temLoja} compact /></div>
            </div>

            <div style={{
              padding: '4px 10px', borderRadius: 100,
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.25)',
              fontSize: 10, fontWeight: 800,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: '#f59e0b',
              marginLeft: 'auto',
              whiteSpace: 'nowrap',
            }}>
              🔒 Acesso restrito
            </div>

            <Link href="/dashboard-financeiro" style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
              padding: '6px 12px', borderRadius: 8,
              fontSize: 12, textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}>
              ← App
            </Link>
          </header>

          <div className="adm-content">{children}</div>
        </div>

        <nav className="adm-bottom-nav" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
          background: 'rgba(8,10,15,0.98)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          alignItems: 'stretch',
        }}>
          {adminMenu.map(item => {
            const active = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)
            const badge = item.countKey ? (counts[item.countKey] || 0) : 0
            return (
              <Link key={item.href} href={item.href} style={{
                flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, padding: '8px 4px 10px',
                textDecoration: 'none',
                color: active ? '#f59e0b' : 'rgba(255,255,255,0.35)',
                borderTop: active ? '2px solid #f59e0b' : '2px solid transparent',
              }}>
                {badge > 0 && (
                  <span style={{ position: 'absolute', top: 4, left: '50%', marginLeft: 4, background: item.attention ? '#ef4444' : 'rgba(255,255,255,0.28)', color: '#fff', fontSize: 8, fontWeight: 800, padding: '0 5px', borderRadius: 999, lineHeight: '14px', minWidth: 14, textAlign: 'center' }}>{badge}</span>
                )}
                <item.Icon size={19} color={active ? '#f59e0b' : 'rgba(255,255,255,0.35)'} />
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, whiteSpace: 'nowrap' }}>
                  {item.label}
                </span>
              </Link>
            )
          })}
          <button onClick={handleLogout} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 3, padding: '8px 4px 10px',
            background: 'none', border: 'none',
            color: 'rgba(239,68,68,0.6)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <IconLogout size={19} color="rgba(239,68,68,0.6)" />
            <span style={{ fontSize: 9, fontWeight: 400 }}>Sair</span>
          </button>
        </nav>

      </div>
    </>
  )
}
