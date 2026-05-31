/**
 * src/lib/analytics.ts
 *
 * Wrapper unificado de analytics (PostHog + Sentry).
 *
 * Por quê:
 * - **Type-safety**: eventos definidos como discriminated union, autocompletar
 *   no editor pra nome do evento + propriedades obrigatórias.
 * - **Single source of truth**: lista oficial de eventos do Bynx aqui.
 *   Adicionar evento? Adiciona aqui primeiro. Não tem `track("any_string")`.
 * - **Sentry integration**: identifyUser também seta usuário no Sentry pra
 *   stack traces virem com email/id do user.
 *
 * Uso:
 *
 *   import { track, identifyUser, resetUser } from '@/lib/analytics'
 *
 *   // Após signup:
 *   identifyUser(user.id, { email: user.email, plan: 'free' })
 *   track({ name: 'user_signed_up', properties: { method: 'email' } })
 *
 *   // Add à coleção:
 *   track({
 *     name: 'card_added_to_collection',
 *     properties: { card_id: 'sv4-122', set_id: 'sv4', quantity: 1, value_brl: 0.88 }
 *   })
 *
 *   // Logout:
 *   resetUser()
 */

'use client'

import * as Sentry from '@sentry/nextjs'
import { posthog } from './posthog'

// ─── Eventos do Bynx (22 eventos chave) ────────────────────────────────────

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

// ─── Funções públicas ──────────────────────────────────────────────────────

/**
 * Captura um evento custom do Bynx.
 * Type-safe: nome + propriedades validados em tempo de compilação.
 */
export function track<T extends BynxEvent>(event: T): void {
  if (typeof window === 'undefined') return
  // posthog-js aceita Record<string, any> nas propriedades; nosso union é o que tipa
  posthog?.capture(event.name, event.properties as Record<string, unknown>)
}

/**
 * Identifica o user logado. Chamar UMA vez quando user faz login/signup.
 *
 * Sentry também recebe o user pra erros virem associados.
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
 * Helper opcional pra atualizar propriedades de uma pessoa SEM disparar evento.
 *
 * Útil pra atualizar plan, MRR etc. após upgrade.
 */
export function setUserProperties(properties: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  posthog?.setPersonProperties(properties)
}
