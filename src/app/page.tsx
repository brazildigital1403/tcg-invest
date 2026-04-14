'use client'

import { useRef, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function Home() {
  const howRef = useRef<HTMLDivElement>(null)
  const pricingRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [city, setCity] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

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
    if (!email || !password || (!isLogin && (!name || !cpf || !city || !whatsapp))) {
      alert('Preencha todos os campos')
      return
    }
    setLoading(true)
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setShowAuthModal(false)
        router.push('/dashboard-financeiro')
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name, cpf, city, whatsapp } },
        })
        if (error) throw error
        if (data.user) {
          await supabase.from('users').insert({ id: data.user.id, email, name, cpf, city, whatsapp })
        }
        alert('Conta criada! Verifique seu e-mail.')
        setIsLogin(true)
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ fontFamily: "'DM Sans', 'Sora', system-ui, sans-serif", background: '#080a0f', color: '#f0f0f0', minHeight: '100vh' }}>

      {/* HEADER */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, backdropFilter: 'blur(16px)', background: 'rgba(8,10,15,0.85)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📊</div>
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.03em' }}>TCG Manager</span>
          </div>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <button onClick={() => scrollTo(howRef)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14 }}>Como funciona</button>
            <button onClick={() => scrollTo(pricingRef)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14 }}>Planos</button>
            {user ? (
              <button onClick={() => router.push('/dashboard-financeiro')} style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '10px 20px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                Meu Dashboard
              </button>
            ) : (
              <button onClick={() => { setIsLogin(true); setShowAuthModal(true) }} style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '10px 20px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                Entrar
              </button>
            )}
          </nav>
        </div>
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
          Sua coleção de cartas<br />
          <span style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>vale dinheiro de verdade.</span>
        </h1>

        <p style={{ fontSize: 20, color: 'rgba(255,255,255,0.5)', maxWidth: 560, lineHeight: 1.6, marginBottom: 48 }}>
          Importe suas cartas por link, acompanhe preços por variante (Normal, Foil, Promo) e saiba exatamente quanto sua coleção vale agora.
        </p>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 80 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
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
                    alt={c.name}
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
        <div style={{ marginTop: 48, display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap' }}>
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
      <section ref={howRef} style={{ padding: '100px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <p style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Como funciona</p>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em' }}>Simples como deve ser</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
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
      <section ref={pricingRef} style={{ padding: '100px 24px', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Planos</p>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>Comece grátis, cresça quando precisar</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 56, fontSize: 16 }}>Sem cartão de crédito para começar.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, textAlign: 'left' }}>
          {/* Plano Free */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 36 }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Grátis</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em' }}>R$ 0</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginBottom: 32 }}>Para começar a organizar</p>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24, marginBottom: 32 }}>
              {['Até 15 cartas na coleção', 'Importação por link', 'Preços por variante', 'Histórico de preços'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ color: '#22c55e', fontSize: 16 }}>✓</span>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>{f}</span>
                </div>
              ))}
              {['Dashboard financeiro completo', 'Marketplace', 'Suporte prioritário'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, opacity: 0.35 }}>
                  <span style={{ color: '#6b7280', fontSize: 16 }}>✕</span>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{f}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setIsLogin(false); setShowAuthModal(true) }}
              style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '14px', borderRadius: 12, fontWeight: 600, cursor: 'pointer', fontSize: 15 }}
            >
              Criar conta grátis
            </button>
          </div>

          {/* Plano Pro */}
          <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.08))', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 20, padding: 36, position: 'relative' }}>
            <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#000', fontSize: 12, fontWeight: 700, padding: '4px 16px', borderRadius: 100, whiteSpace: 'nowrap' }}>
              MAIS POPULAR
            </div>
            <p style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pro</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em' }}>R$ 19</span>
              <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.5)' }}>,90/mês</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginBottom: 32 }}>Para o colecionador sério</p>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24, marginBottom: 32 }}>
              {['Cartas ilimitadas', 'Importação por link', 'Preços por variante (Normal, Foil, Promo)', 'Histórico de preços', 'Dashboard financeiro completo', 'Marketplace integrado', 'Suporte prioritário'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ color: '#f59e0b', fontSize: 16 }}>✓</span>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>{f}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setIsLogin(false); setShowAuthModal(true) }}
              style={{ width: '100%', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '14px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 15, boxShadow: '0 0 30px rgba(245,158,11,0.3)' }}
            >
              Começar com Pro →
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
        <p>© 2026 TCG Manager · Feito para colecionadores brasileiros</p>
      </footer>

      {/* MODAL AUTH */}
      {showAuthModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 40, width: '100%', maxWidth: 440, position: 'relative' }}>
            <button onClick={() => setShowAuthModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20 }}>✕</button>

            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, textAlign: 'center', letterSpacing: '-0.03em' }}>
              {isLogin ? 'Bem-vindo de volta 👋' : 'Criar sua conta'}
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 32 }}>
              {isLogin ? 'Entre para acessar sua coleção' : 'Grátis para sempre nos primeiros 15 cards'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!isLogin && (
                <>
                  <input type="text" placeholder="Nome completo" value={name} onChange={e => setName(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 16px', color: '#fff', fontSize: 15, outline: 'none' }} />
                  <input type="text" placeholder="CPF" value={cpf} onChange={e => setCpf(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 16px', color: '#fff', fontSize: 15, outline: 'none' }} />
                  <input type="text" placeholder="Cidade" value={city} onChange={e => setCity(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 16px', color: '#fff', fontSize: 15, outline: 'none' }} />
                  <input type="text" placeholder="WhatsApp" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 16px', color: '#fff', fontSize: 15, outline: 'none' }} />
                </>
              )}
              <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 16px', color: '#fff', fontSize: 15, outline: 'none' }} />
              <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 16px', color: '#fff', fontSize: 15, outline: 'none' }} />
              <button onClick={handleAuth} disabled={loading}
                style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '14px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 15, opacity: loading ? 0.6 : 1, marginTop: 4 }}>
                {loading ? 'Carregando...' : isLogin ? 'Entrar' : 'Criar conta grátis'}
              </button>
            </div>

            <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>
              {isLogin ? 'Não tem conta? ' : 'Já tem conta? '}
              <button onClick={() => setIsLogin(!isLogin)} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                {isLogin ? 'Criar gratuitamente' : 'Entrar'}
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}