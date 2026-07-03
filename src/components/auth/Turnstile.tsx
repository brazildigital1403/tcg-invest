'use client'

import { useEffect, useRef } from 'react'

// Site key publica do Cloudflare Turnstile (pode ficar no client).
const SITE_KEY = '0x4AAAAAADuy6Ts7PxsndHlW'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let _loaded = false
let _loading = false
const _cbs: (() => void)[] = []

function loadTurnstile(cb: () => void) {
  if (typeof window === 'undefined') return
  if (_loaded && (window as any).turnstile) { cb(); return }
  _cbs.push(cb)
  if (_loading) return
  _loading = true
  const s = document.createElement('script')
  s.src = SCRIPT_SRC
  s.async = true
  s.defer = true
  s.onload = () => { _loaded = true; _cbs.splice(0).forEach((f) => f()) }
  document.head.appendChild(s)
}

/**
 * Widget invisivel/gerenciado do Turnstile.
 * - onToken(token|null): recebe o token (single-use) ou null em erro/expiracao.
 * - resetKey: mudar esse valor forca um reset (novo token) — use apos cada tentativa de auth.
 */
export default function Turnstile({
  onToken,
  resetKey = 0,
}: {
  onToken: (token: string | null) => void
  resetKey?: number
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetId = useRef<string | null>(null)

  // Render inicial
  useEffect(() => {
    let cancelled = false
    loadTurnstile(() => {
      const t = (window as any).turnstile
      if (cancelled || !containerRef.current || !t || widgetId.current) return
      try {
        widgetId.current = t.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme: 'dark',
          callback: (token: string) => onToken(token),
          'error-callback': () => onToken(null),
          'expired-callback': () => onToken(null),
        })
      } catch { /* noop */ }
    })
    return () => {
      cancelled = true
      const t = (window as any).turnstile
      try { if (widgetId.current && t) t.remove(widgetId.current) } catch {}
      widgetId.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset quando resetKey muda (token e single-use)
  useEffect(() => {
    if (resetKey === 0) return
    const t = (window as any).turnstile
    try { if (widgetId.current && t) t.reset(widgetId.current) } catch {}
    onToken(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  return <div ref={containerRef} style={{ display: 'flex', justifyContent: 'center', margin: '2px 0' }} />
}
