'use client'

import { useEffect, useRef } from 'react'

const loadedScripts = new Set<string>()

/**
 * Injeta um <script> externo (embed.js do Instagram/TikTok) so quando o
 * elemento entra perto do viewport, e so uma vez por pagina mesmo com varios
 * blocos da mesma plataforma. `onLoaded` roda toda vez que o wrapper entra em
 * vista (pra reprocessar embeds que a lib so hidrata em elementos existentes
 * no momento em que o script carregou).
 */
export default function LazyEmbedScript({
  src,
  onLoaded,
  children,
  dedupe = true,
}: {
  src: string
  onLoaded: () => void
  children: React.ReactNode
  /**
   * false = injeta um <script> novo a cada bloco, mesmo que o mesmo `src` ja
   * tenha carregado antes. Usar quando a lib nao expoe um jeito confiavel de
   * reprocessar elementos adicionados depois do primeiro load (caso do
   * TikTok — o oEmbed oficial nao documenta um `reprocess()`; o script e leve
   * e idempotente, entao rodar de novo por bloco e o caminho seguro).
   */
  dedupe?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const load = () => {
      if (dedupe && loadedScripts.has(src)) {
        onLoaded()
        return
      }
      loadedScripts.add(src)
      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.onload = onLoaded
      document.body.appendChild(script)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          load()
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, dedupe])

  return <div ref={ref}>{children}</div>
}
