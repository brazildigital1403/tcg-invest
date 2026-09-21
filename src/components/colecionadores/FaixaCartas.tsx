import Image from 'next/image'

/**
 * Faixa de cartas reais correndo na horizontal (/colecionadores, 21/09/2026).
 * CSS puro: a lista vai duplicada e anda -50%, entao o fim encontra o comeco
 * sem salto. Pausa no hover; parada para quem pediu menos movimento.
 * Decorativa: as cartas nao sao links nem conteudo lido (aria-hidden).
 */
export type CartaVitrine = { id: string; nome: string; numero: string; image: string; valor: number }

export default function FaixaCartas({ cartas }: { cartas: CartaVitrine[] }) {
  if (cartas.length === 0) return null
  const lista = [...cartas, ...cartas]
  return (
    <div className="bx-col-faixa" aria-hidden="true">
      <div className="bx-col-faixa-trilho">
        {lista.map((c, i) => (
          <div key={`${c.id}-${i}`} className="bx-col-faixa-carta">
            <Image src={c.image} alt="" width={110} height={154} sizes="110px" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8 }} />
          </div>
        ))}
      </div>
      <style>{`
        .bx-col-faixa { position: relative; overflow: hidden; padding: 24px 0; border-top: 1px solid var(--bx-border); border-bottom: 1px solid var(--bx-border); background: linear-gradient(180deg, rgba(var(--ac-1-rgb), 0.04), transparent); }
        .bx-col-faixa::before, .bx-col-faixa::after { content: ''; position: absolute; top: 0; bottom: 0; width: 80px; z-index: 2; pointer-events: none; }
        .bx-col-faixa::before { left: 0; background: linear-gradient(90deg, var(--bx-bg), transparent); }
        .bx-col-faixa::after { right: 0; background: linear-gradient(270deg, var(--bx-bg), transparent); }
        .bx-col-faixa-trilho { display: flex; gap: 14px; width: max-content; animation: bxColFaixa 60s linear infinite; }
        .bx-col-faixa:hover .bx-col-faixa-trilho { animation-play-state: paused; }
        .bx-col-faixa-carta { width: 84px; flex-shrink: 0; filter: drop-shadow(0 10px 18px rgba(0,0,0,.7)); }
        @media (min-width: 768px) { .bx-col-faixa-carta { width: 110px; } }
        @keyframes bxColFaixa { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @media (prefers-reduced-motion: reduce) { .bx-col-faixa-trilho { animation: none; } }
      `}</style>
    </div>
  )
}
