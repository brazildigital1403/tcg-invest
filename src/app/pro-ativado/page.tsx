'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const PERKS = [
  { icon: '♾️', label: 'Cartas ilimitadas' },
  { icon: '📊', label: 'Dashboard completo' },
  { icon: '📷', label: 'Scan com IA' },
  { icon: '🛒', label: 'Marketplace ilimitado' },
  { icon: '🗂️', label: 'Separadores inclusos' },
  { icon: '🔔', label: 'Alertas de valorização' },
  { icon: '🌐', label: 'Perfil público' },
  { icon: '📤', label: 'Exportar CSV' },
]

function ProAtivadoContent() {
  const params = useSearchParams()
  const plano = params.get('plano') || 'mensal'
  const [show, setShow] = useState(false)
  const [particles, setParticles] = useState<{ x: number; y: number; color: string; size: number; delay: number }[]>([])

  useEffect(() => {
    // Gera partículas de confetti
    const colors = ['#f59e0b', '#ef4444', '#22c55e', '#60a5fa', '#a855f7', '#f0f0f0']
    setParticles(Array.from({ length: 60 }, () => ({
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 8,
      delay: Math.random() * 2,
    })))
    setTimeout(() => setShow(true), 100)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080a0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Confetti */}
      {particles.map((p, i) => (
        <div key={i} style={{
          position: 'fixed',
          left: `${p.x}%`,
          top: `${p.y}%`,
          width: p.size,
          height: p.size,
          background: p.color,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          animation: `fall ${2 + Math.random() * 3}s ${p.delay}s ease-in forwards`,
          opacity: 0,
          pointerEvents: 'none',
          zIndex: 0,
        }} />
      ))}

      {/* Glow background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(245,158,11,0.12) 0%, transparent 70%)',
      }} />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: '#0d0f14',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24,
        padding: '48px 40px',
        width: '100%',
        maxWidth: 520,
        textAlign: 'center',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,158,11,0.1)',
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}>

        {/* Ícone animado */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.2))',
          border: '2px solid rgba(245,158,11,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, margin: '0 auto 24px',
          animation: 'pop 0.5s 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>⭐</div>

        {/* Badge plano */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.15))',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 100, padding: '4px 14px',
          fontSize: 11, fontWeight: 800, color: '#f59e0b',
          letterSpacing: '0.08em', textTransform: 'uppercase',
          marginBottom: 16,
        }}>
          ✦ Pro {plano === 'anual' ? 'Anual' : 'Mensal'} ativado
        </div>

        <h1 style={{
          fontSize: 32, fontWeight: 900, color: '#f0f0f0',
          letterSpacing: '-0.04em', lineHeight: 1.1,
          margin: '0 0 12px',
        }}>
          Bem-vindo ao Pro! 🎉
        </h1>

        <p style={{
          fontSize: 15, color: 'rgba(255,255,255,0.5)',
          lineHeight: 1.6, margin: '0 0 32px',
        }}>
          Sua assinatura está ativa. Você agora tem acesso completo a todos os recursos do Bynx.
        </p>

        {/* Grid de benefícios */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 10, marginBottom: 36, textAlign: 'left',
        }}>
          {PERKS.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '10px 14px',
              opacity: show ? 1 : 0,
              transform: show ? 'translateY(0)' : 'translateY(8px)',
              transition: `opacity 0.4s ${0.4 + i * 0.05}s ease, transform 0.4s ${0.4 + i * 0.05}s ease`,
            }}>
              <span style={{ fontSize: 16 }}>{p.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{p.label}</span>
            </div>
          ))}
        </div>

        {/* Botão principal */}
        <Link href="/minha-colecao" style={{
          display: 'block',
          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
          color: '#000', fontWeight: 800, fontSize: 15,
          padding: '16px 32px', borderRadius: 12,
          textDecoration: 'none', marginBottom: 12,
          letterSpacing: '-0.01em',
        }}>
          Ir para Minha Coleção →
        </Link>

        <Link href="/dashboard-financeiro" style={{
          display: 'block',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 14,
          padding: '13px 32px', borderRadius: 12,
          textDecoration: 'none',
        }}>
          Ver Dashboard
        </Link>

      </div>

      <style>{`
        @keyframes fall {
          0%   { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(110vh) rotate(720deg); }
        }
        @keyframes pop {
          0%   { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}