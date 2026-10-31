import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { formatarBRL, type LotePublico } from '@/lib/leilao'
import { urlLote } from '@/lib/leilao-urls'

/**
 * "Proximos lotes" da rodada ao vivo, em lista: posicao, miniatura, nome,
 * lance inicial e o Mercado Brasileiro de hoje (menor preco, lido no servidor
 * so para carta sem graduacao). Sem referencia, esse trecho some.
 */
export default function FilaProximos({
  proximos,
  posicao,
  referencias,
}: {
  proximos: LotePublico[]
  /** Posicao 1-based do lote na rodada (sem os cancelados). */
  posicao: (id: string) => number
  referencias: Record<string, number>
}) {
  if (!proximos.length) return null
  return (
    <section aria-labelledby="fp-titulo" style={S.caixa}>
      <div style={S.cab}>
        <h2 id="fp-titulo" style={S.h2}>Próximos lotes</h2>
        <span style={S.qtd}>{proximos.length} na fila</span>
      </div>
      <ol style={S.lista}>
        {proximos.map((l, i) => {
          const img = l.fotos[0] || l.cardImage
          const ref = referencias[l.id]
          return (
            <li key={l.id}>
              <Link href={urlLote(l.slug)} prefetch={false} className="fp-it" style={S.it}>
                <span style={S.ordem}>{posicao(l.id)}</span>
                {img ? (
                  <Image
                    src={img}
                    alt=""
                    width={38}
                    height={53}
                    sizes="38px"
                    loading={i < FILA_EAGER ? 'eager' : 'lazy'}
                    style={S.img}
                  />
                ) : (
                  <span style={{ ...S.img, background: 'var(--bx-surface-3)' }} />
                )}
                <span style={S.txt}>
                  <b style={S.nome}>
                    {l.cardName}
                    {l.cardNumero ? ` ${l.cardNumero}` : ''}
                  </b>
                  <span style={S.meta}>
                    Inicial {formatarBRL(l.lanceInicialCents)}
                    {ref ? ` · Mercado hoje a partir de ${formatarBRL(ref)}` : ''}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/**
 * Miniaturas da fila que carregam JA (eager). Com o `loading="lazy"` padrao do
 * next/image, a miniatura so e pedida quando o navegador decide que ela
 * chegou perto da tela: medido em 375px na rodada 31, as tags tinham src no
 * HTML mas `currentSrc` vazio (caixa vazia) depois do carregamento. Sao ~2 a
 * 6 KB cada (largura 64/128); da 7a em diante segue lazy.
 */
const FILA_EAGER = 6

const S: Record<string, CSSProperties> = {
  caixa: {
    display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 16,
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', minWidth: 0,
  },
  cab: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  h2: { margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--bx-text)' },
  qtd: { fontSize: 12, color: 'var(--bx-text-3)', fontVariantNumeric: 'tabular-nums' },
  lista: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  it: {
    display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, minHeight: 44,
    border: '1px solid var(--bx-border)', background: 'var(--bx-bg-elev)', textDecoration: 'none', color: 'inherit', minWidth: 0,
  },
  ordem: { width: 22, flexShrink: 0, fontWeight: 800, color: 'var(--bx-text-3)', fontSize: 12, fontVariantNumeric: 'tabular-nums' },
  img: { width: 38, height: 53, flex: '0 0 38px', borderRadius: 4, objectFit: 'cover', display: 'block' },
  txt: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  nome: { fontSize: 13, color: 'var(--bx-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { fontSize: 11.5, color: 'var(--bx-text-2)', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' },
}
