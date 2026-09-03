'use client'

import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react'

/**
 * Galeria da pagina de produto: UMA foto grande + tira de miniaturas.
 *
 * Difere do `GaleriaFotos` (fotos da LOJA) de proposito: la todas as fotos tem
 * o mesmo peso e um grid resolve; aqui uma foto manda e as outras apoiam. O
 * comportamento do lightbox e o mesmo -- swipe, setas, teclado, contador --
 * porque o usuario nao deveria aprender dois visualizadores no mesmo site.
 */
export default function GaleriaProduto({ fotos, nome }: { fotos: string[]; nome: string }) {
  const [ativa, setAtiva] = useState(0)
  const [aberta, setAberta] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const total = fotos.length
  const fechar = useCallback(() => setAberta(false), [])
  const proximo = useCallback(() => setAtiva(i => (i + 1) % total), [total])
  const anterior = useCallback(() => setAtiva(i => (i - 1 + total) % total), [total])

  // Teclado: setas navegam (com ou sem lightbox), ESC fecha.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar()
      else if (e.key === 'ArrowRight') proximo()
      else if (e.key === 'ArrowLeft') anterior()
    }
    if (!aberta) return
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberta, fechar, proximo, anterior])

  // Trava o scroll do body enquanto o lightbox esta aberto.
  useEffect(() => {
    if (!aberta) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [aberta])

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || total < 2) return
    const dif = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dif) > 50) { if (dif < 0) proximo(); else anterior() }
    touchStartX.current = null
  }

  if (total === 0) {
    return (
      <div style={S.vazio}>
        <IconeSemFoto />
        <span style={S.vazioTxt}>Sem foto</span>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .bx-pg-tira{transition:border-color .15s ease, transform .15s ease}
        .bx-pg-tira:hover{border-color:var(--bx-border-2);transform:translateY(-2px)}
        .bx-pg-zoom{transition:background .15s ease}
        .bx-pg-zoom:hover{background:rgba(0,0,0,0.8)}
        @media (prefers-reduced-motion: reduce){
          .bx-pg-tira,.bx-pg-zoom{transition:none}
          .bx-pg-tira:hover{transform:none}
        }
      `}</style>

      <div style={S.heroWrap} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <button type="button" onClick={() => setAberta(true)} style={S.heroBtn} aria-label={`Ampliar foto ${ativa + 1} de ${total}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fotos[ativa]} alt={`${nome} — foto ${ativa + 1}`} style={S.heroImg} />
        </button>
        {total > 1 && <div style={S.contador}>{ativa + 1} / {total}</div>}
        <span className="bx-pg-zoom" style={S.zoom} aria-hidden="true"><IconeLupa /></span>
      </div>

      {total > 1 && (
        <div style={S.tiras}>
          {fotos.map((f, i) => (
            <button
              key={i}
              type="button"
              className="bx-pg-tira"
              onClick={() => setAtiva(i)}
              style={{ ...S.tira, ...(i === ativa ? S.tiraOn : {}) }}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === ativa ? 'true' : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f} alt="" style={S.tiraImg} />
            </button>
          ))}
        </div>
      )}

      {aberta && (
        <div
          style={S.overlay}
          onClick={fechar}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          role="dialog"
          aria-modal="true"
          aria-label="Visualizador de fotos do produto"
        >
          {total > 1 && <div style={S.lbContador}>{ativa + 1} / {total}</div>}

          <button type="button" onClick={fechar} style={S.fechar} aria-label="Fechar">
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

          {total > 1 && (
            <>
              <button type="button" onClick={e => { e.stopPropagation(); anterior() }} style={{ ...S.nav, left: 16 }} aria-label="Foto anterior">
                <svg width="26" height="26" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M13 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" onClick={e => { e.stopPropagation(); proximo() }} style={{ ...S.nav, right: 16 }} aria-label="Proxima foto">
                <svg width="26" height="26" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}

          <div style={S.lbWrap} onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotos[ativa]} alt={`${nome} — foto ${ativa + 1}`} style={S.lbImg} />
          </div>
        </div>
      )}
    </>
  )
}

const IconeLupa = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5M11 8v6M8 11h6" />
  </svg>
)

const IconeSemFoto = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.3" /><path d="M21 16l-5-5-5 5-2-2-5 5" />
  </svg>
)

const S: Record<string, CSSProperties> = {
  heroWrap: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid var(--bx-border)',
    background: 'var(--bx-surface)',
  },
  heroBtn: { all: 'unset', cursor: 'zoom-in', display: 'block', width: '100%' },
  heroImg: { width: '100%', display: 'block', aspectRatio: '1 / 1', objectFit: 'cover' },
  contador: {
    position: 'absolute', left: 10, bottom: 10,
    fontSize: 11.5, fontWeight: 700, color: 'var(--bx-text-2)',
    background: 'rgba(0,0,0,0.66)', border: '1px solid var(--bx-border-2)',
    padding: '6px 11px', borderRadius: 100, pointerEvents: 'none',
  },
  zoom: {
    position: 'absolute', right: 10, bottom: 10,
    width: 38, height: 38, borderRadius: 10,
    background: 'rgba(0,0,0,0.66)', border: '1px solid var(--bx-border-2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--bx-text)', pointerEvents: 'none',
  },
  tiras: { display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 2 },
  tira: {
    all: 'unset', cursor: 'pointer', flex: 'none',
    width: 60, height: 60, borderRadius: 9, overflow: 'hidden',
    border: '1px solid var(--bx-border)', background: 'var(--bx-surface)',
    boxSizing: 'border-box',
  },
  tiraOn: { borderColor: 'var(--ac-1)', boxShadow: '0 0 0 1px rgba(var(--ac-1-rgb),0.45)' },
  tiraImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },

  vazio: {
    aspectRatio: '1 / 1', borderRadius: 12,
    border: '1px solid var(--bx-border)', background: 'var(--bx-surface)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 8, color: 'var(--bx-text-faint)',
  },
  vazioTxt: { fontSize: 12.5, fontWeight: 600 },

  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, cursor: 'zoom-out',
  },
  lbContador: {
    position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
    color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600, letterSpacing: '0.05em',
    padding: '6px 14px', borderRadius: 20,
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
    fontFamily: 'inherit',
  },
  fechar: {
    position: 'absolute', top: 16, right: 16, width: 44, height: 44,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12, color: '#f0f0f0', cursor: 'pointer', fontFamily: 'inherit',
  },
  nav: {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '50%', color: '#f0f0f0', cursor: 'pointer', fontFamily: 'inherit',
  },
  lbWrap: { maxWidth: '90vw', maxHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' },
  lbImg: { maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
}
