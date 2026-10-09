'use client'

/**
 * Provider global do modal de autenticação.
 *
 * Vive no layout root (src/app/layout.tsx) e renderiza o AuthModal sempre que
 * uma das 3 fontes de trigger é ativada:
 *
 *   1. URL com ?auth=signup ou ?auth=login (e opcional ?next=/rota)
 *      → Funciona em qualquer rota. Limpa o query param após detectar.
 *      → IMPORTANTE: o leitor da URL (useSearchParams) está em sub-componente
 *        wrapped em <Suspense> pra não quebrar prerender de páginas estáticas
 *        como /_not-found (Next.js 16 exige Suspense ao redor de hooks que
 *        forcem CSR no layout).
 *
 *   2. Hook useAuthModal() expondo openSignup/openLogin/closeModal
 *      → Pra components que precisam abrir o modal programaticamente.
 *
 *   3. CustomEvents window 'bynx:open-signup' / 'bynx:open-login'
 *      → Compatibilidade com PublicHeader e código legacy.
 */

import { createContext, Suspense, useCallback, useContext, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import AuthModal from './AuthModal'
import type { OfertaId } from '@/lib/ofertaTcgcon'
import { gravarCta, lerCta } from '@/lib/atribuicao'
import { trackAuthModalOpened } from '@/lib/analytics'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Plan = 'free' | 'plus' | 'mensal' | 'anual' | null

interface OpenSignupOpts {
  next?: string | null
  plan?: Plan
  oferta?: OfertaId | null
  /** Qual botao abriu ("carta:adicionar"). Sem rotulo vira "pag:/rota". */
  cta?: string | null
}

interface OpenLoginOpts {
  next?: string | null
  cta?: string | null
}

interface AuthModalContextValue {
  openSignup: (opts?: OpenSignupOpts) => void
  openLogin: (opts?: OpenLoginOpts) => void
  closeModal: () => void
  isOpen: boolean
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null)

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext)
  if (!ctx) {
    // Fallback no-op pra não quebrar SSR / componentes fora do Provider.
    return {
      openSignup: () => {},
      openLogin: () => {},
      closeModal: () => {},
      isOpen: false,
    }
  }
  return ctx
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Valida que o `next` é uma rota interna segura.
 * - Precisa começar com '/'
 * - Não pode ser protocolo-relativo ('//attacker.com')
 * Previne open redirect attacks.
 */
function sanitizeNext(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (!raw.startsWith('/')) return null
  if (raw.startsWith('//')) return null
  return raw
}

// ─── Listener de URL (isolado em Suspense) ───────────────────────────────────
// Componente separado SOMENTE pra usar useSearchParams() dentro de <Suspense>
// no Provider. Necessário pra Next.js 16 não quebrar prerender de páginas
// estáticas (/_not-found, /404 etc) que herdam o layout root.
//
// Não renderiza nada — só executa side effect de detectar ?auth= na URL.

interface URLAuthListenerProps {
  openSignup: (opts?: OpenSignupOpts) => void
  openLogin: (opts?: OpenLoginOpts) => void
}

// Rota anterior, gravada a cada troca de pagina (navegacao do Next nao
// atualiza o document.referrer). Fallback quando o link nao traz `cta`.
const CHAVE_PAG_ANTERIOR = 'bx_pag_anterior'

function paginaDeOrigem(): string | null {
  try {
    const ant = window.sessionStorage.getItem(CHAVE_PAG_ANTERIOR)
    if (ant) return `pag:${ant}`
    const r = document.referrer
    if (!r) return null
    const u = new URL(r)
    if (u.origin !== window.location.origin) return null
    return `pag:${u.pathname}`
  } catch {
    return null
  }
}

function URLAuthListener({ openSignup, openLogin }: URLAuthListenerProps) {
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()

  // Ao sair de uma rota, deixa ela anotada como "pagina anterior". O cleanup
  // roda antes do efeito da rota nova, entao o listener abaixo ja a enxerga.
  useEffect(() => {
    return () => {
      try {
        window.sessionStorage.setItem(CHAVE_PAG_ANTERIOR, pathname)
      } catch {
        // sessionStorage bloqueado: fica o referrer
      }
    }
  }, [pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!searchParams) return

    const authParam = searchParams.get('auth')
    const nextParam = searchParams.get('next')
    const planParam = searchParams.get('plan')
    // Sem `cta` na URL, o rotulo cai na PAGINA DE ORIGEM do clique (referrer
    // da mesma origem), nao na pagina em que o modal abre: o link do hub do
    // Pokemon abre o modal na home, e "pag:/" nao diria nada.
    const ctaParam = searchParams.get('cta') || paginaDeOrigem()

    if (authParam !== 'signup' && authParam !== 'login') return

    const validNext = sanitizeNext(nextParam)
    const validPlan: Plan =
      planParam === 'plus' ? 'plus'
      : planParam === 'mensal' ? 'mensal'
      : planParam === 'anual' ? 'anual'
      : null

    // Limpa os params da URL sem reload (mantém pathname e outros params)
    const cleanUrl = () => {
      const url = new URL(window.location.href)
      url.searchParams.delete('auth')
      url.searchParams.delete('next')
      url.searchParams.delete('plan')
      url.searchParams.delete('cta')
      window.history.replaceState({}, '', url.toString())
    }

    // Se já logado E tem next → redireciona direto sem modal
    supabase.auth.getSession().then(({ data }) => {
      const isLogged = !!data.session?.user

      if (isLogged && validNext) {
        cleanUrl()
        window.location.href = validNext
        return
      }

      // Não logado → abre modal
      if (authParam === 'signup') {
        openSignup({ next: validNext, plan: validPlan, cta: ctaParam })
      } else {
        openLogin({ next: validNext, cta: ctaParam })
      }
      cleanUrl()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, pathname])

  return null
}

// ─── Provider ────────────────────────────────────────────────────────────────

export default function AuthModalProvider({ children }: { children: React.ReactNode }) {
  // Estado do modal
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [plan, setPlan] = useState<Plan>(null)
  const [next, setNext] = useState<string | null>(null)
  const [oferta, setOferta] = useState<OfertaId | null>(null)

  // ─── API pública via context ─────────────────────────────────────────

  const openSignup = useCallback((opts: OpenSignupOpts = {}) => {
    setMode('signup')
    setPlan(opts.plan ?? null)
    setNext(sanitizeNext(opts.next ?? null))
    setOferta(opts.oferta ?? null)
    setIsOpen(true)
    gravarCta(opts.cta, typeof window !== 'undefined' ? window.location.pathname : null)
    trackAuthModalOpened({ modo: 'signup', cta: lerCta() })
  }, [])

  // Login tambem carimba: quem clica "Entrar" e troca pra "Criar conta"
  // dentro do modal cadastra com o rotulo do botao que abriu.
  const openLogin = useCallback((opts: OpenLoginOpts = {}) => {
    setMode('login')
    setPlan(null)
    setOferta(null)
    setNext(sanitizeNext(opts.next ?? null))
    setIsOpen(true)
    gravarCta(opts.cta, typeof window !== 'undefined' ? window.location.pathname : null)
    trackAuthModalOpened({ modo: 'login', cta: lerCta() })
  }, [])

  const closeModal = useCallback(() => {
    setIsOpen(false)
  }, [])

  // ─── Trigger 2: events legacy do PublicHeader ────────────────────────
  // PublicHeader dispara 'bynx:open-login' quando o user clica em "Entrar"
  // estando em página NÃO landing. Mantemos compat pra não quebrar o header.
  // Não usa useSearchParams então pode ficar fora do Suspense.
  useEffect(() => {
    if (typeof window === 'undefined') return

    // `detail.next` e opcional: o PublicHeader passou a manda-lo em 08/10/2026
    // pra pessoa voltar pra pagina em que estava depois de autenticar.
    function handleOpenSignup(e: Event) {
      const d = (e as CustomEvent<{ next?: string | null; cta?: string | null }>).detail
      openSignup({ next: d?.next ?? null, cta: d?.cta ?? null })
    }
    function handleOpenLogin(e: Event) {
      const d = (e as CustomEvent<{ next?: string | null; cta?: string | null }>).detail
      openLogin({ next: d?.next ?? null, cta: d?.cta ?? null })
    }

    window.addEventListener('bynx:open-signup', handleOpenSignup)
    window.addEventListener('bynx:open-login', handleOpenLogin)
    return () => {
      window.removeEventListener('bynx:open-signup', handleOpenSignup)
      window.removeEventListener('bynx:open-login', handleOpenLogin)
    }
  }, [openSignup, openLogin])

  // ─── Render ──────────────────────────────────────────────────────────

  const value: AuthModalContextValue = {
    openSignup,
    openLogin,
    closeModal,
    isOpen,
  }

  return (
    <AuthModalContext.Provider value={value}>
      {/* URL listener wrapped em Suspense — Next.js 16 exige isso ao redor
          de qualquer hook que force CSR (useSearchParams) em um layout root. */}
      <Suspense fallback={null}>
        <URLAuthListener openSignup={openSignup} openLogin={openLogin} />
      </Suspense>

      {children}

      <AuthModal
        open={isOpen}
        onClose={closeModal}
        initialMode={mode}
        initialPlan={plan}
        next={next}
        oferta={oferta}
      />
    </AuthModalContext.Provider>
  )
}
