import { notFound } from 'next/navigation'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import ListaRodadas from './ListaRodadas'

/**
 * /minha-loja/[id]/leiloes — rodadas ao vivo da loja.
 * Casca de servidor so para a flag: desligada, 404 antes de montar a tela.
 */
export default async function LojaLeiloesPage({ params }: { params: Promise<{ id: string }> }) {
  if (!LEILAO_ATIVO) notFound()
  const { id } = await params
  return <ListaRodadas lojaId={id} />
}
