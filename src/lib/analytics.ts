/**
 * Analytics — Helper centralizado pra disparar eventos custom no GTM/GA4.
 *
 * Uso:
 *   import { trackProUpgradeInitiated } from '@/lib/analytics'
 *   trackProUpgradeInitiated('mensal')
 *
 * Notas:
 * - SSR-safe: checa typeof window !== 'undefined'
 * - Falhas silenciosas: tracking nunca pode quebrar a UX
 * - Eventos batem com os parâmetros já criados no GTM (ep.signup_completed,
 *   ep.first_card_added, ep.pro_upgrade_initiated, ep.pro_upgrade_completed,
 *   ep.loja_clique).
 *
 * GA4 padrão: nomes em snake_case, parâmetros lean (sem categoria/label do GA3).
 */

// ─── Tipos ──────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[]
  }
}

type EventName =
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

// ─── Eventos públicos ───────────────────────────────────────────────────────

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
