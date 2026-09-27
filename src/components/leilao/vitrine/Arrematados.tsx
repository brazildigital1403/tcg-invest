import Link from 'next/link'
import CardItem from '@/components/ui/CardItem'
import { cardDoLote } from '@/components/leilao/cardDoLote'
import { formatarBRL } from '@/lib/leilao'
import { urlHome, urlLote } from '@/lib/leilao-urls'
import type { Arrematado } from '@/app/leiloes/_dados'

/**
 * "Arrematados recentemente": lotes PAGOS, com o preco realizado e o menor
 * preco do Mercado Brasileiro de HOJE (nao e o do dia do arremate: o rotulo
 * diz "hoje"). Lista vazia = a secao nem e renderizada (quem chama decide).
 */
export default function Arrematados({ itens }: { itens: Arrematado[] }) {
  return (
    <section className="vt-sec" aria-labelledby="vt-arr-t">
      <div className="vt-sec-t">
        <h2 id="vt-arr-t">Arrematados recentemente</h2>
        <Link href={urlHome('resultados')} prefetch={false} className="vt-mais">Ver os resultados</Link>
      </div>
      <div className="vt-grade vt-grade6">
        {itens.map(({ lote, mercadoHojeCents }) => (
          <Link key={lote.id} href={urlLote(lote.slug)} prefetch={false} className="vt-lote">
            <CardItem
              card={cardDoLote(lote)}
              mode="readonly"
              hidePriceTable
              ocultarSemPreco
              badge={
                lote.precoAtualCents != null ? <span className="vt-tag">{formatarBRL(lote.precoAtualCents)}</span> : undefined
              }
              footerSlot={
                <div className="vt-arr-rod">
                  <span className="vt-ok">Arrematado</span>
                  {mercadoHojeCents != null && <span>Mercado hoje a partir de {formatarBRL(mercadoHojeCents)}</span>}
                </div>
              }
            />
          </Link>
        ))}
      </div>
    </section>
  )
}
