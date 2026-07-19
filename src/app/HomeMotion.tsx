'use client'

import { useEffect } from 'react'

/**
 * Motion + lightbox da home. Enhancement puro: o conteudo ja vem do servidor.
 *  - reveal on-scroll (.reveal -> .in)
 *  - count-up (.m-val[data-target] e [data-money])
 *  - lightbox: clique numa carta do carrossel (.track .mq) abre grande
 * Respeita prefers-reduced-motion. Tudo escopado em .hm-root.
 */
export default function HomeMotion() {
  useEffect(() => {
    const root = document.querySelector('.hm-root')
    if (!root) return
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const fmtMil = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)} mil` : `${n}`)
    const raw = (n: number) => n.toLocaleString('pt-BR')
    const setFinal = (el: HTMLElement) => {
      const money = el.dataset.money
      if (money !== undefined) {
        el.textContent = 'R$ ' + raw(Number(money)) + (el.dataset.kmi ? ' mil' : '')
      } else {
        const t = Number(el.dataset.target || '0')
        el.textContent = (t >= 1000 ? fmtMil(t) : raw(t)) + (el.dataset.suffix || '')
      }
    }

    // ---- reveal + count-up ----
    if (reduce) {
      root.querySelectorAll('.reveal').forEach(el => el.classList.add('in'))
      root.querySelectorAll<HTMLElement>('.m-val[data-target],.m-val[data-money]').forEach(setFinal)
    } else {
      const io = new IntersectionObserver(
        es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }),
        { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
      )
      root.querySelectorAll('.reveal').forEach(el => io.observe(el))

      const up = (el: HTMLElement) => {
        const money = el.dataset.money
        const tgt = money !== undefined ? Number(money) : Number(el.dataset.target || '0')
        const big = money === undefined && tgt >= 1000
        const dur = 1200
        const t0 = performance.now()
        const step = (t: number) => {
          const p = Math.min(1, (t - t0) / dur)
          const v = Math.round(tgt * (1 - Math.pow(1 - p, 3)))
          el.textContent = money !== undefined
            ? ('R$ ' + raw(v) + (p === 1 && el.dataset.kmi ? ' mil' : ''))
            : ((big ? fmtMil(v) : raw(v)) + (p === 1 ? (el.dataset.suffix || '') : ''))
          if (p < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }
      const mio = new IntersectionObserver(
        es => es.forEach(e => { if (e.isIntersecting) { up(e.target as HTMLElement); mio.unobserve(e.target) } }),
        { threshold: 0.5 },
      )
      root.querySelectorAll<HTMLElement>('.m-val[data-target],.m-val[data-money]').forEach(el => mio.observe(el))
    }

    // ---- lightbox ----
    const modal = document.getElementById('hm-cardmodal')
    const cmimg = document.getElementById('hm-cmimg') as HTMLImageElement | null
    const tracks = Array.from(root.querySelectorAll('.track'))
    let cleanup: (() => void) | undefined

    if (modal && cmimg) {
      const open = (src: string) => {
        cmimg.onerror = () => { cmimg.onerror = null; cmimg.src = src }
        cmimg.src = src.replace('.png', '_hires.png')
        modal.classList.add('open')
        modal.setAttribute('aria-hidden', 'false')
        document.body.style.overflow = 'hidden'
      }
      const close = () => {
        modal.classList.remove('open')
        modal.setAttribute('aria-hidden', 'true')
        document.body.style.overflow = ''
        cmimg.removeAttribute('src')
      }
      const onTrack = (e: Event) => {
        const mq = (e.target as HTMLElement).closest('.mq')
        const im = mq?.querySelector('img')
        if (im) open(im.src)
      }
      const onModal = (e: Event) => { if ((e.target as HTMLElement).hasAttribute('data-close')) close() }
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }

      tracks.forEach(tr => tr.addEventListener('click', onTrack))
      modal.addEventListener('click', onModal)
      document.addEventListener('keydown', onKey)
      cleanup = () => {
        tracks.forEach(tr => tr.removeEventListener('click', onTrack))
        modal.removeEventListener('click', onModal)
        document.removeEventListener('keydown', onKey)
      }
    }

    return () => { cleanup?.() }
  }, [])

  return null
}
