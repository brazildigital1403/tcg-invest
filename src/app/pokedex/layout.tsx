import type { Metadata } from 'next'

/**
 * Metadata da /pokedex. A `page.tsx` e `'use client'` e nao pode exportar
 * `metadata`, entao sem este arquivo o WhatsApp e o X mostravam titulo,
 * descricao e url da home. Mesmo padrao do `comparador/layout.tsx`.
 *
 * ★ Sem `alternates` de proposito: o canonical segue herdado do layout raiz
 * como estava. Mudar canonical e superficie de crawl -- decisao separada.
 * A imagem vem do opengraph-image.tsx desta pasta.
 */
export const metadata: Metadata = {
  title: 'Pokédex — todos os Pokémon e suas cartas',
  description: 'Escolha um Pokémon e veja cada carta dele no Pokémon TCG, com preço em reais.',
  openGraph: {
    title: 'Pokédex — todos os Pokémon e suas cartas | Bynx',
    description: 'Escolha um Pokémon e veja cada carta dele no Pokémon TCG, com preço em reais.',
    url: 'https://bynx.gg/pokedex',
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pokédex — todos os Pokémon e suas cartas | Bynx',
    description: 'Escolha um Pokémon e veja cada carta dele no Pokémon TCG, com preço em reais.',
  },
}

export default function PokedexLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
