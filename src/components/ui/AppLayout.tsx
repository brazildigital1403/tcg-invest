'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  IconCollection, IconDashboard, IconPokedex, IconMarketplace, IconAccount,
  IconLogout, IconBell, IconBellDot, IconInstagram, IconDiscord, IconWhatsApp,
  IconChat,
} from '@/components/ui/Icons'

// ─── Ícones inline (Separador + 3 dos lojistas) ─────────────────────────────

function IconSeparador({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox='0 0 20 20' fill='none'>
      <rect x='3' y='2' width='14' height='16' rx='2' stroke={color} strokeWidth='1.4'/>
      <path d='M3 7h14M3 12h14' stroke={color} strokeWidth='1.4'/>
      <path d='M7 2v5M7 12v6' stroke={color} strokeWidth='1.4' strokeLinecap='round'/>
    </svg>
  )
}

function IconMinhaLoja({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox='0 0 20 20' fill='none'>
      <path d='M3 8l1-4h12l1 4' stroke={color} strokeWidth='1.4' strokeLinejoin='round' />
      <path d='M3 8v9h14V8' stroke={color} strokeWidth='1.4' strokeLinejoin='round' />
      <path d='M8 17v-5h4v5' stroke={color} strokeWidth='1.4' strokeLinejoin='round' />
      <path d='M3 8c0 1.5 1 2.5 2.5 2.5S8 9.5 8 8m0 0c0 1.5 1 2.5 2 2.5s2-1 2-2.5m0 0c0 1.5 1 2.5 2.5 2.5S17 9.5 17 8' stroke={color} strokeWidth='1.4' strokeLinejoin='round' />
    </svg>
  )
}

function IconGuiaLojas({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox='0 0 20 20' fill='none'>
      <path d='M10 2c-3 0-5 2-5 5 0 4 5 10 5 10s5-6 5-10c0-3-2-5-5-5z' stroke={color} strokeWidth='1.4' strokeLinejoin='round' />
      <circle cx='10' cy='7' r='2' stroke={color} strokeWidth='1.4' />
    </svg>
  )
}

function IconExplorar({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox='0 0 20 20' fill='none'>
      <circle cx='10' cy='10' r='7.5' stroke={color} strokeWidth='1.4' />
      <path d='M13 7l-1.5 4.5L7 13l1.5-4.5L13 7z' stroke={color} strokeWidth='1.4' strokeLinejoin='round' />
    </svg>
  )
}

import { marcarTodasLidas } from '@/lib/notificacoes'

const BRAND  = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const BG     = '#080a0f'
const EXPLORE_KEY = 'bynx_explore_mode'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

// ─── Definições de itens de menu ────────────────────────────────────────────

type MenuItem = {
  name: string
  full: string
  href: string
  Icon: (props: { size?: number; color?: string }) => JSX.Element
}

const ITEM_DASHBOARD:    MenuItem = { name: 'Dashboard',   full: 'Dashboard',      href: '/dashboard-financeiro', Icon: IconDashboard }
const ITEM_COLECAO:      MenuItem = { name: 'Coleção',     full: 'Minha Coleção', href: '/minha-colecao',       Icon: IconCollection }
const ITEM_POKEDEX:      MenuItem = { name: 'Pokédex',     full: 'Pokédex',        href: '/pokedex',              Icon: IconPokedex }
const ITEM_MARKETPLACE:  MenuItem = { name: 'Marketplace', full: 'Marketplace',    href: '/marketplace',          Icon: IconMarketplace }
const ITEM_SEPARADORES:  MenuItem = { name: 'Separadores', full: 'Separadores',    href: '/separadores',          Icon: IconSeparador }
const ITEM_CONTA:        MenuItem = { name: 'Conta',       full: 'Minha Conta',    href: '/minha-conta',          Icon: IconAccount }
const ITEM_MINHA_LOJA:   MenuItem = { name: 'Loja',        full: 'Minha Loja',     href: '/minha-loja',           Icon: IconMinhaLoja }
const ITEM_GUIA_LOJAS:   MenuItem = { name: 'Guia',        full: 'Guia de Lojas',  href: '/lojas',                Icon: IconGuiaLojas }
const ITEM_SUPORTE:      MenuItem = { name: 'Suporte',     full: 'Suporte',        href: '/suporte',              Icon: IconChat }

// ─── Componente ─────────────────────────────────────────────────────────────

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const [patrimonio, setPatrimonio] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notifs, setNotifs] = useState<any[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const notifScrollRef = useRef<HTMLDivElement>(null)
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)

  // Detecção adaptativa do perfil
  const [temCartas, setTemCartas] = useState<boolean | null>(null)
  const [temLoja, setTemLoja] = useState<boolean | null>(null)
  const [exploreMode, setExploreMode] = useState(false)

  // Detecção de auth pra guest mode em /pokedex e /separadores.
  // Quando user NÃO está logado e está navegando em uma dessas rotas
  // (vindas das landings via "Explorar Pokédex" / "Explorar Separadores"),
  // dimamos os outros links do menu pra deixar claro que são exclusivos
  // de quem tem conta. O cadastro continua acessível pelos CTAs da página.
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session?.user)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Rotas acessíveis sem login (exploração via landings).
  // Quando o user deslogado está em uma delas, dimamos os outros links no menu.
  const GUEST_ALLOWED_HREFS = new Set<string>(['/pokedex', '/separadores'])
  const isGuestExploreRoute = GUEST_ALLOWED_HREFS.has(pathname || '')
  const guestExploring = isLoggedIn === false && isGuestExploreRoute

  // Load explore mode do localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    setExploreMode(localStorage.getItem(EXPLORE_KEY) === '1')
  }, [])

  // Determina o perfil
  const isLojistaPuro    = temLoja === true && temCartas === false && !exploreMode
  const isLojistaExplore = temLoja === true && temCartas === false && exploreMode

  // Monta menu adaptativo
  const menu = useMemo<MenuItem[]>(() => {
    // Enquanto não sabemos o perfil, usa menu de colecionador (estado padrão)
    if (temLoja === null || temCartas === null) {
      return [ITEM_DASHBOARD, ITEM_COLECAO, ITEM_POKEDEX, ITEM_MARKETPLACE, ITEM_SEPARADORES, ITEM_CONTA, ITEM_GUIA_LOJAS, ITEM_SUPORTE]
    }

    // Lojista puro (sem cartas, com loja, sem explore mode) → menu enxuto
    if (isLojistaPuro) {
      return [ITEM_MINHA_LOJA, ITEM_GUIA_LOJAS, ITEM_CONTA, ITEM_SUPORTE]
    }

    // Demais perfis: menu completo, com Minha Loja se aplicável
    const base: MenuItem[] = [ITEM_DASHBOARD, ITEM_COLECAO, ITEM_POKEDEX, ITEM_MARKETPLACE, ITEM_SEPARADORES]
    if (temLoja) base.push(ITEM_MINHA_LOJA)
    base.push(ITEM_GUIA_LOJAS, ITEM_CONTA, ITEM_SUPORTE)
    return base
  }, [temLoja, temCartas, isLojistaPuro])

  // Logo destino: lojista puro vai pra /minha-loja, demais pra /dashboard-financeiro
  const logoHref = isLojistaPuro ? '/minha-loja' : '/dashboard-financeiro'

  // Patrimônio escondido pra lojista puro (não tem cartas)
  const mostrarPatrimonio = !isLojistaPuro

  // Toggle explore mode
  function toggleExploreMode() {
    const novo = !exploreMode
    setExploreMode(novo)
    if (typeof window !== 'undefined') {
      if (novo) localStorage.setItem(EXPLORE_KEY, '1')
      else localStorage.removeItem(EXPLORE_KEY)
    }
    // Se desligou explore mode estando em página colecionador, redireciona pra /minha-loja
    if (!novo && temLoja && !temCartas) {
      window.location.href = '/minha-loja'
    }
  }

  // Scroll nativo não-passivo — captura wheel antes do browser propagar para a página
  useEffect(() => {
    const el = notifScrollRef.current
    if (!el || !notifOpen) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      el.scrollTop += e.deltaY
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [notifOpen])

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return

      // ─── Detecta perfil (cartas + lojas) ─────────────────────────
      const [{ data: cardsCheck }, { data: lojasCheck }] = await Promise.all([
        supabase.from('user_cards').select('id', { head: false }).eq('user_id', authData.user.id).limit(1),
        supabase.from('lojas').select('id').eq('owner_user_id', authData.user.id).limit(1),
      ])
      const _temCartas = !!cardsCheck && cardsCheck.length > 0
      const _temLoja = !!lojasCheck && lojasCheck.length > 0
      setTemCartas(_temCartas)
      setTemLoja(_temLoja)

      // ─── Cálculo de patrimônio (só se tem cartas) ────────────────
      if (!_temCartas) {
        setPatrimonio(0)
      } else {
        const { data: cards } = await supabase
          .from('user_cards').select('id, card_name, card_link, pokemon_api_id, variante, quantity').eq('user_id', authData.user.id)

        if (!cards || cards.length === 0) {
          setPatrimonio(0)
        } else {
          // Câmbio para estimativas
          let usdRate = 6.0, eurRate = 6.5
          try {
            const er = await fetch('/api/exchange-rate').then(r => r.json())
            usdRate = er.usd || 6.0; eurRate = er.eur || 6.5
          } catch {}

          const PRICE_SELECT = 'id, liga_link, preco_medio, preco_foil_medio, preco_promo_medio, preco_reverse_medio, preco_pokeball_medio, price_usd_normal, price_usd_holofoil, price_eur_normal, price_eur_holofoil'

          const priceById: any = {}
          const priceByLink: any = {}

          // 1. Por pokemon_api_id
          const apiIds = [...new Set(cards.map((c: any) => c.pokemon_api_id).filter(Boolean))]
          if (apiIds.length > 0) {
            const { data: byId } = await supabase.from('pokemon_cards').select(PRICE_SELECT).in('id', apiIds)
            ;(byId || []).forEach((p: any) => { priceById[p.id] = p })
          }

          // 2. Por liga_link
          const links = [...new Set(cards.map((c: any) => c.card_link).filter(Boolean))]
          if (links.length > 0) {
            const { data: byLink } = await supabase.from('pokemon_cards').select(PRICE_SELECT).in('liga_link', links)
            ;(byLink || []).forEach((p: any) => { if (p.liga_link) priceByLink[p.liga_link] = p })
          }

          const CAMPOS: any = {
            normal: 'preco_medio', foil: 'preco_foil_medio', promo: 'preco_promo_medio',
            reverse: 'preco_reverse_medio', pokeball: 'preco_pokeball_medio',
          }

          let total = 0
          for (const card of cards) {
            const p = card.pokemon_api_id ? priceById[card.pokemon_api_id]
              : card.card_link ? priceByLink[card.card_link] : null
            if (!p) continue
            const qty = (card as any).quantity || 1
            const v = card.variante || 'normal'
            // BRL primeiro, depois USD, depois EUR
            let val = parseFloat(p[CAMPOS[v]] || p.preco_medio || 0)
            if (!val) {
              const usd = Math.max(parseFloat(p.price_usd_holofoil || 0), parseFloat(p.price_usd_normal || 0))
              val = usd > 0 ? usd * usdRate : Math.max(parseFloat(p.price_eur_holofoil || 0), parseFloat(p.price_eur_normal || 0)) * eurRate
            }
            total += val * qty
          }
          setPatrimonio(total)
        }
      }

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
    if (typeof window !== 'undefined') {
      localStorage.removeItem(EXPLORE_KEY)
    }
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <>
      {/* ── CSS ── */}
      {notifOpen && <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />}

      {/* ── Painel de notificações — FORA do header para evitar stacking context ── */}
      {notifOpen && (
        <div style={{ position: 'fixed', top: 60, right: 12, width: 'min(340px, calc(100vw - 24px))', background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, boxShadow: '0 16px 48px rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 76px)', overflow: 'hidden' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0' }}>Notificações {notifs.length > 0 && <span style={{ fontSize: 11, color: '#ef4444' }}>({notifs.length})</span>}</p>
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

          <div ref={notifScrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                <IconBell size={28} color="rgba(255,255,255,0.2)" style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 13 }}>Nenhuma notificação</p>
                <p style={{ fontSize: 11, marginTop: 4, color: 'rgba(255,255,255,0.2)' }}>Avisamos quando suas cartas variarem ±10%</p>
              </div>
            ) : (
              notifs.map(n => {
                const color = n.type === 'valorizacao' ? '#22c55e' : n.type === 'desvalorizacao' ? '#ef4444' : n.type === 'marketplace' ? '#f59e0b' : '#60a5fa'
                const bg = n.type === 'valorizacao' ? 'rgba(34,197,94,0.06)' : n.type === 'desvalorizacao' ? 'rgba(239,68,68,0.06)' : n.type === 'marketplace' ? 'rgba(245,158,11,0.06)' : 'rgba(96,165,250,0.06)'
                return (
                  <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: bg }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 6 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</p>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{n.message}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>{new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

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
          <Link href={logoHref} style={{ textDecoration: 'none', marginBottom: 28 }}>
            <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 32, width: 'auto', objectFit: 'contain', display: 'block' }} />
          </Link>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            {menu.map(item => {
              const active = pathname === item.href
              const dimmed = guestExploring && !GUEST_ALLOWED_HREFS.has(item.href)
              return (
                <Link key={item.href} href={item.href}
                  aria-disabled={dimmed || undefined}
                  tabIndex={dimmed ? -1 : undefined}
                  onClick={dimmed ? (e) => e.preventDefault() : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
                    fontSize: 14, fontWeight: active ? 700 : 400,
                    color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                    background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                    borderLeft: active ? '2px solid #f59e0b' : '2px solid transparent',
                    opacity: dimmed ? 0.1 : 1,
                    pointerEvents: dimmed ? 'none' : 'auto',
                    cursor: dimmed ? 'not-allowed' : 'pointer',
                    transition: 'opacity 0.2s',
                  }}>
                  <item.Icon size={16} color={active ? "#f59e0b" : "rgba(255,255,255,0.45)"} />
                  {item.full}
                </Link>
              )
            })}
          </nav>

          {/* Botão Explorar como colecionador (somente lojista puro) */}
          {temLoja && !temCartas && !exploreMode && (
            <button onClick={toggleExploreMode}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', borderRadius: 10,
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
                color: '#f59e0b', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                marginBottom: 8, fontFamily: 'inherit',
              }}>
              <IconExplorar size={14} color="#f59e0b" />
              Explorar como colecionador
            </button>
          )}

          {/* Botão Voltar à minha loja (lojista em explore mode) */}
          {isLojistaExplore && (
            <button onClick={toggleExploreMode}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', borderRadius: 10,
                background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)',
                color: '#60a5fa', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                marginBottom: 8, fontFamily: 'inherit',
              }}>
              <IconMinhaLoja size={14} color="#60a5fa" />
              Voltar para minha loja
            </button>
          )}

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

            {/* Banner explore mode (lojista puro vendo dashboard de colecionador) */}
            {isLojistaExplore && (
              <div style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 8, padding: '4px 10px', flexShrink: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', whiteSpace: 'nowrap' }}>
                  👀 Modo colecionador ativo
                </p>
              </div>
            )}

            {/* Trial badge */}
            {trialDaysLeft !== null && (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '4px 10px', flexShrink: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', whiteSpace: 'nowrap' }}>
                  ⭐ Pro Trial · {trialDaysLeft}d restante{trialDaysLeft !== 1 ? 's' : ''}
                </p>
              </div>
            )}

            {/* Patrimônio (oculto pra lojista puro) */}
            {mostrarPatrimonio && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1 }}>Patrimônio</p>
                <p style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', background: BRAND, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', whiteSpace: 'nowrap' }}>
                  {patrimonio === null ? '...' : fmt(patrimonio)}
                </p>
              </div>
            )}

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
          overflowX: 'auto',
        }}>
          {menu.map(item => {
            const active = pathname === item.href
            const dimmed = guestExploring && !GUEST_ALLOWED_HREFS.has(item.href)
            return (
              <Link key={item.href} href={item.href}
                aria-disabled={dimmed || undefined}
                tabIndex={dimmed ? -1 : undefined}
                onClick={dimmed ? (e) => e.preventDefault() : undefined}
                style={{
                  flex: '0 0 auto', minWidth: 64,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 3, padding: '8px 4px 10px',
                  textDecoration: 'none',
                  color: active ? '#f59e0b' : 'rgba(255,255,255,0.35)',
                  borderTop: active ? '2px solid #f59e0b' : '2px solid transparent',
                  opacity: dimmed ? 0.1 : 1,
                  pointerEvents: dimmed ? 'none' : 'auto',
                  transition: 'opacity 0.2s',
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

              {/* Patrimônio no drawer (oculto pra lojista puro) */}
              {mostrarPatrimonio && (
                <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Patrimônio</p>
                  <p style={{ fontSize: 20, fontWeight: 800, background: BRAND, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {patrimonio === null ? '...' : fmt(patrimonio)}
                  </p>
                </div>
              )}

              {/* Nav links */}
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                {menu.map(item => {
                  const active = pathname === item.href
                  const dimmed = guestExploring && !GUEST_ALLOWED_HREFS.has(item.href)
                  return (
                    <Link key={item.href} href={item.href}
                      aria-disabled={dimmed || undefined}
                      tabIndex={dimmed ? -1 : undefined}
                      onClick={dimmed ? (e) => e.preventDefault() : () => setDrawerOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 12, textDecoration: 'none',
                        fontSize: 15, fontWeight: active ? 700 : 400,
                        color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                        background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                        border: active ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
                        opacity: dimmed ? 0.1 : 1,
                        pointerEvents: dimmed ? 'none' : 'auto',
                        cursor: dimmed ? 'not-allowed' : 'pointer',
                        transition: 'opacity 0.2s',
                      }}>
                      <item.Icon size={20} color={active ? '#fff' : 'rgba(255,255,255,0.5)'} />
                      {item.full}
                      {active && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />}
                    </Link>
                  )
                })}
              </nav>

              {/* Botão explore mode no drawer */}
              {temLoja && !temCartas && !exploreMode && (
                <button onClick={() => { toggleExploreMode(); setDrawerOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px', marginTop: 8, borderRadius: 12,
                    background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
                    color: '#f59e0b', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%',
                    fontFamily: 'inherit',
                  }}>
                  <IconExplorar size={16} color="#f59e0b" />
                  Explorar como colecionador
                </button>
              )}
              {isLojistaExplore && (
                <button onClick={() => { toggleExploreMode(); setDrawerOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px', marginTop: 8, borderRadius: 12,
                    background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)',
                    color: '#60a5fa', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%',
                    fontFamily: 'inherit',
                  }}>
                  <IconMinhaLoja size={16} color="#60a5fa" />
                  Voltar para minha loja
                </button>
              )}

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
