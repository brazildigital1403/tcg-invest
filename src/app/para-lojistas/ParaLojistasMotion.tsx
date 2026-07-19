'use client'

import { useEffect } from 'react'

/**
 * Motion progressivo da /para-lojistas:
 *  - reveal on-scroll (.reveal -> .in)
 *  - count-up dos numeros (.m-val[data-target])
 *
 * Enhancement puro: o conteudo ja vem no HTML do servidor (SEO/GEO). Sem JS,
 * o <noscript> na page deixa tudo visivel. Com prefers-reduced-motion, mostra
 * tudo de uma vez sem animar.
 */
export default function ParaLojistasMotion() {
  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const fmtMil = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)} mil` : `${n}`)
    const setFinal = (el: HTMLElement) => {
      const target = Number(el.dataset.target || '0')
      const suf = el.dataset.suffix || ''
      el.textContent = (target >= 1000 ? fmtMil(target) : target.toLocaleString('pt-BR')) + suf
    }

    if (reduce) {
      document.querySelectorAll('.pl-root .reveal').forEach(el => el.classList.add('in'))
      document.querySelectorAll<HTMLElement>('.pl-root .m-val[data-target]').forEach(setFinal)
      return
    }

    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    document.querySelectorAll('.pl-root .reveal').forEach(el => io.observe(el))

    const countUp = (el: HTMLElement) => {
      const target = Number(el.dataset.target || '0')
      const suf = el.dataset.suffix || ''
      const big = target >= 1000
      const dur = 1100
      const t0 = performance.now()
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / dur)
        const v = Math.round(target * (1 - Math.pow(1 - p, 3)))
        el.textContent = (big ? fmtMil(v) : v.toLocaleString('pt-BR')) + (p === 1 ? suf : '')
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
    const mio = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { countUp(e.target as HTMLElement); mio.unobserve(e.target) }
      }),
      { threshold: 0.5 },
    )
    document.querySelectorAll<HTMLElement>('.pl-root .m-val[data-target]').forEach(el => mio.observe(el))

    return () => { io.disconnect(); mio.disconnect() }
  }, [])

  return null
}
