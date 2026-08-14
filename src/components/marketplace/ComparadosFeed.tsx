'use client'

/**
 * ComparadosFeed — Fase 2 do redesign do /comparador: "comparado agora pela
 * comunidade". Le /api/marketplace/trade-comparisons (rota trancada, o
 * client nunca fala direto com a tabela). Se a API disser disponivel:false
 * (tabela vazia ou fora do ar), cai num fallback de exemplos com selo
 * "exemplo" — nunca mente que é real, nunca fica em branco sem explicação.
 */

import { useState, useEffect } from 'react'
import type { TradeCard } from './TradeAnalyzer'

interface ItemFeed {
  id: string
  autor: string
  ladoA: TradeCard[]
  ladoB: TradeCard[]
  totalA: number
  totalB: number
  pct: number
  veredito: 'equilibrada' | 'desequilibrada' | 'muito_desequilibrada'
  criadoEm: string
  exemplo?: boolean
}

const FONT = "'DM Sans', system-ui, sans-serif"

const EXEMPLOS: ItemFeed[] = [
  {
    id: 'ex1', autor: 'exemplo', exemplo: true,
    ladoA: [{ id: 'ex-a1', name: 'Charizard ex', set_name: 'Obsidian Flames', image_small: null, preco: 340, fonte: 'BRL' }],
    ladoB: [{ id: 'ex-b1', name: 'Gengar VMAX', set_name: 'Fusion Strike', image_small: null, preco: 355, fonte: 'BRL' }],
    totalA: 340, totalB: 355, pct: 4, veredito: 'equilibrada', criadoEm: new Date().toISOString(),
  },
  {
    id: 'ex2', autor: 'exemplo', exemplo: true,
    ladoA: [{ id: 'ex-a2', name: 'Pikachu VMAX', set_name: 'Vivid Voltage', image_small: null, preco: 95, fonte: 'BRL' }],
    ladoB: [{ id: 'ex-b2', name: 'Mew ex', set_name: '151', image_small: null, preco: 210, fonte: 'BRL' }],
    totalA: 95, totalB: 210, pct: 76, veredito: 'muito_desequilibrada', criadoEm: new Date(Date.now() - 3600e3).toISOString(),
  },
]

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function tempoRelativo(iso: string) {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.round(h / 24)}d`
}

const VEREDITO_LABEL: Record<ItemFeed['veredito'], { label: string; cor: string; bg: string }> = {
  equilibrada: { label: 'Equilibrada', cor: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  desequilibrada: { label: 'Desequilibrada', cor: '#f59e0b', bg: 'rgba(245,158,11,0.13)' },
  muito_desequilibrada: { label: 'Muito desequilibrada', cor: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

function Stack({ cartas }: { cartas: TradeCard[] }) {
  return (
    <div style={{ display: 'flex' }}>
      {cartas.slice(0, 3).map((c, i) => (
        <div key={c.id} style={{ width: 24, height: 33, borderRadius: 4, overflow: 'hidden', background: 'linear-gradient(160deg,#2a2f3a,#1a1d24)', border: '2px solid #1b1f27', marginLeft: i === 0 ? 0 : -12, flexShrink: 0 }}>
          {c.image_small && <img src={c.image_small} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
      ))}
      {cartas.length > 3 && (
        <div style={{ width: 24, height: 33, borderRadius: 4, background: 'rgba(255,255,255,0.08)', border: '2px solid #1b1f27', marginLeft: -12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
            +{cartas.length - 3}
        </div>
      )}
    </div>
  )
}

export default function ComparadosFeed({ onReplay }: { onReplay: (ladoA: TradeCard[], ladoB: TradeCard[]) => void }) {
  const [itens, setItens] = useState<ItemFeed[] | null>(null)
  const [contagem, setContagem] = useState(0)

  useEffect(() => {
    fetch('/api/marketplace/trade-comparisons')
      .then(r => r.json())
      .then(d => {
        if (d?.disponivel && d.itens?.length) { setItens(d.itens); setContagem(d.contagemSemana || 0) }
        else setItens(EXEMPLOS)
      })
      .catch(() => setItens(EXEMPLOS))
  }, [])

  if (!itens) return null

  return (
    <div style={{ fontFamily: FONT, color: '#f0f0f0', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, margin: '0 0 2px', fontWeight: 700 }}>Comparado agora pela comunidade</h3>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          {itens[0]?.exemplo ? 'ainda sem trocas publicadas — exemplos de como fica' : `${contagem} troca${contagem === 1 ? '' : 's'} essa semana`}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {itens.map(item => {
          const v = VEREDITO_LABEL[item.veredito]
          return (
            <div key={item.id} onClick={() => !item.exemplo && onReplay(item.ladoA, item.ladoB)}
              style={{ flex: '0 0 auto', width: 200, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 12, cursor: item.exemplo ? 'default' : 'pointer', position: 'relative' }}>
              {item.exemplo && (
                <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 10 }}>exemplo</span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 20, background: v.bg, color: v.cor }}>{v.label}</span>
                {!item.exemplo && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{tempoRelativo(item.criadoEm)}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                <Stack cartas={item.ladoA} />
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}><path d="M7 8h10M7 8l3-3M7 8l3 3M17 16H7M17 16l-3-3M17 16l-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <Stack cartas={item.ladoB} />
              </div>
              <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, margin: '0 0 3px' }}>{fmt(item.totalA)} ↔ {fmt(item.totalB)}</p>
              <p style={{ textAlign: 'center', fontSize: 10.5, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{item.autor}</p>
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', textAlign: 'center', margin: '12px 0 0' }}>
        Comparações anônimas por padrão, vêm de quem escolheu compartilhar. A Bynx não é rede social.
      </p>
    </div>
  )
}
