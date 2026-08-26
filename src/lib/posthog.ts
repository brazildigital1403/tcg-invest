/**
 * src/lib/posthog.ts
 *
 * Cliente PostHog (browser) — LGPD-friendly.
 *
 * Decisões de privacidade (S39):
 *
 * - `opt_out_capturing_by_default: true` → PostHog inicia SEM capturar nada.
 *   Compatível com o CookieBanner LGPD existente (que gateia GTM via
 *   localStorage `bynx_cookie_consent`).
 *
 * - No `loaded` callback, lemos o mesmo localStorage (`bynx_cookie_consent`).
 *   Se valor for 'accepted', fazemos `opt_in_capturing()`. Senão, mantém
 *   silencioso.
 *
 * - **Pendência S39+**: o `CookieBanner.tsx` precisa de update pra também
 *   chamar `posthog.opt_in_capturing()` quando user clica "Aceitar todos"
 *   SEM exigir reload (UX melhor). Por enquanto: aceitar + reload =
 *   PostHog ativa.
 *
 * - `person_profiles: 'identified_only'` → só cria perfil quando user faz
 *   login. Visitantes anônimos NÃO geram perfis (economiza event budget
 *   + ajuda LGPD).
 *
 * - `capture_pageview: false` → DESABILITAMOS o auto-capture do PostHog.
 *   Por quê: estávamos disparando $pageview DUPLICADO (auto-capture +
 *   nosso componente manual `PostHogPageView.tsx`). Pra Next.js App Router
 *   a recomendação oficial do PostHog é DESLIGAR o auto-capture e usar
 *   o componente manual que escuta `usePathname()` + `useSearchParams()`.
 *
 * - `session_recording.maskAllInputs: true` → mascara TODOS inputs por
 *   padrão. Use `data-ph-mask` no elemento pra mascarar texto extra.
 *
 * - Roteamento via `/ingest` → bypassa adblockers (rewrite em next.config.ts).
 */

import posthog from 'posthog-js'

let initialized = false

export function initPostHog() {
  if (typeof window === 'undefined') return null
  if (initialized) return posthog

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) {
    console.warn('[PostHog] NEXT_PUBLIC_POSTHOG_KEY não definida')
    return null
  }

  posthog.init(key, {
    api_host: '/ingest',
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',

    defaults: '2026-01-30',

    person_profiles: 'identified_only',

    // Auto-capture DESLIGADO. Quem dispara $pageview é o componente
    // manual `src/app/PostHogPageView.tsx`, que escuta mudanças de
    // rota do App Router (Next.js 15+). Sem isso, $pageview seria
    // disparado em dobro.
    capture_pageview: false,
    capture_pageleave: true,

    // ─── Web Vitals (LCP, CLS, FCP, INP) ────────────────────────────────
    //
    // Ate 27/07/2026 nao havia NENHUMA coleta: dava pra medir a home na mao,
    // mas nao dava pra saber como esta na mao do usuario — que e quem importa,
    // ainda mais com publico majoritariamente mobile em 4G.
    //
    // Usa o PostHog que ja esta pago e instalado, em vez de somar
    // @vercel/speed-insights: uma dependencia a menos, custo zero a mais, e
    // herda de graca o gate de consentimento LGPD logo abaixo — quem nao
    // aceitou cookie nao e medido, que e o comportamento correto.
    //
    // `network_timing` fica DESLIGADO de proposito: ele grava o waterfall
    // inteiro de cada request, o que engorda o payload sem responder a
    // pergunta que interessa aqui (o site esta rapido pro usuario?).
    capture_performance: {
      web_vitals: true,
      network_timing: false,
    },

    // LGPD: não captura por padrão até user dar consent via CookieBanner.
    opt_out_capturing_by_default: true,

    session_recording: {
      maskAllInputs: true,
      maskInputOptions: {
        password: true,
        email: true,
      },
      maskTextSelector: '[data-ph-mask]',
    },

    loaded: (ph) => {
      // Lê consent do localStorage (mesmo gate usado pelo GTM).
      // Se user aceitou, ativa capture — exceto tráfego interno (#76):
      // navegador que já abriu o admin nunca entra nas métricas.
      try {
        if (
          window.localStorage.getItem('bynx_trafego_interno') !== '1' &&
          window.localStorage.getItem('bynx_cookie_consent') === 'accepted'
        ) {
          ph.opt_in_capturing()
        }
      } catch {
        // localStorage indisponível (modo privado, navegação restrita)
        // → mantém opt-out (sem captura), o que é o comportamento LGPD esperado.
      }

      if (process.env.NODE_ENV === 'development') {
        ph.debug()
      }
    },
  })

  initialized = true
  return posthog
}

export { posthog }
