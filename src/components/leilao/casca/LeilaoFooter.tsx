import Link from 'next/link'
import { IconShield } from '@/components/ui/Icons'
import { urlHome } from '@/lib/leilao-urls'

/** Rodape enxuto do Bynx Leiloes. */
export default function LeilaoFooter() {
  return (
    <footer className="lc-rodape bx-gutter">
      <div className="lc-rodape-in">
        <p className="lc-rodape-protecao">
          <IconShield size={14} />
          Pagamento protegido pela Bynx, no cartão.
        </p>
        <nav aria-label="Links do Bynx Leilões" className="lc-rodape-links">
          <Link href={urlHome('como-funciona')} prefetch={false} className="lc-link">Como funciona</Link>
          <Link href="/termos" prefetch={false} className="lc-link">Termos</Link>
          <Link href="/para-lojistas" prefetch={false} className="lc-link">Para lojistas</Link>
          <Link href="/" prefetch={false} className="lc-link">Ir para o app Bynx</Link>
        </nav>
      </div>
    </footer>
  )
}
