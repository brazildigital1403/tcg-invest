'use client'

import { CSSProperties, useState, useEffect, useCallback, useRef } from 'react'

interface Props {
  fotos: string[]
  nomeLoja: string
}

export default function GaleriaFotos({ fotos, nomeLoja }: Props) {
  const [indexAtivo, setIndexAtivo] = useState<number | null>(null)
  const touchStartX = useRef<number | null>(null)

  const fechar = useCallback(() => setIndexAtivo(null), [])
  const proximo = useCallback(() => {
    setIndexAtivo(i => (i === null ? null : (i + 1) % fotos.length))
  }, [fotos.length])
  const anterior = useCallback(() => {
    setIndexAtivo(i => (i === null ? null : (i - 1 + fotos.length) % fotos.length))
  }, [fotos.length])

  // ─── Teclado: setas navegam, ESC fecha ─────────────────────────────────
  useEffect(() => {
    if (indexAtivo === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar()
      else if (e.key === 'ArrowRight') proximo()
      else if (e.key === 'ArrowLeft') anterior()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [indexAtivo, fechar, proximo, anterior])

  // ─── Bloqueia scroll do body quando lightbox aberto ────────────────────
  useEffect(() => {
    if (indexAtivo === null) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [indexAtivo])

  // ─── Swipe touch no mobile ─────────────────────────────────────────────
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const diff = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(diff) > 50) {
      if (diff < 0) proximo()
      else anterior()
    }
    touchStartX.current = null
  }

  if (fotos.length === 0) return null

  return (
    <>
      {/* Grid de miniaturas */}
      <div style={S.grid}>
        {fotos.map((foto, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndexAtivo(i)}
            style={S.thumbBtn}
            aria-label={`Ver foto ${i + 1} em tamanho grande`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto} alt={`${nomeLoja} foto ${i + 1}`} style={S.thumbImg} />
          </button>
        ))}
      </div>

      {/* Lightbox overlay */}
      {indexAtivo !== null && (
        <div
          style={S.overlay}
          onClick={fechar}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          role="dialog"
          aria-modal="true"
          aria-label="Visualizador de fotos"
        >
          {/* Contador */}
          <div style={S.counter}>
            {indexAtivo + 1} / {fotos.length}
          </div>

          {/* Botão fechar */}
          <button
            type="button"
            onClick={fechar}
            style={S.closeBtn}
            aria-label="Fechar"
          >
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Setas (só se tiver mais de 1 foto) */}
          {fotos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); anterior() }}
                style={{ ...S.navBtn, left: 16 }}
                aria-label="Foto anterior"
              >
                <svg width="26" height="26" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M13 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); proximo() }}
                style={{ ...S.navBtn, right: 16 }}
                aria-label="Próxima foto"
              >
                <svg width="26" height="26" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </>
          )}

          {/* Foto grande */}
          <div style={S.imageWrap} onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fotos[indexAtivo]}
              alt={`${nomeLoja} foto ${indexAtivo + 1}`}
              style={S.fullImg}
            />
          </div>
        </div>
      )}
    </>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 8,
  },
  thumbBtn: {
    all: 'unset',
    cursor: 'pointer',
    display: 'block',
    width: '100%',
    aspectRatio: '4 / 3',
    borderRadius: 10,
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    transition: 'all 0.15s ease',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },

  // ─── Lightbox ───────────────────────────────────────────────────
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(0,0,0,0.92)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    cursor: 'zoom-out',
  },
  counter: {
    position: 'absolute',
    top: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.05em',
    padding: '6px 14px',
    borderRadius: 20,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    fontFamily: 'inherit',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    color: '#f0f0f0',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 48,
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '50%',
    color: '#f0f0f0',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  imageWrap: {
    maxWidth: '90vw',
    maxHeight: '85vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'default',
  },
  fullImg: {
    maxWidth: '100%',
    maxHeight: '85vh',
    objectFit: 'contain',
    borderRadius: 8,
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
}