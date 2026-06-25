'use client'

import { useEffect } from 'react'
import { IconClose } from '@/components/ui/Icons'

export interface ModalUpgradeProps {
  icon: React.ReactNode
  eyebrow: string
  title: string
  sub: string
  feats: string[]
  pricePill?: string
  ctaLabel?: string
  ghostLabel?: string
  onClose: () => void
  onUpgrade: () => void
}

export default function ModalUpgrade({
  icon, eyebrow, title, sub, feats, pricePill,
  ctaLabel = 'Ver planos →', ghostLabel = 'Agora não',
  onClose, onUpgrade,
}: ModalUpgradeProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, fontFamily: 'inherit',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 18, padding: '30px 26px 26px', width: '100%', maxWidth: 380,
          textAlign: 'center', boxShadow: '0 24px 70px -20px rgba(0,0,0,0.8)',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}
        >
          <IconClose size={18} color="rgba(255,255,255,0.4)" />
        </button>

        <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          {icon}
        </div>

        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#f59e0b', margin: '0 0 8px' }}>{eyebrow}</p>

        <h2 style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.18, margin: '0 0 10px', color: '#f0f0f0' }}>
          {title}
        </h2>

        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, margin: '0 0 18px' }}>
          {sub}
        </p>

        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
          {feats.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.35 }}>
              <span style={{ flexShrink: 0, marginTop: 1, color: '#f59e0b', fontWeight: 900 }}>✓</span>
              <span>{f}</span>
            </div>
          ))}
        </div>

        {pricePill && (
          <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', padding: '5px 12px', borderRadius: 100, marginBottom: 18 }}>
            {pricePill}
          </div>
        )}

        <button
          onClick={onUpgrade}
          style={{ display: 'block', width: '100%', padding: 13, borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', border: 'none', fontFamily: 'inherit', background: 'linear-gradient(90deg,#f59e0b,#ef4444)', color: '#1a1205' }}
        >
          {ctaLabel}
        </button>
        <button
          onClick={onClose}
          style={{ display: 'block', width: '100%', marginTop: 10, background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {ghostLabel}
        </button>
      </div>
    </div>
  )
}
