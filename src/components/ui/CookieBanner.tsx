'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─── Storage key (compartilhada com o gate do GTM em src/app/layout.tsx) ─────

const STORAGE_KEY = 'bynx_cookie_consent'

// ─── Componente ───────────────────────────────────────────────────────────────
//
// Soft banner LGPD no rodapé. Aparece apenas quando o usuário NÃO escolheu
// nenhuma opção ainda (localStorage vazio).
//
// • "Aceitar todos"      → grava 'accepted' + window.location.reload() pra ativar GTM
// • "Apenas essenciais"  → grava 'rejected' + esconde banner sem reload
//
// O GTM é carregado em src/app/layout.tsx dentro de um <Script> com checagem
// `localStorage.getItem('bynx_cookie_consent') === 'accepted'`. Por isso o
// reload é necessário no aceite — ele faz o GTM (que estava bloqueado no carregamento
// anterior) finalmente disparar.

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const consent = localStorage.getItem(STORAGE_KEY)
      // Se já aceitou OU já rejeitou, não mostra de novo
      if (consent !== 'accepted' && consent !== 'rejected') {
        setVisible(true)
      }
    } catch {
      // localStorage indisponível (modo restrito do browser) — assume sem consent
      setVisible(true)
    }
  }, [])

  function acceptAll() {
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted')
    } catch {
      // Sem localStorage → reload não vai persistir, então só fecha banner
      setVisible(false)
      return
    }
    // Reload pra ativar GTM (que checa o localStorage no início do <Script>)
    window.location.reload()
  }

  function rejectAll() {
    try {
      localStorage.setItem(STORAGE_KEY, 'rejected')
    } catch {
      /* ignora — só esconde o banner */
    }
    setVisible(false)
  }

  // Não renderiza no SSR pra evitar hydration mismatch (localStorage é client-only)
  if (!mounted || !visible) return null

  return (
    <div style={S.wrapper} role="dialog" aria-live="polite" aria-label="Aviso de cookies">
      <div style={S.banner}>
        <div style={S.content}>
          <div style={S.iconBox} aria-hidden="true">🍪</div>
          <div style={S.textBox}>
            <p style={S.title}>Cookies e privacidade</p>
            <p style={S.text}>
              A Bynx usa cookies essenciais pro site funcionar e cookies analíticos (Google Analytics 4) pra entender como você usa a plataforma.{' '}
              <Link href="/privacidade" style={S.link}>
                Saiba mais
              </Link>
              .
            </p>
          </div>
        </div>
        <div style={S.btnRow}>
          <button type="button" style={S.btnSecondary} onClick={rejectAll}>
            Apenas essenciais
          </button>
          <button type="button" style={S.btnPrimary} onClick={acceptAll}>
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Estilos (alinhados com a paleta do useAppModal — DM Sans, #0f1117) ─────

const S = {
  wrapper: {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9998,
    padding: '0 16px 16px 16px',
    pointerEvents: 'none' as const,
  },
  banner: {
    pointerEvents: 'auto' as const,
    maxWidth: 1100,
    margin: '0 auto',
    background: 'rgba(15,17,23,0.96)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: '16px 20px',
    boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    color: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between',
  },
  content: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    flex: '1 1 380px',
    minWidth: 0,
  },
  iconBox: {
    fontSize: 24,
    flexShrink: 0,
    lineHeight: 1,
    paddingTop: 2,
  },
  textBox: {
    minWidth: 0,
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    margin: 0,
    marginBottom: 4,
    letterSpacing: '-0.01em',
  },
  text: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.5,
    margin: 0,
  },
  link: {
    color: '#f59e0b',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
  btnRow: {
    display: 'flex',
    gap: 8,
    flexShrink: 0,
    flexWrap: 'wrap' as const,
  },
  btnSecondary: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.7)',
    padding: '10px 18px',
    borderRadius: 10,
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 500,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    border: 'none',
    color: '#000',
    padding: '10px 22px',
    borderRadius: 10,
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 700,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
  },
}
