import type { Metadata } from 'next'
import AppLayout from '@/components/ui/AppLayout'
import PreviaCentralizacao from '@/components/centralizacao/PreviaCentralizacao'

/**
 * /centralizacao -- previa de centralizacao do usuario logado.
 *
 * Tela de uso interno, como o /comparador: noindex e fora do sitemap (mexer em
 * superficie de crawl para no Du). Toda a medicao roda no celular; a rota
 * /api/centralizacao so grava o registro (sem foto) e aplica o limite.
 * `?carta=<id>` chega da Colecao com a carta ja escolhida.
 */
export const metadata: Metadata = {
  title: 'Medir centralização',
  description: 'Tire uma foto da frente da sua carta Pokémon TCG e veja se ela está bem centralizada.',
  robots: { index: false, follow: false },
  alternates: { canonical: 'https://bynx.gg/centralizacao' },
}

export default async function CentralizacaoPage({ searchParams }: { searchParams: Promise<{ carta?: string | string[] }> }) {
  const sp = await searchParams
  const carta = typeof sp.carta === 'string' ? sp.carta.slice(0, 200) : null
  return (
    <AppLayout>
      <PreviaCentralizacao cartaInicial={carta} />
    </AppLayout>
  )
}
