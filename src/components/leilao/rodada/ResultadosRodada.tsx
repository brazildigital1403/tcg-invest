import Link from 'next/link'
import type { CSSProperties } from 'react'
import CardItem from '@/components/ui/CardItem'
import { cardDoLote } from '@/components/leilao/cardDoLote'
import type { LotePublico } from '@/lib/leilao'
import { rodapeResultado } from '@/lib/leilao-rodada'
import { urlLote } from '@/lib/leilao-urls'

/**
 * "Resultados desta rodada": os lotes encerrados em CardItem, com o rodape
 * "Arrematado R$ X · N lances" / "Sem lances". Contagem "N de Y lotes
 * encerrados" com o total real (sem cancelados).
 */
export default function ResultadosRodada({
  encerrados,
  total,
  posicao,
}: {
  encerrados: LotePublico[]
  total: number
  posicao: (id: string) => number
}) {
  const fechados = encerrados.filter(l => l.status !== 'cancelado')
  if (!encerrados.length) return null
  return (
    <section aria-labelledby="rr-resultados" style={S.secao}>
      <div style={S.cab}>
        <h2 id="rr-resultados" style={S.h2}>Resultados desta rodada</h2>
        {total > 0 && (
          <span style={S.qtd}>
            {fechados.length} de {total} {total === 1 ? 'lote encerrado' : 'lotes encerrados'}
          </span>
        )}
      </div>
      <div className="rd-grid">
        {encerrados.map(l => {
          const r = rodapeResultado(l)
          const pos = posicao(l.id)
          return (
            <Link key={l.id} href={urlLote(l.slug)} prefetch={false} className="rd-lote">
              <CardItem
                card={cardDoLote(l)}
                mode="readonly"
                hidePriceTable
                ocultarSemPreco
                badge={pos > 0 ? <span style={S.badge}>Lote {pos}</span> : undefined}
                footerSlot={
                  <span style={{ ...S.rodape, color: r?.tipo === 'arrematado' ? 'var(--bx-green)' : 'var(--bx-text-3)' }}>
                    {r?.texto ?? 'Encerrado'}
                  </span>
                }
              />
            </Link>
          )
        })}
      </div>
    </section>
  )
}

const S: Record<string, CSSProperties> = {
  secao: { display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 },
  cab: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  h2: { margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--bx-text)' },
  qtd: { fontSize: 13, color: 'var(--bx-text-3)', fontVariantNumeric: 'tabular-nums' },
  badge: {
    fontSize: 11.5, fontWeight: 800, color: 'var(--bx-text)', background: 'var(--bx-bg-elev)',
    border: '1px solid var(--bx-border-2)', padding: '2px 8px', borderRadius: 6, fontVariantNumeric: 'tabular-nums',
  },
  rodape: { fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
}
