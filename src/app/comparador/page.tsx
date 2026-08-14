'use client'

/**
 * /comparador — Trade Analyzer solto, fora do fluxo de negociação.
 *
 * Mesmo componente usado no ChatDock (TradeAnalyzer), aqui sem carta
 * pré-carregada — o usuário monta os dois lados do zero pra "brincar" ou
 * conferir uma troca combinada fora da Bynx (WhatsApp, presencial, etc.).
 * Não precisa de login: é calculadora, não mexe em dado de ninguém.
 */

import { useState, useRef } from 'react'
import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import TradeAnalyzer, { type TradeCard } from '@/components/marketplace/TradeAnalyzer'
import ComparadorDestaques from '@/components/marketplace/ComparadorDestaques'

export default function ComparadorPage() {
  const [seed, setSeed] = useState<{ a?: TradeCard; b?: TradeCard; v: number }>({ v: 0 })
  const calcRef = useRef<HTMLDivElement>(null)

  function handleSeed(a?: TradeCard, b?: TradeCard) {
    setSeed(prev => ({ a, b, v: prev.v + 1 }))
    calcRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <AppLayout>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 0 60px' }}>
        <PageHeader
          trilha={[INICIO, { name: 'Comparador de troca', href: '/comparador' }]}
          titulo="Comparador de troca"
          descricao="Monte os dois lados de uma troca e veja se está equilibrada, pelo Mercado Brasileiro."
          selo={
            <span style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245,158,11,0.13)', border: '1px solid rgba(245,158,11,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', flex: '0 0 auto' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M7 8h10M7 8l3-3M7 8l3 3M17 16H7M17 16l-3-3M17 16l-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          }
        />

        <ComparadorDestaques onSeed={handleSeed} />

        <div ref={calcRef} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0 20px' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px dashed rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.35)', fontWeight: 700, whiteSpace: 'nowrap' }}>ou monte a sua troca</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px dashed rgba(255,255,255,0.15)' }} />
        </div>

        <TradeAnalyzer key={seed.v} initialCardA={seed.a} initialCardB={seed.b} />
      </div>
    </AppLayout>
  )
}
