'use client'

import { useState, useEffect, CSSProperties, RefObject } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  IconSearch, IconChevronDown, IconPokedex, IconScan, IconAccount, IconArticle,
} from '@/components/ui/Icons'

/**
 * Header público unificado para todas as páginas públicas da Bynx.
 *
 * Estrutura (Proposta A — "Explorar + busca"):
 *   [logo]   Explorar ▾   Guia de Lojas   Blog   |   Para lojistas   [busca]   [CTA]
 *
 * - "Explorar" é um dropdown (hover/foco) que agrupa as ferramentas do
 *   colecionador (Pokédex, Scan IA, Separadores) e a Comunidade (Colecionadores).
 * - "Guia de Lojas" e "Blog" ficam como links diretos de 1 clique.
 * - "Para lojistas" recua como link discreto (B2B), separado por um divisor.
 * - A lupa leva para /busca (a ação nº 1 num catálogo grande).
 *
 * Uso padrão:
 *   <PublicHeader />
 *
 * Uso na landing (com botões de scroll pra seções):
 *   <PublicHeader landingScrollTargets={{ howRef, pricingRef }} />
 *
 * Logo clica e volta pra `/`. CTA muda entre "Entrar" (deslogado) e
 * "Meu Dashboard" (logado). O botão "Entrar" dispara o CustomEvent
 * 'bynx:open-login' (o AuthModalProvider no layout raiz abre o modal).
 */

interface LandingScrollTargets {
  howRef: RefObject<HTMLElement | null>
  pricingRef: RefObject<HTMLElement | null>
}

interface Props {
  landingScrollTargets?: LandingScrollTargets
}

// Itens do dropdown "Explorar" (páginas públicas).
const EXPLORAR_FERRAMENTAS = [
  { href: '/pokedex-pokemon-tcg', label: 'Pokédex', sub: 'Todas as cartas por Pokémon', Icon: IconPokedex },
  { href: '/scan-ia', label: 'Scan IA', sub: 'Escaneie e catalogue', Icon: IconScan },
  { href: '/separadores-pokemon', label: 'Separadores', sub: 'Organize suas pastas', Icon: IconSeparador },
]
const EXPLORAR_COMUNIDADE = [
  { href: '/colecionadores', label: 'Colecionadores', sub: 'Perfis e coleções', Icon: IconAccount },
]

export default function PublicHeader({ landingScrollTargets }: Props = {}) {
  const router = useRouter()
  const pathname = usePathname() || '/'
  const [logado, setLogado] = useState<boolean | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [buscaQuery, setBuscaQuery] = useState('')

  // Detecta se um link de nav corresponde à rota atual.
  // /lojas considera /lojas/[slug] também ativo (subrota).
  function isActive(href: string): boolean {
    if (href === '/lojas') return pathname === '/lojas' || pathname.startsWith('/lojas/')
    if (href === '/blog') return pathname === '/blog' || pathname.startsWith('/blog/')
    return pathname === href
  }

  // Um dos itens do "Explorar" está ativo? (destaca o gatilho do dropdown)
  const explorarAtivo =
    [...EXPLORAR_FERRAMENTAS, ...EXPLORAR_COMUNIDADE].some(i => isActive(i.href))

  function navLinkStyle(href: string): CSSProperties {
    return isActive(href)
      ? { ...S.navLinkAnchor, ...S.navLinkAnchorActive }
      : S.navLinkAnchor
  }

  function mobileLinkStyle(href: string): CSSProperties {
    return isActive(href)
      ? { ...S.mobileMenuItemLink, ...S.mobileMenuItemLinkActive }
      : S.mobileMenuItemLink
  }

  useEffect(() => {
    let alive = true

    async function checar() {
      const { data } = await supabase.auth.getUser()
      if (alive) setLogado(!!data.user)
    }

    checar()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setLogado(!!session?.user)
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  function scrollTo(ref: RefObject<HTMLElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth' })
    setMobileMenuOpen(false)
  }

  function closeMobile() {
    setMobileMenuOpen(false)
  }

  /**
   * Abre o modal de login da landing (via evento global, sem reload).
   */
  function openLogin() {
    setMobileMenuOpen(false)
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('bynx:open-login'))
  }

  // Busca do menu mobile: Enter navega pra /busca?q=…
  function submitBusca() {
    const q = buscaQuery.trim()
    setMobileMenuOpen(false)
    router.push(q ? `/busca?q=${encodeURIComponent(q)}` : '/busca')
  }

  return (
    <>
      <style>{`
        /* Nav desktop visível ≥ 769px, menu mobile escondido */
        .ph-nav-desktop  { display: flex; }
        .ph-mobile-area  { display: none; }

        @media (max-width: 768px) {
          .ph-nav-desktop  { display: none !important; }
          .ph-mobile-area  { display: flex !important; }
        }

        /* Dropdown "Explorar" — abre por hover e por foco (teclado) */
        .ph-explore { position: relative; }
        .ph-dd {
          opacity: 0;
          visibility: hidden;
          transform: translateY(-6px);
          transition: opacity .15s ease, transform .15s ease, visibility .15s;
        }
        .ph-explore:hover .ph-dd,
        .ph-explore:focus-within .ph-dd {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
        /* Ponte invisível pro mouse cruzar o gap sem fechar */
        .ph-dd::before {
          content: '';
          position: absolute;
          top: -12px; left: 0; right: 0; height: 12px;
        }
        .ph-chev { display: inline-flex; transition: transform .15s ease; }
        .ph-explore:hover .ph-chev,
        .ph-explore:focus-within .ph-chev { transform: rotate(180deg); }

        .ph-nl:hover { color: #f0f0f0 !important; }
        .ph-dd-item:hover { background: rgba(255,255,255,0.05); color: #f0f0f0 !important; }
        .ph-b2b:hover { color: rgba(255,255,255,0.6) !important; }
        .ph-iconbtn:hover { color: #f0f0f0 !important; border-color: rgba(255,255,255,0.18) !important; }
        .ph-mitem:hover { color: #f0f0f0; }

        @media (prefers-reduced-motion: reduce) {
          .ph-dd, .ph-chev { transition: none !important; }
        }
      `}</style>

      <header style={S.header}>
        <div className="bx-gutter" style={S.inner}>
          {/* Logo — clicável, volta pra landing */}
          <Link href="/" style={S.logoLink} onClick={closeMobile}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_BYNX.png" alt="Bynx" style={S.logo} />
          </Link>

          {/* ─── NAV DESKTOP ────────────────────────────────────── */}
          <nav className="ph-nav-desktop" style={S.navDesktop}>
            {/* Botões de scroll (só na landing) */}
            {landingScrollTargets && (
              <>
                <button
                  type="button"
                  onClick={() => scrollTo(landingScrollTargets.howRef)}
                  className="ph-nl"
                  style={S.navLink}
                >
                  Como funciona
                </button>
                <button
                  type="button"
                  onClick={() => scrollTo(landingScrollTargets.pricingRef)}
                  className="ph-nl"
                  style={S.navLink}
                >
                  Planos
                </button>
              </>
            )}

            {/* ─── Explorar (dropdown) ─── */}
            <div className="ph-explore" style={S.exploreWrap}>
              <button
                type="button"
                className="ph-nl"
                style={explorarAtivo ? { ...S.exploreBtn, ...S.navLinkAnchorActive } : S.exploreBtn}
                aria-haspopup="true"
              >
                Explorar
                <span className="ph-chev">
                  <IconChevronDown size={15} color="currentColor" />
                </span>
              </button>

              <div className="ph-dd" style={S.dd} role="menu">
                <div style={S.ddGroup}>Ferramentas</div>
                {EXPLORAR_FERRAMENTAS.map(({ href, label, sub, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="ph-dd-item"
                    style={S.ddItem}
                    role="menuitem"
                  >
                    <span style={S.ddItemIcon}><Icon size={17} color="currentColor" /></span>
                    <span style={S.ddItemText}>
                      {label}
                      <small style={S.ddItemSub}>{sub}</small>
                    </span>
                  </Link>
                ))}

                <div style={S.ddGroup}>Comunidade</div>
                {EXPLORAR_COMUNIDADE.map(({ href, label, sub, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="ph-dd-item"
                    style={S.ddItem}
                    role="menuitem"
                  >
                    <span style={S.ddItemIcon}><Icon size={17} color="currentColor" /></span>
                    <span style={S.ddItemText}>
                      {label}
                      <small style={S.ddItemSub}>{sub}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Links diretos */}
            <Link href="/lojas" className="ph-nl" style={navLinkStyle('/lojas')}>
              Guia de Lojas
            </Link>
            <Link href="/blog" className="ph-nl" style={navLinkStyle('/blog')}>
              Blog
            </Link>

            <span style={S.divider} />

            {/* B2B discreto */}
            <Link href="/para-lojistas" className="ph-b2b" style={S.linkB2b}>
              Para lojistas
            </Link>

            {/* Busca */}
            <Link href="/busca" className="ph-iconbtn" style={S.iconBtn} aria-label="Buscar cartas e sets">
              <IconSearch size={18} color="currentColor" />
            </Link>

            {/* CTA */}
            {logado === null ? (
              <div style={S.ctaPlaceholder} />
            ) : logado ? (
              <button
                onClick={() => router.push('/dashboard-financeiro')}
                style={S.ctaPrimary}
              >
                Meu Dashboard
              </button>
            ) : (
              <button
                onClick={openLogin}
                style={S.ctaPrimary}
              >
                Entrar
              </button>
            )}
          </nav>

          {/* ─── MOBILE: CTA compacto + hamburguer ─────────────── */}
          <div className="ph-mobile-area" style={S.mobileArea}>
            {logado === null ? (
              <div style={S.ctaPlaceholderMobile} />
            ) : logado ? (
              <button
                onClick={() => router.push('/dashboard-financeiro')}
                style={S.ctaPrimaryMobile}
              >
                Dashboard
              </button>
            ) : (
              <button
                onClick={openLogin}
                style={S.ctaPrimaryMobile}
              >
                Entrar
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(v => !v)}
              style={S.hamburger}
              aria-label="Abrir menu"
              aria-expanded={mobileMenuOpen}
            >
              <span style={S.hamburgerBar} />
              <span style={S.hamburgerBar} />
              <span style={S.hamburgerBar} />
            </button>
          </div>
        </div>

        {/* ─── Menu mobile expandido (agrupado) ───────────────── */}
        {mobileMenuOpen && (
          <div style={S.mobileMenu}>
            {/* Busca */}
            <div style={S.mobileSearchWrap}>
              <IconSearch size={16} color="rgba(255,255,255,0.4)" />
              <input
                value={buscaQuery}
                onChange={e => setBuscaQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitBusca() }}
                placeholder="Buscar cartas, sets…"
                style={S.mobileSearchInput}
                aria-label="Buscar cartas e sets"
              />
            </div>

            {/* Landing (scroll) */}
            {landingScrollTargets && (
              <>
                <button
                  type="button"
                  onClick={() => scrollTo(landingScrollTargets.howRef)}
                  style={S.mobileMenuItem}
                >
                  Como funciona
                </button>
                <button
                  type="button"
                  onClick={() => scrollTo(landingScrollTargets.pricingRef)}
                  style={S.mobileMenuItem}
                >
                  Planos
                </button>
              </>
            )}

            <div style={S.mobileGroup}>Ferramentas</div>
            {EXPLORAR_FERRAMENTAS.map(({ href, label, Icon }) => (
              <Link key={href} href={href} onClick={closeMobile} className="ph-mitem" style={mobileLinkStyle(href)}>
                <span style={S.mobileItemIcon}><Icon size={18} color="currentColor" /></span>
                {label}
              </Link>
            ))}

            <div style={S.mobileGroup}>Explorar</div>
            <Link href="/lojas" onClick={closeMobile} className="ph-mitem" style={mobileLinkStyle('/lojas')}>
              <span style={S.mobileItemIcon}><IconGuiaLojasMini /></span>
              Guia de Lojas
            </Link>
            <Link href="/colecionadores" onClick={closeMobile} className="ph-mitem" style={mobileLinkStyle('/colecionadores')}>
              <span style={S.mobileItemIcon}><IconAccount size={18} color="currentColor" /></span>
              Colecionadores
            </Link>
            <Link href="/blog" onClick={closeMobile} className="ph-mitem" style={mobileLinkStyle('/blog')}>
              <span style={S.mobileItemIcon}><IconArticle size={18} color="currentColor" /></span>
              Blog
            </Link>

            <div style={S.mobileGroup}>Para quem vende</div>
            <Link href="/para-lojistas" onClick={closeMobile} style={{ ...mobileLinkStyle('/para-lojistas'), color: 'rgba(255,255,255,0.5)' }}>
              Para lojistas
            </Link>
          </div>
        )}
      </header>
    </>
  )
}

// ─── Ícones locais (não estão no Icons.tsx) ───────────────────────────────────

// Mesmo desenho usado no AppLayout, pra manter consistência visual.
function IconSeparador({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke={color} strokeWidth="1.4" />
      <path d="M3 7h14M3 12h14" stroke={color} strokeWidth="1.4" />
      <path d="M7 2v5M7 12v6" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function IconGuiaLojasMini({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3.5 8V16a1 1 0 001 1h11a1 1 0 001-1V8" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2.5 8l1.4-4a1 1 0 01.95-.7h10.3a1 1 0 01.95.7L17.5 8a2 2 0 01-3.75 1 2 2 0 01-3.75 0 2 2 0 01-3.75 0A2 2 0 012.5 8z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
// Acento sai de token (var(--ac-*)) com fallback pro âmbar da marca — assim
// respeita o tema claro dormente e nunca crava a cor de destaque sozinha.

const AC = 'var(--ac-1, #f59e0b)'
const AC_GRAD = 'var(--ac-grad, linear-gradient(135deg, #f59e0b, #ef4444))'

const S: Record<string, CSSProperties> = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backdropFilter: 'blur(16px)',
    background: 'rgba(8,10,15,0.9)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  inner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '14px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  logoLink: {
    display: 'flex',
    alignItems: 'center',
    textDecoration: 'none',
    flexShrink: 0,
  },
  logo: {
    height: 34,
    width: 'auto',
    objectFit: 'contain',
  },

  // ─── Nav desktop ───
  navDesktop: {
    alignItems: 'center',
    gap: 22,
  },
  navLink: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: 'inherit',
    padding: 0,
    transition: 'color 0.15s ease',
  },
  navLinkAnchor: {
    color: 'rgba(255,255,255,0.6)',
    textDecoration: 'none',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    transition: 'color 0.15s ease',
  },
  navLinkAnchorActive: {
    color: AC,
    fontWeight: 700,
  },

  // ─── Explorar (dropdown) ───
  exploreWrap: {
    display: 'flex',
    alignItems: 'center',
  },
  exploreBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: 'inherit',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    transition: 'color 0.15s ease',
  },
  dd: {
    position: 'absolute',
    top: 'calc(100% + 12px)',
    left: 0,
    minWidth: 236,
    background: '#0d0f15',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 14,
    boxShadow: '0 24px 48px rgba(0,0,0,0.55)',
    padding: 8,
    zIndex: 20,
  },
  ddGroup: {
    fontSize: 10,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '8px 10px 4px',
  },
  ddItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    padding: '9px 10px',
    borderRadius: 9,
    color: 'rgba(255,255,255,0.72)',
    textDecoration: 'none',
    fontSize: 14,
    transition: 'background 0.15s ease, color 0.15s ease',
  },
  ddItemIcon: {
    color: AC,
    display: 'flex',
    flexShrink: 0,
  },
  ddItemText: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.25,
  },
  ddItemSub: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: 400,
  },

  divider: {
    width: 1,
    height: 20,
    background: 'rgba(255,255,255,0.12)',
    flexShrink: 0,
  },
  linkB2b: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    transition: 'color 0.15s ease',
  },
  iconBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    width: 38,
    height: 38,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'color 0.15s ease, border-color 0.15s ease',
    flexShrink: 0,
  },

  ctaPrimary: {
    background: AC_GRAD,
    border: 'none',
    color: '#0a0a0a',
    padding: '9px 18px',
    borderRadius: 10,
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  ctaPlaceholder: {
    width: 120,
    height: 36,
  },

  // ─── Mobile ───
  mobileArea: {
    alignItems: 'center',
    gap: 10,
  },
  ctaPrimaryMobile: {
    background: AC_GRAD,
    border: 'none',
    color: '#0a0a0a',
    padding: '8px 14px',
    borderRadius: 8,
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'inherit',
  },
  ctaPlaceholderMobile: {
    width: 80,
    height: 32,
  },
  hamburger: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: '7px 10px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  hamburgerBar: {
    display: 'block',
    width: 18,
    height: 2,
    background: '#f0f0f0',
    borderRadius: 2,
  },

  // ─── Menu mobile expandido ───
  mobileMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 99,
    background: 'rgba(8,10,15,0.98)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 24px 48px rgba(0,0,0,0.55)',
    maxHeight: 'calc(100vh - 60px)',
    overflowY: 'auto',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    padding: '14px 20px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  mobileSearchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: '10px 12px',
    marginBottom: 8,
  },
  mobileSearchInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: '#f0f0f0',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  mobileGroup: {
    fontSize: 10,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '12px 0 2px',
  },
  mobileItemIcon: {
    color: AC,
    display: 'flex',
    flexShrink: 0,
  },
  mobileMenuItem: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    fontSize: 15,
    padding: '10px 0',
    textAlign: 'left',
    fontFamily: 'inherit',
    fontWeight: 500,
  },
  mobileMenuItemLink: {
    color: 'rgba(255,255,255,0.7)',
    textDecoration: 'none',
    fontSize: 15,
    padding: '10px 0',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 11,
  },
  mobileMenuItemLinkActive: {
    color: AC,
    fontWeight: 700,
  },
}
