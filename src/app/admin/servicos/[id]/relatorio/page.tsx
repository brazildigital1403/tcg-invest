// Relatorio de bancada de um pedido, para imprimir (Chrome, "Salvar como PDF",
// A4, margens nenhuma, escala 100%). Admin: a rota da API confere a sessao.
// A casca do admin (menu, barra) nao aparece aqui: ver src/app/admin/layout.tsx.

import type { Metadata } from 'next'
import RelatorioPagina from '@/components/servicos/relatorio/RelatorioTela'

export const metadata: Metadata = {
  title: 'Relatório de bancada',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RelatorioPagina id={id} />
}
