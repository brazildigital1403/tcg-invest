import Link from 'next/link'
import CardItem from '@/components/ui/CardItem'
import { cardDoLote } from '@/components/leilao/cardDoLote'
import { formatarBRL } from '@/lib/leilao'
import { urlHome, urlLote } from '@/lib/leilao-urls'
import type { Arrematado } from '@/app/leiloes/_dados'

/**
 * Arrematados da vitrine: lotes PAGOS, so com a carta e o preco realizado.
 * Lista vazia = a secao nem e renderizada (quem chama decide).
 */
export default function Arrematados({ itens }: { itens: Arrematado[] }) {
  return (
    <section className="vt-sec" aria-labelledby="vt-arr-t">
      <div className="vt-sec-t">
        <h2 id="vt-arr-t" className="lk-sub">Arrematados</h2>
        <Link href={urlHome('resultados')} prefetch={false} className="vt-mais">Ver todos</Link>
      </div>
      <div className="vt-grade vt-grade-auto">
        {itens.map(({ lote }) => (
          <Link key={lote.id} href={urlLote(lote.slug)} prefetch={false} className="vt-lote">
            <CardItem
              card={cardDoLote(lote)}
              mode="readonly"
              hidePriceTable
              ocultarSemPreco
              badge={
                lote.precoAtualCents != null ? <span className="vt-tag">{formatarBRL(lote.precoAtualCents)}</span> : undefined
              }
            />
          </Link>
        ))}
      </div>
    </section>
  )
}
