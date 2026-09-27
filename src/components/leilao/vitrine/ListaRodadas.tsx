import Image from 'next/image'
import Link from 'next/link'
import { IconChevronRight } from '@/components/ui/Icons'
import { tituloRodada, type RodadaPublica } from '@/lib/leilao-rodada'
import { urlRodada } from '@/lib/leilao-urls'
import type { LojaDoLote } from '@/app/leiloes/_dados'

/** Lista de rodadas em linhas: quando, loja, lotes e seta. Toda a linha e o link. */
export default function ListaRodadas({
  rodadas,
  lojas,
  contagem,
  quando,
}: {
  rodadas: RodadaPublica[]
  lojas: Map<string, LojaDoLote>
  contagem: Map<string, number>
  quando: (r: RodadaPublica) => string
}) {
  return (
    <ul className="vt-lista">
      {rodadas.map(r => {
        const loja = lojas.get(r.lojaId ?? '') ?? null
        const nome = loja ? loja.nome ?? loja.slug : null
        const n = contagem.get(r.id)
        return (
          <li key={r.id}>
            <Link href={urlRodada(r.numero)} prefetch={false} className="vt-linha-r">
              <span className="vt-num" style={{ fontWeight: 800, minWidth: 44, color: 'var(--bx-text)', flexShrink: 0 }}>{quando(r)}</span>
              {loja?.logoUrl ? (
                <Image src={loja.logoUrl} alt="" width={26} height={26} sizes="26px" style={{ width: 26, height: 26, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <span className="vt-logo" style={{ width: 26, height: 26, flexBasis: 26, borderRadius: 8, fontSize: 11 }} aria-hidden>
                  {(nome ?? 'B').charAt(0).toUpperCase()}
                </span>
              )}
              <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                <span style={{ color: 'var(--bx-text)', fontWeight: 600 }}>{nome ?? tituloRodada(r)}</span>
                {n != null ? ` · ${n === 1 ? '1 lote' : `${n} lotes`}` : ''}
                {nome && r.titulo ? <span style={{ display: 'block', fontSize: 12, color: 'var(--bx-text-3)' }}>{tituloRodada(r)}</span> : null}
              </span>
              <IconChevronRight size={16} color="var(--bx-text-3)" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
