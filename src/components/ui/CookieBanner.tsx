'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { IconShield } from '@/components/ui/Icons'
import { posthog } from '@/lib/posthog'

// ─── Storage key (compartilhada com o gate do GTM em src/app/layout.tsx) ─────

export const STORAGE_KEY = 'bynx_cookie_consent'

// Evento disparado ao aceitar/rejeitar -- 'storage' so avisa OUTRAS abas, nao
// a propria pagina que fez a mudanca. Paginas com elemento fixo proprio (ex.
// LandingLendarias.tsx, sticky de CTA) escutam isso pra saber a hora exata
// de voltar a aparecer, sem precisar dar reload (achado de auditoria
// 05/08/2026: o banner ficava por cima da CTA principal pra todo visitante
// novo -- justo o trafego pago que a landing existe pra converter).
export const CONSENT_EVENT = 'bynx-cookie-consent-changed'

// ─── Componente ───────────────────────────────────────────────────────────────
//
// Soft banner LGPD no rodapé. Aparece apenas quando o usuário NÃO escolheu
// nenhuma opção ainda (localStorage vazio).
//
// Consent Mode v2: o GTM (src/app/layout.tsx) já carrega sempre, com
// 'consent default' denied. Aqui só avisamos o Google do 'consent update'
// via window.gtag — sem reload de página, os tags liberados disparam na hora.
//
// • "Aceitar todos"      → grava 'accepted' + consent update granted
// • "Apenas essenciais"  → grava 'rejected' + consent update denied (explícito)

// ★ PostHog na hora do clique (#133, 13/09/2026). O `loaded` do posthog.ts so
// le o consentimento quando o PostHog inicia -- e isso acontece ANTES de a
// pessoa clicar. Sem esta chamada, quem aceitava so era medido a partir do
// proximo carregamento: a sessao inteira em que ela aceitou se perdia. Mesma
// regra do `loaded`: navegador de trafego interno (#76) nunca entra.
function pushPostHogConsent(granted: boolean) {
  try {
    if (!posthog.__loaded) return
    if (granted && localStorage.getItem('bynx_trafego_interno') !== '1') posthog.opt_in_capturing()
    if (!granted) posthog.opt_out_capturing()
  } catch {
    // PostHog bloqueado ou localStorage indisponivel -- fica sem captura, que e o seguro
  }
}

function pushConsentUpdate(granted: boolean) {
  try {
    const status = granted ? 'granted' : 'denied'
    ;(window as any).gtag?.('consent', 'update', {
      ad_storage: status,
      analytics_storage: status,
      ad_user_data: status,
      ad_personalization: status,
    })
  } catch {
    // gtag indisponivel (bloqueador de script, etc) — nao quebra o banner
  }
}

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
      /* ignora — só esconde o banner */
    }
    pushConsentUpdate(true)
    pushPostHogConsent(true)
    setVisible(false)
    window.dispatchEvent(new Event(CONSENT_EVENT))
  }

  function rejectAll() {
    try {
      localStorage.setItem(STORAGE_KEY, 'rejected')
    } catch {
      /* ignora — só esconde o banner */
    }
    pushConsentUpdate(false)
    pushPostHogConsent(false)
    setVisible(false)
    window.dispatchEvent(new Event(CONSENT_EVENT))
  }

  // Não renderiza no SSR pra evitar hydration mismatch (localStorage é client-only)
  if (!mounted || !visible) return null

  return (
    <div style={S.wrapper} role="dialog" aria-live="polite" aria-label="Aviso de cookies">
      {/* ★ Compacto (08/10/2026): o banner tinha 156 px e cobria a caixa de
          preco da pagina da carta em 375x812 para todo visitante novo. Agora e
          uma linha (~76 px), sem icone no celular, com os dois botoes em 44 px.
          Mesma logica de consentimento; so o tamanho mudou. */}
      <div style={S.banner}>
        <div style={S.content}>
          <div className="bx-ck-ico" style={S.iconBox} aria-hidden="true"><IconShield size={18} /></div>
          <div style={S.textBox}>
            <p style={S.title}>Cookies e privacidade</p>
            <p style={S.text}>
              Usamos cookies para medir o site.{' '}
              {/*
                ★ `prefetch={false}` (10/09/2026). Este banner aparece pra todo
                visitante que ainda nao decidiu sobre cookie, ou seja, quase
                todo carregamento de pagina publica — e o `<Link>` prefetchava
                /privacidade junto. Nos logs de 09/09: 12.180 requests em
                /privacidade em 24h, contra 11.299 pageviews da home. Era 1
                request de politica de privacidade por visita ao site, e
                praticamente ninguem clica em "Saiba mais".
              */}
              <Link href="/privacidade" prefetch={false} style={S.link}>
                Saiba mais
              </Link>
              .
            </p>
          </div>
        </div>
        <div style={S.btnRow}>
          <button type="button" style={S.btnSecondary} onClick={rejectAll}>
            Só essenciais
          </button>
          <button type="button" style={S.btnPrimary} onClick={acceptAll}>
            Aceitar
          </button>
        </div>
      </div>
      <style>{`@media (max-width: 480px){ .bx-ck-ico{ display:none !important } }`}</style>
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
    padding: '0 10px 10px 10px',
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
    borderRadius: 14,
    padding: '10px 12px',
    boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    color: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: '1 1 auto',
    minWidth: 0,
  },
  iconBox: {
    flexShrink: 0,
    lineHeight: 1,
    color: 'rgba(255,255,255,0.6)',
  },
  textBox: {
    minWidth: 0,
    flex: 1,
  },
  title: {
    fontSize: 12.5,
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.01em',
  },
  text: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.35,
    margin: 0,
  },
  link: {
    color: '#f59e0b',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
  btnRow: {
    display: 'flex',
    gap: 6,
    flexShrink: 0,
  },
  btnSecondary: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.7)',
    minHeight: 44,
    padding: '0 12px',
    borderRadius: 10,
    fontSize: 12.5,
    cursor: 'pointer',
    fontWeight: 500,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    border: 'none',
    color: '#000',
    minHeight: 44,
    padding: '0 14px',
    borderRadius: 10,
    fontSize: 12.5,
    cursor: 'pointer',
    fontWeight: 700,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
  },
}
