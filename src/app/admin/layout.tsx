'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconDashboard, IconChat, IconAccount, IconLogout, IconBell, IconKey, IconArticle, IconShield, IconTag, IconLink, IconStar, IconLeilao, IconRestauro, IconBox, IconCalendar, IconMenu, IconClose } from '@/components/ui/Icons'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import WorldSwitcher from '@/components/ui/WorldSwitcher'
import { supabase } from '@/lib/supabaseClient'
import { lojaCache } from '@/lib/lojaCache'
import { marcarTrafegoInterno } from '@/lib/trafego-interno'

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

// Icone de conteudo inline (balao com linhas de texto = post)
function IconConteudoAdmin({ size = 16, color = 'rgba(255,255,255,0.45)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 3h14v10H7l-4 4V3z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M6.5 7h7M6.5 10h4.5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

// Icone de parceiros inline (megafone — mesmo desenho do menu do app)
function IconParceirosAdmin({ size = 16, color = 'rgba(255,255,255,0.45)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M2.5 9.2 17.5 5v10L2.5 11.7V9.2Z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M9.7 14a2.5 2.5 0 1 1-4.8-1.3" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

// Icone da regua de e-mail inline (envelope)
function IconReguaAdmin({ size = 16, color = 'rgba(255,255,255,0.45)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" stroke={color} strokeWidth="1.4"/>
      <path d="M3 5.5l7 5.5 7-5.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// Icone da ferramenta de centralizacao (carta com moldura e mira)
function IconCentralizacaoAdmin({ size = 16, color = 'rgba(255,255,255,0.45)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="4" y="2.5" width="12" height="15" rx="1.5" stroke={color} strokeWidth="1.4"/>
      <rect x="6.5" y="5" width="7" height="10" rx="0.5" stroke={color} strokeWidth="1.2" strokeDasharray="1.6 1.4"/>
      <path d="M10 8.5v3M8.5 10h3" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

type MenuItem = { label: string; href: string; Icon: any; countKey?: string; attention?: boolean; group: string; topo?: boolean }

// Menu em 4 grupos (07/11/2026, decisao do Du depois de 23 itens planos):
// FILAS = o que precisa de acao hoje (badge vermelho so aqui), NEGOCIO,
// MARKETING, COMUNIDADE. `topo` marca o que entra na barra do celular; o
// resto abre no botao "Menu". Badge vermelho (`attention`) = pendencia;
// badge cinza = quantidade (total de usuarios, novos em 7 dias, inscritos,
// aniversariantes do mes) -- voltou em 08/11/2026 a pedido do Du, que le
// esses numeros pelo menu sem abrir o Dashboard.
const GRUPOS = ['', 'Filas', 'Negócio', 'Marketing', 'Comunidade'] as const

const adminMenu: MenuItem[] = [
  { label: 'Dashboard', href: '/admin', Icon: IconDashboard, group: '', topo: true },
  { label: 'Tickets', href: '/admin/tickets', Icon: IconChat, countKey: 'tickets', attention: true, group: 'Filas', topo: true },
  { label: 'Cartas faltando', href: '/admin/card-requests', Icon: IconCardAlert, countKey: 'cartas', attention: true, group: 'Filas', topo: true },
  { label: 'Bancada', href: '/admin/servicos', Icon: IconRestauro, countKey: 'servicos', attention: true, group: 'Filas', topo: true },
  // Central do leilao e Protecao Bynx (reclamacoes de pedido de leilao): so com o leilao ligado.
  ...(LEILAO_ATIVO ? [
    { label: 'Leilões', href: '/admin/leiloes', Icon: IconLeilao, countKey: 'leiloes', attention: true, group: 'Filas', topo: true },
    { label: 'Proteção Bynx', href: '/admin/reclamacoes', Icon: IconShield, countKey: 'reclamacoes', attention: true, group: 'Filas' },
  ] : []),
  { label: 'Centralização', href: '/admin/centralizacao', Icon: IconCentralizacaoAdmin, group: 'Filas' },
  { label: 'Usuários', href: '/admin/users', Icon: IconAccount, countKey: 'usuarios', group: 'Negócio' },
  { label: 'Lojas', href: '/admin/lojas', Icon: IconStore, countKey: 'lojas', group: 'Negócio' },
  { label: 'Marketplace', href: '/admin/marketplace', Icon: IconMarketplaceAdmin, countKey: 'marketplace', group: 'Negócio' },
  { label: 'Conversas', href: '/admin/conversas', Icon: IconConversasAdmin, countKey: 'conversas', group: 'Negócio' },
  { label: 'Financeiro', href: '/admin/financeiro', Icon: IconWalletAdmin, countKey: 'financeiro', group: 'Negócio' },
  { label: 'Parceiros', href: '/admin/parceiros', Icon: IconParceirosAdmin, group: 'Negócio' },
  { label: 'Régua', href: '/admin/regua', Icon: IconReguaAdmin, group: 'Marketing' },
  { label: 'Sino', href: '/admin/notificacoes', Icon: IconBell, group: 'Marketing' },
  { label: 'Criadores', href: '/admin/convites', Icon: IconStar, group: 'Marketing' },
  { label: 'Promoções', href: '/admin/promocoes', Icon: IconTag, group: 'Marketing' },
  { label: 'Links', href: '/admin/links', Icon: IconLink, group: 'Marketing' },
  { label: 'Social', href: '/admin/conteudo', Icon: IconConteudoAdmin, group: 'Marketing' },
  { label: 'Blog', href: '/admin/blog', Icon: IconArticle, group: 'Marketing' },
  { label: 'Amigo Secreto', href: '/admin/amigo-secreto', Icon: IconBox, countKey: 'amigo', group: 'Comunidade' },
  { label: 'Aniversariantes', href: '/admin/aniversariantes', Icon: IconCalendar, countKey: 'aniversariantes', group: 'Comunidade' },
  { label: 'Agenda do Club', href: '/admin/club-eventos', Icon: IconStar, group: 'Comunidade' },
  { label: 'Organizadores do Club', href: '/admin/club-organizadores', Icon: IconKey, group: 'Comunidade' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [collapsed, setCollapsed] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const [temLoja, setTemLoja] = useState(lojaCache.getHasLoja() ?? false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase.from('lojas').select('id').eq('owner_user_id', user.id).limit(1)
        const has = !!(data && data.length)
        lojaCache.setHasLoja(has)
        if (alive) setTemLoja(has)
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
      .then(r => {
        // Sessão de admin confirmada → este navegador é tráfego interno (#76).
        if (r.ok) marcarTrafegoInterno()
        return r.ok ? r.json() : null
      })
      .then(d => { if (alive && d) setCounts(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [pathname])

  // Login, relatorio de bancada e guia de envio (documentos A4 para imprimir) saem sem a casca do admin.
  if (pathname === '/admin/login' || /^\/admin\/servicos\/[^/]+\/(relatorio|guia)\/?$/.test(pathname)) return <>{children}</>

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
        .adm-switchbar { display: none; }
        .adm-content { flex: 1; overflow-x: hidden; }

        @media (max-width: 768px) {
          .adm-sidebar { display: none !important; }
          .adm-header-logo { display: flex !important; }
          .adm-bottom-nav { display: flex !important; }
          .adm-switchbar { display: flex !important; align-items: center; padding: 8px 16px; border-bottom: 1px solid var(--bx-border); background: rgba(8,10,15,0.97); }
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
            {adminMenu.map((item, i) => {
              const active = item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
              const badge = item.countKey ? (counts[item.countKey] || 0) : 0
              const novoGrupo = item.group && (i === 0 || adminMenu[i - 1].group !== item.group)
              return (<div key={item.href} style={{ display: 'contents' }}>
                {novoGrupo && (collapsed
                  ? <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 10px' }} />
                  : <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', padding: '14px 12px 4px' }}>{item.group}</div>)}
                <Link href={item.href} title={collapsed ? item.label : undefined} style={{
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
              </div>)
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
              <IconKey size={14} style={{ display: 'inline-block', verticalAlign: -2, marginRight: 4 }} />Acesso restrito
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

          {/* World switcher mobile (sub-barra) */}
          <div className="adm-switchbar">
            <WorldSwitcher current="admin" temLoja={temLoja} compact />
          </div>

          <div className="adm-content">{children}</div>
        </div>

        {/* 10 itens + sair nao cabem lado a lado em 390px (39px cada, texto
            "Dashboard"/"Marketplace" com nowrap vazava) -- vira barra com
            scroll horizontal, cada item com largura minima legivel, em vez
            de espremer tudo com flex:1 (achado de auditoria 04/08/2026). */}
        <nav className="adm-bottom-nav" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
          background: 'rgba(8,10,15,0.98)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          alignItems: 'stretch',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          {adminMenu.filter(i => i.topo).map(item => {
            const active = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)
            const badge = item.countKey ? (counts[item.countKey] || 0) : 0
            return (
              <Link key={item.href} href={item.href} onClick={() => setMenuAberto(false)} style={{
                flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, padding: '8px 4px 10px',
                textDecoration: 'none',
                color: active ? '#f59e0b' : 'rgba(255,255,255,0.35)',
                borderTop: active ? '2px solid #f59e0b' : '2px solid transparent',
              }}>
                {badge > 0 && (
                  <span style={{ position: 'absolute', top: 4, left: '50%', marginLeft: 4, background: item.attention ? '#ef4444' : 'rgba(255,255,255,0.28)', color: '#fff', fontSize: 8, fontWeight: 800, padding: '0 5px', borderRadius: 999, lineHeight: '14px', minWidth: 14, textAlign: 'center' }}>{badge}</span>
                )}
                <item.Icon size={19} color={active ? '#f59e0b' : 'rgba(255,255,255,0.35)'} />
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                  {item.label}
                </span>
              </Link>
            )
          })}
          {(() => {
            // "Menu" abre a folha com o resto; o badge soma so as PENDENCIAS que nao
            // estao na barra. Quantidade (total de usuarios etc.) nao entra na soma,
            // senao o botao mostraria 400 sem nada para fazer.
            const resto = adminMenu.filter(i => !i.topo)
            const soma = resto.reduce((n, i) => n + (i.attention && i.countKey ? (counts[i.countKey] || 0) : 0), 0)
            const vermelho = resto.some(i => i.attention && i.countKey && (counts[i.countKey] || 0) > 0)
            const ativo = resto.some(i => pathname.startsWith(i.href))
            return (
              <button type="button" onClick={() => setMenuAberto(v => !v)} aria-expanded={menuAberto} style={{
                flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, padding: '8px 4px 10px',
                background: 'none', border: 'none', borderTop: ativo && !menuAberto ? '2px solid #f59e0b' : '2px solid transparent',
                color: menuAberto || ativo ? '#f59e0b' : 'rgba(255,255,255,0.35)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {soma > 0 && !menuAberto && (
                  <span style={{ position: 'absolute', top: 4, left: '50%', marginLeft: 4, background: vermelho ? '#ef4444' : 'rgba(255,255,255,0.28)', color: '#fff', fontSize: 8, fontWeight: 800, padding: '0 5px', borderRadius: 999, lineHeight: '14px', minWidth: 14, textAlign: 'center' }}>{soma}</span>
                )}
                {menuAberto ? <IconClose size={19} color="#f59e0b" /> : <IconMenu size={19} color={ativo ? '#f59e0b' : 'rgba(255,255,255,0.35)'} />}
                <span style={{ fontSize: 9, fontWeight: menuAberto || ativo ? 700 : 400 }}>{menuAberto ? 'Fechar' : 'Menu'}</span>
              </button>
            )
          })()}
        </nav>

        {/* Folha do celular: os grupos inteiros, acima da barra. */}
        {menuAberto && (
          <div className="adm-sheet" onClick={() => setMenuAberto(false)} style={{
            position: 'fixed', inset: 0, zIndex: 190, background: 'rgba(8,10,15,0.7)',
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              position: 'absolute', left: 0, right: 0, bottom: 58, maxHeight: '72vh', overflowY: 'auto',
              background: '#0d0f14', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px 16px 0 0',
              padding: '8px 12px 16px',
            }}>
              {GRUPOS.filter(g => g).map(g => {
                const itens = adminMenu.filter(i => i.group === g)
                if (!itens.length) return null
                return (
                  <div key={g}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', padding: '14px 8px 4px' }}>{g}</div>
                    {itens.map(item => {
                      const active = pathname.startsWith(item.href)
                      const badge = item.countKey ? (counts[item.countKey] || 0) : 0
                      return (
                        <Link key={item.href} href={item.href} onClick={() => setMenuAberto(false)} style={{
                          display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '0 8px', borderRadius: 10, textDecoration: 'none',
                          fontSize: 14, fontWeight: active ? 700 : 400,
                          color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                          background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                        }}>
                          <item.Icon size={16} color={active ? '#f59e0b' : 'rgba(255,255,255,0.45)'} />
                          {item.label}
                          {badge > 0 && <span style={{ marginLeft: 'auto', background: item.attention ? '#ef4444' : 'rgba(255,255,255,0.1)', color: item.attention ? '#fff' : 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 999, minWidth: 18, textAlign: 'center' }}>{badge}</span>}
                        </Link>
                      )
                    })}
                  </div>
                )
              })}
              <button onClick={handleLogout} style={{
                display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, width: '100%', padding: '0 8px', marginTop: 12,
                background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
                color: 'rgba(239,68,68,0.8)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <IconLogout size={16} color="rgba(239,68,68,0.8)" />Sair
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
