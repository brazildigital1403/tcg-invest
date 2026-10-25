// Guia de envio de um pedido, para o admin baixar o PDF e mandar ao cliente.
// Mesmo documento do /servico/[id]/guia; a rota da API confere a sessao.

import type { Metadata } from 'next'
import GuiaEnvio from '@/components/servicos/relatorio/GuiaEnvio'

export const metadata: Metadata = {
  title: 'Guia de envio',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GuiaEnvio id={id} admin />
}
