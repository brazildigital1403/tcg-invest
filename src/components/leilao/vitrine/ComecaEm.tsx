'use client'

import { useEffect, useState } from 'react'
import { textoComecaEm } from '@/lib/leilao-vitrine'

/**
 * "começa em 1h 14min", contando pelo relogio do aparelho (a cada 30s: o
 * texto so tem minuto). Primeiro render com `renderizadoEm`, igual no
 * servidor e no cliente.
 */
export default function ComecaEm({
  iniciaEm,
  renderizadoEm,
  maiuscula = false,
}: {
  iniciaEm: string | null
  renderizadoEm: string
  maiuscula?: boolean
}) {
  const base = Date.parse(renderizadoEm)
  const [agora, setAgora] = useState<number>(Number.isFinite(base) ? base : 0)

  useEffect(() => {
    const tick = () => setAgora(Date.now())
    tick()
    const t = setInterval(tick, 30_000)
    return () => clearInterval(t)
  }, [])

  const ini = iniciaEm ? Date.parse(iniciaEm) : NaN
  const texto = textoComecaEm(ini - agora)
  return <>{maiuscula ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto}</>
}
