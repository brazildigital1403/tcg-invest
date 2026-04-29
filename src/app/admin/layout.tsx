'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconDashboard, IconChat, IconAccount, IconLogout } from '@/components/ui/Icons'

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'

// ─── Ícone de loja inline (storefront) ────────────────────────────────────

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

// ─── Ícone de marketplace inline (tag/etiqueta) ───────────────────────────

function IconMarketplaceAdmin({ size = 16, color = 'rgba(255,255,255,0.45)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2.5L17.5 10L10 17.5L2.5 10V2.5H10Z" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6.5" cy="6.5" r="1.2" stroke={color} strokeWidth="1.4"/>
    </svg>
  )
}

// ─── Ícone de carteira/financeiro inline ──────────────────────────────────

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

const adminMenu = [
  { label: 'Dashboard',   href: '/admin',             Icon: IconDashboard          },
  { label: 'Tickets',     href: '/admin/tickets',     Icon: IconChat               },
  { label: 'Lojas',       href: '/admin/lojas',       Icon: IconStore              },
  { label: 'Marketplace', href: '/admin/marketplace', Icon: IconMarketplaceAdmin   },
  { label: 'Usuários',    href: '/admin/users',       Icon: IconAccount            },
  { label: 'Financeiro',  href: '/admin/financeiro',  Icon: IconWalletAdmin        },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/admin/login') return <>{children}</>

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
          .adm-sidebar        { display: none !important; }
          .adm-header-logo    { display: flex !important; }
          .adm-bottom-nav     { display: flex !important; }
          .adm-content        { padding-bottom: 80px; }
        }
      `}</style>

      <div className="adm-root">

        <aside className="adm-sidebar">
          <Link href="/admin" style={{ textDecoration: 'none', marginBottom: 6 }}>
            <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 28, width: 'auto', objectFit: 'contain', display: 'block' }} />
          </Link>
          <div style={{
            fontSize: 10, fontWeight: 800,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            background: BRAND,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: 24, paddingLeft: 2,
          }}>
            Painel Admin
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            {adminMenu.map(item => {
              const active = item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
              return (
                <Link key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
                  fontSize: 14, fontWeight: active ? 700 : 400,
                  color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                  background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                  borderLeft: active ? '2px solid #f59e0b' : '2px solid transparent',
                }}>
                  <item.Icon size={16} color={active ? '#f59e0b' : 'rgba(255,255,255,0.45)'} />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <Link href="/dashboard-financeiro" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 12px', borderRadius: 10,
            textDecoration: 'none',
            color: 'rgba(255,255,255,0.4)',
            fontSize: 13, fontWeight: 500,
            marginBottom: 4,
          }}>
            ← Voltar ao app
          </Link>

          <button onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', borderRadius: 10,
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.3)',
              fontSize: 14, cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
            }}>
            <IconLogout size={15} color="rgba(255,255,255,0.3)" /> Sair do admin
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
            return (
              <Link key={item.href} href={item.href} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, padding: '8px 4px 10px',
                textDecoration: 'none',
                color: active ? '#f59e0b' : 'rgba(255,255,255,0.35)',
                borderTop: active ? '2px solid #f59e0b' : '2px solid transparent',
              }}>
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
