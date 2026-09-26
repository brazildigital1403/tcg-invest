import type { Metadata } from 'next'

// /servico/[id] e a pagina privada de um pedido de restauracao/pre-grading:
// nunca indexa (a pagina em si e client component e nao exporta metadata).
export const metadata: Metadata = {
  title: 'Seu pedido de restauração',
  robots: { index: false, follow: false },
}

export default function ServicoLayout({ children }: { children: React.ReactNode }) {
  return children
}
