import Image from 'next/image'
import Link from 'next/link'
import SeloTempo from '@/components/leilao/SeloTempo'
import { Preco, Rotulo } from '@/components/leilao/kit'
import { formatarBRL, type LotePublico } from '@/lib/leilao'
import { urlLote } from '@/lib/leilao-urls'

/** O lote que termina primeiro: carta grande, preco e tempo. O cartao inteiro leva ao lote. */
export default function LoteDestaque({ lote, renderizadoEm }: { lote: LotePublico; renderizadoEm: string }) {
  const imagem = lote.fotos[0] || lote.cardImage
  const temLance = lote.nLances > 0 && lote.precoAtualCents != null
  const lances = lote.nLances === 0 ? 'Nenhum lance ainda' : lote.nLances === 1 ? '1 lance' : `${lote.nLances} lances`
  return (
    <Link href={urlLote(lote.slug)} prefetch={false} className="vt-dest">
      <span className="vt-dest-t">
        <Rotulo>Termina primeiro</Rotulo>
        <SeloTempo lote={lote} renderizadoEm={renderizadoEm} selo />
      </span>
      <span className="vt-dest-art">
        {imagem && <Image src={imagem} alt="" width={384} height={536} sizes="(min-width: 769px) 300px, 200px" priority />}
      </span>
      <span className="vt-dest-nome">
        <strong>{lote.cardName}</strong>
        {lote.setNome && <small>{lote.setNome}</small>}
      </span>
      <Preco medio rotulo={temLance ? 'Lance atual' : 'Lance inicial'} valor={formatarBRL(temLance ? lote.precoAtualCents! : lote.lanceInicialCents)} meta={lances} />
      <span className="lk-btn lk-btn-prim lk-btn-cheio">Dar lance</span>
    </Link>
  )
}
