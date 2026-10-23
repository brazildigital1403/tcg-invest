import type { Metadata } from 'next'
import CriadoresClient from './CriadoresClient'

// Landing do convite de grupo para criadores (23/10/2026): /criadores?c=<codigo>.
// Pagina ESTATICA: o codigo do link e lido no navegador e validado em
// /api/criadores/convite, entao nao ha render por request. Fora do AppLayout,
// sem indexacao e fora do sitemap -- o link circula so no grupo.

export const metadata: Metadata = {
  title: 'Convite para criadores',
  description: 'Um ano de Bynx Pro para criadores de Pokémon TCG: coleção, graduadas e patrimônio em real, organizados do seu jeito.',
  robots: { index: false, follow: false },
}

export default function CriadoresPage() {
  return <CriadoresClient />
}
