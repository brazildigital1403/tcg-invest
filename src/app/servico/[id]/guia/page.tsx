// Guia de envio do pedido, visto pelo CLIENTE (dono): folha A4 com o passo a
// passo de embalagem e a etiqueta de recortar. Fora do AppLayout de proposito,
// como o relatorio: e um documento para imprimir. O dado vem do GET do pedido,
// que so devolve o endereco da Bynx com o pedido aceito e o sinal pago.

import type { Metadata } from 'next'
import GuiaEnvio from '@/components/servicos/relatorio/GuiaEnvio'

export const metadata: Metadata = {
  title: 'Guia de envio',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GuiaEnvio id={id} />
}
