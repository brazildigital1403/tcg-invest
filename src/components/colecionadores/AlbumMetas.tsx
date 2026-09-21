'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import AnelMeta from '@/components/metas/AnelMeta'
import { fraseLeitura } from '@/lib/metasTexto'
import type { CartaVitrine } from '@/components/colecionadores/FaixaCartas'

/**
 * O album de demonstracao das Metas na /colecionadores. O visitante toca nas
 * cartas que "tem" e ve o anel, o quanto falta e a frase de leitura mudarem --
 * sente a feature antes de criar conta. Precos reais do catalogo (menor preco),
 * a mesma frase que a meta de verdade usa (fraseLeitura).
 */
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v >= 100 ? 0 : 2 })

export default function AlbumMetas({ cartas, temInicial, nomeColecao }: { cartas: CartaVitrine[]; temInicial: string[]; nomeColecao: string }) {
  const [tem, setTem] = useState<Set<string>>(() => new Set(temInicial))
  const r = useMemo(() => {
    const total = cartas.length
    const n = cartas.filter(c => tem.has(c.id)).length
    const vt = cartas.reduce((s, c) => s + c.valor, 0)
    const vtenho = cartas.reduce((s, c) => s + (tem.has(c.id) ? c.valor : 0), 0)
    return { total, tenho: n, vt, vtenho, falta: Math.max(0, vt - vtenho) }
  }, [cartas, tem])
  const pc = r.total ? Math.round((r.tenho / r.total) * 100) : 0
  const pv = r.vt ? Math.round((r.vtenho / r.vt) * 100) : 0
  const frase = fraseLeitura(r, brl)

  function alternar(id: string) {
    setTem(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  return (
    <div className="bx-col-album">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ac-1)' }}>Experimente</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Toque nas cartas que você já tem</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 999, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', color: 'var(--bx-text-2)' }}>{nomeColecao} · preços reais</span>
      </div>
      <div className="bx-col-album-grade">
        {cartas.map(c => {
          const t = tem.has(c.id)
          return (
            <button key={c.id} type="button" onClick={() => alternar(c.id)} aria-pressed={t} aria-label={`${t ? 'Desmarcar' : 'Marcar'} ${c.nome}`}
              className={`bx-col-carta${t ? '' : ' bx-col-carta-falta'}`}>
              <Image src={c.image} alt="" width={160} height={223} sizes="(max-width: 768px) 30vw, 160px" style={{ width: '100%', height: 'auto', display: 'block' }} />
              {t && (
                <span className="bx-col-ok" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4.5 10.5l3.5 3.5L15.5 6" stroke="var(--bx-brand-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              )}
              <span className="bx-col-preco">{brl(c.valor)}</span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18 }} aria-live="polite">
        <AnelMeta cartas={pc} valor={pv} tamanho={92} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-0.02em' }}>
            {r.tenho} <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--bx-text-2)' }}>de {r.total} cartas · faltam</span> <span className="bx-col-grad">{brl(r.falta)}</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bx-text-2)' }}>{pc}% das cartas · {pv}% do valor</div>
          <div style={{ fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.55 }}><b style={{ color: 'var(--bx-text)' }}>{frase.forte}</b> {frase.resto}</div>
        </div>
      </div>
      <style>{`
        .bx-col-album { background: var(--bx-hero-wash), var(--bx-surface); border: 1px solid rgba(var(--ac-1-rgb), 0.28); border-radius: 22px; box-shadow: 0 18px 50px -22px rgba(var(--ac-1-rgb), 0.4); padding: 18px 14px; }
        @media (min-width: 768px) { .bx-col-album { padding: 26px; } }
        .bx-col-album-grade { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; perspective: 900px; }
        .bx-col-carta { position: relative; padding: 0; border: 0; border-radius: 9px; overflow: hidden; background: var(--bx-surface-2); cursor: pointer; transition: transform 0.2s ease, filter 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease; }
        .bx-col-carta:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 3px; }
        .bx-col-carta-falta { filter: grayscale(1); opacity: 0.38; }
        @media (hover: hover) {
          .bx-col-carta:hover { transform: translateY(-4px) rotateX(4deg) rotateY(-4deg); box-shadow: 0 18px 34px -12px rgba(0,0,0,.8); }
          .bx-col-carta-falta:hover { opacity: 0.7; }
        }
        .bx-col-ok { position: absolute; top: 6px; left: 6px; width: 22px; height: 22px; border-radius: 50%; background: var(--bx-green); display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,.5); }
        .bx-col-preco { position: absolute; right: 6px; bottom: 6px; background: rgba(0,0,0,.82); border-radius: 7px; padding: 3px 7px; font-size: 11px; font-weight: 800; color: #fff; }
        .bx-col-grad { background: var(--ac-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
        @media (prefers-reduced-motion: reduce) { .bx-col-carta:hover { transform: none; } }
      `}</style>
    </div>
  )
}
