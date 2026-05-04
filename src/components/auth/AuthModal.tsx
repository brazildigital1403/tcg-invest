'use client'

/**
 * Modal de autenticação global do Bynx.
 *
 * Extraído do src/app/page.tsx pra funcionar SOBRE qualquer página
 * (landings, /lojas, /perfil, etc). O modal era acoplado à home e os CTAs
 * "Cadastrar" das landings redirecionavam pra `/` antes de abrir — quebrando
 * o contexto pro user (estava lendo sobre Lojas, era jogado pra HOME que
 * fala de Coleção).
 *
 * Comportamento idêntico ao modal antigo:
 *   - Step 0 (opcional): escolha de plano (free / mensal / anual)
 *   - Step 1: dados da conta (nome, email, senha, nascimento)
 *   - Step 2: perfil (CPF, cidade, WhatsApp, aceites LGPD)
 *   - Login: email + senha + recovery
 *   - Após signup com plano pago, redireciona pra Stripe Checkout
 *   - Após signup free / login, redireciona pra `next` (ou /dashboard-financeiro)
 *
 * Uso (via AuthModalProvider):
 *   const { openSignup, openLogin } = useAuthModal()
 *   openSignup({ next: '/minha-colecao' })
 *
 * Ou via querystring na URL (qualquer rota):
 *   ?auth=signup&next=/minha-colecao
 *   ?auth=login
 */

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { trackProUpgradeInitiated } from '@/lib/analytics'
import { IconWarning, IconClose, IconEye, IconEyeOff } from '@/components/ui/Icons'

// ─── Validadores ─────────────────────────────────────────────────────────────

function validarCPF(cpf: string) {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i)
  let rest = (sum * 10) % 11
  if (rest === 10 || rest === 11) rest = 0
  if (rest !== parseInt(digits[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i)
  rest = (sum * 10) % 11
  if (rest === 10 || rest === 11) rest = 0
  return rest === parseInt(digits[10])
}

function formatarCPF(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4')
          .replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3')
          .replace(/(\d{3})(\d{1,3})/, '$1.$2')
}

function formatarWhatsApp(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

function validarEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function forcasenha(senha: string) {
  if (senha.length < 6) return { nivel: 0, label: 'Muito curta', cor: '#ef4444' }
  if (senha.length < 8) return { nivel: 1, label: 'Fraca', cor: '#f59e0b' }
  const temNum = /\d/.test(senha)
  const temEsp = /[^a-zA-Z0-9]/.test(senha)
  const temMaius = /[A-Z]/.test(senha)
  const score = [temNum, temEsp, temMaius].filter(Boolean).length
  if (score === 0) return { nivel: 1, label: 'Fraca', cor: '#f59e0b' }
  if (score === 1) return { nivel: 2, label: 'Média', cor: '#f59e0b' }
  return { nivel: 3, label: 'Forte', cor: '#22c55e' }
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function Campo({ label, erro, children }: { label?: string; erro?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>}
      {children}
      {erro && (
        <p style={{ fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconWarning size={14} color="#ef4444" style={{marginRight:4}} /> {erro}
        </p>
      )}
    </div>
  )
}

function inputStyle(erro?: string, valido?: boolean): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${erro ? 'rgba(239,68,68,0.6)' : valido ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 10, padding: '13px 16px', color: '#fff', fontSize: 14,
    outline: 'none', width: '100%', boxSizing: 'border-box' as const,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    transition: 'border-color 0.2s',
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface AuthModalProps {
  open: boolean
  onClose: () => void
  /** 'signup' abre na escolha de plano (step 0). 'login' abre direto no form de login. */
  initialMode?: 'signup' | 'login'
  /** Plano pré-selecionado (pula o step 0 e vai direto pro form de cadastro com badge do plano). */
  initialPlan?: 'free' | 'mensal' | 'anual' | null
  /** Rota pra redirecionar pós-auth. Validada (precisa começar com '/' e não ser '//'). */
  next?: string | null
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export default function AuthModal({ open, onClose, initialMode = 'signup', initialPlan = null, next = null }: AuthModalProps) {
  const router = useRouter()

  // Estado do fluxo (todos resetados quando o modal abre)
  const [isLogin, setIsLogin] = useState(initialMode === 'login')
  const [showPlanStep, setShowPlanStep] = useState(initialMode === 'signup' && !initialPlan)
  const [pendingPlan, setPendingPlan] = useState<'free' | 'mensal' | 'anual' | null>(initialPlan)

  // Campos do form
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [dataNasc, setDataNasc] = useState('')
  const [termosAceito, setTermosAceito] = useState(false)
  const [marketingAceito, setMarketingAceito] = useState(false)
  const [city, setCity] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [signupStep, setSignupStep] = useState(1) // 1 = conta, 2 = perfil + aceites

  // Recovery
  const [forgotStep, setForgotStep] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  // Validação / erros
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  // ─── Resets quando o modal reabre ──────────────────────────────────────
  // Quando `open` muda de false → true, reseta tudo pro estado inicial
  // (mantendo só o que veio nas props). Evita carregar lixo da última abertura.
  React.useEffect(() => {
    if (open) {
      setIsLogin(initialMode === 'login')
      setShowPlanStep(initialMode === 'signup' && !initialPlan)
      setPendingPlan(initialPlan)
      setSignupStep(1)
      setForgotStep(false)
      setForgotSent(false)
      setForgotEmail('')
      setName(''); setCpf(''); setCity(''); setWhatsapp('')
      setEmail(''); setPassword(''); setShowPassword(false)
      setDataNasc(''); setTermosAceito(false); setMarketingAceito(false)
      setTouched({}); setErros({}); setServerError('')
      setLoading(false)
    }
  }, [open, initialMode, initialPlan])

  // ─── Helpers ──────────────────────────────────────────────────────────

  function calcIdade(nasc: string) {
    if (!nasc) return -1
    const hoje = new Date(); const d = new Date(nasc)
    let idade = hoje.getFullYear() - d.getFullYear()
    if (hoje.getMonth() - d.getMonth() < 0 || (hoje.getMonth() - d.getMonth() === 0 && hoje.getDate() < d.getDate())) idade--
    return idade
  }
  const idadeCalc = calcIdade(dataNasc)
  const menorDe13  = dataNasc !== '' && idadeCalc < 13
  const entre13e17 = dataNasc !== '' && idadeCalc >= 13 && idadeCalc < 18

  function validarCampos() {
    const e: Record<string, string> = {}
    if (!isLogin) {
      if (!name.trim() || name.trim().split(' ').filter(Boolean).length < 2)
        e.name = 'Informe nome e sobrenome'
      if (!validarCPF(cpf))
        e.cpf = 'CPF inválido'
      if (!city.trim())
        e.city = 'Informe sua cidade'
      const wDigits = whatsapp.replace(/\D/g, '')
      if (wDigits.length < 10)
        e.whatsapp = 'WhatsApp incompleto (DDD + número)'
    }
    if (!validarEmail(email))
      e.email = 'E-mail inválido'
    if (password.length < 6)
      e.password = 'Senha deve ter pelo menos 6 caracteres'
    return e
  }

  function handleBlur(field: string) {
    setTouched(prev => ({ ...prev, [field]: true }))
    setErros(validarCampos())
  }

  function trocarModo() {
    setIsLogin(!isLogin)
    setShowPlanStep(false)
    setForgotStep(false); setForgotSent(false); setForgotEmail('')
    setName(''); setCpf(''); setCity(''); setWhatsapp('')
    setEmail(''); setPassword('')
    setTouched({}); setErros({}); setServerError('')
  }

  async function handleForgotPassword() {
    if (!forgotEmail || !validarEmail(forgotEmail)) return
    setForgotLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setForgotLoading(false)
    if (!error) setForgotSent(true)
  }

  async function handleAuth() {
    const allTouched: Record<string, boolean> = { name: true, cpf: true, city: true, whatsapp: true, email: true, password: true }
    setTouched(allTouched)
    const e = validarCampos()
    setErros(e)
    if (Object.keys(e).length > 0) return

    if (!isLogin && menorDe13) { setServerError('Cadastro não permitido para menores de 13 anos.'); return }
    if (!isLogin && !termosAceito) { setServerError('Você precisa aceitar os Termos de Uso e a Política de Privacidade.'); return }
    setLoading(true)
    setServerError('')
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          if (error.message.includes('Invalid login')) setServerError('E-mail ou senha incorretos.')
          else setServerError(error.message)
          return
        }
        onClose()
        const loginDest = next || '/dashboard-financeiro'
        router.push(loginDest)
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name, cpf, city, whatsapp } },
        })
        if (error) {
          if (error.message.includes('already registered')) setServerError('Este e-mail já está cadastrado.')
          else setServerError(error.message)
          return
        }
        if (data.user) {
          const trialExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          await supabase.from('users').insert({ id: data.user.id, email, name, cpf, city, whatsapp, trial_expires_at: trialExpiry, data_nascimento: dataNasc || null, termos_aceitos_em: new Date().toISOString(), marketing_aceito: marketingAceito })

          setServerError('')
          onClose()

          // Plano pago → Stripe Checkout
          if (pendingPlan && pendingPlan !== 'free') {
            try {
              trackProUpgradeInitiated(pendingPlan)
              // S29: precisa pegar session ATUAL pro Bearer token
              // (auth.signUp já loga o user automaticamente).
              const { data: { session } } = await supabase.auth.getSession()
              if (!session?.access_token) {
                router.push(next || '/dashboard-financeiro')
                return
              }
              const res = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ plano: pendingPlan }),
              })
              const checkoutData = await res.json()
              if (checkoutData.url) { window.location.href = checkoutData.url; return }
            } catch { }
          }
          // Free ou falha no Stripe → next ou dashboard
          const signupDest = next || '/dashboard-financeiro'
          router.push(signupDest)
        }
      }
    } catch (err: any) {
      setServerError('Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────

  if (!open) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 440, boxShadow: '0 32px 80px rgba(0,0,0,0.7)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>
              {showPlanStep ? 'Escolha seu plano' : forgotStep ? 'Recuperar acesso' : isLogin ? 'Bem-vindo de volta' : 'Criar sua conta'}
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              {showPlanStep ? 'Organize sua coleção grátis ou desbloqueie mais com o Pro' : forgotStep ? 'Enviaremos um link para seu e-mail' : isLogin ? 'Entre para acessar sua coleção' : 'Grátis · 7 dias de Pro incluídos ⭐'}
            </p>
            {!isLogin && !forgotStep && !showPlanStep && pendingPlan && pendingPlan !== 'free' && (
              <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '5px 10px' }}>
                <span style={{ fontSize: 13 }}>⭐</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>
                  Plano Pro {pendingPlan === 'mensal' ? 'Mensal · R$ 29,90/mês' : 'Anual · R$ 249/ano'} será ativado após o cadastro
                </span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: 32, height: 32, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconClose size={13} color="rgba(255,255,255,0.4)" /></button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 28px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* STEP 0: Escolha de plano */}
          {showPlanStep ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => { setPendingPlan('free'); setShowPlanStep(false) }}
                style={{ width: '100%', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: '#f0f0f0', transition: 'all 0.15s', position: 'relative' }}>
                <div style={{ position: 'absolute', top: -10, left: 16, background: 'rgba(245,158,11,0.9)', color: '#000', fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 100, letterSpacing: '0.05em' }}>
                  ⭐ 7 DIAS DE PRO GRÁTIS
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>Começar grátis</span>
                  <span style={{ fontSize: 18, fontWeight: 900 }}>R$ 0</span>
                </div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>7 dias de Pro completo · depois 6 cartas grátis para sempre</p>
              </button>

              <button onClick={() => { setPendingPlan('mensal'); setShowPlanStep(false) }}
                style={{ width: '100%', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: '#f0f0f0', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>Pro Mensal</span>
                  <span style={{ fontSize: 18, fontWeight: 900, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>R$ 29,90<span style={{ fontSize: 11 }}>/mês</span></span>
                </div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>Cartas ilimitadas · Perfil público · Exportar · Marketplace completo</p>
              </button>

              <button onClick={() => { setPendingPlan('anual'); setShowPlanStep(false) }}
                style={{ width: '100%', background: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(239,68,68,0.08))', border: '2px solid rgba(245,158,11,0.5)', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: '#f0f0f0', position: 'relative', transition: 'all 0.15s' }}>
                <div style={{ position: 'absolute', top: -10, right: 16, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#000', fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 100, letterSpacing: '0.05em' }}>
                  MELHOR VALOR
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>Pro Anual</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 18, fontWeight: 900, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>R$ 249</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block' }}>R$ 14,91/mês · 2 meses grátis</span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>Tudo do Pro + prioridade no suporte + acesso antecipado</p>
              </button>

              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 4 }}>
                Sem cartão de crédito para começar gratuitamente
              </p>
            </div>
          ) : forgotStep ? (
            /* RECOVERY */
            forgotSent ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <svg width="48" height="48" viewBox="0 0 20 20" fill="none" style={{marginBottom:16}}><rect x="2" y="5" width="16" height="11" rx="2" stroke="rgba(245,158,11,0.6)" strokeWidth="1.3"/><path d="M2 7l8 6 8-6" stroke="rgba(245,158,11,0.6)" strokeWidth="1.3" strokeLinecap="round"/></svg>
                <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>E-mail enviado!</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 24 }}>
                  Verifique sua caixa de entrada em{' '}
                  <span style={{ color: '#f59e0b' }}>{forgotEmail}</span>{' '}
                  e clique no link para criar uma nova senha.
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginBottom: 20 }}>
                  Não recebeu? Verifique o spam ou tente novamente.
                </p>
                <button
                  onClick={() => { setForgotStep(false); setForgotSent(false) }}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', padding: '10px 24px', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}
                >
                  ← Voltar ao login
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{flexShrink:0}}><path d="M10 2a6 6 0 014.5 10l-1 1.5H6.5L5.5 12A6 6 0 0110 2z" stroke="rgba(245,158,11,0.8)" strokeWidth="1.3"/><path d="M7.5 16.5h5M8.5 18.5h3" stroke="rgba(245,158,11,0.6)" strokeWidth="1.3" strokeLinecap="round"/></svg>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                    Informe seu e-mail cadastrado e enviaremos um link para criar uma nova senha.
                  </p>
                </div>
                <Campo erro={forgotEmail.length > 0 && !validarEmail(forgotEmail) ? 'E-mail inválido' : undefined}>
                  <input
                    autoFocus
                    type="email"
                    placeholder="Seu e-mail cadastrado"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleForgotPassword() }}
                    style={inputStyle(
                      forgotEmail.length > 0 && !validarEmail(forgotEmail) ? 'inválido' : undefined,
                      forgotEmail.length > 0 && validarEmail(forgotEmail)
                    )}
                  />
                </Campo>
                <button
                  onClick={handleForgotPassword}
                  disabled={forgotLoading || !validarEmail(forgotEmail)}
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '13px', borderRadius: 10, fontWeight: 700, cursor: forgotLoading ? 'not-allowed' : 'pointer', fontSize: 14, opacity: forgotLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {forgotLoading ? (
                    <>
                      <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      Enviando...
                    </>
                  ) : 'Enviar link de recuperação →'}
                </button>
                <button
                  onClick={() => setForgotStep(false)}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 13, textAlign: 'center' }}
                >
                  ← Voltar ao login
                </button>
              </div>
            )
          ) : (
            /* FORM LOGIN / CADASTRO */
            <>
              {!isLogin && (() => {
                const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }
                return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {[1,2].map(s => (
                      <div key={s} style={{ flex: 1, height: 3, borderRadius: 100, background: s <= signupStep ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>
                    Etapa {signupStep} de 2 — {signupStep === 1 ? 'Dados da conta' : 'Perfil e aceites'}
                  </p>

                  {signupStep === 1 && (
                    <>
                      <div>
                        <label style={lbl}>Nome completo *</label>
                        <Campo erro={touched.name ? erros.name : undefined}>
                          <input type="text" placeholder="Seu nome completo"
                            value={name}
                            onChange={e => { setName(e.target.value); if (touched.name) setErros(validarCampos()) }}
                            onBlur={() => handleBlur('name')}
                            style={inputStyle(touched.name ? erros.name : undefined, touched.name && !erros.name && name.length > 3)}
                          />
                        </Campo>
                      </div>
                      <div>
                        <label style={lbl}>Data de nascimento *</label>
                        <input type="date" value={dataNasc} onChange={e => setDataNasc(e.target.value)}
                          max={new Date().toISOString().split('T')[0]}
                          style={{ ...inputStyle(), width: '100%', colorScheme: 'dark' }}
                        />
                      </div>
                      {menorDe13 && (
                        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 14px' }}>
                          <p style={{ fontSize: 13, color: '#ef4444', lineHeight: 1.5 }}>🔒 <strong>Cadastro não permitido.</strong> O Bynx não permite cadastro de menores de 13 anos (LGPD, Art. 14).</p>
                        </div>
                      )}
                      {entre13e17 && (
                        <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 14px' }}>
                          <p style={{ fontSize: 13, color: '#f59e0b', lineHeight: 1.5 }}>⚠️ Ao continuar, declare que possui autorização de um responsável legal (LGPD, Art. 14).</p>
                        </div>
                      )}
                    </>
                  )}

                  {signupStep === 2 && (
                    <>
                      <div>
                        <label style={lbl}>CPF *</label>
                        <Campo erro={touched.cpf ? erros.cpf : undefined}>
                          <input type="text" placeholder="000.000.000-00"
                            value={cpf}
                            onChange={e => { setCpf(formatarCPF(e.target.value)); if (touched.cpf) setErros(validarCampos()) }}
                            onBlur={() => handleBlur('cpf')}
                            style={inputStyle(touched.cpf ? erros.cpf : undefined, touched.cpf && !erros.cpf && cpf.length > 0)}
                          />
                        </Campo>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={lbl}>Cidade *</label>
                          <Campo erro={touched.city ? erros.city : undefined}>
                            <input type="text" placeholder="Cidade"
                              value={city}
                              onChange={e => { setCity(e.target.value); if (touched.city) setErros(validarCampos()) }}
                              onBlur={() => handleBlur('city')}
                              style={inputStyle(touched.city ? erros.city : undefined, touched.city && !erros.city && city.length > 0)}
                            />
                          </Campo>
                        </div>
                        <div>
                          <label style={lbl}>WhatsApp *</label>
                          <Campo erro={touched.whatsapp ? erros.whatsapp : undefined}>
                            <input type="text" placeholder="(11) 99999-9999"
                              value={whatsapp}
                              onChange={e => { setWhatsapp(formatarWhatsApp(e.target.value)); if (touched.whatsapp) setErros(validarCampos()) }}
                              onBlur={() => handleBlur('whatsapp')}
                              style={inputStyle(touched.whatsapp ? erros.whatsapp : undefined, touched.whatsapp && !erros.whatsapp && whatsapp.length > 0)}
                            />
                          </Campo>
                        </div>
                      </div>
                    </>
                  )}
                </>
                )
              })()}

              {(!isLogin ? signupStep === 1 : true) && <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>E-mail *</label>
                <Campo erro={touched.email ? erros.email : undefined}>
                  <input type="email" placeholder="seu@email.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (touched.email) setErros(validarCampos()) }}
                    onBlur={() => handleBlur('email')}
                    style={inputStyle(touched.email ? erros.email : undefined, touched.email && !erros.email && email.length > 0)}
                  />
                </Campo>
              </div>}

              {(!isLogin ? signupStep === 1 : true) && <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Senha *</label>
                <Campo erro={touched.password ? erros.password : undefined}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Senha"
                      value={password}
                      onChange={e => { setPassword(e.target.value); if (touched.password) setErros(validarCampos()) }}
                      onBlur={() => handleBlur('password')}
                      style={{ ...inputStyle(touched.password ? erros.password : undefined, touched.password && !erros.password && password.length > 0), paddingRight: 44 }}
                    />
                    <button type="button" onClick={() => setShowPassword(s => !s)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 16 }}>
                      {showPassword ? <IconEyeOff size={16} color='rgba(255,255,255,0.4)' /> : <IconEye size={16} color='rgba(255,255,255,0.4)' />}
                    </button>
                  </div>
                  {!isLogin && password.length > 0 && (() => {
                    const f = forcasenha(password)
                    return (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                          {[1,2,3].map(n => (
                            <div key={n} style={{ height: 3, flex: 1, borderRadius: 2, background: n <= f.nivel ? f.cor : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
                          ))}
                        </div>
                        <p style={{ fontSize: 11, color: f.cor }}>{f.label}</p>
                      </div>
                    )
                  })()}
                </Campo>
              </div>}

              {!isLogin && signupStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={termosAceito} onChange={e => setTermosAceito(e.target.checked)}
                      style={{ marginTop: 3, accentColor: '#f59e0b', width: 15, height: 15, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                      Li e aceito os{' '}
                      <a href="/termos" target="_blank" style={{ color: '#f59e0b', textDecoration: 'underline' }}>Termos de Uso</a>
                      {' '}e a{' '}
                      <a href="/privacidade" target="_blank" style={{ color: '#f59e0b', textDecoration: 'underline' }}>Política de Privacidade</a>
                      {' '}<span style={{ color: '#ef4444' }}>*</span>
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={marketingAceito} onChange={e => setMarketingAceito(e.target.checked)}
                      style={{ marginTop: 3, accentColor: '#f59e0b', width: 15, height: 15, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                      Quero receber novidades e dicas de TCG do Bynx <span style={{ color: 'rgba(255,255,255,0.25)' }}>(opcional)</span>
                    </span>
                  </label>
                </div>
              )}

              {serverError && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconWarning size={16} color="#ef4444" />
                  <p style={{ fontSize: 13, color: '#ef4444' }}>{serverError}</p>
                </div>
              )}

              {!isLogin && signupStep === 1 ? (
                <>
                  <button
                    disabled={!name.trim() || !email.trim() || !password.trim() || !dataNasc || menorDe13}
                    onClick={() => {
                      const e = validarCampos()
                      if (e.name || e.email || e.password) { setErros(e); setTouched({ name: true, email: true, password: true }); return }
                      if (!dataNasc) { setServerError('Informe sua data de nascimento.'); return }
                      setServerError(''); setSignupStep(2)
                    }}
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '14px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 15, marginTop: 4, opacity: (!name.trim() || !email.trim() || !password.trim() || !dataNasc || menorDe13) ? 0.5 : 1 }}>
                    Continuar →
                  </button>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: -4 }}>* campos obrigatórios</p>
                </>
              ) : (
                <>
                  {!isLogin && (
                    <button onClick={() => setSignupStep(1)}
                      style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', padding: '11px', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
                      ← Voltar
                    </button>
                  )}
                  <button onClick={handleAuth} disabled={loading}
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '14px', borderRadius: 10, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15, opacity: loading ? 0.7 : 1, marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {loading ? (
                      <>
                        <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                        Carregando...
                      </>
                    ) : isLogin ? 'Entrar →'
                      : pendingPlan === 'mensal' ? 'Criar conta e assinar Pro Mensal →'
                      : pendingPlan === 'anual' ? 'Criar conta e assinar Pro Anual →'
                      : 'Criar conta grátis →'}
                  </button>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: -4 }}>* campos obrigatórios</p>
                </>
              )}

              {isLogin && (
                <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: -4 }}>
                  Esqueceu a senha?{' '}
                  <button
                    style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: 12 }}
                    onClick={() => { setForgotStep(true); setForgotEmail(email); setForgotSent(false) }}
                  >
                    Recuperar acesso
                  </button>
                </p>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        {!forgotStep && (
          <div style={{ padding: '14px 28px', borderTop: '1px solid rgba(255,255,255,0.07)', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
              {isLogin ? 'Não tem conta? ' : 'Já tem conta? '}
              <button onClick={trocarModo} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                {isLogin ? 'Criar gratuitamente' : 'Entrar'}
              </button>
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
