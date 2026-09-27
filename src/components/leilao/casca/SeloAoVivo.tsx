'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { urlRodada } from '@/lib/leilao-urls'

/**
 * Selo AO VIVO do cabecalho: aparece quando ha rodada no ar e leva ate ela.
 * Some na propria pagina da rodada (ali o palco ja diz AO VIVO) e no
 * pagamento (a tela e so de pagar; o mockup aprovado tira tudo do topo).
 */
export default function SeloAoVivo({ numero }: { numero: number }) {
  const pathname = usePathname() || ''
  const destino = urlRodada(numero)
  if (pathname === destino || pathname.endsWith('/pagar')) return null
  return (
    <Link href={destino} prefetch={false} className="lc-aovivo" aria-label="Rodada ao vivo agora. Abrir a rodada">
      <span className="lc-aovivo-ponto" aria-hidden />
      AO VIVO
    </Link>
  )
}
