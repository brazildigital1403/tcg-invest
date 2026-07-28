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
import { capturarAtribuicao } from '@/lib/atribuicao'

export default function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return

    // ─── Atribuicao ───────────────────────────────────────────────────────
    //
    // Roda ANTES do posthog e FORA de qualquer gate de consentimento, de
    // proposito. Este componente monta sempre; quem vira no-op sem consent e
    // o `posthog.capture` la embaixo. Foi exatamente essa diferenca que
    // permitiu resolver o buraco de atribuicao: a origem fica guardada em
    // localStorage nosso, nao vai pra terceiro nenhum, e e lida so na hora do
    // cadastro pra gravar na linha do proprio usuario.
    //
    // Mora aqui, apesar do nome do arquivo, porque este ja e o unico ponto do
    // app que escuta mudanca de rota com Suspense montado. Um componente
    // separado exigiria um segundo boundary de useSearchParams por nada.
    capturarAtribuicao()

    if (!posthog) return

    let url = window.origin + pathname
    const search = searchParams?.toString()
    if (search) {
      url = `${url}?${search}`
    }

    posthog.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams])

  return null
}
