'use client'

import React, { useRef, useEffect, useState } from 'react'
import { IconWarning, IconLink, IconTrendingUp, IconTrendingDown, IconDashboard, IconMarketplace, IconShield, IconWallet, IconCheck, IconClose, IconEye, IconEyeOff, IconKey, IconFire, IconCollection, IconChart } from '@/components/ui/Icons'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { trackProUpgradeInitiated } from '@/lib/analytics'
import PublicHeader from '@/components/ui/PublicHeader'

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

// ─── Componente de campo com erro ─────────────────────────────────────────────

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

// ─── Estilos de input ─────────────────────────────────────────────────────────

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

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, textAlign: 'left', fontFamily: 'inherit' }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f0' }}>{q}</span>
        <span style={{ fontSize: 20, color: '#f59e0b', flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </button>
      {open && (
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, paddingBottom: 20 }}>{a}</p>
      )}
    </div>
  )
}


// ── Modal de Contato Comercial ────────────────────────────────────────────────

const CONTACT_CATEGORIES = [
  { id: 'parceria',    icon: '🤝', label: 'Parceria',                  desc: 'Lojas, distribuidores, organizadores de torneios' },
  { id: 'loja',        icon: '🏪', label: 'Quero minha loja no Bynx',  desc: 'Cadastre sua loja no nosso Guia de Lojas' },
  { id: 'imprensa',    icon: '📣', label: 'Imprensa & Mídia',          desc: 'Canais, podcasts e influencers de Pokémon TCG' },
  { id: 'sugestao',    icon: '💡', label: 'Sugestão de funcionalidade', desc: 'Ideias para melhorar o Bynx' },
  { id: 'duvida',      icon: '❓', label: 'Dúvida geral',              desc: 'Planos, pagamentos, privacidade' },
  { id: 'investidor',  icon: '💼', label: 'Investidor',                desc: 'Interesse em investir no Bynx' },
]

function ContactModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = React.useState<'category' | 'form' | 'done'>('category')
  const [category, setCategory] = React.useState<string>('')
  const [nome, setNome] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [mensagem, setMensagem] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [closing, setClosing] = React.useState(false)

  const selectedCat = CONTACT_CATEGORIES.find(c => c.id === category)

  const handleClose = () => {
    setClosing(true)
    setTimeout(onClose, 200)
  }

  async function handleSend() {
    if (!nome.trim() || !email.trim() || !mensagem.trim()) return
    setLoading(true)
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, categoryLabel: selectedCat?.label, nome, email, mensagem }),
      })
      setStep('done')
    } catch {
      // mesmo com erro, mostra sucesso (enviou ou não)
      setStep('done')
    }
    setLoading(false)
  }

  const S = {
    overlay: {
      position: 'fixed' as const, inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      opacity: closing ? 0 : 1, transition: 'opacity 0.2s ease',
    },
    box: {
      background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 500,
      fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0',
      transform: closing ? 'scale(0.97)' : 'scale(1)', transition: 'transform 0.2s ease',
    },
  }

  return (
    <div style={S.overlay} onClick={handleClose}>
      <div style={S.box} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>✦ Fale conosco</p>
            <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
              {step === 'done' ? 'Mensagem enviada!' : step === 'form' ? selectedCat?.label : 'Como podemos ajudar?'}
            </h2>
          </div>
          <button onClick={handleClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>×</button>
        </div>

        {/* Step 1 — escolha de categoria */}
        {step === 'category' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CONTACT_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setCategory(cat.id); setStep('form') }}
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s', fontFamily: 'inherit' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
              >
                <span style={{ fontSize: 22, flexShrink: 0 }}>{cat.icon}</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', marginBottom: 2 }}>{cat.label}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{cat.desc}</p>
                </div>
                <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.25)', fontSize: 18, flexShrink: 0 }}>›</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — formulário */}
        {step === 'form' && (
          <div>
            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>{selectedCat?.icon}</span>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{selectedCat?.desc}</p>
              <button onClick={() => setStep('category')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12, flexShrink: 0, fontFamily: 'inherit' }}>← Trocar</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <input
                type="text" placeholder="Seu nome" value={nome} onChange={e => setNome(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              />
              <input
                type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              />
              <textarea
                placeholder="Sua mensagem..." value={mensagem} onChange={e => setMensagem(e.target.value)}
                rows={4}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 14px', color: '#f0f0f0', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={loading || !nome.trim() || !email.trim() || !mensagem.trim()}
              style={{ width: '100%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', color: '#000', padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: loading ? 'wait' : 'pointer', opacity: (!nome.trim() || !email.trim() || !mensagem.trim()) ? 0.5 : 1, fontFamily: 'inherit' }}
            >
              {loading ? 'Enviando...' : 'Enviar mensagem →'}
            </button>
          </div>
        )}

        {/* Step 3 — confirmação */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 20px' }}>✓</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>Recebemos sua mensagem!</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28, lineHeight: 1.6 }}>Entraremos em contato em breve pelo e-mail <strong style={{ color: '#f59e0b' }}>{email}</strong>.</p>
            <button onClick={handleClose} style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', color: '#000', padding: '12px 32px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              Fechar
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default function Home() {
  const howRef = useRef<HTMLDivElement>(null)
  const pricingRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [showPlanStep, setShowPlanStep] = useState(false) // step 0: escolha do plano
  const [loading, setLoading] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<'free' | 'mensal' | 'anual' | null>(null)

  // Campos
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false) // mantido por compatibilidade, nao usado mais (PublicHeader gerencia seu proprio state)
  const [forgotStep, setForgotStep] = useState(false) // true = tela de recuperar senha
  const [signupStep, setSignupStep] = useState(1) // 1 = conta, 2 = perfil + aceites
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  // Erros por campo (só mostra após o usuário interagir)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')

  // Valida todos os campos e retorna erros
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

  // Marca campo como tocado e valida
  function handleBlur(field: string) {
    setTouched(prev => ({ ...prev, [field]: true }))
    setErros(validarCampos())
  }

  // Limpa tudo ao trocar de modo
  function trocarModo() {
    setIsLogin(!isLogin)
    setShowPlanStep(false)
    setForgotStep(false); setForgotSent(false); setForgotEmail('')
    setName(''); setCpf(''); setCity(''); setWhatsapp('')
    setEmail(''); setPassword('')
    setTouched({}); setErros({}); setServerError('')
  }

  async function handleForgotPassword() {
    if (!forgotEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) return
    setForgotLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setForgotLoading(false)
    if (!error) setForgotSent(true)
  }

  useEffect(() => {
    // ─── Detecta sessão sem redirecionar ────────────────────────
    // Agora que o Bynx tem várias seções (Guia de Lojas, Para Lojistas, etc),
    // a landing é navegável pra todo usuário — logado ou não. O botão
    // "Entrar" do header vira "Meu Dashboard" quando o user está logado,
    // permitindo acesso rápido sem empurrar o user pra fora da landing.
    async function getUser() {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) {
        setUser(data.session.user)
      }
    }
    getUser()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // ─── Lê query param ?auth=signup e abre modal antigo em fluxo de signup ──
  // Usado pelo AuthModal (botão "Criar conta") e por outras páginas que
  // queiram direcionar usuários pro funil completo de cadastro.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const authParam = params.get('auth')
    if (authParam === 'signup') {
      setIsLogin(false)
      setShowPlanStep(true)   // começa pela escolha de plano
      setShowAuthModal(true)
      // Remove o query param da URL sem recarregar
      const url = new URL(window.location.href)
      url.searchParams.delete('auth')
      window.history.replaceState({}, '', url.toString())
    } else if (authParam === 'login') {
      setIsLogin(true)
      setShowAuthModal(true)
      const url = new URL(window.location.href)
      url.searchParams.delete('auth')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  // ─── Escuta eventos customizados disparados pelo PublicHeader ──────────
  // 'bynx:open-signup' — clicou em "Criar conta" em algum lugar (abre modal em signup com plano)
  // 'bynx:open-login'  — clicou em "Entrar" no PublicHeader (abre modal em login)
  useEffect(() => {
    if (typeof window === 'undefined') return

    function handleOpenSignup() {
      setIsLogin(false)
      setShowPlanStep(true)
      setShowAuthModal(true)
    }
    function handleOpenLogin() {
      setIsLogin(true)
      setShowPlanStep(false)
      setShowAuthModal(true)
    }

    window.addEventListener('bynx:open-signup', handleOpenSignup)
    window.addEventListener('bynx:open-login', handleOpenLogin)
    return () => {
      window.removeEventListener('bynx:open-signup', handleOpenSignup)
      window.removeEventListener('bynx:open-login', handleOpenLogin)
    }
  }, [])

  const scrollTo = (ref: any) => ref.current?.scrollIntoView({ behavior: 'smooth' })

  // Abre modal com contexto do plano escolhido
  async function handleClickPlan(plano: 'free' | 'mensal' | 'anual') {
    // Se já logado e escolheu Pro → vai direto para Stripe
    if (user && plano !== 'free') {
      try {
        trackProUpgradeInitiated(plano)
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plano, userId: user.id, userEmail: user.email }),
        })
        const data = await res.json()
        if (data.url) window.location.href = data.url
      } catch { }
      return
    }
    // Se já logado e free → vai para dashboard
    if (user && plano === 'free') {
      router.push('/dashboard-financeiro')
      return
    }
    // Não logado → abre modal
    setPendingPlan(plano)
    setIsLogin(false)
    setShowAuthModal(true)
    // Se clicou em "grátis" mostra step de escolha de plano (incentiva upgrade)
    setShowPlanStep(plano === 'free')
  }

  async function handleAuth() {
    // Marca todos os campos como tocados e valida
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
        setShowAuthModal(false)
        router.push('/dashboard-financeiro')
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
          setShowAuthModal(false)

          // Redireciona conforme plano escolhido
          if (pendingPlan && pendingPlan !== 'free') {
            try {
              trackProUpgradeInitiated(pendingPlan)
              const res = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plano: pendingPlan, userId: data.user.id, userEmail: email }),
              })
              const checkoutData = await res.json()
              if (checkoutData.url) { window.location.href = checkoutData.url; return }
            } catch { }
          }
          router.push('/dashboard-financeiro')
        }
      }
    } catch (err: any) {
      setServerError('Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

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

  return (
    <div style={{ fontFamily: "'DM Sans', 'Sora', system-ui, sans-serif", background: '#080a0f', color: '#f0f0f0', minHeight: '100vh' }}>

      {/* CSS responsivo landing */}
      <style>{`
        @media (max-width: 768px) {
          .lp-hero-btns   { flex-direction: column !important; align-items: stretch !important; }
          .lp-mockup-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .lp-stats-row   { flex-wrap: wrap !important; gap: 24px !important; }
          .lp-sets-row    { gap: 24px !important; flex-wrap: wrap !important; }
          .lp-plans-grid  { grid-template-columns: 1fr !important; }
          .lp-how-grid    { grid-template-columns: 1fr !important; }
          .lp-feat-grid   { grid-template-columns: repeat(2, 1fr) !important; }
          .lp-mockup-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      {/* JSON-LD: FAQPage — rich snippets no Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "Precisa de cartão de crédito para começar?",
                acceptedAnswer: { "@type": "Answer", text: "Não. O plano gratuito é 100% gratuito e os 7 dias de Pro são liberados na hora, sem cartão. Você cria a conta com e-mail e já organiza sua coleção." }
              },
              {
                "@type": "Question",
                name: "Como adiciono minhas cartas no Bynx?",
                acceptedAnswer: { "@type": "Answer", text: "Tem dois caminhos: busca pelo nome na Pokédex de 22 mil+ cartas, ou Scan com IA — aponta a câmera, a carta é reconhecida e entra na coleção." }
              },
              {
                "@type": "Question",
                name: "O Bynx funciona com cartas em português, inglês e japonês?",
                acceptedAnswer: { "@type": "Answer", text: "Sim. O Bynx tem o catálogo internacional completo (sets em inglês e japonês) e também as edições brasileiras da Liga. Os preços são exibidos em reais (R$) atualizados." }
              },
              {
                "@type": "Question",
                name: "Como o Bynx sabe o preço das cartas Pokémon?",
                acceptedAnswer: { "@type": "Answer", text: "O Bynx coleta preços de referência do mercado brasileiro continuamente. Os valores são organizados por variante (Normal, Holo, Reverse Holo, Foil, Promo) e exibidos como mínimo, médio e máximo." }
              },
              {
                "@type": "Question",
                name: "Qual a diferença entre Normal, Holo, Reverse, Foil e Promo?",
                acceptedAnswer: { "@type": "Answer", text: "Cada variante tem preço próprio. Uma Holo pode valer 2x a Normal; uma Reverse Holo pode valer 5x. O Bynx separa cada variante para você ter o valor exato da carta que tem na mão." }
              },
              {
                "@type": "Question",
                name: "O Bynx vende minhas cartas Pokémon pra mim?",
                acceptedAnswer: { "@type": "Answer", text: "Não. O Marketplace conecta você direto com outros colecionadores via WhatsApp. Você cria o anúncio, recebe interessados, negocia e fecha. O Bynx é a vitrine; o trade é com você." }
              },
              {
                "@type": "Question",
                name: "Tenho uma loja de TCG. Posso aparecer no Bynx?",
                acceptedAnswer: { "@type": "Answer", text: "Sim. O Guia de Lojas Bynx é gratuito pra cadastrar e tem opções Pro e Premium para destaque, fotos, redes sociais e analytics dos seus visitantes." }
              },
            ]
          })
        }}
      />

      <PublicHeader landingScrollTargets={{ howRef, pricingRef }} />

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '120px 24px 80px', position: 'relative', overflow: 'hidden' }}>
        {/* Background glow */}
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(245,158,11,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', left: '20%', width: 300, height: 300, background: 'radial-gradient(ellipse, rgba(239,68,68,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 100, padding: '6px 16px', fontSize: 13, color: '#f59e0b', marginBottom: 32, fontWeight: 500 }}>
          ✦ A plataforma brasileira de coleções de Pokémon TCG
        </div>

        <h1 style={{ fontSize: 'clamp(40px, 7vw, 80px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 24, maxWidth: 900 }}>
          Quanto vale sua coleção<br />
          <span style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pokémon hoje?</span>
        </h1>

        <p style={{ fontSize: 20, color: 'rgba(255,255,255,0.55)', maxWidth: 620, lineHeight: 1.6, marginBottom: 24 }}>
          Você tem cartas guardadas há anos. Já trocou e ficou com a dúvida — <em style={{ color: 'rgba(255,255,255,0.75)', fontStyle: 'normal' }}>"será que vendi por menos do que valia?"</em>. O Bynx mostra o preço real em reais, atualizado, organizado, pra você decidir com base no que importa.
        </p>
        {/* Trial badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 100, padding: '8px 20px', marginBottom: 40 }}>
          <span style={{ fontSize: 16 }}>⭐</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#f59e0b' }}>7 dias de Pro grátis</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>· sem cartão de crédito</span>
        </div>

        <div className="lp-hero-btns" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 80 }}>
          <button
            onClick={() => handleClickPlan('free')}
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '16px 32px', borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: 'pointer', boxShadow: '0 0 40px rgba(245,158,11,0.3)' }}
          >
            Começar grátis →
          </button>
          <button
            onClick={() => scrollTo(howRef)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '16px 32px', borderRadius: 12, fontWeight: 600, fontSize: 16, cursor: 'pointer' }}
          >
            Ver como funciona
          </button>
        </div>

        {/* Dashboard mockup */}
        <div style={{ width: '100%', maxWidth: 860, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '24px', boxShadow: '0 40px 100px rgba(0,0,0,0.5)' }}>
          {/* Barra de tabs mockup */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }} />
          </div>
          {/* Stats */}
          <div className="lp-mockup-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'Mínimo da Carteira', value: 'R$ 29.009,50', color: '#22c55e' },
              { label: 'Valor Médio', value: 'R$ 29.565,36', color: '#60a5fa' },
              { label: 'Máximo da Carteira', value: 'R$ 52.879,20', color: '#f59e0b' },
            ].map((s) => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{s.label}</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
          {/* Cards mockup com imagens reais */}
          <div className="lp-mockup-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { name: 'Mew Star', variante: 'Holo', medio: 'R$ 19.000,00', badge: '#f59e0b', img: 'https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/card-images/liga-08B-Mew_20Star_20_14_2F29_.jpg' },
              { name: 'Captain Pikachu', variante: 'Special Illustration', medio: 'R$ 7.900,00', badge: '#a855f7', img: 'https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/card-images/liga-CBB1C-Captain_20Pikachu_20_Special_2.jpg' },
              { name: 'Umbreon ex', variante: 'Special Illustration', medio: 'R$ 5.313,06', badge: '#a855f7', img: 'https://images.pokemontcg.io/sv8pt5/161.png' },
              { name: 'Charizard', variante: 'Rare Secret', medio: 'R$ 2.825,99', badge: '#f59e0b', img: 'https://images.pokemontcg.io/ecard3/146.png' },
            ].map((c) => (
              <div key={c.name} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12 }}>
                <div style={{ width: '100%', paddingBottom: '140%', borderRadius: 8, marginBottom: 10, position: 'relative', overflow: 'hidden' }}>
                  <img
                    src={c.img}
                    alt={`Carta Pokémon TCG ${c.name} - ${c.variante}`}
                    loading="lazy"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>{c.name}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 9, background: c.badge + '22', color: c.badge, padding: '2px 6px', borderRadius: 6, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>{c.variante}</span>
                  <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700, whiteSpace: 'nowrap' }}>{c.medio}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF — números reais do catálogo */}
      <section style={{ padding: '56px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 40, textTransform: 'uppercase', letterSpacing: '0.1em' }}>O maior catálogo Pokémon TCG em português</p>
        <div className="lp-stats-row" style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap' }}>
          {[
            { num: '22.000+', label: 'cartas catalogadas' },
            { num: '240+', label: 'coleções (sets) cobertas' },
            { num: 'BRL', label: 'preços em reais, atualizados' },
            { num: '100%', label: 'foco no Brasil' },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 32, fontWeight: 800, color: '#f59e0b', letterSpacing: '-0.03em' }}>{s.num}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DOR — "Você já passou por isso?" */}
      <section aria-label="Cenários comuns do colecionador" style={{ padding: '90px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Quem coleciona, conhece</p>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>Você já passou por isso?</h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 640, margin: '0 auto', lineHeight: 1.6 }}>
            Toda hora aparece um momento desses. Quanto custa não ter resposta na hora?
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {[
            {
              emoji: '🤝',
              title: 'Vai pra liga e vai trocar',
              desc: 'Você sabe o valor real das cartas que vai pôr na mesa? Ou troca no chute e descobre depois que perdeu R$ 200 no negócio?'
            },
            {
              emoji: '📦',
              title: 'Acabou de abrir um booster',
              desc: 'Veio uma carta legal. Vale guardar? Trocar agora? Foil ou Reverse — qual delas vale mais?'
            },
            {
              emoji: '💬',
              title: 'Recebeu oferta no zap',
              desc: '"Te dou R$ 80 nessa." É justo? Tá te passando a perna? Sem referência clara, você decide no susto.'
            },
            {
              emoji: '📋',
              title: 'Tem coleção numa planilha',
              desc: 'Desatualizada há meses. Você nem sabe se sua coleção subiu ou caiu R$ 500 esse mês.'
            },
          ].map((c) => (
            <div key={c.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 28 }}>
              <div style={{ fontSize: 32, marginBottom: 14 }} aria-hidden="true">{c.emoji}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.02em' }}>{c.title}</h3>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section ref={howRef} aria-label="Como funciona o Bynx" style={{ padding: '100px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <p style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Como funciona</p>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em' }}>Simples como deve ser</h2>
        </div>
        <div className="lp-how-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {[
            { num: '01', Icon: IconCollection, title: 'Adicione suas cartas', desc: 'Busque pelo nome da carta e o Bynx encontra na nossa Pokédex de 22 mil+ cartas. Em 2 cliques tá na sua coleção.' },
            { num: '02', Icon: IconFire, title: 'Ou use o Scan', desc: 'Aponta a câmera, a IA reconhece a carta e adiciona automaticamente. Pra quem tem coleção grande e não quer digitar tudo.' },
            { num: '03', Icon: IconChart, title: 'Acompanhe o valor', desc: 'Preços por variante em reais (Normal, Holo, Reverse, Foil, Promo). Mínimo, médio e máximo de mercado, sempre atualizados.' },
            { num: '04', Icon: IconWallet, title: 'Decida com clareza', desc: 'Coleção valorizou ou caiu? Carta tá no preço justo? Você tem todos os números antes de fazer trade, vender ou comprar.' },
          ].map((s) => (
            <div key={s.num} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 28, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 36, opacity: 0.06, fontWeight: 900 }} aria-hidden="true">{s.num}</div>
              <s.Icon size={32} color='rgba(245,158,11,0.8)' style={{marginBottom:14}} />
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.02em' }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DIFERENCIAIS */}
      <section style={{ padding: '90px 24px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recursos</p>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>Tudo que você precisa, num só lugar</h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 640, margin: '0 auto', lineHeight: 1.6 }}>
              De colecionador de fim de semana a quem leva trade a sério.
            </p>
          </div>
          <div className="lp-feat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { Icon: IconCollection, title: 'Pokédex completa', desc: '22.000+ cartas em 240+ coleções. Busca por nome, autocomplete inteligente, filtro por tipo e raridade.' },
              { Icon: IconFire, title: 'Scan com IA', desc: 'Aponta a câmera e adiciona a carta na coleção. Sem digitar nome, sem catar link.' },
              { Icon: IconChart, title: 'Preços por variante', desc: 'Normal, Holo, Reverse, Foil e Promo separados. Cada variante tem preço próprio em reais.' },
              { Icon: IconWallet, title: 'Painel de portfólio', desc: 'Mínimo, médio e máximo da sua coleção. Acompanhamento mês a mês.' },
              { Icon: IconTrendingUp, title: 'Histórico de preços', desc: 'Carta valorizou ou caiu nos últimos 6 meses? Você vê o gráfico antes de decidir.' },
              { Icon: IconMarketplace, title: 'Marketplace', desc: 'Anuncie suas cartas e converse direto via WhatsApp com outros colecionadores. O contato é entre vocês.' },
              { Icon: IconDashboard, title: 'Guia de Lojas BR', desc: 'Encontre lojas físicas de TCG perto de você. Endereço, redes sociais, especialidades — tudo num só lugar.' },
              { Icon: IconShield, title: 'Privado e seguro', desc: 'Sua coleção é só sua. Autenticação séria, dados isolados, nunca compartilhados.' },
            ].map((f) => (
              <div key={f.title} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 24, border: '1px solid rgba(255,255,255,0.06)' }}>
                <f.Icon size={26} color='rgba(245,158,11,0.7)' style={{marginBottom:12}} />
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.01em' }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section ref={pricingRef} style={{ padding: '100px 24px', maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Planos</p>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>Comece grátis, desbloqueie mais quando quiser</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 56, fontSize: 16 }}>Sem cartão de crédito para começar.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, textAlign: 'left' }}>

          {/* Plano Free */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '32px 28px' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Grátis</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.04em' }}>R$ 0</span>
            </div>
            <div style={{ marginBottom: 28 }}>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 4 }}>Para começar a organizar</p>
              <p style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700 }}>⭐ Inclui 7 dias de Pro grátis</p>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 20, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { txt: '6 cartas na coleção', ok: true },
                { txt: '3 anúncios no Marketplace', ok: true },
                { txt: 'Pokédex completa', ok: true },
                { txt: 'Dashboard financeiro', ok: true },
                { txt: 'Cartas ilimitadas', ok: false },
                { txt: 'Perfil público', ok: false },
                { txt: 'Exportar CSV', ok: false },
                { txt: 'Anúncios ilimitados', ok: false },
                { txt: 'Scan com IA', ok: false },
                { txt: 'Separadores de Fichário', ok: false },
              ].map(f => (
                <div key={f.txt} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: f.ok ? 1 : 0.35 }}>
                  <span style={{ color: f.ok ? '#22c55e' : '#6b7280', fontSize: 13, flexShrink: 0 }}>{f.ok ? <IconCheck size={13} color='#22c55e' /> : <svg width='13' height='13' viewBox='0 0 20 20' fill='none'><path d='M5 5l10 10M15 5L5 15' stroke='#6b7280' strokeWidth='1.6' strokeLinecap='round'/></svg>}</span>
                  <span style={{ fontSize: 13, color: f.ok ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.4)' }}>{f.txt}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => handleClickPlan('free')}
              style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '13px', borderRadius: 12, fontWeight: 600, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}
            >
              ⭐ Começar com 7 dias Pro grátis
            </button>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 10 }}>Após o trial: plano gratuito com 6 cartas</p>
          </div>

          {/* Pro Mensal */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '32px 28px' }}>
            <p style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pro · Mensal</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 6 }}>
              <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>R$ 29</span>
              <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.45)', letterSpacing: '-0.02em' }}>,90<span style={{ fontSize: 13 }}>/mês</span></span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 28 }}>Cancele quando quiser · sem fidelidade</p>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 20, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Cartas ilimitadas',
                'Anúncios ilimitados',
                'Pokédex completa',
                'Dashboard financeiro completo',
                'Perfil público compartilhável',
                'Exportar CSV',
                'Marketplace sem limites',
                'Badge Pro no perfil',
                'Scan com IA (créditos disponíveis)',
                'Separadores de Fichário (disponíveis)',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconCheck size={13} color='#f59e0b' />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{f}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => handleClickPlan('mensal')}
              style={{ width: '100%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', color: '#000', padding: '13px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}
            >
              {user ? 'Assinar Pro Mensal →' : 'Começar com Pro Mensal →'}
            </button>
          </div>

          {/* Pro Anual — destaque */}
          <div style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.08),rgba(239,68,68,0.06))', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 20, padding: '32px 28px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#000', fontSize: 10, fontWeight: 800, padding: '4px 14px', borderRadius: 100, whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>
              MELHOR VALOR · 30% OFF
            </div>
            <p style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pro · Anual</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 4 }}>
              <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>R$ 249</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 4 }}>R$ 20,75/mês · cobrado anualmente</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textDecoration: 'line-through' }}>R$358,80/ano</span>
              <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 100 }}>Economize R$109,80</span>
            </div>
            <div style={{ borderTop: '1px solid rgba(245,158,11,0.15)', paddingTop: 20, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Tudo do Pro Mensal',
                'Economize R$109,80 por ano',
                'Prioridade no suporte',
                'Acesso antecipado a novidades',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconCheck size={13} color='#f59e0b' />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{f}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => handleClickPlan('anual')}
              style={{ width: '100%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', color: '#000', padding: '13px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', boxShadow: '0 0 30px rgba(245,158,11,0.25)' }}
            >
              {user ? 'Assinar Pro Anual →' : 'Começar com Pro Anual →'}
            </button>
          </div>
        </div>
      </section>


      {/* ── FAQ ── */}
      <section style={{ padding: '80px 24px', maxWidth: 720, margin: '0 auto' }}>
        <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 8 }}>
          Perguntas frequentes
        </h2>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 15, marginBottom: 48 }}>
          Tudo que você precisa saber antes de começar
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            {
              q: 'Precisa de cartão de crédito para começar?',
              a: 'Não. O plano gratuito é 100% gratuito e os 7 dias de Pro são liberados na hora, sem cartão. Você cria a conta com e-mail e já organiza sua coleção.'
            },
            {
              q: 'Como adiciono minhas cartas?',
              a: 'Tem dois caminhos: (1) busca pelo nome — a Pokédex do Bynx tem 22 mil+ cartas catalogadas, é só achar e adicionar; (2) Scan com IA — aponta a câmera, a carta é reconhecida e entra na sua coleção. Você escolhe o que for mais rápido pra você.'
            },
            {
              q: 'Funciona com cartas em português, inglês e japonês?',
              a: 'Sim. O Bynx tem o catálogo internacional completo (sets em inglês e japonês) e também as edições brasileiras da Liga. Os preços são exibidos em reais (R$) atualizados.'
            },
            {
              q: 'Como o Bynx sabe o preço das cartas?',
              a: 'O Bynx coleta preços de referência do mercado brasileiro continuamente. Os valores são organizados por variante (Normal, Holo, Reverse Holo, Foil, Promo) e exibidos como mínimo, médio e máximo — para você ter uma faixa real de mercado, não um único número.'
            },
            {
              q: 'Qual a diferença entre Normal, Holo, Reverse, Foil e Promo?',
              a: 'Cada variante tem preço próprio. Uma Holo pode valer 2x a Normal; uma Reverse Holo pode valer 5x. Promos são ainda mais específicas. O Bynx separa cada variante para você ter o valor exato da carta que tem na mão, não uma média genérica.'
            },
            {
              q: 'O Bynx vende minhas cartas pra mim?',
              a: 'Não. O Marketplace do Bynx conecta você direto com outros colecionadores via WhatsApp. Você cria o anúncio, recebe interessados, negocia e fecha o trade do jeito que quiser. O Bynx é a vitrine; o trade é com você.'
            },
            {
              q: 'Tenho uma loja de TCG. Posso aparecer no Bynx?',
              a: 'Sim. O Guia de Lojas Bynx é gratuito pra cadastrar (plano Básico) e tem opções Pro e Premium para destaque, fotos, redes sociais e analytics dos seus visitantes. Acesse a área "Minha Loja" depois de criar sua conta.'
            },
          ].map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </section>

      {/* ── BLOCO LOJISTA — captura lead de loja ── */}
      <section aria-label="Para lojas de TCG" style={{ padding: '40px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.06), rgba(168,85,247,0.04))', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 20, padding: '36px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 340px' }}>
            <p style={{ fontSize: 12, color: '#60a5fa', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Para lojistas</p>
            <h2 style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
              Tem loja de TCG? Apareça no <span style={{ color: '#60a5fa' }}>Guia Bynx</span>.
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>
              Cadastro grátis. Colecionadores BR encontram sua loja por endereço, especialidade e redes sociais. Pro e Premium destacam você no topo, com analytics dos visitantes.
            </p>
          </div>
          <a
            href="/lojas"
            style={{ background: 'linear-gradient(135deg, #60a5fa, #a855f7)', border: 'none', color: '#000', padding: '14px 28px', borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Ver o Guia →
          </a>
        </div>
      </section>

      {/* ── DEPOIMENTO ── */}
      <section style={{ padding: '60px 24px', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(239,68,68,0.04))', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 24, padding: '40px 48px', position: 'relative' }}>
          <span style={{ position: 'absolute', top: 24, left: 32, fontSize: 48, color: 'rgba(245,158,11,0.3)', fontFamily: 'Georgia, serif', lineHeight: 1 }} aria-hidden="true">"</span>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: 'rgba(255,255,255,0.85)', fontStyle: 'italic', marginBottom: 24, paddingTop: 16 }}>
            Antes do Bynx, eu trocava carta no chute. Depois de organizar minha coleção e ver o valor real de cada variante, parei de perder dinheiro nos trades. Agora chego na liga sabendo exatamente o que tenho.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#000', flexShrink: 0 }}>
              ES
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0' }}>Eduardo Silva</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Colecionador · São Paulo, SP</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── DEMO ANIMADA ── */}
      <section style={{ padding: '60px 24px', maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
          Veja como funciona
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, marginBottom: 32 }}>
          Do link colado à coleção organizada
        </p>

        {/* Container do mockup animado */}
        <div style={{ background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden', position: 'relative' }}>

          {/* Barra superior do "browser" */}
          <div style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(239,68,68,0.6)' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(245,158,11,0.6)' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(34,197,94,0.6)' }} />
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '4px 12px', marginLeft: 8, fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'left' }}>
              bynx.gg/dashboard-financeiro
            </div>
          </div>

          {/* Conteúdo animado — 3 cenas em loop */}
          <div style={{ position: 'relative', height: 380, overflow: 'hidden' }}>

            {/* ── Cena 1: Dashboard com patrimônio ── */}
            <div style={{ position: 'absolute', inset: 0, padding: '24px 28px', animation: 'bynx-scene1 12s ease-in-out infinite' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Patrimônio total da coleção</div>
              <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 20, animation: 'bynx-countup 3s ease-out 0.5s both' }}>
                R$ 2.847,00
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
                {[{l:'Cartas',v:'47'},{l:'Saldo',v:'+R$340',c:'#22c55e'},{l:'Performance',v:'+13,6%',c:'#22c55e'},{l:'Compras',v:'R$2.507'}].map((s,i)=>(
                  <div key={i} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'10px 12px' }}>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginBottom:4 }}>{s.l}</div>
                    <div style={{ fontSize:15, fontWeight:700, color: s.c || '#f0f0f0' }}>{s.v}</div>
                  </div>
                ))}
              </div>
              {/* Mini gráfico simulado */}
              <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:12 }}>Histórico de preço — Charizard ex</div>
                <svg viewBox="0 0 400 80" style={{ width:'100%', height:80 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path d="M0 65 C40 60 80 55 120 45 C160 35 200 50 240 30 C280 15 320 20 360 10 L360 80 L0 80 Z" fill="url(#g1)"/>
                  <path d="M0 65 C40 60 80 55 120 45 C160 35 200 50 240 30 C280 15 320 20 360 10" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>

            {/* ── Cena 2: Minha Coleção com cards ── */}
            <div style={{ position: 'absolute', inset: 0, padding: '24px 28px', animation: 'bynx-scene2 12s ease-in-out infinite' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:20, fontWeight:800, letterSpacing:'-0.03em', marginBottom:2 }}>Minha Coleção</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>47 cartas · R$2.847,00</div>
                </div>
                <div style={{ background:'linear-gradient(135deg,#f59e0b,#ef4444)', borderRadius:10, padding:'8px 16px', fontSize:13, fontWeight:700, color:'#000' }}>+ Importar por link</div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                {[
                  { name:'Charizard ex', set:'151', price:'R$189', foil:true, var:'Foil', img:'https://images.pokemontcg.io/sv3pt5/183_hires.png', fb:'🔥' },
                  { name:'Pikachu ex', set:'151', price:'R$87', foil:false, var:'Normal', img:'https://images.pokemontcg.io/sv3pt5/25_hires.png', fb:'⚡' },
                  { name:'Mewtwo ex', set:'151', price:'R$134', foil:true, var:'Foil', img:'https://images.pokemontcg.io/sv3pt5/150_hires.png', fb:'🌀' },
                  { name:'Umbreon ex', set:'PAL', price:'R$210', foil:true, var:'Foil', img:'https://images.pokemontcg.io/sv2/210_hires.png', fb:'🌙' },
                ].map((c,i)=>(
                  <div key={i} style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${c.foil ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius:12, padding:'12px 10px', animation:`bynx-cardin 0.4s ${0.1*i}s ease both` }}>
                    <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, height:130, marginBottom:8, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <img
                        src={c.img}
                        alt={c.name}
                        style={{ height:'100%', width:'100%', objectFit:'contain' }}
                        onError={(e) => { const t = e.currentTarget; t.style.display='none'; (t.nextSibling as any).style.display='flex'; }}
                      />
                      <div style={{ display:'none', alignItems:'center', justifyContent:'center', width:'100%', height:'100%', fontSize:24 }}>{c.fb}</div>
                    </div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f0f0f0', marginBottom:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginBottom:4 }}>{c.set} · {c.var}</div>
                    <div style={{ fontSize:13, fontWeight:800, color: c.foil ? '#f59e0b' : '#f0f0f0' }}>{c.price}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Cena 3: Marketplace ── */}
            <div style={{ position: 'absolute', inset: 0, padding: '24px 28px', animation: 'bynx-scene3 12s ease-in-out infinite' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:20, fontWeight:800, letterSpacing:'-0.03em', marginBottom:2 }}>Marketplace</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>128 anúncios disponíveis</div>
                </div>
                <div style={{ background:'linear-gradient(135deg,#f59e0b,#ef4444)', borderRadius:10, padding:'8px 16px', fontSize:13, fontWeight:700, color:'#000' }}>+ Anunciar carta</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { name:'Charizard ex SIR', set:'151', seller:'ash.ketchum', price:'R$450', badge:'FOIL', city:'SP' },
                  { name:'Charizard ex', set:'151', seller:'gary_oak', price:'R$189', badge:'NORMAL', city:'RJ' },
                  { name:'Umbreon ex SIR', set:'PAL', seller:'misty.water', price:'R$820', badge:'FOIL', city:'MG' },
                ].map((l,i)=>(
                  <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ width:44, height:44, background:'rgba(255,255,255,0.06)', borderRadius:8, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <img
                        src={['https://images.pokemontcg.io/sv3pt5/183_hires.png','https://images.pokemontcg.io/sv3pt5/6_hires.png','https://images.pokemontcg.io/sv2/210_hires.png'][i]}
                        alt={l.name}
                        style={{ width:'100%', height:'100%', objectFit:'cover' }}
                        onError={(e) => { const t = e.currentTarget; t.style.display='none'; (t.nextSibling as any).style.display='flex'; }}
                      />
                      <div style={{ display:'none', alignItems:'center', justifyContent:'center', width:'100%', height:'100%', fontSize:20 }}>{['🌟','🔥','💧'][i]}</div>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, marginBottom:2 }}>{l.name}</div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>{l.set} · {l.seller} · {l.city}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:15, fontWeight:800, color:'#f59e0b', marginBottom:2 }}>{l.price}</div>
                      <div style={{ fontSize:9, fontWeight:700, background:'rgba(245,158,11,0.15)', color:'#f59e0b', padding:'2px 7px', borderRadius:100 }}>{l.badge}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Indicadores de cena */}
            <div style={{ position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)', display:'flex', gap:6 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius:'50%', background:'rgba(255,255,255,0.2)', animation:`bynx-dot${i+1} 12s ease-in-out infinite` }} />
              ))}
            </div>
          </div>
        </div>

        <style>{`
          @keyframes bynx-scene1 {
            0%,25%   { opacity:1; transform:translateX(0); }
            30%,65%  { opacity:0; transform:translateX(-40px); }
            96%,100% { opacity:0; transform:translateX(40px); }
          }
          @keyframes bynx-scene2 {
            0%,28%   { opacity:0; transform:translateX(40px); }
            33%,58%  { opacity:1; transform:translateX(0); }
            63%,100% { opacity:0; transform:translateX(-40px); }
          }
          @keyframes bynx-scene3 {
            0%,60%   { opacity:0; transform:translateX(40px); }
            65%,90%  { opacity:1; transform:translateX(0); }
            95%,100% { opacity:0; transform:translateX(-40px); }
          }
          @keyframes bynx-countup {
            from { opacity:0; transform:translateY(8px); }
            to   { opacity:1; transform:translateY(0); }
          }
          @keyframes bynx-cardin {
            from { opacity:0; transform:translateY(12px) scale(0.95); }
            to   { opacity:1; transform:translateY(0) scale(1); }
          }
          @keyframes bynx-dot1 {
            0%,25%  { background:rgba(245,158,11,0.9); transform:scale(1.3); }
            30%,100%{ background:rgba(255,255,255,0.2); transform:scale(1); }
          }
          @keyframes bynx-dot2 {
            0%,30%  { background:rgba(255,255,255,0.2); transform:scale(1); }
            33%,58% { background:rgba(245,158,11,0.9); transform:scale(1.3); }
            63%,100%{ background:rgba(255,255,255,0.2); transform:scale(1); }
          }
          @keyframes bynx-dot3 {
            0%,62%  { background:rgba(255,255,255,0.2); transform:scale(1); }
            65%,90% { background:rgba(245,158,11,0.9); transform:scale(1.3); }
            95%,100%{ background:rgba(255,255,255,0.2); transform:scale(1); }
          }
        `}</style>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: '100px 24px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 300, background: 'radial-gradient(ellipse, rgba(245,158,11,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 20, position: 'relative' }}>
          Sua coleção merece<br />estar organizada.
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 17, marginBottom: 12, position: 'relative' }}>Comece a organizar grátis. Sem cartão de crédito.</p>
        <p style={{ color: '#f59e0b', fontSize: 14, fontWeight: 600, marginBottom: 40, position: 'relative' }}>⭐ 7 dias de Pro incluídos no cadastro gratuito</p>
        <button
          onClick={() => handleClickPlan('free')}
          style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '18px 48px', borderRadius: 14, fontWeight: 700, fontSize: 18, cursor: 'pointer', boxShadow: '0 0 60px rgba(245,158,11,0.25)', position: 'relative' }}
        >
          Começar agora grátis →
        </button>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '40px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => setShowContactModal(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 13, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Fale conosco</button>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
          <a href="/privacidade" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontSize: 13 }}>Privacidade</a>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
          <a href="/termos" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontSize: 13 }}>Termos de uso</a>
        </div>
        <p>© 2026 <strong>Bynx</strong> · Feito para colecionadores brasileiros de Pokémon TCG</p>
      </footer>

      {/* MODAL CONTATO COMERCIAL */}
      {showContactModal && (
        <ContactModal onClose={() => setShowContactModal(false)} />
      )}

      {/* MODAL AUTH */}
      {showAuthModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}
          onClick={() => { setShowAuthModal(false); setShowPlanStep(false) }}
        >
          <div
            style={{ background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 440, boxShadow: '0 32px 80px rgba(0,0,0,0.7)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header — muda título conforme o step */}
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>
                  {showPlanStep ? 'Escolha seu plano' : forgotStep ? 'Recuperar acesso' : isLogin ? 'Bem-vindo de volta' : 'Criar sua conta'}
                </h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  {showPlanStep ? 'Organize sua coleção grátis ou desbloqueie mais com o Pro' : forgotStep ? 'Enviaremos um link para seu e-mail' : isLogin ? 'Entre para acessar sua coleção' : 'Grátis · 7 dias de Pro incluídos ⭐'}
                </p>
                {/* Badge do plano escolhido */}
                {!isLogin && !forgotStep && !showPlanStep && pendingPlan && pendingPlan !== 'free' && (
                  <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '5px 10px' }}>
                    <span style={{ fontSize: 13 }}>⭐</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>
                      Plano Pro {pendingPlan === 'mensal' ? 'Mensal · R$ 29,90/mês' : 'Anual · R$ 249/ano'} será ativado após o cadastro
                    </span>
                  </div>
                )}
              </div>
              <button onClick={() => { setShowAuthModal(false); setShowPlanStep(false) }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: 32, height: 32, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconClose size={13} color="rgba(255,255,255,0.4)" /></button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 28px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* ── STEP 0: ESCOLHA DO PLANO ── */}
              {showPlanStep ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Grátis com trial */}
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

                  {/* Pro Mensal */}
                  <button onClick={() => { setPendingPlan('mensal'); setShowPlanStep(false) }}
                    style={{ width: '100%', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: '#f0f0f0', transition: 'all 0.15s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>Pro Mensal</span>
                      <span style={{ fontSize: 18, fontWeight: 900, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>R$ 29,90<span style={{ fontSize: 11 }}>/mês</span></span>
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>Cartas ilimitadas · Perfil público · Exportar · Marketplace completo</p>
                  </button>

                  {/* Pro Anual — destaque */}
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
                /* ── STEP ESQUECI A SENHA ── */
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
                /* ── FORM LOGIN / CADASTRO ── */
                <>
                  {!isLogin && (() => {
                    const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }
                    return (
                    <>
                      {/* Indicador de etapas */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {[1,2].map(s => (
                          <div key={s} style={{ flex: 1, height: 3, borderRadius: 100, background: s <= signupStep ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
                        ))}
                      </div>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>
                        Etapa {signupStep} de 2 — {signupStep === 1 ? 'Dados da conta' : 'Perfil e aceites'}
                      </p>

                      {/* ── ETAPA 1: Nome, E-mail, Senha, Nascimento ── */}
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

                      {/* ── ETAPA 2: CPF, Cidade, WhatsApp, Aceites ── */}
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

                  {/* Aceites — etapa 2 do cadastro */}
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

                  {/* Botões de navegação */}
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

            {/* Footer — troca modo */}
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
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}