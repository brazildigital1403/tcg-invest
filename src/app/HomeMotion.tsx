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

    // ---- hero: patrimonio + tendencia rotativos (mudam a cada visita) ----
    const patrEl = root.querySelector<HTMLElement>('.am-pval')
    if (patrEl) {
      const patr = Math.round((6000 + Math.random() * 74000) / 10) * 10
      const trendEl = document.getElementById('hm-trend')
      if (trendEl) {
        const pct = Math.round(15 + Math.random() * 95) / 10
        const gain = Math.round(patr * pct / 100)
        trendEl.textContent = 'R$ ' + raw(gain) + ' este m\u00eas \u00b7 +' + pct.toFixed(1).replace('.', ',') + '%'
      }
      if (reduce) {
        patrEl.textContent = 'R$ ' + raw(patr)
      } else {
        const t0p = performance.now()
        const stepP = (t: number) => {
          const p = Math.min(1, (t - t0p) / 1200)
          patrEl.textContent = 'R$ ' + raw(Math.round(patr * (1 - Math.pow(1 - p, 3))))
          if (p < 1) requestAnimationFrame(stepP)
        }
        requestAnimationFrame(stepP)
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

    // ---- lightbox / carrossel ----
    const modal = document.getElementById('hm-cardmodal')
    const cmimg = document.getElementById('hm-cmimg') as HTMLImageElement | null
    const cmcount = document.getElementById('hm-cmcount')
    const btnPrev = document.getElementById('hm-cmprev')
    const btnNext = document.getElementById('hm-cmnext')
    const tracks = Array.from(root.querySelectorAll('.track'))
    let cleanup: (() => void) | undefined

    if (modal && cmimg) {
      // lista unica das cartas do marquee (o track e duplicado pro loop infinito)
      const seen = new Set<string>()
      const cards: string[] = []
      root.querySelectorAll<HTMLImageElement>('.track .mq img').forEach(im => {
        const src = im.getAttribute('src') || im.src
        if (src && !seen.has(src)) { seen.add(src); cards.push(src) }
      })
      let idx = 0

      const render = () => {
        const src = cards[idx]
        if (!src) return
        cmimg.onerror = () => { cmimg.onerror = null; cmimg.src = src }
        cmimg.src = src.replace('.png', '_hires.png')
        if (cmcount) cmcount.textContent = (idx + 1) + ' / ' + cards.length
      }
      const openAt = (src: string) => {
        const i = cards.indexOf(src)
        idx = i >= 0 ? i : 0
        render()
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
      const go = (d: number) => { if (cards.length) { idx = (idx + d + cards.length) % cards.length; render() } }

      const onTrack = (e: Event) => {
        const mq = (e.target as HTMLElement).closest('.mq')
        const im = mq?.querySelector('img')
        if (im) openAt(im.getAttribute('src') || im.src)
      }
      const onModal = (e: Event) => { if ((e.target as HTMLElement).closest('[data-close]')) close() }
      const onPrev = (e: Event) => { e.stopPropagation(); go(-1) }
      const onNext = (e: Event) => { e.stopPropagation(); go(1) }
      const onKey = (e: KeyboardEvent) => {
        if (!modal.classList.contains('open')) return
        if (e.key === 'Escape') close()
        else if (e.key === 'ArrowLeft') go(-1)
        else if (e.key === 'ArrowRight') go(1)
      }
      // swipe no mobile
      let tx = 0
      const onTS = (e: TouchEvent) => { tx = e.changedTouches[0].clientX }
      const onTE = (e: TouchEvent) => {
        const dx = e.changedTouches[0].clientX - tx
        if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1)
      }

      tracks.forEach(tr => tr.addEventListener('click', onTrack))
      modal.addEventListener('click', onModal)
      btnPrev?.addEventListener('click', onPrev)
      btnNext?.addEventListener('click', onNext)
      cmimg.addEventListener('touchstart', onTS, { passive: true })
      cmimg.addEventListener('touchend', onTE, { passive: true })
      document.addEventListener('keydown', onKey)
      cleanup = () => {
        tracks.forEach(tr => tr.removeEventListener('click', onTrack))
        modal.removeEventListener('click', onModal)
        btnPrev?.removeEventListener('click', onPrev)
        btnNext?.removeEventListener('click', onNext)
        cmimg.removeEventListener('touchstart', onTS)
        cmimg.removeEventListener('touchend', onTE)
        document.removeEventListener('keydown', onKey)
      }
    }

    return () => { cleanup?.() }
  }, [])

  return null
}
