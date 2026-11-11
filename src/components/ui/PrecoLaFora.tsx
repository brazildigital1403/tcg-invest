'use client'

import { useEffect, useState } from 'react'

/**
 * Bloco "Preco la fora" do detalhe da carta (Colecao e Pokedex).
 *
 * ★ 11/11/2026, mockup aprovado pelo Du (artifact UwERiQNUaJiTM1Bp78TJmE).
 * TCGplayer (USD) e Cardmarket (EUR) logo ABAIXO do Mercado Brasileiro, em cinza e sem
 * destaque: o Brasil e sempre o primeiro e o maior. O valor de fora e informativo, nao e
 * parametro de preco da Bynx.
 *
 * Sem dado (carta so do Brasil, ou a tabela ainda vazia) o componente nao renderiza nada:
 * nada de linha "indisponivel". Fonte: /api/cards/[id]/preco-internacional.
 */

interface PrecoFora {
  usd_normal: number | null
  usd_holofoil: number | null
  usd_reverse_holofoil: number | null
  usd_1st_edition_normal: number | null
  usd_1st_edition_holofoil: number | null
  eur_media_venda: number | null
  eur_tendencia: number | null
  coletado_em: string
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0 }
const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** O valor do TCGplayer que combina com a variante da carta; sem ele, o primeiro que existir. */
function escolherUsd(p: PrecoFora, variante?: string | null): { valor: number; rotulo: string } | null {
  const candidatos: { chave: string; valor: number; rotulo: string }[] = [
    { chave: 'normal', valor: num(p.usd_normal), rotulo: 'Normal' },
    { chave: 'foil', valor: num(p.usd_holofoil), rotulo: 'Holofoil' },
    { chave: 'reverse', valor: num(p.usd_reverse_holofoil), rotulo: 'Reverse holofoil' },
    { chave: '1st-normal', valor: num(p.usd_1st_edition_normal), rotulo: '1ª edição' },
    { chave: '1st-foil', valor: num(p.usd_1st_edition_holofoil), rotulo: '1ª edição holofoil' },
  ]
  const v = (variante || 'normal').toLowerCase()
  const alvo = candidatos.find(c => c.chave === v && c.valor > 0)
  const pegado = alvo || candidatos.find(c => c.valor > 0)
  return pegado ? { valor: pegado.valor, rotulo: pegado.rotulo } : null
}

function idade(iso: string): { texto: string; velho: boolean } {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (!Number.isFinite(dias) || dias <= 0) return { texto: 'atualizado hoje', velho: false }
  if (dias === 1) return { texto: 'atualizado ontem', velho: false }
  return { texto: `atualizado há ${dias} dias`, velho: dias > 7 }
}

export default function PrecoLaFora({ cardId, variante }: {
  cardId: string | null | undefined
  /** Variante da carta (normal, foil, reverse...). Escolhe qual valor do TCGplayer mostrar. */
  variante?: string | null
}) {
  const [preco, setPreco] = useState<PrecoFora | null>(null)
  const [cotacao, setCotacao] = useState<{ usd: number; eur: number } | null>(null)

  useEffect(() => {
    if (!cardId) return
    let ativo = true
    Promise.all([
      fetch(`/api/cards/${encodeURIComponent(cardId)}/preco-internacional`).then(r => (r.ok ? r.json() : null)),
      fetch('/api/exchange-rate').then(r => (r.ok ? r.json() : null)),
    ])
      .then(([p, c]) => {
        if (!ativo) return
        setPreco(p?.preco ?? null)
        setCotacao(c && num(c.usd) > 0 && num(c.eur) > 0 ? { usd: num(c.usd), eur: num(c.eur) } : null)
      })
      .catch(() => { /* sem o bloco; o preco do Brasil continua onde esta */ })
    return () => { ativo = false }
  }, [cardId])

  if (!preco) return null
  const usd = escolherUsd(preco, variante)
  const eurValor = num(preco.eur_media_venda) || num(preco.eur_tendencia)
  const eurRotulo = num(preco.eur_media_venda) ? 'Média de venda' : 'Tendência'
  if (!usd && !eurValor) return null

  const { texto: quando, velho } = idade(preco.coletado_em)
  const nota = { margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--bx-text-2)' } as const

  const linha = (fonte: string, regiao: string, detalhe: string, valorTxt: string, emReais: number | null) => (
    <div className="bx-plf-linha">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{fonte} <span style={{ fontWeight: 500, color: 'var(--bx-text-2)' }}>· {regiao}</span></span>
        <span style={{ fontSize: 12, color: 'var(--bx-text-2)' }}>{detalhe}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 800 }}>{valorTxt}</span>
        {emReais != null && <span style={{ fontSize: 12, color: 'var(--bx-text-2)' }}>≈ R$ {fmt(emReais)}</span>}
      </div>
    </div>
  )

  return (
    <section className="bx-plf" aria-label="Preço lá fora">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bx-text-2)' }}>Preço lá fora</h3>
        {velho
          ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(var(--ac-1-rgb), 0.45)', color: 'var(--ac-1)' }}>{quando}</span>
          : <span style={{ fontSize: 11, color: 'var(--bx-text-2)' }}>{quando}</span>}
      </div>
      {usd && linha('TCGplayer', 'EUA', `${usd.rotulo} · preço de mercado`, `US$ ${fmt(usd.valor)}`, cotacao ? usd.valor * cotacao.usd : null)}
      {eurValor > 0 && linha('Cardmarket', 'Europa', eurRotulo, `€ ${fmt(eurValor)}`, cotacao ? eurValor * cotacao.eur : null)}
      <p style={nota}>
        Só para você comparar. O valor de fora não entra na sua coleção nem no preço da Bynx.
        {cotacao ? ` Câmbio do dia: US$ 1 = R$ ${fmt(cotacao.usd)} · € 1 = R$ ${fmt(cotacao.eur)}.` : ''}
      </p>
      <style>{`
        .bx-plf { padding: 14px; border-radius: 14px; border: 1px solid var(--bx-border); background: var(--bx-surface); display: flex; flex-direction: column; gap: 12px; min-width: 0; }
        .bx-plf-linha { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px 12px; padding: 10px 12px; border-radius: 10px; background: var(--bx-surface-2); }
      `}</style>
    </section>
  )
}
