'use client'

/**
 * /comparador — Trade Analyzer solto, fora do fluxo de negociação.
 *
 * Mesmo componente usado no ChatDock (TradeAnalyzer), aqui sem carta
 * pré-carregada — o usuário monta os dois lados do zero pra "brincar" ou
 * conferir uma troca combinada fora da Bynx (WhatsApp, presencial, etc.).
 * Não precisa de login: é calculadora, não mexe em dado de ninguém.
 */

import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import TradeAnalyzer from '@/components/marketplace/TradeAnalyzer'

export default function ComparadorPage() {
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

        <TradeAnalyzer />
      </div>
    </AppLayout>
  )
}
