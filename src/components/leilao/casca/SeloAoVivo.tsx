'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { urlRodada } from '@/lib/leilao-urls'

/**
 * Selo AO VIVO do cabecalho: aparece quando ha rodada no ar e leva ate ela.
 * Some na propria pagina da rodada (ali o palco ja diz AO VIVO) e no
 * pagamento (a tela e so de pagar; o mockup aprovado tira tudo do topo).
 *
 * Ilha de cliente: consulta GET /api/leiloes/no-ar (publica, 10s na CDN) na
 * montagem, na troca de rota e a cada 30s com a aba visivel (e na volta da
 * aba). Falhou: mantem o que estava (o selo e complementar).
 */

const INTERVALO_MS = 30_000

export default function SeloAoVivo() {
  const pathname = usePathname() || ''
  const [numero, setNumero] = useState<number | null>(null)
  const emVoo = useRef(false)

  const consultar = useCallback(async () => {
    if (emVoo.current) return
    emVoo.current = true
    try {
      const r = await fetch('/api/leiloes/no-ar')
      if (!r.ok) return
      const j = (await r.json()) as { numero?: unknown }
      const n = Number(j.numero)
      setNumero(Number.isInteger(n) && n > 0 ? n : null)
    } catch {
      // rede caiu: segue o ultimo estado conhecido
    } finally {
      emVoo.current = false
    }
  }, [])

  // Montagem e troca de rota.
  useEffect(() => {
    consultar()
  }, [consultar, pathname])

  // A cada 30s com a aba visivel; na volta da aba, na hora.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') consultar()
    }, INTERVALO_MS)
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') consultar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [consultar])

  if (!numero) return null
  const destino = urlRodada(numero)
  if (pathname === destino || pathname.endsWith('/pagar')) return null
  return (
    <Link href={destino} prefetch={false} className="lc-aovivo" aria-label="Rodada ao vivo agora. Abrir a rodada">
      <span className="lc-aovivo-ponto" aria-hidden />
      AO VIVO
    </Link>
  )
}
