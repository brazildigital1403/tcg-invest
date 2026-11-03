import Link from 'next/link'
import { IconCard, IconLoja, IconShield } from '@/components/ui/Icons'
import { urlHome } from '@/lib/leilao-urls'

/** A garantia em uma linha. O texto completo fica em Como funciona. */
export default function SelosGarantia() {
  return (
    <Link href={urlHome('como-funciona')} prefetch={false} className="vt-selos">
      <span><IconShield size={15} />Proteção Bynx</span>
      <span><IconCard size={15} />Só paga quem vence</span>
      <span><IconLoja size={15} />Quem vende aparece</span>
    </Link>
  )
}
