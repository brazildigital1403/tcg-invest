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
import ComparadosFeed from '@/components/marketplace/ComparadosFeed'

export default function ComparadorPage() {
  /**
   * `v` e um TOKEN, nao um `key`. Antes isto era `key={seed.v}` no
   * TradeAnalyzer: cada toque num destaque remontava o componente inteiro e
   * levava junto tudo que o usuario tinha adicionado pela BUSCA -- que o pai
   * nem enxerga. Agora o token so avisa "chegou carta nova"; quem acrescenta e
   * o proprio TradeAnalyzer, sem perder o que ja estava na tela.
   */
  const [seed, setSeed] = useState<{ ladoA: TradeCard[]; ladoB: TradeCard[]; v: number }>({ ladoA: [], ladoB: [], v: 0 })
  /** true = substitui os dois lados (replay do feed). false = acrescenta. */
  const [substituir, setSubstituir] = useState(false)
  const calcRef = useRef<HTMLDivElement>(null)

  function irParaCalculadora() {
    calcRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /**
   * ★ Antes isto APAGAVA o trabalho do usuario. `handleSeed` montava
   * `{ladoA: a?[a]:[], ladoB: b?[b]:[]}` -- sempre substituindo os DOIS lados
   * -- e o `key={seed.v}` remontava o TradeAnalyzer do zero. Quem ja tinha
   * montado um lado e tocava numa carta do radar via o lado sumir, sem aviso e
   * sem desfazer. E a propria copy convida ao toque: "Toque numa carta pra ja
   * jogar ela na troca aqui embaixo".
   *
   * Agora ACRESCENTA no lado certo e preserva o outro.
   */
  function handleSeed(a?: TradeCard, b?: TradeCard) {
    setSubstituir(false)
    setSeed(prev => ({ ladoA: a ? [a] : [], ladoB: b ? [b] : [], v: prev.v + 1 }))
    irParaCalculadora()
  }

  /** Replay do feed: aqui SUBSTITUIR e o certo -- e "ver aquela troca", nao
   *  "somar aquela troca na minha". */
  function handleReplay(ladoA: TradeCard[], ladoB: TradeCard[]) {
    setSubstituir(true)
    setSeed(prev => ({ ladoA, ladoB, v: prev.v + 1 }))
    irParaCalculadora()
  }

  return (
    <AppLayout>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 0 60px' }}>
        <PageHeader
          trilha={[INICIO, { name: 'Comparador de troca', href: '/comparador' }]}
          titulo="Comparador de troca"
          descricao="Monte os dois lados de uma troca e veja se está equilibrada, pelo Mercado Brasileiro."
          selo={
            <span style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--ac-1-rgb),0.13)', border: '1px solid rgba(var(--ac-1-rgb),0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ac-1)', flex: '0 0 auto' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M7 8h10M7 8l3-3M7 8l3 3M17 16H7M17 16l-3-3M17 16l-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          }
        />

        <ComparadorDestaques onSeed={handleSeed} />

        <ComparadosFeed onReplay={handleReplay} />

        <div ref={calcRef} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0 20px' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px dashed rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.35)', fontWeight: 700, whiteSpace: 'nowrap' }}>ou monte a sua troca</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px dashed rgba(255,255,255,0.15)' }} />
        </div>

        <TradeAnalyzer seedLadoA={seed.ladoA} seedLadoB={seed.ladoB} seedToken={seed.v} seedSubstitui={substituir} />
      </div>
    </AppLayout>
  )
}
