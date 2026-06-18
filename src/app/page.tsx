'use client'

import React, { useRef, useEffect, useState } from 'react'
import { IconLink, IconTrendingUp, IconTrendingDown, IconDashboard, IconMarketplace, IconShield, IconWallet, IconCheck, IconKey, IconFire, IconCollection, IconChart } from '@/components/ui/Icons'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { trackProUpgradeInitiated } from '@/lib/analytics'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import HomeSearchBand from '@/components/ui/HomeSearchBand'
import HomeVitrines from '@/components/ui/HomeVitrines'

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

// ─── Depoimentos ─────────────────────────────────────────────────────────────
// 14 depoimentos com nomes BR realistas em carousel scroll-snap.
// UX: setas (desktop) + bullets clicáveis (ambos) + overscroll-behavior-x
// pra bloquear o back-gesture do trackpad no Mac.

const TESTIMONIALS = [
  { initials: 'RC', name: 'Rafael Cavalcanti', role: 'Investidor', city: 'Vinhedo, SP', text: 'Trato minha coleção como portfólio. O Bynx me mostra ROI por carta, performance vs compra e quais variantes acompanhar. Já vendi 3 Charizards no momento certo só olhando o histórico de preço.' },
  { initials: 'MS', name: 'Mariana Silva', role: 'Colecionadora', city: 'Curitiba, PR', text: 'Comecei a colecionar com meu filho e a coleção cresceu sem eu perceber. Hoje sei exatamente quanto temos em casa — e cada carta tá organizada por set.' },
  { initials: 'LA', name: 'Lucas Almeida', role: 'Colecionador', city: 'Belo Horizonte, MG', text: 'Tô completando o 151 carta por carta. A barra de progresso por set é viciante. Já são 87% e não vou parar até zerar.' },
  { initials: 'GO', name: 'Gabriel Oliveira', role: 'Competitivo', city: 'São Paulo, SP', text: 'Monto deck pra torneio e antes de comprar carta eu sempre confiro o histórico no Bynx. Já evitei comprar carta hypeada que ia desabar — e desabou na semana seguinte.' },
  { initials: 'CO', name: 'Carlos Oliveira', role: 'Lojista', city: 'Campinas, SP', text: 'Tenho loja física há 6 anos. Uso o Bynx pra precificar carta usada que entra no balcão. Os valores médios batem com o que a galera aceita, não preciso negociar no chute.' },
  { initials: 'CA', name: 'Camila Araújo', role: 'Colecionadora', city: 'Florianópolis, SC', text: 'Minha coleção é toda de Eeveelutions. O Bynx separa por variante (foil, reverse, alt art) e isso muda tudo — antes eu nem sabia que tinha 4 versões da mesma Sylveon.' },
  { initials: 'MR', name: 'Marcelo Rocha', role: 'Veterano', city: 'Porto Alegre, RS', text: 'Joguei TCG na época do Charizard Base Set. Voltei adulto, comecei tudo de novo, mas agora com cabeça de coleção, não de moleque trocando carta no recreio. O Bynx é o que faltava nessa fase 2.' },
  { initials: 'BF', name: 'Bruno Ferreira', role: 'Colecionador', city: 'Brasília, DF', text: 'Já perdi carta em mudança, já saí no prejuízo em troca, sabe como é. Agora tudo registrado, com foto e valor. Se sumir alguma, eu sei na hora.' },
  { initials: 'FB', name: 'Fernanda Borges', role: 'Lojista', city: 'Fortaleza, CE', text: 'Vendo carta pelo Instagram e o Bynx é meu termômetro de preço. Quando uma variante começa a subir, eu vejo antes — e ajusto o anúncio antes do meu concorrente.' },
  { initials: 'LC', name: 'Larissa Costa', role: 'Colecionadora', city: 'Goiânia, GO', text: 'Voltei a colecionar depois de 15 anos. O Bynx me deu o contexto que faltava: o que é raro hoje, o que valorizou, como organizar. Virei criança de novo, só que com planilha.' },
  { initials: 'PH', name: 'Pedro Henrique', role: 'Competitivo', city: 'Niterói, RJ', text: 'Tô economizando pro Nationals. Cada carta que entra no deck eu lanço no Bynx pra ver o custo total. Saber que o deck me custou R$ 1.840 e tá valendo R$ 2.100 é satisfação pura.' },
  { initials: 'DM', name: 'Diego Mendes', role: 'Colecionador', city: 'Recife, PE', text: '5 caixas de cartas aleatórias no armário há anos. Em 2 fins de semana escaneei tudo, organizei e descobri que tinha quase R$ 4 mil em carta lá. Sério.' },
  { initials: 'AC', name: 'André Cardoso', role: 'Lojista', city: 'Joinville, SC', text: 'Organizo torneios locais e vendo cartas avulsas. O Bynx me dá controle de estoque + valor atualizado. Antes era planilha do Excel sofrendo, agora é só abrir o app.' },
  { initials: 'BS', name: 'Beatriz Santos', role: 'Colecionadora', city: 'Salvador, BA', text: 'O app é bonito demais. Adicionar carta é rápido, ver a coleção dá orgulho, e o dashboard de patrimônio é meu xodó. Recomendei pra todo o grupo da liga.' },
]

const TESTIMONIAL_PAD_LEFT = 24 // bate com paddingLeft do scroller

function TestimonialsCarousel() {
  const scrollerRef = React.useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [canPrev, setCanPrev] = React.useState(false)
  const [canNext, setCanNext] = React.useState(true)

  // Atualiza activeIndex e estado das setas conforme o scroll do container.
  // Usa rAF pra throttlar e não disparar setState em cada pixel.
  React.useEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    let raf = 0
    const update = () => {
      const cards = Array.from(el.children) as HTMLElement[]
      if (cards.length === 0) return
      const scrollLeft = el.scrollLeft
      const isAtEnd = scrollLeft + el.clientWidth >= el.scrollWidth - 4

      let closest = 0
      if (isAtEnd) {
        // No fim físico do scroll, o último card é sempre o ativo
        // (pode não estar "colado à esquerda" mas é o que o user vê).
        closest = cards.length - 1
      } else {
        let minDist = Infinity
        cards.forEach((card, i) => {
          const dist = Math.abs(card.offsetLeft - scrollLeft - TESTIMONIAL_PAD_LEFT)
          if (dist < minDist) { minDist = dist; closest = i }
        })
      }
      setActiveIndex(closest)
      setCanPrev(scrollLeft > 4)
      setCanNext(!isAtEnd)
    }

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }

    update()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', update)
    }
  }, [])

  const scrollToIndex = (i: number) => {
    const el = scrollerRef.current
    if (!el) return
    const cards = Array.from(el.children) as HTMLElement[]
    const card = cards[i]
    if (!card) return
    el.scrollTo({ left: card.offsetLeft - TESTIMONIAL_PAD_LEFT, behavior: 'smooth' })
  }

  const arrowBase: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 2,
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(15,17,23,0.85)',
    border: '1px solid rgba(255,255,255,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'opacity 0.2s, color 0.2s, background 0.2s, border-color 0.2s',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    padding: 0,
  }

  return (
    <section style={{ padding: '60px 0 40px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 32px', padding: '0 24px' }}>
        <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
          O que os players dizem
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>
          Coleção organizada, valor na mão, decisão sem chute
        </p>
      </div>

      <div style={{ position: 'relative' }}>
        {/* Seta esquerda */}
        <button
          type="button"
          className="lp-testimonials-arrow"
          aria-label="Depoimento anterior"
          onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}
          disabled={!canPrev}
          style={{
            ...arrowBase,
            left: 12,
            color: canPrev ? '#f59e0b' : 'rgba(255,255,255,0.2)',
            cursor: canPrev ? 'pointer' : 'default',
            opacity: canPrev ? 1 : 0.4,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Seta direita */}
        <button
          type="button"
          className="lp-testimonials-arrow"
          aria-label="Próximo depoimento"
          onClick={() => scrollToIndex(Math.min(TESTIMONIALS.length - 1, activeIndex + 1))}
          disabled={!canNext}
          style={{
            ...arrowBase,
            right: 12,
            color: canNext ? '#f59e0b' : 'rgba(255,255,255,0.2)',
            cursor: canNext ? 'pointer' : 'default',
            opacity: canNext ? 1 : 0.4,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Scroller */}
        <div
          ref={scrollerRef}
          className="lp-testimonials-row"
          role="region"
          aria-label="Depoimentos de usuários"
          style={{
            display: 'flex',
            gap: 20,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            padding: '8px 24px 24px',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
          }}
        >
          {TESTIMONIALS.map((t, i) => (
            <article
              key={i}
              style={{
                flex: '0 0 auto',
                width: 'min(560px, 86vw)',
                scrollSnapAlign: 'start',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(239,68,68,0.04))',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 24,
                padding: '36px 32px 28px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span style={{ position: 'absolute', top: 20, left: 28, fontSize: 44, color: 'rgba(245,158,11,0.3)', fontFamily: 'Georgia, serif', lineHeight: 1 }} aria-hidden="true">"</span>
              <p style={{ fontSize: 16, lineHeight: 1.7, color: 'rgba(255,255,255,0.85)', fontStyle: 'italic', marginBottom: 24, paddingTop: 16, flex: 1 }}>
                {t.text}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#000', flexShrink: 0 }}>
                  {t.initials}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0' }}>{t.name}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{t.role} · {t.city}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Bullets — sempre visíveis (mobile + desktop) */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 8, padding: '0 24px', flexWrap: 'wrap' }}>
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Ir para depoimento ${i + 1} de ${TESTIMONIALS.length}`}
            aria-current={i === activeIndex ? 'true' : undefined}
            onClick={() => scrollToIndex(i)}
            style={{
              // S32 a11y: touch target minimo 24x24 (Lighthouse). Bullet visual = <span> dentro.
              width: i === activeIndex ? 32 : 24,
              height: 24,
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'width 0.25s ease',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'block',
                width: i === activeIndex ? 22 : 7,
                height: 7,
                borderRadius: 4,
                background: i === activeIndex ? '#f59e0b' : 'rgba(255,255,255,0.18)',
                transition: 'width 0.25s ease, background 0.25s ease',
              }}
            />
          </button>
        ))}
      </div>
    </section>
  )
}

export default function Home() {
  const howRef = useRef<HTMLDivElement>(null)
  const pricingRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { openSignup } = useAuthModal()

  const [user, setUser] = useState<any>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false) // mantido por compatibilidade, nao usado mais (PublicHeader gerencia seu proprio state)

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

  const scrollTo = (ref: any) => ref.current?.scrollIntoView({ behavior: 'smooth' })

  // Abre modal global ou redireciona conforme estado de auth + plano escolhido.
  // Toda lógica de modal (form, validação, escolha de plano, Stripe pós-cadastro)
  // foi extraída pro AuthModalProvider em src/components/auth/AuthModalProvider.tsx.
  async function handleClickPlan(plano: 'free' | 'mensal' | 'anual') {
    // Logado + Pro → Stripe Checkout direto
    if (user && plano !== 'free') {
      try {
        trackProUpgradeInitiated(plano)
        // S29: pega session pra Bearer token. userId/email não vão mais no body.
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          openSignup({ plan: plano })
          return
        }
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ plano }),
        })
        const data = await res.json()
        if (!res.ok) {
          alert(data.error || 'Erro ao iniciar checkout. Tente novamente.')
          return
        }
        if (data.url) window.location.href = data.url
        else alert('Erro inesperado. Tente novamente.')
      } catch {
        alert('Erro de rede. Verifique sua conexão.')
      }
      return
    }
    // Logado + free → vai pro dashboard
    if (user && plano === 'free') {
      router.push('/dashboard-financeiro')
      return
    }
    // Não logado → abre modal global com plano pré-selecionado
    openSignup({ plan: plano })
  }

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
          .lp-testimonials-arrow { display: none !important; }
        }
        .lp-testimonials-row::-webkit-scrollbar { display: none; }
        .lp-testimonials-arrow:hover:not(:disabled) { background: rgba(245,158,11,0.15) !important; border-color: rgba(245,158,11,0.4) !important; }
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


        <h1 style={{ fontSize: 'clamp(40px, 7vw, 80px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 24, maxWidth: 900 }}>
          Quanto vale sua coleção<br />
          <span style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pokémon hoje?</span>
        </h1>

        <p style={{ fontSize: 20, color: 'rgba(255,255,255,0.55)', maxWidth: 1180, lineHeight: 1.6, marginBottom: 24 }}>
          Você tem cartas guardadas há anos. Já trocou e ficou com a dúvida — <em style={{ color: 'rgba(255,255,255,0.75)', fontStyle: 'normal' }}>"será que vendi por menos do que valia?"</em>. O Bynx mostra o preço real em reais, atualizado, organizado, pra você decidir com base no que importa.
        </p>
        {/* Trial badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 100, padding: '8px 20px', marginBottom: 40 }}>
          <span style={{ fontSize: 16 }}>⭐</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#f59e0b' }}>7 dias de Pro grátis</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>· sem cartão de crédito</span>
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

        <HomeSearchBand />

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
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>{s.label}</p>
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
                  <span style={{ fontSize: 9, background: c.badge + '22', color: c.badge === '#a855f7' ? '#e9d5ff' : c.badge, padding: '2px 6px', borderRadius: 6, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>{c.variante}</span>
                  <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700, whiteSpace: 'nowrap' }}>{c.medio}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <HomeVitrines />

      {/* SOCIAL PROOF — números reais do catálogo */}
      <section style={{ padding: '56px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 40, textTransform: 'uppercase', letterSpacing: '0.1em' }}>O maior catálogo Pokémon TCG em português</p>
        <div className="lp-stats-row" style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap' }}>
          {[
            { num: '69.000+', label: 'cartas catalogadas' },
            { num: '865', label: 'coleções (sets) cobertas' },
            { num: 'BRL', label: 'preços em reais, atualizados' },
            { num: '100%', label: 'foco no Brasil' },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 32, fontWeight: 800, color: '#f59e0b', letterSpacing: '-0.03em' }}>{s.num}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DOR — "Você já passou por isso?" */}
      <section aria-label="Cenários comuns do colecionador" style={{ padding: '90px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Quem coleciona, conhece</p>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>Você já passou por isso?</h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', maxWidth: 640, margin: '0 auto', lineHeight: 1.6 }}>
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
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>{s.desc}</p>
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
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', maxWidth: 640, margin: '0 auto', lineHeight: 1.6 }}>
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
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section ref={pricingRef} style={{ padding: '100px 24px', maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Planos</p>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>Comece grátis, desbloqueie mais quando quiser</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 56, fontSize: 16 }}>Sem cartão de crédito para começar.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, textAlign: 'left' }}>

          {/* Plano Free */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '32px 28px' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Grátis</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.04em' }}>R$ 0</span>
            </div>
            <div style={{ marginBottom: 28 }}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 4 }}>Para começar a organizar</p>
              <p style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700 }}>⭐ Inclui 7 dias de Pro grátis</p>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 20, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { txt: 'Cartas ilimitadas', ok: true },
                { txt: 'Perfil público', ok: true },
                { txt: '3 anúncios no Marketplace', ok: true },
                { txt: 'Pokédex completa', ok: true },
                { txt: 'Dashboard financeiro', ok: true },
                { txt: 'Exportar CSV', ok: false },
                { txt: 'Anúncios ilimitados', ok: false },
                { txt: 'Scan com IA', ok: false },
                { txt: 'Separadores de Fichário', ok: false },
              ].map(f => (
                <div key={f.txt} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: f.ok ? 1 : 0.35 }}>
                  <span style={{ color: f.ok ? '#22c55e' : '#6b7280', fontSize: 13, flexShrink: 0 }}>{f.ok ? <IconCheck size={13} color='#22c55e' /> : <svg width='13' height='13' viewBox='0 0 20 20' fill='none'><path d='M5 5l10 10M15 5L5 15' stroke='#6b7280' strokeWidth='1.6' strokeLinecap='round'/></svg>}</span>
                  <span style={{ fontSize: 13, color: f.ok ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.6)' }}>{f.txt}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => handleClickPlan('free')}
              style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '13px', borderRadius: 12, fontWeight: 600, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}
            >
              ⭐ Começar com 7 dias Pro grátis
            </button>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 10 }}>Após o trial: cartas ilimitadas pra sempre, sem Scan IA e features Pro</p>
          </div>

          {/* Pro Mensal */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '32px 28px' }}>
            <p style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pro · Mensal</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 6 }}>
              <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>R$ 29</span>
              <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.65)', letterSpacing: '-0.02em' }}>,90<span style={{ fontSize: 13 }}>/mês</span></span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 28 }}>Cancele quando quiser · sem fidelidade</p>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 20, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Anúncios ilimitados',
                'Pokédex completa',
                'Dashboard financeiro completo',
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
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginBottom: 4 }}>R$ 20,75/mês · cobrado anualmente</p>
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
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 15, marginBottom: 48 }}>
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

      {/* ── DEPOIMENTOS ── */}
      <TestimonialsCarousel />

      {/* ── DEMO ANIMADA ── */}
      <section style={{ padding: '60px 24px', maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
          Veja como funciona
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, marginBottom: 32 }}>
          Sua coleção em tempo real
        </p>

        {/* Container do mockup animado */}
        <div style={{ background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden', position: 'relative' }}>

          {/* Barra superior do "browser" */}
          <div style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(239,68,68,0.6)' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(245,158,11,0.6)' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(34,197,94,0.6)' }} />
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '4px 12px', marginLeft: 8, fontSize: 11, color: 'rgba(255,255,255,0.55)', textAlign: 'left' }}>
              bynx.gg/dashboard-financeiro
            </div>
          </div>

          {/* Conteúdo animado — 3 cenas em loop */}
          <div style={{ position: 'relative', height: 380, overflow: 'hidden' }}>

            {/* ── Cena 1: Dashboard com patrimônio ── */}
            <div style={{ position: 'absolute', inset: 0, padding: '24px 28px', animation: 'bynx-scene1 12s ease-in-out infinite' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Patrimônio total da coleção</div>
              <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 20, animation: 'bynx-countup 3s ease-out 0.5s both' }}>
                R$ 2.847,00
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
                {[{l:'Cartas',v:'47'},{l:'Saldo',v:'+R$340',c:'#22c55e'},{l:'Performance',v:'+13,6%',c:'#22c55e'},{l:'Compras',v:'R$2.507'}].map((s,i)=>(
                  <div key={i} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'10px 12px' }}>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', marginBottom:4 }}>{s.l}</div>
                    <div style={{ fontSize:15, fontWeight:700, color: s.c || '#f0f0f0' }}>{s.v}</div>
                  </div>
                ))}
              </div>
              {/* Mini gráfico simulado */}
              <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginBottom:12 }}>Histórico de preço — Charizard ex</div>
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
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)' }}>47 cartas · R$2.847,00</div>
                </div>
                <div style={{ background:'linear-gradient(135deg,#f59e0b,#ef4444)', borderRadius:10, padding:'8px 16px', fontSize:13, fontWeight:700, color:'#000' }}>+ Adicionar carta</div>
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
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', marginBottom:4 }}>{c.set} · {c.var}</div>
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
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)' }}>128 anúncios disponíveis</div>
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
                      <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)' }}>{l.set} · {l.seller} · {l.city}</div>
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
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17, marginBottom: 12, position: 'relative' }}>Comece a organizar grátis. Sem cartão de crédito.</p>
        <p style={{ color: '#f59e0b', fontSize: 14, fontWeight: 600, marginBottom: 40, position: 'relative' }}>⭐ 7 dias de Pro incluídos no cadastro gratuito</p>
        <button
          onClick={() => handleClickPlan('free')}
          style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '18px 48px', borderRadius: 14, fontWeight: 700, fontSize: 18, cursor: 'pointer', boxShadow: '0 0 60px rgba(245,158,11,0.25)', position: 'relative' }}
        >
          Começar agora grátis →
        </button>
      </section>

      {/* FOOTER */}
      <PublicFooter />


      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}