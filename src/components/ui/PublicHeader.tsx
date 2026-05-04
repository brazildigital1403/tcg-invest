'use client'

import { useEffect, useState, CSSProperties, RefObject } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/**
 * Header público unificado para todas as páginas públicas do Bynx.
 *
 * Uso padrão (páginas como /lojas, /lojas/[slug], /para-lojistas, /termos, /privacidade):
 *   <PublicHeader />
 *
 * Uso na landing (com botões de scroll pra seções):
 *   <PublicHeader landingScrollTargets={{ howRef, pricingRef }} />
 *
 * Logo clica e volta pra `/`. CTA muda entre "Entrar" (deslogado) e "Meu Dashboard" (logado).
 *
 * Comportamento do botão "Entrar":
 *   - Se já está na landing: dispara CustomEvent 'bynx:open-login'
 *     (a landing escuta e abre seu modal de auth em modo login)
 *   - Se está em outra página: navega pra `/?auth=login`
 *     (a landing lê o query param no mount e abre o modal)
 *
 * Isso garante que todo login usa o mesmo modal rico da landing (que tem
 * fluxo completo de login + signup com escolha de plano).
 */

interface LandingScrollTargets {
  howRef: RefObject<HTMLElement | null>
  pricingRef: RefObject<HTMLElement | null>
}

interface Props {
  /**
   * Quando passado, renderiza os botões "Como funciona" e "Planos" no nav desktop
   * e no menu mobile, fazendo scroll suave para os elementos referenciados.
   * Use apenas na landing (`src/app/page.tsx`).
   */
  landingScrollTargets?: LandingScrollTargets
}

export default function PublicHeader({ landingScrollTargets }: Props = {}) {
  const router = useRouter()
  const pathname = usePathname() || '/'
  const [logado, setLogado] = useState<boolean | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Detecta se um link de nav corresponde à rota atual.
  // /lojas considera /lojas/[slug] também ativo (subrota).
  function isActive(href: string): boolean {
    if (href === '/lojas') return pathname === '/lojas' || pathname.startsWith('/lojas/')
    return pathname === href
  }

  // Aplica destaque (bold + cor) ao link ativo.
  // Usa S.navLinkAnchorActive como overlay sobre S.navLinkAnchor.
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

    // Atualiza se auth mudar durante a sessão
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
   * Abre o modal de login da landing.
   * Se já estamos na landing, dispara evento customizado (sem reload).
   * Se estamos em outra página, navega pra /?auth=login.
   */
  function openLogin() {
    setMobileMenuOpen(false)
    if (typeof window === 'undefined') return

    if (window.location.pathname === '/') {
      window.dispatchEvent(new CustomEvent('bynx:open-login'))
    } else {
      router.push('/?auth=login')
    }
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
      `}</style>

      <header style={S.header}>
        <div style={S.inner}>
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
                  style={S.navLink}
                >
                  Como funciona
                </button>
                <button
                  type="button"
                  onClick={() => scrollTo(landingScrollTargets.pricingRef)}
                  style={S.navLink}
                >
                  Planos
                </button>
              </>
            )}

            {/* Links universais */}
            <Link href="/lojas" style={navLinkStyle('/lojas')}>
              Guia de Lojas
            </Link>
            <Link href="/colecionadores" style={navLinkStyle('/colecionadores')}>
              Colecionadores
            </Link>
            <Link href="/pokedex-pokemon-tcg" style={navLinkStyle('/pokedex-pokemon-tcg')}>
              Pokédex
            </Link>
            <Link href="/scan-ia" style={navLinkStyle('/scan-ia')}>
              Scan IA
            </Link>
            <Link href="/separadores-pokemon" style={navLinkStyle('/separadores-pokemon')}>
              Separadores
            </Link>
            <Link href="/para-lojistas" style={navLinkStyle('/para-lojistas')}>
              Para lojistas
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

        {/* ─── Menu mobile expandido ──────────────────────────── */}
        {mobileMenuOpen && (
          <div style={S.mobileMenu}>
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

            <Link href="/lojas" onClick={closeMobile} style={mobileLinkStyle('/lojas')}>
              Guia de Lojas
            </Link>
            <Link href="/colecionadores" onClick={closeMobile} style={mobileLinkStyle('/colecionadores')}>
              Colecionadores
            </Link>
            <Link href="/pokedex-pokemon-tcg" onClick={closeMobile} style={mobileLinkStyle('/pokedex-pokemon-tcg')}>
              Pokédex
            </Link>
            <Link href="/scan-ia" onClick={closeMobile} style={mobileLinkStyle('/scan-ia')}>
              Scan IA
            </Link>
            <Link href="/separadores-pokemon" onClick={closeMobile} style={mobileLinkStyle('/separadores-pokemon')}>
              Separadores
            </Link>
            <Link href="/para-lojistas" onClick={closeMobile} style={mobileLinkStyle('/para-lojistas')}>
              Para lojistas
            </Link>
          </div>
        )}
      </header>
    </>
  )
}

// ─── Estilos (espelham o header da landing) ───────────────────────────────────

const S: Record<string, CSSProperties> = {
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
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
    gap: 28,
  },
  navLink: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: 'inherit',
    padding: 0,
  },
  navLinkAnchor: {
    color: 'rgba(255,255,255,0.6)',
    textDecoration: 'none',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  // Aplicado quando o link bate com a rota atual.
  // Cor laranja + bold deixam claro onde o user está sem precisar
  // de underline ou borda lateral. Mantém o layout estável (mesma
  // altura/largura), só muda peso e cor do texto.
  navLinkAnchorActive: {
    color: '#f59e0b',
    fontWeight: 700,
  },
  ctaPrimary: {
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    border: 'none',
    color: '#000',
    padding: '9px 18px',
    borderRadius: 10,
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
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
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    border: 'none',
    color: '#000',
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
    borderTop: '1px solid rgba(255,255,255,0.08)',
    padding: '12px 20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
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
    display: 'block',
  },
  // Mesma lógica do desktop: laranja + bold quando o link
  // bate com a rota atual.
  mobileMenuItemLinkActive: {
    color: '#f59e0b',
    fontWeight: 700,
  },
}