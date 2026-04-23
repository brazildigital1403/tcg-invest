'use client'

import { useEffect, useState, CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/**
 * Header público reusável para páginas públicas do Bynx que NÃO são a landing.
 * Ex: /lojas, /lojas/[slug], /termos, /privacidade (se quiserem unificar no futuro).
 *
 * A landing tem seu próprio header inline porque depende de refs de scroll específicos.
 */
export default function PublicHeader() {
  const router = useRouter()
  const [logado, setLogado] = useState<boolean | null>(null)

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

  return (
    <header style={S.header}>
      <div style={S.inner}>
        {/* Logo — clicável, volta pra landing */}
        <Link href="/" style={S.logoLink}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_BYNX.png" alt="Bynx" style={S.logo} />
        </Link>

        {/* CTA à direita */}
        <div style={S.actions}>
          {logado === null ? (
            // Placeholder sutil enquanto verifica auth — evita flash
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
              onClick={() => router.push('/login')}
              style={S.ctaPrimary}
            >
              Entrar
            </button>
          )}
        </div>
      </div>
    </header>
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
  },
  logoLink: {
    display: 'flex',
    alignItems: 'center',
    textDecoration: 'none',
  },
  logo: {
    height: 34,
    width: 'auto',
    objectFit: 'contain',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
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
    width: 80,
    height: 36,
  },
}