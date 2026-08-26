/**
 * src/lib/trafego-interno.ts
 *
 * Marca este NAVEGADOR como tráfego interno (dono/admin) pra ele sair
 * das métricas — item #76 do quadro.
 *
 * Por que por navegador e não por IP: o cookie do admin é httpOnly (o
 * client não lê), e IP residencial muda. A flag é gravada em localStorage
 * na primeira vez que uma sessão de admin é confirmada (fetch de
 * /api/admin/counts respondendo ok no AdminLayout) e vale pra sempre
 * naquele navegador — inclusive quando o admin navega no site público.
 *
 * Efeitos:
 * - PostHog: opt_out imediato + o gate em posthog.ts nunca mais opta in.
 * - GA4 (via GTM): o bootstrap do GTM em src/app/layout.tsx empurra
 *   `traffic_type: 'internal'` no dataLayer ANTES do gtm.js carregar.
 *   Depende de config no painel (variável de dataLayer no GTM + filtro
 *   de dados "Internal Traffic" no GA4) — passo do Du, fora do repo.
 */

import { posthog } from '@/lib/posthog'

const KEY = 'bynx_trafego_interno'

export function isTrafegoInterno(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function marcarTrafegoInterno(): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(KEY, '1') } catch {}
  // Desliga o PostHog já nesta sessão, sem esperar reload.
  try { posthog?.opt_out_capturing() } catch {}
  // Sinaliza pro GTM/GA4 nesta sessão também (as próximas já nascem
  // com o push no bootstrap do layout).
  try {
    ;(window as unknown as { dataLayer?: unknown[] }).dataLayer?.push({ traffic_type: 'internal' })
  } catch {}
}
