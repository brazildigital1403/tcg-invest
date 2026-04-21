'use client'
import { useState, useEffect } from 'react'
import { IconRocket, IconWarning, IconCheck } from '@/components/ui/Icons'
import { supabase } from '@/lib/supabaseClient'

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'

interface Props {
  tipo: 'cartas' | 'marketplace'
}

export default function UpgradeBanner({ tipo }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)

  useEffect(() => {
    async function checkTrial() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('users').select('trial_expires_at, is_pro').eq('id', user.id).single()
      if (data && !data.is_pro && data.trial_expires_at) {
        const expiry = new Date(data.trial_expires_at)
        if (expiry > new Date()) {
          const days = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          setTrialDaysLeft(days)
        }
      }
    }
    checkTrial()
  }, [])

  const msg = tipo === 'cartas'
    ? 'Você atingiu o limite de 6 cartas do plano Gratuito.'
    : 'Você atingiu o limite de 3 anúncios ativos do plano Gratuito.'

  async function handleCheckout(plano: 'mensal' | 'anual') {
    setLoading(plano)
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) { alert('Faça login para continuar'); setLoading(null); return }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano, userId: authData.user.id, userEmail: authData.user.email }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert('Erro ao iniciar checkout. Tente novamente.')
    } catch {
      alert('Erro ao iniciar checkout. Tente novamente.')
    }
    setLoading(null)
  }

  return (
    <div style={{
      margin: '8px 0 24px',
      background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.08))',
      border: '1px solid rgba(245,158,11,0.25)',
      borderRadius: 16, padding: '20px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', gap: 12,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <IconRocket size={20} color="#f59e0b" />
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', marginBottom: 4 }}>{msg}</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
          {trialDaysLeft !== null && trialDaysLeft <= 2
            ? <><IconWarning size={13} color='#ef4444' style={{marginRight:4}} /><strong style={{ color: '#ef4444' }}>Seu trial Pro expira em {trialDaysLeft} dia{trialDaysLeft !== 1 ? 's' : ''}!</strong> Assine para manter acesso ilimitado.</>
            : <>Faça upgrade para o plano <strong style={{ color: '#f59e0b' }}>Pro</strong> e tenha acesso ilimitado.</>
          }
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', width: '100%', marginTop: 4 }}>
        {/* Pro Mensal */}
        <div style={{ flex: 1, minWidth: 160, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 16px' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Pro Mensal</p>
          <p style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 2, background: BRAND, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>R$ 29,90</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>por mês</p>
          <button onClick={() => handleCheckout('mensal')} disabled={!!loading}
            style={{ width: '100%', background: BRAND, border: 'none', color: '#000', padding: '9px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading === 'mensal' ? 0.7 : 1 }}>
            {loading === 'mensal' ? 'Aguarde...' : 'Assinar Pro'}
          </button>
        </div>

        {/* Pro Anual */}
        <div style={{ flex: 1, minWidth: 160, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '14px 16px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: BRAND, color: '#000', fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 100, whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>
            2 MESES GRÁTIS
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Pro Anual</p>
          <p style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 2, background: BRAND, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>R$ 249</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>por ano · R$ 14,91/mês</p>
          <button onClick={() => handleCheckout('anual')} disabled={!!loading}
            style={{ width: '100%', background: BRAND, border: 'none', color: '#000', padding: '9px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading === 'anual' ? 0.7 : 1 }}>
            {loading === 'anual' ? 'Aguarde...' : 'Assinar Anual'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
        {['Cartas ilimitadas', 'Anúncios ilimitados', 'Perfil público', 'Exportar CSV'].map(f => (
          <span key={f} style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{f}</span>
        ))}
      </div>
    </div>
  )
}