'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

const STEPS = [
  { key: 'imported',   icon: '🔗', label: 'Importar primeira carta',    desc: 'Cole um link da LigaPokemon'      },
  { key: 'profile',    icon: '👤', label: 'Configurar seu perfil',       desc: 'Adicione username em Minha Conta' },
  { key: 'marketplace',icon: '🛒', label: 'Explorar o Marketplace',     desc: 'Veja cartas à venda'              },
  { key: 'dashboard',  icon: '📊', label: 'Ver o Dashboard financeiro',  desc: 'Confira o valor da sua coleção'   },
]

export default function OnboardingChecklist({ userId }: { userId: string }) {
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function check() {
      const saved = localStorage.getItem(`bynx-onboarding-${userId}`)
      if (saved === 'dismissed') { setDismissed(true); setLoading(false); return }

      const savedDone = saved ? JSON.parse(saved) : {}

      // Verifica automaticamente o que já foi feito
      const [{ count: cards }, { data: user }] = await Promise.all([
        supabase.from('user_cards').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('users').select('username').eq('id', userId).single(),
      ])

      const newDone = {
        ...savedDone,
        imported: (cards || 0) > 0,
        profile: !!user?.username,
        dashboard: savedDone.dashboard || false,
        marketplace: savedDone.marketplace || false,
      }

      setDone(newDone)
      localStorage.setItem(`bynx-onboarding-${userId}`, JSON.stringify(newDone))
      setLoading(false)
    }
    check()
  }, [userId])

  function markDone(key: string) {
    const newDone = { ...done, [key]: true }
    setDone(newDone)
    localStorage.setItem(`bynx-onboarding-${userId}`, JSON.stringify(newDone))
  }

  function dismiss() {
    setDismissed(true)
    localStorage.setItem(`bynx-onboarding-${userId}`, 'dismissed')
  }

  const allDone = STEPS.every(s => done[s.key])
  const completedCount = STEPS.filter(s => done[s.key]).length

  if (loading || dismissed) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(239,68,68,0.04))',
      border: '1px solid rgba(245,158,11,0.2)',
      borderRadius: 16, padding: '20px 24px', marginBottom: 24,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 800, color: '#f0f0f0', marginBottom: 2 }}>
            {allDone ? '🎉 Tudo certo! Bem-vindo ao Bynx!' : '🚀 Primeiros passos'}
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {allDone ? 'Sua coleção está pronta para decolar.' : `${completedCount} de ${STEPS.length} concluídos`}
          </p>
        </div>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
      </div>

      {/* Barra de progresso */}
      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          width: `${(completedCount / STEPS.length) * 100}%`,
          background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
          transition: 'width 0.4s ease',
        }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {STEPS.map(step => (
          <div key={step.key} onClick={() => markDone(step.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: done[step.key] ? 'default' : 'pointer', opacity: done[step.key] ? 0.5 : 1, transition: 'opacity 0.2s' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
              background: done[step.key] ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${done[step.key] ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
            }}>
              {done[step.key] ? '✓' : step.icon}
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: done[step.key] ? 400 : 600, color: done[step.key] ? 'rgba(255,255,255,0.4)' : '#f0f0f0', textDecoration: done[step.key] ? 'line-through' : 'none' }}>
                {step.label}
              </p>
              {!done[step.key] && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{step.desc}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}