'use client'

import { useState, useEffect } from 'react'
import { IconLink, IconKey, IconEye, IconEyeOff } from '@/components/ui/Icons'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function forcaSenha(senha: string) {
  if (senha.length < 6) return { nivel: 0, label: 'Muito curta', cor: '#ef4444' }
  if (senha.length < 8) return { nivel: 1, label: 'Fraca', cor: '#f59e0b' }
  const temNum  = /\d/.test(senha)
  const temEsp  = /[^a-zA-Z0-9]/.test(senha)
  const temMaiu = /[A-Z]/.test(senha)
  const score   = [temNum, temEsp, temMaiu].filter(Boolean).length
  if (score <= 1) return { nivel: 2, label: 'Média', cor: '#f59e0b' }
  return { nivel: 3, label: 'Forte', cor: '#22c55e' }
}

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [showConf, setShowConf]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState(false)
  const [validSession, setValidSession] = useState<boolean | null>(null)

  // Verifica se o usuário chegou via link de recuperação
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setValidSession(!!data.session)
    })

    // Escuta o evento de password recovery
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleReset() {
    setError('')

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      setError(err.message.includes('same password')
        ? 'A nova senha não pode ser igual à anterior.'
        : 'Erro ao atualizar senha. O link pode ter expirado.')
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/dashboard-financeiro'), 3000)
  }

  const forca     = forcaSenha(password)
  const coincidem = confirm.length > 0 && password === confirm

  // ── Loading state ────────────────────────────────────────────────────────

  if (validSession === null) {
    return (
      <div style={{ minHeight: '100vh', background: '#080a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 32, animation: 'spin 1s linear infinite' }}>⏳</div>
      </div>
    )
  }

  // ── Link inválido ─────────────────────────────────────────────────────────

  if (!validSession) {
    return (
      <div style={{ minHeight: '100vh', background: '#080a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <IconLink size={48} color="rgba(255,255,255,0.3)" style={{marginBottom:20}} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f0f0f0', marginBottom: 10 }}>Link inválido ou expirado</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28, lineHeight: 1.6 }}>
            O link de recuperação expirou ou já foi usado. Solicite um novo na tela de login.
          </p>
          <button onClick={() => router.push('/')}
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '12px 28px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Voltar ao início
          </button>
        </div>
      </div>
    )
  }

  // ── Sucesso ───────────────────────────────────────────────────────────────

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#080a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <svg width="48" height="48" viewBox="0 0 20 20" fill="none" style={{marginBottom:20}}><circle cx="10" cy="10" r="7.5" stroke="rgba(34,197,94,0.5)" strokeWidth="1.4"/><path d="M6 10l3 3 5-6" stroke="rgba(34,197,94,0.7)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#22c55e', marginBottom: 10 }}>Senha atualizada!</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
            Sua senha foi alterada com sucesso. Redirecionando para o dashboard...
          </p>
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#080a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <div style={{ width: '100%', maxWidth: 420, background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ padding: '28px 32px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            <IconKey size={16} color="rgba(255,255,255,0.4)" style={{marginRight:6}} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: '#f0f0f0', marginBottom: 3 }}>Criar nova senha</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Escolha uma senha forte para sua conta</p>
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: '24px 32px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Nova senha */}
          <div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Nova senha</p>
            <div style={{ position: 'relative' }}>
              <input
                autoFocus
                type={showPass ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${password.length > 0 && password.length < 6 ? 'rgba(239,68,68,0.5)' : password.length >= 6 ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 10, padding: '13px 44px 13px 16px', color: '#fff', fontSize: 14,
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.2s',
                }}
              />
              <button type="button" onClick={() => setShowPass(s => !s)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 16 }}>
                {showPass ? <IconEyeOff size={16} color='rgba(255,255,255,0.4)' /> : <IconEye size={16} color='rgba(255,255,255,0.4)' />}
              </button>
            </div>

            {/* Força da senha */}
            {password.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3].map(n => (
                    <div key={n} style={{ height: 3, flex: 1, borderRadius: 2, background: n <= forca.nivel ? forca.cor : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
                  ))}
                </div>
                <p style={{ fontSize: 11, color: forca.cor }}>{forca.label}</p>
              </div>
            )}
          </div>

          {/* Confirmar senha */}
          <div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Confirmar senha</p>
            <div style={{ position: 'relative' }}>
              <input
                type={showConf ? 'text' : 'password'}
                placeholder="Repita a nova senha"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${confirm.length > 0 ? (coincidem ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.5)') : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 10, padding: '13px 44px 13px 16px', color: '#fff', fontSize: 14,
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.2s',
                }}
              />
              <button type="button" onClick={() => setShowConf(s => !s)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 16 }}>
                {showConf ? <IconEyeOff size={16} color='rgba(255,255,255,0.4)' /> : <IconEye size={16} color='rgba(255,255,255,0.4)' />}
              </button>
            </div>
            {confirm.length > 0 && !coincidem && (
              <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>⚠ As senhas não coincidem</p>
            )}
            {coincidem && (
              <p style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }}>✓ As senhas coincidem</p>
            )}
          </div>

          {/* Erro do servidor */}
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: '#ef4444' }}>⚠</span>
              <p style={{ fontSize: 13, color: '#ef4444' }}>{error}</p>
            </div>
          )}

          {/* Botão */}
          <button
            onClick={handleReset}
            disabled={loading || password.length < 6 || !coincidem}
            style={{
              background: password.length >= 6 && coincidem
                ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                : 'rgba(255,255,255,0.06)',
              border: 'none',
              color: password.length >= 6 && coincidem ? '#000' : 'rgba(255,255,255,0.3)',
              padding: '14px', borderRadius: 10, fontWeight: 700, cursor: loading || !coincidem ? 'not-allowed' : 'pointer',
              fontSize: 15, opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {loading ? (
              <><span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Atualizando...</>
            ) : 'Salvar nova senha →'}
          </button>

        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
