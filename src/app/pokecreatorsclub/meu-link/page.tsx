import type { Metadata } from 'next'
import MeuLinkClient from './MeuLinkClient'

// Meu link do Club (plano de 25/11/2026). Página ESTÁTICA: tudo é lido no navegador por
// club_meu_link. Segue o resto do Club: fora do AppLayout, sem indexação e fora do sitemap.

export const metadata: Metadata = {
  title: 'Meu link',
  description: 'O seu endereço no Poké Creators Club e quantas pessoas chegaram por ele.',
  robots: { index: false, follow: false },
}

export default function MeuLinkPage() {
  return <MeuLinkClient />
}
