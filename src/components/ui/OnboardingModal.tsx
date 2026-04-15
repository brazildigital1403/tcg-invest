'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'

const steps = [
  {
    icon: '👋',
    title: 'Bem-vindo ao TCG Manager!',
    desc: 'Seu portfólio financeiro de Pokémon TCG. Vamos configurar tudo em 3 passos rápidos.',
    cta: 'Começar →',
    tip: null,
  },
  {
    icon: '🔗',
    title: 'Importe sua primeira carta',
    desc: 'Copie o link de qualquer carta no site da LigaPokemon e cole aqui. Importamos a imagem e os preços automaticamente.',
    cta: 'Entendi →',
    tip: 'Exemplo: ligapokemon.com.br/?view=cards/card&card=...',
  },
  {
    icon: '📊',
    title: 'Acompanhe seu patrimônio',
    desc: 'Depois de importar suas cartas, o Dashboard mostra o valor total da coleção, histórico de preços e ranking das mais valiosas.',
    cta: 'Ir para Minha Coleção →',
    tip: null,
    action: 'colecao',
  },
]

interface Props {
  userName?: string
  onClose: () => void
}

export default function OnboardingModal({ userName, onClose }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const current = steps[step]

  function handleCta() {
    if (current.action === 'colecao') {
      onClose()
      router.push('/minha-colecao')
    } else if (current.action === 'done') {
      onClose()
    } else {
      setStep(s => s + 1)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.7)', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0' }}>

        {/* Barra de progresso */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ height: '100%', background: BRAND, transition: 'width 0.4s ease', width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>

        {/* Conteúdo */}
        <div style={{ padding: '40px 36px 32px' }}>
          {/* Ícone */}
          <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, marginBottom: 24 }}>
            {current.icon}
          </div>

          {/* Título */}
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>
            {step === 0 && userName ? `Bem-vindo, ${userName.split(' ')[0]}!` : current.title}
          </h2>

          {/* Descrição */}
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, marginBottom: current.tip ? 16 : 32 }}>
            {current.desc}
          </p>

          {/* Dica */}
          {current.tip && (
            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 12, padding: '12px 16px', marginBottom: 32, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{current.tip}</p>
            </div>
          )}

          {/* Botões */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={handleCta}
              style={{ flex: 1, background: BRAND, border: 'none', color: '#000', padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {current.cta}
            </button>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', padding: '14px 16px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
              >
                ←
              </button>
            )}
          </div>

          {/* Pular */}
          <button
            onClick={onClose}
            style={{ display: 'block', width: '100%', marginTop: 14, background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}
          >
            Pular introdução
          </button>
        </div>

        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, paddingBottom: 24 }}>
          {steps.map((_, i) => (
            <div
              key={i}
              onClick={() => setStep(i)}
              style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 100, background: i === step ? '#f59e0b' : 'rgba(255,255,255,0.15)', cursor: 'pointer', transition: 'all 0.3s' }}
            />
          ))}
        </div>

      </div>
    </div>
  )
}