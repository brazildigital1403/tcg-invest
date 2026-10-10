// Relatorio de bancada do pedido, visto pelo CLIENTE (dono). Mesmo documento
// do painel (RelatorioImpresso), com a barra "Imprimir / Salvar PDF".
// Fora do AppLayout de proposito: e um documento A4, como o do admin. O
// /servico/[id] poe o AppLayout na propria page, entao esta rota irma sai sem
// casca. A rota da API confere o dono e o status 'entregue'.

import type { Metadata } from 'next'
import { RelatorioDono } from '@/components/servicos/relatorio/RelatorioTela'

export const metadata: Metadata = {
  title: 'Relatório da bancada',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RelatorioDono id={id} />
}
