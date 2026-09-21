import { useId } from 'react'
import { IconCheck } from '@/components/ui/Icons'

/**
 * Anel duplo das Metas: CARTAS por fora (acento), VALOR por dentro (verde).
 * Uma figura, dois dados -- a diferenca entre eles salta aos olhos, e a frase
 * de leitura ao lado explica. Substitui as duas barras soltas.
 */
export default function AnelMeta({ cartas, valor, tamanho = 96 }: {
  cartas: number
  valor: number
  tamanho?: number
}) {
  const id = useId().replace(/:/g, '')
  const r1 = 52, r2 = 38
  const c1 = 2 * Math.PI * r1, c2 = 2 * Math.PI * r2
  const pc = Math.max(0, Math.min(100, cartas)), pv = Math.max(0, Math.min(100, valor))
  const completo = pc >= 100
  const fs = tamanho >= 110 ? 26 : tamanho >= 80 ? 22 : 14
  return (
    <div role="img" aria-label={`${pc}% das cartas e ${pv}% do valor`}
      style={{ position: 'relative', width: tamanho, height: tamanho, flexShrink: 0 }}>
      <svg width={tamanho} height={tamanho} viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--ac-1)' }} />
            <stop offset="1" style={{ stopColor: 'var(--ac-2)' }} />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={r1} fill="none" strokeWidth={10} style={{ stroke: 'var(--bx-surface-3)' }} />
        <circle cx="60" cy="60" r={r1} fill="none" strokeWidth={10} strokeLinecap="round" stroke={`url(#g${id})`}
          strokeDasharray={c1} strokeDashoffset={c1 * (1 - pc / 100)} style={{ transition: 'stroke-dashoffset 0.2s ease' }} />
        <circle cx="60" cy="60" r={r2} fill="none" strokeWidth={8} style={{ stroke: 'var(--bx-surface-3)' }} />
        <circle cx="60" cy="60" r={r2} fill="none" strokeWidth={8} strokeLinecap="round"
          strokeDasharray={c2} strokeDashoffset={c2 * (1 - pv / 100)} style={{ stroke: 'var(--bx-green)', transition: 'stroke-dashoffset 0.2s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {completo ? <IconCheck size={Math.round(tamanho / 4)} color="var(--bx-green)" /> : (
          <>
            {/* So o numero: "das cartas" dentro do anel encostava no anel de
                valor (visto no teste de 21/09). A legenda vem ao lado. */}
            <span style={{ fontSize: fs, fontWeight: 900, letterSpacing: '-0.03em' }}>{pc}%</span>
          </>
        )}
      </div>
    </div>
  )
}

/** Legenda de duas bolinhas, ao lado do anel. */
export function LegendaAnel({ cartas, valor }: { cartas: number; valor: number }) {
  const bola = (bg: string) => <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: bg, marginRight: 6 }} />
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, fontWeight: 700, color: 'var(--bx-text-2)' }}>
      <span>{bola('var(--ac-grad)')}{cartas}% das cartas</span>
      <span>{bola('var(--bx-green)')}{valor}% do valor</span>
    </div>
  )
}
