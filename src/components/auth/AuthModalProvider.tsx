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

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Plan = 'free' | 'mensal' | 'anual' | null

interface OpenSignupOpts {
  next?: string | null
  plan?: Plan
}

interface OpenLoginOpts {
  next?: string | null
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

function URLAuthListener({ openSignup, openLogin }: URLAuthListenerProps) {
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!searchParams) return

    const authParam = searchParams.get('auth')
    const nextParam = searchParams.get('next')

    if (authParam !== 'signup' && authParam !== 'login') return

    const validNext = sanitizeNext(nextParam)

    // Limpa os params da URL sem reload (mantém pathname e outros params)
    const cleanUrl = () => {
      const url = new URL(window.location.href)
      url.searchParams.delete('auth')
      url.searchParams.delete('next')
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
        openSignup({ next: validNext })
      } else {
        openLogin({ next: validNext })
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

  // ─── API pública via context ─────────────────────────────────────────

  const openSignup = useCallback((opts: OpenSignupOpts = {}) => {
    setMode('signup')
    setPlan(opts.plan ?? null)
    setNext(sanitizeNext(opts.next ?? null))
    setIsOpen(true)
  }, [])

  const openLogin = useCallback((opts: OpenLoginOpts = {}) => {
    setMode('login')
    setPlan(null)
    setNext(sanitizeNext(opts.next ?? null))
    setIsOpen(true)
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

    function handleOpenSignup() {
      openSignup()
    }
    function handleOpenLogin() {
      openLogin()
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
      />
    </AuthModalContext.Provider>
  )
}
