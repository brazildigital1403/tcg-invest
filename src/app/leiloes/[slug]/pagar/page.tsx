import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import PagarLote from '@/components/leilao/PagarLote'
import { rotuloGraduacao } from '@/components/leilao/cardDoLote'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { codigoDoSlug, type LotePublico } from '@/lib/leilao'
import { urlLote, urlPagar } from '@/lib/leilao-urls'
import { buscarLotePorCodigo } from '../../_dados'

/**
 * /leiloes/[slug]/pagar — pagamento do arremate.
 *
 * O servidor entrega so o que e publico do lote (view `leiloes_publico`). Quem
 * venceu, o prazo e o vendedor vem da ilha `PagarLote`, que chama
 * GET /api/leiloes/[id]/checkout com o Bearer da sessao: o login da Bynx vive
 * no navegador, entao o servidor desta pagina nao sabe quem esta olhando.
 *
 * Pagina privada: fora do indice e sem cache (cada visita e de uma pessoa).
 * Acento do comprador (`.bx-ctx-comprador`), igual ao /checkout. Sem padding
 * lateral proprio: o `main.bx-gutter` da casca de /leiloes ja da o gutter.
 */

// DECISAO DO DU: cache. Mesmo regime da pagina do lote (force-dynamic): esta
// tela so tem sentido ao vivo e e por pessoa.
export const dynamic = 'force-dynamic'
export const maxDuration = 20

export const metadata: Metadata = {
  title: 'Pagar lote arrematado',
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function nomeCompleto(l: LotePublico): string {
  return [l.cardName, l.cardNumero, rotuloGraduacao(l)].filter(Boolean).join(' ')
}

export default async function PagarLotePage({ params, searchParams }: Props) {
  if (!LEILAO_ATIVO) notFound()

  const { slug } = await params
  const codigo = codigoDoSlug(slug)
  if (!codigo) notFound()
  const l = await buscarLotePorCodigo(codigo)
  if (!l) notFound()
  if (l.slug && l.slug !== slug) redirect(urlPagar(l.slug))

  const sp = await searchParams
  const cancelado = sp.cancelado === '1'
  const urlDoLote = urlLote(l.slug)
  const nome = nomeCompleto(l)

  return (
      <div className="bx-ctx-comprador" style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--bx-text)', margin: '0 0 12px', letterSpacing: '-0.01em' }}>
          Pagar lote arrematado
        </h1>
        <PagarLote
          loteId={l.id}
          urlLote={urlDoLote}
          urlPagar={urlPagar(l.slug)}
          nomeInicial={nome}
          imagemInicial={l.fotos[0] || l.cardImage}
          cancelado={cancelado}
        />
      </div>
  )
}
