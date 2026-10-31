'use client'

import { useEffect, useState } from 'react'
import { IconClock } from '@/components/ui/Icons'
import { formatarTempoRestante, statusPublico, type LotePublico } from '@/lib/leilao'

/**
 * Selo de tempo da vitrine. Conta pelo relogio do APARELHO a partir de
 * `termina_em` / `inicia_em`.
 *
 * Por que nao um deslocamento sobre o `server_now` do RSC: esse horario fica
 * congelado no HTML (latencia da resposta, aba restaurada do bfcache, pagina
 * aberta ha minutos) e o erro vira contagem adiantada ou atrasada. Na vitrine
 * o selo e so indicativo; o lance e a pagina do lote acertam pelo servidor.
 *
 * O primeiro render usa `renderizadoEm` como "agora" — igual no servidor e no
 * cliente, sem erro de hidratacao. Na montagem passa para o relogio local.
 */
export default function SeloTempo({
  lote,
  renderizadoEm,
}: {
  lote: Pick<LotePublico, 'status' | 'iniciaEm' | 'terminaEm' | 'softCloseSeg'>
  renderizadoEm: string
}) {
  const base = Date.parse(renderizadoEm)
  const [agora, setAgora] = useState<number>(Number.isFinite(base) ? base : 0)

  useEffect(() => {
    const tick = () => setAgora(Date.now())
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

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
