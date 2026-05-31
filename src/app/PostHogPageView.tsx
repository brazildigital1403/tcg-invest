/**
 * src/app/PostHogPageView.tsx
 *
 * Captura $pageview a cada mudança de rota.
 *
 * Por que precisa: no Next.js App Router (Next.js 13+), navegação SPA
 * não dispara eventos nativos do PostHog. Esse componente escuta o
 * pathname + searchParams e captura $pageview manualmente.
 *
 * ⚠️ DEVE estar dentro de <Suspense> porque `useSearchParams` força
 * client-rendering. Sem Suspense, toda a árvore vira CSR.
 *
 * Renderiza null — invisível pro user, só executa o useEffect.
 */

'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { posthog } from '@/lib/posthog'

export default function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname || !posthog) return

    let url = window.origin + pathname
    const search = searchParams?.toString()
    if (search) {
      url = `${url}?${search}`
    }

    posthog.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams])

  return null
}
