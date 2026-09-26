import type { Metadata } from 'next'
import PublicHeader from '@/components/ui/PublicHeader'
import AgendarClient from './AgendarClient'
import { SV_CSS } from '@/components/servicos/css'
import { servicoPorParam, MAX_CARTAS_POR_SOLICITACAO } from '@/lib/servicos'

// Formulario do orcamento pelas fotos. Nunca indexa (e o passo do funil, nao
// uma pagina de busca). ?servico= pre-seleciona; ?qtd= volta preservado do login.

export const metadata: Metadata = {
  title: 'Pedir orçamento de restauração ou pré-grading',
  description: 'Mande as fotos da carta e receba o orçamento antes de qualquer envio.',
  robots: { index: false, follow: true },
}

export default async function AgendarPage({ searchParams }: { searchParams: Promise<{ servico?: string; qtd?: string }> }) {
  const { servico, qtd } = await searchParams
  const n = Math.min(MAX_CARTAS_POR_SOLICITACAO, Math.max(1, Number.parseInt(qtd || '1', 10) || 1))
  return (
    <div className="sv-root">
      <style>{SV_CSS}</style>
      <PublicHeader />
      <main className="bx-gutter">
        <AgendarClient servicoInicial={servicoPorParam(servico)} qtdInicial={n} />
      </main>
    </div>
  )
}
