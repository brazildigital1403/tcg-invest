'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const FONT = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export default function EmailConfirmadoPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<'loading' | 'ok' | 'erro'>('loading')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (alive) setEstado('erro'); return }
        await supabase.from('users').update({ reconfirmar_email: false }).eq('id', user.id)
        if (alive) setEstado('ok')
      } catch {
        if (alive) setEstado('erro')
      }
    })()
    return () => { alive = false }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#080a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FONT }}>
      <div style={{ maxWidth: 420, width: '100%', background: '#0d0f14', border: '1px solid #1f2937', borderRadius: 20, padding: '40px 32px', textAlign: 'center' }}>
        {estado === 'loading' && (
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: 0 }}>Confirmando seu e-mail...</p>
        )}
        {estado === 'ok' && (
          <>
            <div style={{ fontSize: 44, lineHeight: 1 }}>✅</div>
            <h1 style={{ color: '#f0f0f0', fontSize: 22, fontWeight: 800, margin: '16px 0 8px' }}>E-mail confirmado!</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>Obrigado! Sua conta está verificada e segura. 🔒</p>
            <button onClick={() => router.push('/minha-colecao')} style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '12px 32px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: FONT }}>Ir para o app →</button>
          </>
        )}
        {estado === 'erro' && (
          <>
            <div style={{ fontSize: 44, lineHeight: 1 }}>⚠️</div>
            <h1 style={{ color: '#f0f0f0', fontSize: 20, fontWeight: 800, margin: '16px 0 8px' }}>Link expirado ou inválido</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>Faça login novamente e reenvie o link de confirmação.</p>
            <button onClick={() => router.push('/')} style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '12px 32px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: FONT }}>Voltar ao início</button>
          </>
        )}
      </div>
    </div>
  )
}
