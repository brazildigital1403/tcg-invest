/**
 * Analytics — Helper centralizado de tracking.
 *
 * Bynx tem 2 stacks de analytics que COEXISTEM:
 *
 * 1. GTM / GA4 (legado) — eventos de marketing/funil
 *    Funções: trackFirstCardAdded, trackProUpgradeInitiated,
 *             trackProUpgradeCompleted, trackLojaClique
 *    Mecanismo: window.dataLayer.push (SSR-safe, fail-safe)
 *
 * 2. PostHog + Sentry (S39) — product analytics + error tracking
 *    Funções: track(), identifyUser(), resetUser(), setUserProperties()
 *    Mecanismo: posthog-js (PostHog) + @sentry/nextjs (Sentry)
 *
 * AMBOS coexistem propositalmente:
 * - GTM/GA4 alimentam Google Ads, Tag Manager, audiências
 * - PostHog/Sentry alimentam funil, retention, replays e error tracking
 *
 * Notas comuns:
 * - SSR-safe: TODAS as funções checam typeof window !== 'undefined'
 * - Falhas silenciosas: tracking nunca pode quebrar a UX
 * - Eventos GTM batem com parâmetros já criados no container Bynx
 *   (ep.signup_completed, ep.first_card_added, ep.pro_upgrade_initiated,
 *   ep.pro_upgrade_completed, ep.loja_clique).
 *
 * Este arquivo NÃO usa 'use client' diretamente — pode ser importado
 * tanto em Server Components quanto em Client Components. Em SSR as
 * funções viram no-op silenciosamente.
 */

import * as Sentry from '@sentry/nextjs'
import { posthog } from './posthog'

// ═══════════════════════════════════════════════════════════════
// PARTE 1: GTM / GA4 (LEGADO — preservado intacto)
// ═══════════════════════════════════════════════════════════════

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[]
  }
}

type EventName =
  | 'sign_up'
  | 'signup_completed'
  | 'first_card_added'
  | 'pro_upgrade_initiated'
  | 'pro_upgrade_completed'
  | 'loja_clique'

// ─── Push genérico (fail-safe, SSR-safe) ────────────────────────────────────

function push(event: EventName, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return
  try {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event, ...params })
  } catch {
    // Tracking nunca quebra UX — silent fail
  }
}

// ─── Eventos públicos GTM/GA4 ───────────────────────────────────────────────

/**
 * Cadastro concluido — o evento de AQUISICAO.
 *
 * Nao confundir com o `signup_completed` logo abaixo, que dispara na PRIMEIRA
 * CARTA e mede onboarding, nao aquisicao. Ate 28/07/2026 esse proxy era a
 * unica coisa parecida com um evento de cadastro, o que impedia montar o funil
 * clique -> conta criada.
 *
 * Leva a atribuicao junto pra dar pra segmentar o funil por canal direto no
 * GA4 e no PostHog.
 *
 * RESSALVA: o PostHog so captura depois do aceite de cookie e o GTM so e
 * injetado depois do aceite. Entao este evento NAO ve todo mundo — quem
 * ve todo mundo e a coluna `signup_utm_source` em `users`, que e a fonte da
 * verdade. Este aqui serve pro funil, nao pra contagem.
 */
export function trackSignUp(params: {
  metodo?: string
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
}): void {
  const p = {
    method: params.metodo || 'email',
    utm_source: params.utm_source || undefined,
    utm_medium: params.utm_medium || undefined,
    utm_campaign: params.utm_campaign || undefined,
  }
  push('sign_up', p)
  try {
    posthog?.capture('signup', p)
  } catch {
    // Silent fail — tracking nunca quebra cadastro.
  }
}

/**
 * Dispara quando um user adiciona a PRIMEIRA carta na coleção.
 * Usa flag em localStorage pra garantir disparo único por user/browser.
 *
 * Edge case: se o user limpar localStorage, pode disparar de novo.
 * Pra GA4 isso é tolerável (apenas adiciona ~1 evento extra raríssimo).
 */
export function trackFirstCardAdded(userId: string): void {
  if (typeof window === 'undefined') return
  try {
    const flagKey = `bynx_first_card_${userId}`
    if (localStorage.getItem(flagKey)) return // já disparou pra esse user
    localStorage.setItem(flagKey, '1')
    push('first_card_added', { user_id: userId })
    push('signup_completed', { user_id: userId }) // proxy: 1ª carta = onboarding completo
  } catch {
    // Silent fail
  }
}

/**
 * Dispara quando user clica em "Assinar Pro" — antes do redirect pro Stripe.
 */
export function trackProUpgradeInitiated(plano: 'mensal' | 'anual'): void {
  push('pro_upgrade_initiated', { plano })
}

/**
 * Dispara na página /pro-ativado, no mount.
 * Webhook é server-side — não dá pra disparar dataLayer dele.
 */
export function trackProUpgradeCompleted(plano: 'mensal' | 'anual'): void {
  push('pro_upgrade_completed', { plano })
}

/**
 * Dispara quando user clica num link rastreado de uma loja
 * (whatsapp, instagram, facebook, website, maps).
 */
export function trackLojaClique(lojaId: string, tipo: string): void {
  push('loja_clique', { loja_id: lojaId, tipo })
}

// ═══════════════════════════════════════════════════════════════
// PARTE 2: PostHog + Sentry (S39 — Product Analytics & Errors)
// ═══════════════════════════════════════════════════════════════

/**
 * Catálogo de eventos da Bynx pro PostHog.
 *
 * Discriminated union: TypeScript valida que `properties` bate com `name`.
 * Pra adicionar evento novo, expanda este type e use track({ name, properties }).
 */
export type BynxEvent =
  // Auth (3)
  | {
      name: 'user_signed_up'
      properties: {
        method: 'email' | 'google' | 'oauth'
        oauth_provider?: string
      }
    }
  | {
      name: 'user_logged_in'
      properties: { method: 'email' | 'google' | 'oauth' }
    }
  | { name: 'user_logged_out'; properties: Record<string, never> }

  // Coleção (4)
  | {
      name: 'card_added_to_collection'
      properties: {
        card_id: string
        set_id: string
        quantity: number
        condition?: string
        value_brl?: number
      }
    }
  | {
      name: 'card_removed_from_collection'
      properties: { card_id: string; set_id: string }
    }
  | {
      name: 'card_quantity_updated'
      properties: { card_id: string; from_qty: number; to_qty: number }
    }
  | {
      name: 'collection_value_viewed'
      properties: { total_cards: number; total_value_brl: number }
    }

  // Scanner (3)
  | { name: 'scanner_opened'; properties: Record<string, never> }
  | {
      name: 'card_scanned'
      properties: { card_id?: string; confidence?: number; success: boolean }
    }
  | { name: 'scanner_failed'; properties: { error_reason: string } }

  // Discovery (4)
  | {
      name: 'card_detail_viewed'
      properties: { card_id: string; set_id: string; price_brl?: number }
    }
  | {
      name: 'set_detail_viewed'
      properties: { set_id: string; total_cards: number }
    }
  | {
      name: 'pokedex_searched'
      properties: { query: string; results_count: number }
    }
  | { name: 'search_no_results'; properties: { query: string } }

  // Comparador de troca (2)
  | {
      /**
       * Disparado quando o veredito aparece -- os DOIS lados montados. Nao no
       * clique de adicionar carta: montar meia troca e abandonar nao e uso, e
       * contar isso inflaria a metrica com quem so passou os olhos.
       *
       * `sem_preco` sai junto de proposito: e o unico jeito de medir quanto do
       * uso real esbarra nas 17,9% de cartas sem preco BRL. Sem essa
       * propriedade, "as pessoas usam" e "as pessoas conseguem uma resposta"
       * viram a mesma coisa no painel.
       */
      name: 'trade_compared'
      properties: {
        cartas_lado_a: number
        cartas_lado_b: number
        total_a: number
        total_b: number
        veredito: 'equilibrada' | 'desequilibrada' | 'muito_desequilibrada' | 'sem_preco'
        sem_preco: number
        origem: 'comparador' | 'chat'
      }
    }
  | {
      name: 'trade_published'
      properties: { veredito: string; anonimo: boolean }
    }

  // Lojas (4)
  | { name: 'store_signup_started'; properties: Record<string, never> }
  | { name: 'store_signup_completed'; properties: { plan: string } }
  | { name: 'store_visited'; properties: { store_id: string } }
  | {
      name: 'marketplace_listing_clicked'
      properties: { listing_id: string; price_brl: number }
    }

  // Monetização (4)
  | { name: 'pricing_viewed'; properties: { source?: string } }
  | {
      name: 'plan_upgrade_started'
      properties: { from_plan: string; to_plan: string }
    }
  | {
      name: 'plan_upgrade_completed'
      properties: { plan: string; mrr_brl: number }
    }
  | { name: 'checkout_abandoned'; properties: { step: string } }

/**
 * Captura um evento custom da Bynx no PostHog.
 *
 * Type-safe: nome + propriedades validados em tempo de compilação.
 *
 * Exemplo:
 *   track({ name: 'card_added_to_collection',
 *           properties: { card_id: 'sv4-122', set_id: 'sv4', quantity: 1 } })
 */
export function track<T extends BynxEvent>(event: T): void {
  if (typeof window === 'undefined') return
  posthog?.capture(event.name, event.properties as Record<string, unknown>)
}

/**
 * Identifica o user logado. Chamar UMA vez quando user faz login/signup.
 *
 * Sentry também recebe o user pra erros virem associados ao perfil.
 *
 * @param userId - ID do user no Supabase (UUID)
 * @param properties - email, name, plan etc. para perfilar
 */
export function identifyUser(
  userId: string,
  properties: {
    email?: string
    name?: string
    plan?: string
    created_at?: string
    [key: string]: unknown
  },
): void {
  if (typeof window === 'undefined') return

  // PostHog: cria/atualiza perfil
  posthog?.identify(userId, properties)

  // Sentry: associa erros futuros ao user
  Sentry.setUser({
    id: userId,
    email: properties.email,
    username: properties.name,
  })
}

/**
 * Reseta o user identificado (chamar no logout).
 *
 * - PostHog: descontinua o perfil (próximos eventos serão anônimos)
 * - Sentry: remove user context
 */
export function resetUser(): void {
  if (typeof window === 'undefined') return

  posthog?.reset()
  Sentry.setUser(null)
}

/**
 * Atualiza propriedades de uma pessoa SEM disparar evento.
 *
 * Útil pra atualizar plan, MRR etc. após upgrade.
 */
export function setUserProperties(properties: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  posthog?.setPersonProperties(properties)
}
