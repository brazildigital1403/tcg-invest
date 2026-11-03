import Image from 'next/image'
import Link from 'next/link'
import { formatarBRL, type LotePublico } from '@/lib/leilao'
import { urlLote } from '@/lib/leilao-urls'
import type { LojaDoLote } from '@/app/leiloes/_dados'

/** Lote pago: carta, loja e valor final. */
export default function LinhaResultado({ lote, loja }: { lote: LotePublico; loja: LojaDoLote | null }) {
  const imagem = lote.fotos[0] || lote.cardImage
  const lances = lote.nLances === 1 ? '1 lance' : `${lote.nLances} lances`
  return (
    <Link href={urlLote(lote.slug)} prefetch={false} className="vt-res">
      {imagem ? <Image src={imagem} alt="" width={128} height={179} sizes="48px" /> : <span className="vt-res-vazio" />}
      <span className="vt-res-c">
        <b>{lote.cardName}</b>
        <small>{loja ? `${loja.nome ?? loja.slug} · ${lances}` : lances}</small>
      </span>
      {lote.precoAtualCents != null && <strong>{formatarBRL(lote.precoAtualCents)}</strong>}
    </Link>
  )
}
