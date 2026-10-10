'use client'

// Carrossel dos shorts da bancada. Cards verticais (9:16) numa faixa com
// scroll-snap: no celular, arrasta com o dedo; no desktop, setas + barra de
// progresso. O player do YouTube so carrega quando a pessoa toca no card
// (cada iframe pesa ~1 MB), e so um toca por vez: abrir outro fecha o anterior.

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconPlay, IconChevronLeft, IconChevronRight, IconYouTube, IconClose } from '@/components/ui/Icons'

export interface Short { id: string; titulo: string; tema: string; vertical: boolean }

export default function ShortsCarrossel({ shorts, canal }: { shorts: Short[]; canal: string | null }) {
  const trilho = useRef<HTMLDivElement>(null)
  const [tocando, setTocando] = useState<string | null>(null)
  const [progresso, setProgresso] = useState(0)
  const [pontas, setPontas] = useState({ inicio: true, fim: false })

  const medir = useCallback(() => {
    const t = trilho.current
    if (!t) return
    const max = t.scrollWidth - t.clientWidth
    setProgresso(max > 0 ? t.scrollLeft / max : 1)
    setPontas({ inicio: t.scrollLeft < 8, fim: t.scrollLeft > max - 8 })
  }, [])

  useEffect(() => {
    const t = trilho.current
    if (!t) return
    // Mede ja depois de montar (via frame, fora do corpo do efeito) e a cada mudanca de tamanho.
    const raf = requestAnimationFrame(medir)
    const ro = new ResizeObserver(medir)
    ro.observe(t)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [medir])

  function rolar(dir: 1 | -1) {
    const t = trilho.current
    if (!t) return
    const card = t.querySelector<HTMLElement>('.sc-card')
    const passo = card ? card.offsetWidth + 16 : t.clientWidth * 0.8
    const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    t.scrollBy({ left: dir * passo, behavior: reduzir ? 'auto' : 'smooth' })
  }

  return (
    <div className="sc">
      <style>{CSS}</style>
      <div className="sc-trilho" ref={trilho} onScroll={medir} role="region" aria-label="Vídeos da bancada" tabIndex={0}>
        {shorts.map((s, i) => (
          <article key={s.id} className={`sc-card${tocando === s.id ? ' sc-card-on' : ''}`}>
            {tocando === s.id ? (
              <>
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${s.id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
                  title={s.titulo}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                <button type="button" className="sc-fechar" onClick={() => setTocando(null)} aria-label="Fechar vídeo"><IconClose size={16} /></button>
              </>
            ) : (
              <button type="button" className="sc-capa" onClick={() => setTocando(s.id)} aria-label={`Assistir: ${s.titulo}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://i.ytimg.com/vi/${s.id}/${s.vertical ? 'oardefault' : 'hqdefault'}.jpg`}
                  alt=""
                  loading={i < 3 ? 'eager' : 'lazy'}
                  onError={e => { const img = e.currentTarget; if (!img.src.includes('hqdefault')) img.src = `https://i.ytimg.com/vi/${s.id}/hqdefault.jpg` }}
                />
                <span className="sc-veu" />
                <span className="sc-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="sc-tema">{s.tema}</span>
                <span className="sc-play"><IconPlay size={30} strokeWidth={1.8} /></span>
                <span className="sc-titulo">{s.titulo}</span>
              </button>
            )}
          </article>
        ))}
      </div>

      <div className="sc-rodape">
        <div className="sc-barra" aria-hidden="true"><span style={{ width: `${Math.max(12, progresso * 100)}%` }} /></div>
        <div className="sc-setas">
          <button type="button" onClick={() => rolar(-1)} disabled={pontas.inicio} aria-label="Vídeos anteriores"><IconChevronLeft size={20} /></button>
          <button type="button" onClick={() => rolar(1)} disabled={pontas.fim} aria-label="Próximos vídeos"><IconChevronRight size={20} /></button>
        </div>
        {canal && (
          <a className="sc-canal" href={canal} target="_blank" rel="noopener"><IconYouTube size={18} /> Ver o canal</a>
        )}
      </div>
    </div>
  )
}

const CSS = `
.sc{display:grid;gap:18px}
.sc-trilho{display:grid;grid-auto-flow:column;grid-auto-columns:clamp(210px,62vw,260px);gap:16px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scroll-padding-inline:2px;padding:6px 2px 10px;scrollbar-width:none}
.sc-trilho::-webkit-scrollbar{display:none}
.sc-trilho:focus-visible{outline:2px solid var(--bx-text);outline-offset:4px;border-radius:18px}
.sc-card{position:relative;aspect-ratio:9/16;border-radius:18px;overflow:hidden;scroll-snap-align:start;background:var(--bx-surface-2);border:1px solid var(--bx-border);box-shadow:var(--bx-shadow);transition:transform .2s ease,border-color .2s ease}
.sc-card:hover{transform:translateY(-4px);border-color:rgba(var(--ac-1-rgb),.55)}
.sc-card-on{border-color:rgba(var(--ac-1-rgb),.7)}
.sc-card iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000}
.sc-capa{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;background:none;cursor:pointer;color:#fff;text-align:left;font:inherit}
.sc-capa:focus-visible{outline:2px solid var(--bx-text);outline-offset:-4px}
.sc-capa img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .2s ease}
.sc-card:hover .sc-capa img{transform:scale(1.04)}
.sc-veu{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,10,15,.55) 0%,rgba(8,10,15,0) 28%,rgba(8,10,15,0) 52%,rgba(8,10,15,.92) 100%)}
.sc-num{position:absolute;top:14px;left:14px;font-size:13px;font-weight:800;letter-spacing:.06em;font-variant-numeric:tabular-nums;opacity:.9}
.sc-tema{position:absolute;top:12px;right:12px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;border-radius:999px;background:rgba(8,10,15,.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.18)}
.sc-play{position:absolute;top:50%;left:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;display:grid;place-items:center;background:var(--ac-grad);color:var(--bx-brand-ink);box-shadow:0 10px 30px rgba(0,0,0,.5);transition:transform .2s ease}
.sc-card:hover .sc-play{transform:scale(1.08)}
.sc-titulo{position:absolute;left:14px;right:14px;bottom:16px;font-size:15px;font-weight:700;line-height:1.3;text-wrap:balance}
.sc-fechar{position:absolute;top:8px;right:8px;z-index:2;width:44px;height:44px;display:grid;place-items:center;border-radius:50%;border:0;background:rgba(8,10,15,.7);color:#fff;cursor:pointer}
.sc-rodape{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.sc-barra{flex:1 1 160px;height:4px;border-radius:999px;background:var(--bx-surface-2);overflow:hidden}
.sc-barra span{display:block;height:100%;background:var(--ac-grad);transition:width .15s ease}
.sc-setas{display:flex;gap:8px}
.sc-setas button{width:44px;height:44px;display:grid;place-items:center;border-radius:50%;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text);cursor:pointer;transition:background .15s ease,opacity .15s ease}
.sc-setas button:hover:not(:disabled){background:var(--bx-surface-2)}
.sc-setas button:disabled{opacity:.35;cursor:default}
.sc-canal{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text);font-weight:600;font-size:14px;text-decoration:none}
.sc-canal:hover{background:var(--bx-surface-2)}
@media (max-width:640px){ .sc-setas{display:none} }
@media (prefers-reduced-motion:reduce){
  .sc-card,.sc-capa img,.sc-play,.sc-barra span{transition:none}
  .sc-card:hover,.sc-card:hover .sc-capa img,.sc-card:hover .sc-play{transform:none}
}
`
