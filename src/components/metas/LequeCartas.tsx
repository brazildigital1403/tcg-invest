import Image from 'next/image'
import { IconCheck } from '@/components/ui/Icons'

/**
 * Leque de artes das Metas (#368, mockup aprovado em 21/09/2026).
 *
 * A mais valiosa no centro, as seguintes alternando para os lados. Carta que
 * a pessoa TEM sai colorida com check verde; a que FALTA sai em cinza com
 * borda tracejada. Numa meta "32% das cartas, 97% do valor" o centro vem
 * colorido e as pontas em cinza: o dado aparece antes de alguem ler o numero.
 *
 * Decorativo (aria-hidden): os nomes estao na grade logo abaixo. NAO e card
 * de carta -- a grade continua sendo o CardItem.
 */
export type CartaLeque = { image: string | null; nome: string; tem: boolean }

const MEDIDAS = {
  sm: [48, 56, 48],
  md: [54, 64, 78, 64, 54],
  lg: [72, 86, 104, 86, 72],
} as const

// Coloca a primeira (mais valiosa) no centro e alterna as demais.
function arrumar<T>(xs: T[]): T[] {
  const out: T[] = []
  xs.forEach((x, i) => { if (i % 2 === 0) out.push(x); else out.unshift(x) })
  return out
}

export default function LequeCartas({ cartas, tamanho = 'md', prioridade = false }: {
  cartas: CartaLeque[]
  tamanho?: 'sm' | 'md' | 'lg'
  /** Acima da dobra: a carta do centro carrega com prioridade (LCP). */
  prioridade?: boolean
}) {
  const n = tamanho === 'sm' ? 3 : 5
  const lista = arrumar(cartas.slice(0, n))
  if (lista.length === 0) return null
  const larguras = MEDIDAS[tamanho]
  const off = Math.floor((larguras.length - lista.length) / 2)
  const passo = lista.length >= 5 ? 7 : 8
  const meio = (lista.length - 1) / 2
  return (
    <div className="bx-leque" aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      {lista.map((c, i) => {
        const w = larguras[i + off] ?? larguras[larguras.length - 1]
        const d = i - meio
        const centro = d === 0
        return (
          <div key={`${c.nome}-${i}`} className="bx-leque-carta" style={{
            width: w, flexShrink: 0, position: 'relative', marginLeft: i ? -14 : 0,
            zIndex: 10 - Math.abs(Math.round(d)),
            ['--r' as string]: `${d * passo}deg`, ['--y' as string]: `${Math.abs(d) * (lista.length >= 5 ? 4 : 4)}px`,
            transform: 'rotate(var(--r)) translateY(var(--y))',
            transition: 'transform 0.2s ease',
          }}>
            <div style={{
              aspectRatio: '63 / 88', borderRadius: 6, overflow: 'hidden', position: 'relative',
              background: 'var(--bx-surface-2)',
              border: c.tem ? '1px solid var(--bx-border-2)' : '1px dashed var(--bx-border-2)',
              boxShadow: c.tem ? 'var(--bx-shadow)' : 'none',
              filter: c.tem ? undefined : 'grayscale(1)', opacity: c.tem ? 1 : 0.4,
            }}>
              {c.image && (
                <Image src={c.image} alt="" fill sizes={`${w}px`} priority={prioridade && centro}
                  style={{ objectFit: 'contain' }} />
              )}
            </div>
            {c.tem && (
              <span style={{ position: 'absolute', top: 4, left: 4, width: 18, height: 18, borderRadius: '50%', background: 'var(--bx-green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconCheck size={11} color="var(--bx-brand-ink)" />
              </span>
            )}
          </div>
        )
      })}
      <style>{`
        @media (hover: hover) { .bx-leque:hover .bx-leque-carta { transform: rotate(calc(var(--r) * 1.3)) translateY(var(--y)); } }
        @media (prefers-reduced-motion: reduce) { .bx-leque-carta { transition: none !important; } .bx-leque:hover .bx-leque-carta { transform: rotate(var(--r)) translateY(var(--y)); } }
      `}</style>
    </div>
  )
}
