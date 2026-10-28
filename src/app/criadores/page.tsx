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
  // Previa do link no WhatsApp: sem isto o titulo, o texto e a url vinham do
  // layout raiz (os da home). A imagem sai de ./opengraph-image.tsx.
  openGraph: {
    title: 'Creator Bynx: 1 ano de Bynx Pro para criadores',
    description: 'Convite para criadores de Pokémon TCG: 1 ano de Bynx Pro, sem cartão e sem cobrança no fim. 100 convites até 06/11.',
    url: 'https://bynx.gg/criadores',
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Creator Bynx: 1 ano de Bynx Pro para criadores',
    description: 'Convite para criadores de Pokémon TCG: 1 ano de Bynx Pro, sem cartão e sem cobrança no fim.',
  },
}

export default function CriadoresPage() {
  return <CriadoresClient />
}
