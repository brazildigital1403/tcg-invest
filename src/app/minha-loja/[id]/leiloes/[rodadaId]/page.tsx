import { notFound } from 'next/navigation'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import EditorRodada from './EditorRodada'

/**
 * /minha-loja/[id]/leiloes/[rodadaId] — montar uma rodada ao vivo.
 * Casca de servidor so para a flag: desligada, 404 antes de montar a tela.
 */
export default async function LojaRodadaPage({ params }: { params: Promise<{ id: string; rodadaId: string }> }) {
  if (!LEILAO_ATIVO) notFound()
  const { id, rodadaId } = await params
  return <EditorRodada lojaId={id} rodadaId={rodadaId} />
}
