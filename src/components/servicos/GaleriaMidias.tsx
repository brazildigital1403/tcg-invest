'use client'

// Galeria das midias de um pedido de servico (fotos do cliente, entrada e
// saida da bancada, video de abertura, embalagem, laudo).
//
// Mesmo comportamento do lightbox do GaleriaProduto -- swipe, setas, teclado,
// contador, ESC fecha, scroll travado -- porque o usuario nao deveria aprender
// dois visualizadores no mesmo site. A diferenca e que aqui tambem ha video
// (toca dentro do modal) e PDF (abre em nova aba: PDF embutido no celular e
// ruim). As miniaturas de video mostram o primeiro quadro com o selo de play.

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconClose, IconPlay, IconArticle } from '@/components/ui/Icons'

export interface MidiaGaleria {
  id: string
  url: string | null
  mime: string
  rotulo: string
}

export default function GaleriaMidias({ midias, tamanho = 88 }: { midias: MidiaGaleria[]; tamanho?: number }) {
  const itens = midias.filter(m => m.url)
  const [ativa, setAtiva] = useState<number | null>(null)
  const toque = useRef<number | null>(null)
  const total = itens.length

  const fechar = useCallback(() => setAtiva(null), [])
  const proximo = useCallback(() => setAtiva(i => (i === null ? i : (i + 1) % total)), [total])
  const anterior = useCallback(() => setAtiva(i => (i === null ? i : (i - 1 + total) % total)), [total])

  useEffect(() => {
    if (ativa === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar()
      else if (e.key === 'ArrowRight') proximo()
      else if (e.key === 'ArrowLeft') anterior()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [ativa, fechar, proximo, anterior])

  if (!total) return null
  const atual = ativa === null ? null : itens[ativa]

  return (
    <>
      <style>{CSS}</style>
      <div className="gm-grade" style={{ ['--gm-w' as string]: `${tamanho}px` }}>
        {itens.map((m, i) => (
          <button key={m.id} type="button" className="gm-mini" onClick={() => setAtiva(i)} aria-label={`Abrir ${m.rotulo}`}>
            <span className="gm-thumb">
              {m.mime.startsWith('image/')
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={m.url!} alt="" loading="lazy" />
                : m.mime.startsWith('video/')
                  ? <><video src={`${m.url}#t=0.1`} muted playsInline preload="metadata" /><span className="gm-play"><IconPlay size={22} strokeWidth={1.8} /></span></>
                  : <span className="gm-doc"><IconArticle size={24} /> PDF</span>}
            </span>
            <small>{m.rotulo}</small>
          </button>
        ))}
      </div>

      {atual && (
        <div
          className="gm-modal"
          role="dialog"
          aria-modal="true"
          aria-label={atual.rotulo}
          onClick={fechar}
          onTouchStart={e => { toque.current = e.touches[0].clientX }}
          onTouchEnd={e => {
            if (toque.current === null) return
            const dx = e.changedTouches[0].clientX - toque.current
            toque.current = null
            if (Math.abs(dx) > 50) { if (dx < 0) proximo(); else anterior() }
          }}
        >
          <div className="gm-topo" onClick={e => e.stopPropagation()}>
            <span>{atual.rotulo}{total > 1 && <b>{ativa! + 1} / {total}</b>}</span>
            <button type="button" className="gm-x" onClick={fechar} aria-label="Fechar"><IconClose size={18} /></button>
          </div>

          <div className="gm-palco" onClick={e => e.stopPropagation()}>
            {atual.mime.startsWith('image/')
              // eslint-disable-next-line @next/next/no-img-element
              ? <img key={atual.id} src={atual.url!} alt={atual.rotulo} />
              : atual.mime.startsWith('video/')
                ? <video key={atual.id} src={atual.url!} controls autoPlay playsInline />
                : (
                  <div className="gm-pdf">
                    <IconArticle size={40} />
                    <p>{atual.rotulo}</p>
                    <a href={atual.url!} target="_blank" rel="noopener" className="gm-bt">Abrir o PDF</a>
                  </div>
                )}
          </div>

          {total > 1 && (
            <>
              <button type="button" className="gm-nav gm-nav-e" onClick={e => { e.stopPropagation(); anterior() }} aria-label="Anterior"><IconChevronLeft size={22} /></button>
              <button type="button" className="gm-nav gm-nav-d" onClick={e => { e.stopPropagation(); proximo() }} aria-label="Próxima"><IconChevronRight size={22} /></button>
            </>
          )}
        </div>
      )}
    </>
  )
}

const CSS = `
.gm-grade{display:flex;flex-wrap:wrap;gap:8px}
.gm-mini{display:flex;flex-direction:column;gap:5px;width:var(--gm-w);padding:0;border:0;background:none;color:var(--bx-text-3);font:inherit;text-align:left;cursor:zoom-in}
.gm-thumb{position:relative;display:block;width:var(--gm-w);aspect-ratio:5/7;border-radius:9px;overflow:hidden;border:1px solid var(--bx-border);background:var(--bx-surface-2);transition:transform .15s ease,border-color .15s ease}
.gm-mini:hover .gm-thumb{transform:translateY(-2px);border-color:var(--bx-border-2)}
.gm-mini:focus-visible .gm-thumb{outline:2px solid var(--bx-text);outline-offset:2px}
.gm-thumb img,.gm-thumb video{width:100%;height:100%;object-fit:cover;display:block}
.gm-play{position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.28);color:#fff}
.gm-doc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:12px;font-weight:700;color:var(--bx-text-2)}
.gm-mini small{font-size:11px;line-height:1.3}

.gm-modal{position:fixed;inset:0;z-index:9999;background:rgba(4,5,8,.94);display:flex;align-items:center;justify-content:center;padding:64px 16px 24px}
.gm-topo{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px 10px 18px;color:#fff;font-size:14px;font-weight:600}
.gm-topo span{display:flex;align-items:center;gap:10px}
.gm-topo b{font-size:12px;font-weight:700;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.12);font-variant-numeric:tabular-nums}
.gm-x{width:44px;height:44px;display:grid;place-items:center;border-radius:50%;border:0;background:rgba(255,255,255,.1);color:#fff;cursor:pointer}
.gm-palco{max-width:min(100%,960px);max-height:100%;display:flex;align-items:center;justify-content:center}
.gm-palco img,.gm-palco video{max-width:100%;max-height:calc(100dvh - 96px);border-radius:10px;object-fit:contain;background:#000}
.gm-pdf{display:flex;flex-direction:column;align-items:center;gap:12px;padding:32px;border-radius:16px;background:var(--bx-bg-elev);color:var(--bx-text-2);text-align:center}
.gm-pdf p{margin:0;font-size:15px;color:var(--bx-text)}
.gm-bt{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:12px;background:var(--ac-grad);color:var(--bx-brand-ink);font-weight:700;text-decoration:none}
.gm-nav{position:absolute;top:50%;margin-top:-24px;width:48px;height:48px;display:grid;place-items:center;border-radius:50%;border:0;background:rgba(255,255,255,.1);color:#fff;cursor:pointer;transition:background .15s ease}
.gm-nav:hover{background:rgba(255,255,255,.2)}
.gm-nav-e{left:12px}.gm-nav-d{right:12px}
@media (max-width:640px){ .gm-nav{top:auto;bottom:18px;margin-top:0} }
@media (prefers-reduced-motion:reduce){ .gm-thumb{transition:none} .gm-mini:hover .gm-thumb{transform:none} }
`
