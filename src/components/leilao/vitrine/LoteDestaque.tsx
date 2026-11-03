import Image from 'next/image'
import Link from 'next/link'
import SeloTempo from '@/components/leilao/SeloTempo'
import { formatarBRL, type LotePublico } from '@/lib/leilao'
import { urlLote } from '@/lib/leilao-urls'

/** O lote que termina primeiro, na primeira dobra da vitrine. O cartao inteiro leva ao lote. */
export default function LoteDestaque({ lote, renderizadoEm }: { lote: LotePublico; renderizadoEm: string }) {
  const imagem = lote.fotos[0] || lote.cardImage
  const temLance = lote.nLances > 0 && lote.precoAtualCents != null
  return (
    <Link href={urlLote(lote.slug)} prefetch={false} className="vt-dest">
      <span className="vt-dest-art">
        {imagem && <Image src={imagem} alt="" width={384} height={536} sizes="(min-width: 769px) 256px, 128px" priority />}
      </span>
      <span className="vt-dest-d">
        <span className="vt-dest-ey">Termina primeiro</span>
        <strong className="vt-dest-nome">{lote.cardName}</strong>
        {lote.setNome && <span className="vt-dest-set">{lote.setNome}</span>}
        <span className="vt-dest-rot">{temLance ? 'Lance atual' : 'Lance inicial'}</span>
        <span className="vt-dest-preco">{formatarBRL(temLance ? lote.precoAtualCents! : lote.lanceInicialCents)}</span>
        <SeloTempo lote={lote} renderizadoEm={renderizadoEm} tamanho={13} />
        <span className="vt-cta vt-dest-cta">Dar lance</span>
      </span>
    </Link>
  )
}
