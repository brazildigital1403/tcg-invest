import type { Metadata } from 'next'
import AniversariantesClient from './AniversariantesClient'

// Aniversariantes do Poke Creators Club (05/11/2026). Lista lida no navegador,
// so com sessao, pelas funcoes club_aniversario*. Fora do AppLayout, sem
// indexacao e fora do sitemap.

export const metadata: Metadata = {
  title: 'Aniversariantes do Club',
  description: 'Quem faz aniversário no Poké Creators Club.',
  robots: { index: false, follow: false },
}

export default function AniversariantesPage() {
  return <AniversariantesClient />
}
