'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Variant = { title: string; subtitle: string; cta: string }

const VARIANTS: Variant[] = [
  {
    title: 'Quanto vale a sua coleção?',
    subtitle: 'Descubra o valor real das suas cartas em reais, com preços atualizados todo dia.',
    cta: 'Avaliar minha coleção',
  },
  {
    title: 'Sua coleção, organizada de verdade.',
    subtitle: 'Catálogo completo, scanner com IA e preços em R$. Tudo num lugar só.',
    cta: 'Começar grátis',
  },
  {
    title: 'Compre e venda com segurança.',
    subtitle: 'Marketplace de cartas com perfis públicos e negociação direta entre colecionadores.',
    cta: 'Ver o marketplace',
  },
  {
    title: 'Acompanhe o preço de cada carta.',
    subtitle: 'Alertas, histórico e o valor do seu portfólio Pokémon sempre à mão.',
    cta: 'Criar conta grátis',
  },
  {
    title: 'Escaneie. Catalogue. Acompanhe.',
    subtitle: 'Monte sua coleção em minutos com o scanner de cartas por IA.',
    cta: 'Testar o scanner',
  },
  {
    title: 'Sua coleção vale mais do que você imagina.',
    subtitle: 'Junte-se a milhares de colecionadores no maior hub de Pokémon TCG do Brasil.',
    cta: 'Entrar no Bynx',
  },
]

export default function PromoBanner() {
  const [i, setI] = useState(0)
  useEffect(() => {
    setI(Math.floor(Math.random() * VARIANTS.length))
  }, [])
  const v = VARIANTS[i]

  return (
    <div className="bynx-promo">
      <style>{`
        @keyframes bynxPromoGlow { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:.95;transform:scale(1.08)} }
        @keyframes bynxFloat { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-10px) rotate(8deg)} }
        @keyframes bynxFloat2 { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(8px) rotate(-10deg)} }
        @keyframes bynxShine { 0%{transform:translateX(-130%)} 55%,100%{transform:translateX(360%)} }
        .bynx-promo{position:relative;overflow:hidden;border-radius:16px;padding:26px 24px;margin:6px 0 2px;border:1px solid rgba(245,158,11,0.28);background:radial-gradient(130% 130% at 100% 0%, rgba(245,158,11,0.16), transparent 55%), linear-gradient(135deg,#15191f 0%, #0b0e14 100%);}
        .bynx-promo .pb-glow{position:absolute;top:-70px;right:-40px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle, rgba(245,158,11,0.40), rgba(239,68,68,0.12) 45%, transparent 70%);filter:blur(6px);animation:bynxPromoGlow 5s ease-in-out infinite;pointer-events:none;}
        .bynx-promo .pb-ball{position:absolute;opacity:.10;pointer-events:none;}
        .bynx-promo .pb-ball.b1{top:-24px;right:30px;width:118px;height:118px;animation:bynxFloat 7s ease-in-out infinite;}
        .bynx-promo .pb-ball.b2{bottom:-34px;left:-20px;width:92px;height:92px;animation:bynxFloat2 9s ease-in-out infinite;}
        .bynx-promo .pb-cta{position:relative;overflow:hidden;display:inline-flex;align-items:center;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#000;padding:12px 24px;border-radius:12px;font-weight:800;font-size:14px;text-decoration:none;box-shadow:0 6px 22px rgba(245,158,11,0.30);transition:transform .15s ease, box-shadow .15s ease;}
        .bynx-promo .pb-cta:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(245,158,11,0.45);}
        .bynx-promo .pb-shine{position:absolute;top:0;left:0;height:100%;width:36%;background:linear-gradient(100deg,transparent, rgba(255,255,255,0.55), transparent);transform:translateX(-130%);animation:bynxShine 3.8s ease-in-out infinite;pointer-events:none;}
        @media (prefers-reduced-motion: reduce){ .bynx-promo .pb-glow,.bynx-promo .pb-ball,.bynx-promo .pb-shine{animation:none !important;} }
      `}</style>

      <div className="pb-glow" />
      <Pokeball className="pb-ball b1" />
      <Pokeball className="pb-ball b2" />

      <div style={{ position: 'relative', zIndex: 2 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: '#f59e0b',
            fontWeight: 800,
            marginBottom: 8,
          }}
        >
          Bynx
        </div>
        <h2
          style={{
            fontSize: 'clamp(19px, 4vw, 25px)',
            fontWeight: 800,
            color: '#fff',
            margin: '0 0 8px',
            lineHeight: 1.15,
            maxWidth: 540,
          }}
        >
          {v.title}
        </h2>
        <p
          style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.62)',
            margin: '0 0 18px',
            maxWidth: 520,
            lineHeight: 1.5,
          }}
        >
          {v.subtitle}
        </p>
        <Link href="/" className="pb-cta">
          <span className="pb-shine" />
          <span style={{ position: 'relative' }}>{v.cta + ' \u2192'}</span>
        </Link>
      </div>
    </div>
  )
}

function Pokeball({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="46" stroke="#f59e0b" strokeWidth="5" />
      <path d="M5 50 H38 a12 12 0 0 0 24 0 H95" stroke="#f59e0b" strokeWidth="5" />
      <circle cx="50" cy="50" r="11" stroke="#f59e0b" strokeWidth="5" fill="#0b0e14" />
    </svg>
  )
}
