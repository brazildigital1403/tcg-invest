'use client'

import { useRef, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

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
          <span>⚠</span> {erro}
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

export default function Home() {
  const howRef = useRef<HTMLDivElement>(null)
  const pricingRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)

  // Campos
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [city, setCity] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [forgotStep, setForgotStep] = useState(false) // true = tela de recuperar senha
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
    async function getUser() {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) setUser(data.session.user)
    }
    getUser()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const scrollTo = (ref: any) => ref.current?.scrollIntoView({ behavior: 'smooth' })

  async function handleAuth() {
    // Marca todos os campos como tocados e valida
    const allTouched: Record<string, boolean> = { name: true, cpf: true, city: true, whatsapp: true, email: true, password: true }
    setTouched(allTouched)
    const e = validarCampos()
    setErros(e)
    if (Object.keys(e).length > 0) return

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
          await supabase.from('users').insert({ id: data.user.id, email, name, cpf, city, whatsapp })
        }
        setServerError('')
        setShowAuthModal(false)
        // Mostra feedback e redireciona
        router.push('/dashboard-financeiro')
      }
    } catch (err: any) {
      setServerError('Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ fontFamily: "'DM Sans', 'Sora', system-ui, sans-serif", background: '#080a0f', color: '#f0f0f0', minHeight: '100vh' }}>

      {/* HEADER */}
      {/* CSS responsivo landing */}
      <style>{`
        @media (max-width: 768px) {
          .lp-nav-desktop { display: none !important; }
          .lp-hamburger   { display: flex !important; }
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

      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, backdropFilter: 'blur(16px)', background: 'rgba(8,10,15,0.9)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 34, width: 'auto', objectFit: 'contain' }} />
          </div>

          {/* Nav desktop */}
          <nav className="lp-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <button onClick={() => scrollTo(howRef)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>Como funciona</button>
            <button onClick={() => scrollTo(pricingRef)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>Planos</button>
            {user ? (
              <button onClick={() => router.push('/dashboard-financeiro')} style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '9px 18px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                Meu Dashboard
              </button>
            ) : (
              <button onClick={() => { setIsLogin(true); setShowAuthModal(true) }} style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '9px 18px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                Entrar
              </button>
            )}
          </nav>

          {/* Hamburguer mobile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* CTA compacto mobile */}
            <div className="lp-nav-desktop" style={{ display: 'none' }} />
            {user ? (
              <button className="lp-hamburger" onClick={() => router.push('/dashboard-financeiro')}
                style={{ display: 'none', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '8px 14px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                Dashboard
              </button>
            ) : (
              <button className="lp-hamburger" onClick={() => { setIsLogin(true); setShowAuthModal(true) }}
                style={{ display: 'none', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '8px 14px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                Entrar
              </button>
            )}
            <button className="lp-hamburger" onClick={() => setMobileMenuOpen(v => !v)}
              style={{ display: 'none', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', flexDirection: 'column', gap: 4 }}>
              <span style={{ display: 'block', width: 18, height: 2, background: '#f0f0f0', borderRadius: 2 }} />
              <span style={{ display: 'block', width: 18, height: 2, background: '#f0f0f0', borderRadius: 2 }} />
              <span style={{ display: 'block', width: 18, height: 2, background: '#f0f0f0', borderRadius: 2 }} />
            </button>
          </div>
        </div>

        {/* Menu mobile expandido */}
        {mobileMenuOpen && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button onClick={() => { scrollTo(howRef); setMobileMenuOpen(false) }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 15, padding: '10px 0', textAlign: 'left', fontFamily: 'inherit', fontWeight: 500 }}>
              Como funciona
            </button>
            <button onClick={() => { scrollTo(pricingRef); setMobileMenuOpen(false) }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 15, padding: '10px 0', textAlign: 'left', fontFamily: 'inherit', fontWeight: 500 }}>
              Planos
            </button>
          </div>
        )}
      </header>

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '120px 24px 80px', position: 'relative', overflow: 'hidden' }}>
        {/* Background glow */}
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(245,158,11,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', left: '20%', width: 300, height: 300, background: 'radial-gradient(ellipse, rgba(239,68,68,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 100, padding: '6px 16px', fontSize: 13, color: '#f59e0b', marginBottom: 32, fontWeight: 500 }}>
          ✦ Portfólio financeiro para colecionadores de TCG
        </div>

        <h1 style={{ fontSize: 'clamp(40px, 7vw, 80px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 24, maxWidth: 900 }}>
          Sua coleção Pokémon TCG<br />
          <span style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>vale dinheiro de verdade.</span>
        </h1>

        <p style={{ fontSize: 20, color: 'rgba(255,255,255,0.5)', maxWidth: 560, lineHeight: 1.6, marginBottom: 48 }}>
          Importe cartas da LigaPokemon por link, acompanhe preços por variante (Normal, Foil, Promo) em tempo real e saiba exatamente quanto seu portfólio Pokémon TCG vale agora.
        </p>

        <div className="lp-hero-btns" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 80 }}>
          <button
            onClick={() => { setIsLogin(false); setShowAuthModal(true) }}
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
              { name: 'Mega Charizard X ex', variante: 'Foil', medio: 'R$ 1.955,86', badge: '#f59e0b', img: 'https://repositorio.sbrauble.com/arquivos/in/pokemon_bkp/cd/738/6924ac1ff1bb1-8t6ug-w0jnu-6386cdd1635c69bcd3f1e8f5ea9c84f1.jpg' },
              { name: 'Mega Lucario ex', variante: 'Normal', medio: 'R$ 1.491,16', badge: '#6b7280', img: 'https://repositorio.sbrauble.com/arquivos/in/pokemon_bkp/cd/730/68d6d9f43ca1d-0ix3o-6t79y-bda68739bd4cf82472222621b2fdd599.jpg' },
              { name: 'Pikachu ex', variante: 'Normal', medio: 'R$ 22.900,00', badge: '#6b7280', img: 'https://repositorio.sbrauble.com/arquivos/in/pokemon_bkp/cd/742/693733302feb0-4n8de-8xsfc-723befacbf6c75de8818e5186aa60264.jpg' },
              { name: 'Mega Gengar ex', variante: 'Normal', medio: 'R$ 3.239,34', badge: '#6b7280', img: 'https://repositorio.sbrauble.com/arquivos/in/pokemon_bkp/cd/754/697cf2d0eccd2-a5opg-h5lnm-9a3cbb1b17fb0c24b5f4da3defde2c8b.jpg' },
            ].map((c) => (
              <div key={c.name} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12 }}>
                <div style={{ width: '100%', paddingBottom: '140%', borderRadius: 8, marginBottom: 10, position: 'relative', overflow: 'hidden' }}>
                  <img
                    src={c.img}
                    alt={`Carta Pokémon TCG ${c.name} - ${c.variante}`}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>{c.name}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, background: c.badge + '22', color: c.badge, padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}>{c.variante}</span>
                  <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700 }}>{c.medio}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section style={{ padding: '56px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 40, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Feito para colecionadores de Pokémon TCG</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap' }}>
          {[
            { icon: '✦', label: 'Coleção Básica', sub: '1999' },
            { icon: '✦', label: 'Scarlet & Violet', sub: 'atual' },
            { icon: '✦', label: 'Mega Evolution', sub: '2025' },
            { icon: '✦', label: 'Sword & Shield', sub: 'clássico' },
            { icon: '✦', label: 'Sun & Moon', sub: 'clássico' },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{s.label}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.sub}</p>
            </div>
          ))}
        </div>
        <div className="lp-stats-row" style={{ marginTop: 48, display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap' }}>
          {[
            { num: '+500', label: 'cartas cadastradas' },
            { num: '+120', label: 'colecionadores ativos' },
            { num: 'R$ 50k+', label: 'em coleções gerenciadas' },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b', letterSpacing: '-0.03em' }}>{s.num}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{s.label}</p>
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
        <div className="lp-how-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {[
            { num: '01', icon: '🔗', title: 'Cole o link da LigaPokemon', desc: 'Importação automática de dados, imagem e todos os preços por variante (Normal, Foil, Promo) com um único link.' },
            { num: '02', icon: '📊', title: 'Selecione o tipo da sua carta', desc: 'Diga se a sua é Normal, Foil ou Promo. O sistema calcula o valor real da sua coleção baseado no mercado atual.' },
            { num: '03', icon: '💰', title: 'Veja seu portfólio ao vivo', desc: 'Mínimo, médio e máximo da carteira inteira. Saiba quanto você pode ganhar dependendo de como negociar.' },
          ].map((s) => (
            <div key={s.num} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 32, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 20, right: 20, fontSize: 40, opacity: 0.06, fontWeight: 900 }}>{s.num}</div>
              <div style={{ fontSize: 36, marginBottom: 16 }}>{s.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.02em' }}>{s.title}</h3>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DIFERENCIAIS */}
      <section style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 42px)', fontWeight: 800, letterSpacing: '-0.03em' }}>O que nos diferencia</h2>
          </div>
          <div className="lp-feat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { icon: '🎯', title: 'Preços por variante', desc: 'Normal, Foil e Promo separados. O valor certo para a carta que você tem.' },
              { icon: '📈', title: 'Portfólio financeiro', desc: 'Min, médio e máximo da carteira. Pense como um investidor.' },
              { icon: '⚡', title: 'Importação por link', desc: 'Um link da LigaPokemon importa tudo automaticamente.' },
              { icon: '📉', title: 'Histórico de preços', desc: 'Acompanhe a variação do mercado ao longo do tempo.' },
              { icon: '🛒', title: 'Marketplace integrado', desc: 'Compre e venda direto na plataforma.' },
              { icon: '🔒', title: 'Seus dados seguros', desc: 'Autenticação segura. Só você vê sua coleção.' },
            ].map((f) => (
              <div key={f.title} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 24, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{f.title}</h4>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section ref={pricingRef} style={{ padding: '100px 24px', maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Planos</p>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>Comece grátis, cresça quando precisar</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 56, fontSize: 16 }}>Sem cartão de crédito para começar.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, textAlign: 'left' }}>

          {/* Plano Free */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '32px 28px' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Grátis</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.04em' }}>R$ 0</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 28 }}>Para experimentar</p>
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
              ].map(f => (
                <div key={f.txt} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: f.ok ? 1 : 0.35 }}>
                  <span style={{ color: f.ok ? '#22c55e' : '#6b7280', fontSize: 13, flexShrink: 0 }}>{f.ok ? '✓' : '✕'}</span>
                  <span style={{ fontSize: 13, color: f.ok ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.4)' }}>{f.txt}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setIsLogin(false); setShowAuthModal(true) }}
              style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '13px', borderRadius: 12, fontWeight: 600, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}
            >
              Criar conta grátis
            </button>
          </div>

          {/* Pro Mensal */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '32px 28px' }}>
            <p style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pro · Mensal</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 6 }}>
              <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>R$ 19</span>
              <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.45)', letterSpacing: '-0.02em' }}>,90<span style={{ fontSize: 13 }}>/mês</span></span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 28 }}>Cancele quando quiser</p>
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
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#f59e0b', fontSize: 13, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{f}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setIsLogin(false); setShowAuthModal(true) }}
              style={{ width: '100%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', color: '#000', padding: '13px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}
            >
              Assinar Pro Mensal →
            </button>
          </div>

          {/* Pro Anual — destaque */}
          <div style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.08),rgba(239,68,68,0.06))', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 20, padding: '32px 28px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#000', fontSize: 10, fontWeight: 800, padding: '4px 14px', borderRadius: 100, whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>
              🔥 MELHOR VALOR · 2 MESES GRÁTIS
            </div>
            <p style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pro · Anual</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 4 }}>
              <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>R$ 179</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 4 }}>R$ 14,91/mês · equivale a 10 meses</p>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginBottom: 28, textDecoration: 'line-through' }}>R$ 238,80 no mensal</p>
            <div style={{ borderTop: '1px solid rgba(245,158,11,0.15)', paddingTop: 20, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Tudo do Pro Mensal',
                '2 meses grátis incluso',
                'Prioridade no suporte',
                'Acesso antecipado a novidades',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#f59e0b', fontSize: 13, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{f}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setIsLogin(false); setShowAuthModal(true) }}
              style={{ width: '100%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', color: '#000', padding: '13px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', boxShadow: '0 0 30px rgba(245,158,11,0.25)' }}
            >
              Assinar Pro Anual →
            </button>
          </div>
        </div>
      </section>


      {/* CTA FINAL */}
      <section style={{ padding: '100px 24px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 300, background: 'radial-gradient(ellipse, rgba(245,158,11,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 20, position: 'relative' }}>
          Sua coleção merece<br />uma gestão profissional.
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 17, marginBottom: 40, position: 'relative' }}>Comece grátis. Sem cartão de crédito.</p>
        <button
          onClick={() => { setIsLogin(false); setShowAuthModal(true) }}
          style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '18px 48px', borderRadius: 14, fontWeight: 700, fontSize: 18, cursor: 'pointer', boxShadow: '0 0 60px rgba(245,158,11,0.25)', position: 'relative' }}
        >
          Começar agora grátis →
        </button>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
        <p>© 2026 <strong>Bynx</strong> · Feito para colecionadores brasileiros de Pokémon TCG</p>
      </footer>

      {/* MODAL AUTH */}
      {showAuthModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}
          onClick={() => setShowAuthModal(false)}
        >
          <div
            style={{ background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 440, boxShadow: '0 32px 80px rgba(0,0,0,0.7)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header — muda título conforme o step */}
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>
                  {forgotStep ? 'Recuperar acesso 🔑' : isLogin ? 'Bem-vindo de volta 👋' : 'Criar sua conta'}
                </h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  {forgotStep ? 'Enviaremos um link para seu e-mail' : isLogin ? 'Entre para acessar sua coleção' : 'Grátis para sempre nos primeiros 15 cards'}
                </p>
              </div>
              <button onClick={() => setShowAuthModal(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: 32, height: 32, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 28px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {forgotStep ? (
                /* ── STEP ESQUECI A SENHA ── */
                forgotSent ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
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
                      <span>💡</span>
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
                  {!isLogin && (
                    <>
                      <Campo erro={touched.name ? erros.name : undefined}>
                        <input type="text" placeholder="Nome completo"
                          value={name}
                          onChange={e => { setName(e.target.value); if (touched.name) setErros(validarCampos()) }}
                          onBlur={() => handleBlur('name')}
                          style={inputStyle(touched.name ? erros.name : undefined, touched.name && !erros.name && name.length > 3)}
                        />
                      </Campo>
                      <Campo erro={touched.cpf ? erros.cpf : undefined}>
                        <input type="text" placeholder="CPF (000.000.000-00)"
                          value={cpf}
                          onChange={e => { setCpf(formatarCPF(e.target.value)); if (touched.cpf) setErros(validarCampos()) }}
                          onBlur={() => handleBlur('cpf')}
                          style={inputStyle(touched.cpf ? erros.cpf : undefined, touched.cpf && !erros.cpf && cpf.length > 0)}
                        />
                      </Campo>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <Campo erro={touched.city ? erros.city : undefined}>
                          <input type="text" placeholder="Cidade"
                            value={city}
                            onChange={e => { setCity(e.target.value); if (touched.city) setErros(validarCampos()) }}
                            onBlur={() => handleBlur('city')}
                            style={inputStyle(touched.city ? erros.city : undefined, touched.city && !erros.city && city.length > 0)}
                          />
                        </Campo>
                        <Campo erro={touched.whatsapp ? erros.whatsapp : undefined}>
                          <input type="text" placeholder="WhatsApp"
                            value={whatsapp}
                            onChange={e => { setWhatsapp(formatarWhatsApp(e.target.value)); if (touched.whatsapp) setErros(validarCampos()) }}
                            onBlur={() => handleBlur('whatsapp')}
                            style={inputStyle(touched.whatsapp ? erros.whatsapp : undefined, touched.whatsapp && !erros.whatsapp && whatsapp.length > 0)}
                          />
                        </Campo>
                      </div>
                    </>
                  )}

                  <Campo erro={touched.email ? erros.email : undefined}>
                    <input type="email" placeholder="E-mail"
                      value={email}
                      onChange={e => { setEmail(e.target.value); if (touched.email) setErros(validarCampos()) }}
                      onBlur={() => handleBlur('email')}
                      style={inputStyle(touched.email ? erros.email : undefined, touched.email && !erros.email && email.length > 0)}
                    />
                  </Campo>

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
                        {showPassword ? '🙈' : '👁️'}
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

                  {serverError && (
                    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#ef4444', fontSize: 16 }}>⚠</span>
                      <p style={{ fontSize: 13, color: '#ef4444' }}>{serverError}</p>
                    </div>
                  )}

                  <button onClick={handleAuth} disabled={loading}
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '14px', borderRadius: 10, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15, opacity: loading ? 0.7 : 1, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {loading ? (
                      <>
                        <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                        Carregando...
                      </>
                    ) : isLogin ? 'Entrar →' : 'Criar conta grátis →'}
                  </button>

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