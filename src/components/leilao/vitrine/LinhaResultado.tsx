import { Linha, MiniCarta } from '@/components/leilao/kit'
import { formatarBRL, type LotePublico } from '@/lib/leilao'
import { urlLote } from '@/lib/leilao-urls'
import type { LojaDoLote } from '@/app/leiloes/_dados'

/** Lote pago: carta, loja e valor final. */
export default function LinhaResultado({ lote, loja }: { lote: LotePublico; loja: LojaDoLote | null }) {
  const imagem = lote.fotos[0] || lote.cardImage
  const lances = lote.nLances === 1 ? '1 lance' : `${lote.nLances} lances`
  return (
    <Linha
      href={urlLote(lote.slug)}
      seta={false}
      midia={imagem ? <MiniCarta src={imagem} /> : undefined}
      titulo={lote.cardName}
      meta={loja ? `${loja.nome ?? loja.slug} · ${lances}` : lances}
      valor={lote.precoAtualCents != null ? formatarBRL(lote.precoAtualCents) : undefined}
    />
  )
}
