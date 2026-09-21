import type { Metadata } from 'next'

// Area logada: fora do indice. A pagina publica sobre colecao e a
// /colecionadores (#375), nao esta.
export const metadata: Metadata = {
  title: 'Metas de coleção',
  robots: { index: false, follow: false },
}

export default function MetasLayout({ children }: { children: React.ReactNode }) {
  return children
}
