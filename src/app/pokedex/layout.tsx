import type { Metadata } from 'next'

/**
 * Metadata da /pokedex. A `page.tsx` e `'use client'` e nao pode exportar
 * `metadata`, entao sem este arquivo o WhatsApp e o X mostravam titulo,
 * descricao e url da home. Mesmo padrao do `comparador/layout.tsx`.
 *
 * ★ Canonical proprio (decisao do Du, 14/09): sem ele a rota herdava o
 * `canonical: "https://bynx.gg"` absoluto do layout raiz e dizia ao Google que
 * a versao canonica dela era a HOME -- e ela esta no sitemap.
 * A imagem vem do opengraph-image.tsx desta pasta.
 */
export const metadata: Metadata = {
  title: 'Pokédex — todos os Pokémon e suas cartas',
  description: 'Escolha um Pokémon e veja cada carta dele no Pokémon TCG, com preço em reais.',
  alternates: { canonical: 'https://bynx.gg/pokedex' },
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
