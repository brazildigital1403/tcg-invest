/**
 * src/lib/posthog-server.ts
 *
 * Cliente PostHog server-side (Node.js).
 *
 * Use em:
 * - API routes (`src/app/api/.../route.ts`)
 * - Server Actions
 * - Server Components que precisam capturar eventos
 *
 * IMPORTANTE: server-side capture é por-request. Sempre chame `shutdown()`
 * no fim da request OU use `flushAt: 1` + `flushInterval: 0` pra flush
 * imediato (já configurado aqui).
 *
 * Exemplo de uso:
 *
 *   import { getPostHogServer } from '@/lib/posthog-server'
 *
 *   export async function POST(req: Request) {
 *     const posthog = getPostHogServer()
 *     posthog.capture({
 *       distinctId: userId,
 *       event: 'webhook_received',
 *       properties: { provider: 'stripe' },
 *     })
 *     await posthog.shutdown() // flush antes de retornar
 *     return Response.json({ ok: true })
 *   }
 */

import { PostHog } from 'posthog-node'

let posthogServerClient: PostHog | null = null

export function getPostHogServer(): PostHog {
  if (!posthogServerClient) {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) {
      throw new Error('[PostHog Server] NEXT_PUBLIC_POSTHOG_KEY não definida')
    }

    posthogServerClient = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      // Flush imediato — server-side não pode bufferizar entre requests
      flushAt: 1,
      flushInterval: 0,
    })
  }

  return posthogServerClient
}
