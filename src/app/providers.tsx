/**
 * src/app/providers.tsx
 *
 * Wrapper de providers client-side.
 *
 * Envolve a árvore React com:
 * - PostHogProvider: contexto do PostHog client (acesso via `usePostHog()`)
 * - PostHogPageView: dispara $pageview a cada mudança de rota (Suspense necessário)
 *
 * Importante: ESTE arquivo é client-side ('use client'). O `layout.tsx` (server)
 * importa e envolve `{children}` aqui dentro.
 */

'use client'

import { useEffect, Suspense } from 'react'
import { PostHogProvider } from 'posthog-js/react'
import { posthog, initPostHog } from '@/lib/posthog'
import PostHogPageView from './PostHogPageView'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog()
  }, [])

  return (
    <PostHogProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PostHogProvider>
  )
}
