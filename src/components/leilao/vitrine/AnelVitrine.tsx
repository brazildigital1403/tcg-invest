'use client'

import { useEffect, useId, useState } from 'react'
import { formatarTempoAnel, formatarTempoRestante } from '@/lib/leilao'

/**
 * Anel do relogio do lote no ar, no palco da vitrine (58px). Conta pelo
 * relogio do APARELHO a partir de `termina_em` (mesma escolha do SeloTempo:
 * na vitrine o tempo e indicativo; o lance acerta pelo servidor na rodada).
 * Primeiro render com `renderizadoEm` = sem erro de hidratacao.
 *
 * Nada anima sozinho: so o traco muda a cada segundo, entao
 * prefers-reduced-motion nao tem o que desligar.
 */
export default function AnelVitrine({
  terminaEm,
  duracaoSeg,
  renderizadoEm,
}: {
  terminaEm: string | null
  duracaoSeg: number
  renderizadoEm: string
}) {
  const id = useId().replace(/:/g, '')
  const base = Date.parse(renderizadoEm)
  const [agora, setAgora] = useState<number>(Number.isFinite(base) ? base : 0)

  useEffect(() => {
    const tick = () => setAgora(Date.now())
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  const fim = terminaEm ? Date.parse(terminaEm) : NaN
  const resta = Number.isFinite(fim) ? Math.max(0, fim - agora) : 0
  const total = Math.max(1, duracaoSeg) * 1000
  const fracao = Math.min(1, resta / total)
  const urgente = resta <= 10_000
  const R = 28
  const C = 2 * Math.PI * R
  const texto = formatarTempoAnel(resta)

  return (
    <span className="vt-anel" role="timer" aria-label={`Tempo restante do lote: ${formatarTempoRestante(resta)}`}>
      <svg viewBox="0 0 64 64" width={58} height={58} aria-hidden>
        <defs>
          <linearGradient id={`vt-anel-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--ac-1)' }} />
            <stop offset="1" style={{ stopColor: 'var(--ac-2)' }} />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r={R} fill="none" stroke="var(--bx-border)" strokeWidth="5" />
        {fracao > 0 && (
          <circle
            cx="32" cy="32" r={R} fill="none" strokeWidth="5" strokeLinecap="round"
            stroke={urgente ? 'var(--bx-red)' : `url(#vt-anel-${id})`}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - fracao)}
            transform="rotate(-90 32 32)"
          />
        )}
      </svg>
      <b style={{ color: urgente ? 'var(--bx-red)' : 'var(--bx-text)', fontSize: texto.length > 5 ? 11.5 : 13 }}>{texto}</b>
    </span>
  )
}
