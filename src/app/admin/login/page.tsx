'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const qp     = useSearchParams()
  const next   = qp.get('next') || '/admin'

  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [err,      setErr]      = useState('')

  async function submit() {
    setLoading(true); setErr('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setErr(d.error || 'Erro ao autenticar')
      setPassword('')
      return
    }
    router.push(next)
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      background: '#080a0f',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '40px 36px',
        width: '100%', maxWidth: 400,
        color: '#f0f0f0',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 30, width: 'auto', marginBottom: 14 }} />
          <p style={{
            fontSize: 11, fontWeight: 800,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            margin: 0,
          }}>
            Painel Administrativo
          </p>
        </div>

        <label style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: 6,
          display: 'block',
        }}>Senha de acesso</label>

        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          autoFocus
          placeholder="••••••••"
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: '12px 14px',
            color: '#f0f0f0',
            fontSize: 14,
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: 14,
            fontFamily: 'inherit',
            letterSpacing: '0.1em',
          }}
        />

        {err && (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#ef4444',
            fontSize: 12,
            padding: '8px 12px',
            borderRadius: 8,
            marginBottom: 14,
          }}>
            {err}
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading || !password}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            border: 'none', color: '#000',
            padding: '12px', borderRadius: 10,
            fontSize: 14, fontWeight: 800,
            cursor: (loading || !password) ? 'not-allowed' : 'pointer',
            opacity: (loading || !password) ? 0.5 : 1,
            fontFamily: 'inherit',
          }}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <p style={{
          textAlign: 'center',
          fontSize: 11,
          color: 'rgba(255,255,255,0.25)',
          marginTop: 22, marginBottom: 0,
        }}>
          Acesso restrito · Bynx.gg
        </p>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#080a0f' }} />}>
      <LoginForm />
    </Suspense>
  )
}