import type { Metadata } from 'next'
import AvisosClient from './AvisosClient'

// Avisos do Poke Creators Club (08/11/2026). Lidos no navegador, so com sessao,
// pelas funcoes club_aviso*. Fora do AppLayout, sem indexacao e fora do sitemap.

export const metadata: Metadata = {
  title: 'Avisos do Club',
  description: 'Os avisos da organização do Poké Creators Club.',
  robots: { index: false, follow: false },
}

export default function AvisosPage() {
  return <AvisosClient />
}
