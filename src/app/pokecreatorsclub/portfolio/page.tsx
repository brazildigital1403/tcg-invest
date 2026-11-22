import type { Metadata } from 'next'
import PortfolioClient from './PortfolioClient'

// Meu portfólio (Fase 2 do Álbum do Club). Página ESTÁTICA: tudo é lido no navegador pelas funções
// club_portfolio_*. Segue o resto do Club: fora do AppLayout, sem indexação e fora do sitemap.

export const metadata: Metadata = {
  title: 'Meu portfólio',
  description: 'O seu portfólio de criador no Poké Creators Club.',
  robots: { index: false, follow: false },
}

export default function PortfolioPage() {
  return <PortfolioClient />
}
