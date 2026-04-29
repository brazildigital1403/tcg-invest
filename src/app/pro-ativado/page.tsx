'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { trackProUpgradeCompleted } from '@/lib/analytics'

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

  useEffect(() => {
    setTimeout(() => setShow(true), 100)
    // GTM/GA4: dispara conversão final (webhook é server-side, não dá pra disparar dataLayer dele)
    trackProUpgradeCompleted(plano as 'mensal' | 'anual')
  }, [plano])

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
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(245,158,11,0.12) 0%, transparent 70%)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        background: '#0d0f14',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24,
        padding: '48px 40px',
        width: '100%',
        maxWidth: 520,
        textAlign: 'center',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.2))',
          border: '2px solid rgba(245,158,11,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, margin: '0 auto 24px',
        }}>⭐</div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(245,158,11,0.15)',
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
          letterSpacing: '-0.04em', lineHeight: 1.1, margin: '0 0 12px',
        }}>Bem-vindo ao Pro! 🎉</h1>

        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: '0 0 32px' }}>
          Sua assinatura está ativa. Você agora tem acesso completo a todos os recursos do Bynx.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 36, textAlign: 'left' }}>
          {PERKS.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '10px 14px',
            }}>
              <span style={{ fontSize: 16 }}>{p.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{p.label}</span>
            </div>
          ))}
        </div>

        <Link href="/minha-colecao" style={{
          display: 'block',
          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
          color: '#000', fontWeight: 800, fontSize: 15,
          padding: '16px 32px', borderRadius: 12,
          textDecoration: 'none', marginBottom: 12,
        }}>Ir para Minha Coleção →</Link>

        <Link href="/dashboard-financeiro" style={{
          display: 'block',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 14,
          padding: '13px 32px', borderRadius: 12,
          textDecoration: 'none',
        }}>Ver Dashboard</Link>
      </div>
    </div>
  )
}

export default function ProAtivadoPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', background: '#080a0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'sans-serif', color: 'rgba(255,255,255,0.3)',
      }}>
        Carregando...
      </div>
    }>
      <ProAtivadoContent />
    </Suspense>
  )
}