'use client'

import { useEffect, useState, CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/**
 * Modal de autenticação usado pelo PublicHeader em qualquer página pública.
 *
 * Fluxos suportados:
 *   - Login (email + senha)
 *   - Recuperar senha (email → link via Supabase)
 *
 * IMPORTANTE: este modal NÃO tem fluxo de cadastro próprio. Todo signup passa
 * pelo modal antigo da landing (`src/app/page.tsx`), que tem o funil completo
 * com escolha de plano. Quando o user clica "Criar conta" aqui:
 *   - Se já está na landing → dispara CustomEvent 'bynx:open-signup'
 *   - Se está em outra página → navega pra `/?auth=signup`
 *
 * A landing escuta o evento e lê o query param, abrindo o modal antigo em
 * modo signup. Isso garante consistência: todo cadastro passa pelo mesmo funil.
 */

interface Props {
  open: boolean
  onClose: () => void
}

export default function AuthModal({ open, onClose }: Props) {
  const router = useRouter()

  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgotSent, setForgotSent] = useState(false)

  // Reseta o estado quando o modal abre/fecha
  useEffect(() => {
    if (open) {
      setMode('login')
      setError(null)
      setForgotSent(false)
    } else {
      // Limpa campos ao fechar (evita deixar senha em memória)
      setEmail('')
      setPassword('')
      setShowPassword(false)
      setError(null)
      setForgotSent(false)
    }
  }, [open])

  // Fecha com ESC
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Bloqueia scroll do body quando aberto
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.trim()) { setError('Informe seu e-mail.'); return }
    if (mode === 'login' && !password) { setError('Informe sua senha.'); return }

    setLoading(true)
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (err) { setError('E-mail ou senha inválidos.'); return }
        onClose()
        router.push('/dashboard-financeiro')
      } else if (mode === 'forgot') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/recuperar-senha` : undefined,
        })
        if (err) { setError('Não foi possível enviar o e-mail. Verifique o endereço informado.'); return }
        setForgotSent(true)
      }
    } catch (err) {
      console.error(err)
      setError('Algo deu errado. Tente novamente em instantes.')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handler do botão "Criar conta grátis".
   *
   * - Se já está na landing: dispara evento customizado 'bynx:open-signup'
   *   (a landing escuta e abre o modal antigo em modo signup)
   * - Se está em outra página: navega pra /?auth=signup
   *   (a landing lê o query param no mount e abre o modal)
   */
  function handleOpenSignup() {
    onClose()
    if (typeof window === 'undefined') return

    if (window.location.pathname === '/') {
      // Pequeno delay pra garantir que o AuthModal já fechou antes do antigo abrir
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('bynx:open-signup'))
      }, 50)
    } else {
      router.push('/?auth=signup')
    }
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.card} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>
          <div>
            <h2 style={S.title}>
              {mode === 'forgot' ? 'Recuperar acesso' : 'Bem-vindo de volta'}
            </h2>
            <p style={S.subtitle}>
              {mode === 'forgot'
                ? 'Enviaremos um link pro seu e-mail'
                : 'Entre para acessar sua coleção'}
            </p>
          </div>
          <button type="button" onClick={onClose} style={S.closeBtn} aria-label="Fechar">✕</button>
        </div>

        {/* Body */}
        {forgotSent ? (
          <div style={S.successBox}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📬</div>
            <p style={S.successTitle}>E-mail enviado!</p>
            <p style={S.successMsg}>
              Se o endereço <strong>{email}</strong> estiver cadastrado, você vai receber um link
              pra redefinir sua senha em instantes.
            </p>
            <button type="button" onClick={() => { setMode('login'); setForgotSent(false) }} style={S.ctaPrimary}>
              Voltar pro login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={S.form}>
            <div>
              <label style={S.label}>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="voce@email.com"
                style={S.input}
                autoComplete="email"
                required
              />
            </div>

            {mode === 'login' && (
              <div>
                <label style={S.label}>Senha</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    style={{ ...S.input, paddingRight: 40 }}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={S.showPwdBtn}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    tabIndex={-1}
                  >
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
            )}

            {error && <div style={S.errorBox}>{error}</div>}

            <button type="submit" disabled={loading} style={{ ...S.ctaPrimary, opacity: loading ? 0.6 : 1, cursor: loading ? 'wait' : 'pointer' }}>
              {loading
                ? 'Aguarde...'
                : mode === 'forgot'
                ? 'Enviar link'
                : 'Entrar'}
            </button>

            {/* Links secundários */}
            <div style={S.secondaryLinks}>
              {mode === 'login' && (
                <>
                  <button type="button" onClick={() => { setMode('forgot'); setError(null) }} style={S.linkBtn}>
                    Esqueci minha senha
                  </button>
                  <span style={S.separator}>·</span>
                  <button type="button" onClick={handleOpenSignup} style={S.linkBtn}>
                    <span>Não tem conta? </span>
                    <strong style={{ color: '#f59e0b' }}>Criar conta grátis</strong>
                  </button>
                </>
              )}
              {mode === 'forgot' && (
                <button type="button" onClick={() => { setMode('login'); setError(null) }} style={S.linkBtn}>
                  ← Voltar pro login
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    overflow: 'auto',
  },
  card: {
    background: '#0f1117',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: '28px 24px',
    width: '100%',
    maxWidth: 440,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    color: '#f0f0f0',
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
    maxHeight: 'calc(100vh - 40px)',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    margin: 0,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    margin: 0,
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '50%',
    width: 32,
    height: 32,
    color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
    fontSize: 13,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  input: {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: '12px 14px',
    color: '#f0f0f0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  showPwdBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    padding: 4,
  },
  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 13,
    color: '#ef4444',
  },
  ctaPrimary: {
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    border: 'none',
    color: '#000',
    padding: '13px 20px',
    borderRadius: 10,
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: 'inherit',
    marginTop: 4,
  },
  secondaryLinks: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 14,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.55)',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    padding: '4px 2px',
  },
  separator: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 13,
  },

  // ─── Sucesso do "esqueci senha" ───
  successBox: {
    textAlign: 'center',
    padding: '16px 8px',
  },
  successTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#22c55e',
    margin: 0,
    marginBottom: 8,
  },
  successMsg: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.6,
    margin: 0,
    marginBottom: 18,
  },
}