'use client'

// CTA fixo no rodape do celular. So aparece depois que o CTA do hero sai da
// tela (IntersectionObserver no #sv-hero-cta), some quando o CTA final
// (.sv-final) entra na tela, pra nao repetir o mesmo botao duas vezes, e some
// enquanto o banner de cookies esta aberto, pra um nao cobrir o outro.

import { useEffect, useState } from 'react'
import { STORAGE_KEY, CONSENT_EVENT } from '@/components/ui/CookieBanner'

export default function StickyCta({ href, rotulo }: { href: string; rotulo: string }) {
  const [heroFora, setHeroFora] = useState(false)
  const [finalVisivel, setFinalVisivel] = useState(false)
  const [cookieAberto, setCookieAberto] = useState(true)

  useEffect(() => {
    const alvo = document.getElementById('sv-hero-cta')
    if (!alvo) return
    const io = new IntersectionObserver(([e]) => setHeroFora(!e.isIntersecting && e.boundingClientRect.top < 0))
    io.observe(alvo)
    const fim = document.querySelector('.sv-final')
    const io2 = new IntersectionObserver(([e]) => setFinalVisivel(e.isIntersecting))
    if (fim) io2.observe(fim)
    return () => { io.disconnect(); io2.disconnect() }
  }, [])

  useEffect(() => {
    const ler = () => {
      try {
        const v = localStorage.getItem(STORAGE_KEY)
        setCookieAberto(v !== 'accepted' && v !== 'rejected')
      } catch {
        setCookieAberto(false)
      }
    }
    ler()
    window.addEventListener(CONSENT_EVENT, ler)
    return () => window.removeEventListener(CONSENT_EVENT, ler)
  }, [])

  const visivel = heroFora && !finalVisivel && !cookieAberto
  return (
    <div className={`sv-sticky${visivel ? '' : ' sv-sticky-off'}`} aria-hidden={!visivel}>
      <div className="sv-sticky-in">
        <a className="sv-cta" href={href} tabIndex={visivel ? 0 : -1}>{rotulo}</a>
      </div>
    </div>
  )
}
