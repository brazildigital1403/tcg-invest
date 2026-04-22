'use client'

import { useState, useEffect } from 'react'

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'

const STEPS = [
  {
    id: 'import',
    icon: '🔗',
    title: 'Importe sua primeira carta',
    desc: 'Copie o link de qualquer carta da LigaPokemon e cole no Bynx. Importamos imagem e preços automaticamente.',
    cta: 'Importar carta →',
    href: '/minha-colecao',
    lsKey: 'ob-import',
  },
  {
    id: 'dashboard',
    icon: '📊',
    title: 'Veja o valor da sua coleção',
    desc: 'O Dashboard mostra o patrimônio total, histórico de preço e variações em tempo real.',
    cta: 'Ver Dashboard →',
    href: '/dashboard-financeiro',
    lsKey: 'ob-dashboard',
  },
  {
    id: 'marketplace',
    icon: '🛒',
    title: 'Explore o Marketplace',
    desc: 'Compre e venda cartas diretamente com outros colecionadores brasileiros via WhatsApp.',
    cta: 'Abrir Marketplace →',
    href: '/marketplace',
    lsKey: 'ob-marketplace',
  },
  {
    id: 'profile',
    icon: '🌐',
    title: 'Configure seu perfil público',
    desc: 'Crie um username e compartilhe sua coleção com outros colecionadores.',
    cta: 'Configurar perfil →',
    href: '/minha-conta',
    lsKey: 'ob-profile',
  },
]

interface Props {
  onClose: () => void
}

export default function OnboardingModal({ onClose }: Props) {
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const state: Record<string, boolean> = {}
    STEPS.forEach(s => { state[s.id] = !!localStorage.getItem(s.lsKey) })
    setDone(state)
  }, [])

  const markDone = (id: string, lsKey: string) => {
    localStorage.setItem(lsKey, '1')
    setDone(prev => ({ ...prev, [id]: true }))
  }

  const handleClose = () => {
    setClosing(true)
    localStorage.setItem('onboarding-visto', '1')
    setTimeout(onClose, 200)
  }

  const completedCount = Object.values(done).filter(Boolean).length
  const progress = Math.round((completedCount / STEPS.length) * 100)

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        opacity: closing ? 0 : 1, transition: 'opacity 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 480,
          fontFamily: "'DM Sans', system-ui, sans-serif",
          transform: closing ? 'scale(0.97)' : 'scale(1)', transition: 'transform 0.2s ease',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>✦ Primeiros passos</p>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#f0f0f0', letterSpacing: '-0.03em', margin: 0 }}>Configure seu Bynx</h2>
            </div>
            <button onClick={handleClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>×</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 100, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 100, background: BRAND, width: `${progress}%`, transition: 'width 0.4s ease' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: completedCount === STEPS.length ? '#22c55e' : '#f59e0b', whiteSpace: 'nowrap' }}>
              {completedCount}/{STEPS.length} {completedCount === STEPS.length ? '🎉' : ''}
            </span>
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {STEPS.map(step => {
            const isDone = done[step.id]
            return (
              <div key={step.id} style={{
                background: isDone ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isDone ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 14, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.2s',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: isDone ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isDone ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isDone ? 16 : 18, color: isDone ? '#22c55e' : 'inherit',
                }}>
                  {isDone ? '✓' : step.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: isDone ? 'rgba(255,255,255,0.4)' : '#f0f0f0', marginBottom: isDone ? 0 : 2, textDecoration: isDone ? 'line-through' : 'none' }}>
                    {step.title}
                  </p>
                  {!isDone && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>{step.desc}</p>}
                </div>
                {!isDone && (
                  <a href={step.href} onClick={() => markDone(step.id, step.lsKey)}
                    style={{ background: BRAND, border: 'none', color: '#000', padding: '8px 14px', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {step.cta}
                  </a>
                )}
              </div>
            )
          })}
        </div>

        {completedCount === STEPS.length ? (
          <button onClick={handleClose} style={{ width: '100%', background: BRAND, border: 'none', color: '#000', padding: '13px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
            🎉 Tudo pronto! Vamos lá
          </button>
        ) : (
          <button onClick={handleClose} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)', padding: '11px', borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Explorar sozinho por agora
          </button>
        )}
      </div>
    </div>
  )
}