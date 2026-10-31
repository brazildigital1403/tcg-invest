import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import MeusLances from './MeusLances'

/**
 * /leiloes/meus-lances — os lotes em que a pessoa deu lance.
 *
 * Tudo por pessoa e o login vive no navegador: o servidor so entrega a casca
 * e a ilha `MeusLances` busca GET /api/leiloes/meus com o Bearer da sessao.
 * Fora do indice. Sem AppLayout: herda o layout de /leiloes.
 */

export const metadata: Metadata = {
  title: 'Meus lances',
  robots: { index: false, follow: false },
}

export default function MeusLancesPage() {
  if (!LEILAO_ATIVO) notFound()
  return <MeusLances />
}
