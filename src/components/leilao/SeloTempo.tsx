'use client'

import { useEffect, useState } from 'react'
import { IconClock } from '@/components/ui/Icons'
import { formatarTempoRestante, statusPublico, type LotePublico } from '@/lib/leilao'

/**
 * Selo de tempo da vitrine. Conta no relogio do SERVIDOR: `serverNow` vem da
 * renderizacao e vira um deslocamento sobre o relogio do aparelho (celular com
 * hora errada nao pode mostrar lote aberto ou fechado errado).
 *
 * O primeiro render usa o proprio `serverNow` como "agora" — igual no servidor
 * e no cliente, sem erro de hidratacao. O tique comeca no efeito.
 */
export default function SeloTempo({
  lote,
  serverNow,
}: {
  lote: Pick<LotePublico, 'status' | 'iniciaEm' | 'terminaEm' | 'softCloseSeg'>
  serverNow: string
}) {
  const base = Date.parse(serverNow)
  const [agora, setAgora] = useState<number>(Number.isFinite(base) ? base : 0)

  useEffect(() => {
    const offset = Number.isFinite(base) ? base - Date.now() : 0
    const tick = () => setAgora(Date.now() + offset)
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [base])

  const st = statusPublico(lote, agora)
  let texto = ''
  if (st === 'em_breve') {
    const ini = lote.iniciaEm ? Date.parse(lote.iniciaEm) : NaN
    texto = Number.isFinite(ini) && ini > agora ? `Começa em ${formatarTempoRestante(ini - agora)}` : 'Em breve'
  } else if (st === 'ao_vivo' || st === 'encerrando') {
    const fim = lote.terminaEm ? Date.parse(lote.terminaEm) : NaN
    texto = Number.isFinite(fim) ? formatarTempoRestante(fim - agora) : 'Ao vivo'
  } else {
    texto = 'Encerrado'
  }

  const urgente = st === 'encerrando'
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        color: urgente ? 'var(--bx-red)' : st === 'ao_vivo' ? 'var(--bx-text)' : 'var(--bx-text-3)',
      }}
    >
      <IconClock size={12} />
      {texto}
    </span>
  )
}
