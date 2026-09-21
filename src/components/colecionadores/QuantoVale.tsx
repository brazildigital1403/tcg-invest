'use client'

import { useState } from 'react'
import Image from 'next/image'

/**
 * "Como saber quanto vale sua carta Pokemon" na /colecionadores: uma carta real
 * (preco do catalogo, revalidado com a pagina) em que o visitante troca a
 * variante e ve o menor preco do Mercado Brasileiro mudar. O proprio exemplo
 * explica por que a Bynx usa o menor preco e nao a media (regra de 25/08).
 */
export type Faixa = { min: number | null; med: number | null; max: number | null }
export type CartaPreco = { nome: string; numero: string; image: string; normal: Faixa; holo: Faixa; reverse: Faixa }
type Variante = 'normal' | 'holo' | 'reverse'

const fmt = (x: number | null) => x == null ? 'sem dado' : x.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function explicacao(v: Variante, c: CartaPreco): string {
  const f = c[v]
  if (f.min == null) return 'Nesta variante ainda não há preço de referência. Quando o mercado não tem oferta, a Bynx não inventa um número.'
  if (v === 'reverse' && c.normal.min && f.min && f.min > c.normal.min * 3) {
    const x = Math.round(f.min / c.normal.min)
    return `A reverse holo do mesmo ${c.nome} sai por cerca de ${x} vezes a normal. Mesmo Pokémon, mesma coleção, outra carta.`
  }
  if (f.max && f.min && f.max > f.min * 10) return `O máximo de ${fmt(f.max)} é um anúncio fora da curva. É por isso que a Bynx usa o menor preço, e não a média: um anúncio sozinho puxa a média para cima.`
  if (f.med == null || f.max == null) return 'Com pouca oferta no mercado, a Bynx mostra só o preço que existe.'
  return 'O menor preço é o que alguém realmente consegue pagar hoje. A faixa completa mostra até onde o mercado vai.'
}

export default function QuantoVale({ carta }: { carta: CartaPreco }) {
  const opcoes = (['normal', 'holo', 'reverse'] as Variante[]).filter(v => carta[v].min != null)
  const [v, setV] = useState<Variante>(opcoes[0] ?? 'normal')
  const f = carta[v]
  const rotulo: Record<Variante, string> = { normal: 'Normal', holo: 'Holo', reverse: 'Reverse holo' }
  return (
    <div className="bx-col-qv">
      <div className="bx-col-qv-palco">
        <div className="bx-col-qv-brilho" aria-hidden="true" />
        <div className="bx-col-qv-carta">
          <Image src={carta.image} alt={`${carta.nome} ${carta.numero}`} width={230} height={321} sizes="(max-width: 768px) 170px, 230px" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 10 }} />
          {v !== 'normal' && <span className="bx-col-qv-holo" aria-hidden="true" />}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--bx-text-3)', marginBottom: 8 }}>1. ESCOLHA A VARIANTE</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }} role="group" aria-label="Variante">
          {opcoes.map(o => (
            <button key={o} type="button" onClick={() => setV(o)} aria-pressed={v === o} className={`bx-col-chip${v === o ? ' bx-col-chip-on' : ''}`}>{rotulo[o]}</button>
          ))}
        </div>
        <div className="bx-col-qv-caixa" aria-live="polite">
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ac-1)' }}>Mercado Brasileiro · menor preço</div>
          <div className="bx-col-qv-grande">{fmt(f.min)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
            {([['Mínimo', f.min, true], ['Médio', f.med, false], ['Máximo', f.max, false]] as const).map(([r, x, verde]) => (
              <div key={r} style={{ background: 'var(--bx-bg-elev)', border: '1px solid var(--bx-border)', borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bx-text-3)' }}>{r}</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: verde ? 'var(--bx-green)' : 'var(--bx-text)' }}>{fmt(x)}</div>
              </div>
            ))}
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 13.5, color: 'var(--bx-text-2)', lineHeight: 1.6 }}>{explicacao(v, carta)}</p>
        </div>
      </div>
      <style>{`
        .bx-col-qv { display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; align-items: center; }
        @media (min-width: 900px) { .bx-col-qv { grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 48px; } }
        .bx-col-qv-palco { position: relative; display: flex; justify-content: center; padding: 20px 0; }
        .bx-col-qv-brilho { position: absolute; width: 220px; height: 220px; border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%); background: radial-gradient(circle, rgba(var(--ac-1-rgb), 0.25), transparent 65%); }
        .bx-col-qv-carta { position: relative; width: 170px; transform: rotate(-3deg); animation: bxColFlutua 6s ease-in-out infinite alternate; filter: drop-shadow(0 30px 40px rgba(0,0,0,.8)); }
        @media (min-width: 768px) { .bx-col-qv-carta { width: 230px; } .bx-col-qv-brilho { width: 280px; height: 280px; } }
        .bx-col-qv-holo { position: absolute; inset: 0; border-radius: 10px; mix-blend-mode: screen; pointer-events: none;
          background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.35) 45%, rgba(var(--ac-1-rgb), .25) 55%, transparent 70%); background-size: 250% 100%; animation: bxColHolo 3s ease-in-out infinite alternate; }
        .bx-col-qv-caixa { background: var(--bx-hero-wash), var(--bx-surface); border: 1px solid rgba(var(--ac-1-rgb), 0.28); border-radius: 20px; padding: 18px; }
        @media (min-width: 768px) { .bx-col-qv-caixa { padding: 24px; } }
        .bx-col-qv-grande { font-size: clamp(38px, 6vw, 52px); font-weight: 900; letter-spacing: -0.04em; line-height: 1.1; background: var(--ac-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
        .bx-col-chip { display: inline-flex; align-items: center; gap: 7px; font: inherit; font-size: 14px; font-weight: 700; min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--bx-border); background: var(--bx-surface); color: var(--bx-text-2); cursor: pointer; transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
        .bx-col-chip-on { border-color: var(--ac-1); background: rgba(var(--ac-1-rgb), 0.12); color: var(--ac-1); }
        @keyframes bxColFlutua { from { transform: rotate(-3deg) translateY(0) } to { transform: rotate(-3deg) translateY(-10px) } }
        @keyframes bxColHolo { from { background-position: 0% 0 } to { background-position: 100% 0 } }
        @media (prefers-reduced-motion: reduce) { .bx-col-qv-carta, .bx-col-qv-holo { animation: none; } }
      `}</style>
    </div>
  )
}
