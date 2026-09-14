import type { Metadata } from 'next'

/**
 * Metadata do /marketplace. A `page.tsx` e `'use client'` e nao pode exportar
 * `metadata`, entao sem este arquivo o WhatsApp e o X mostravam titulo,
 * descricao e url da home. Mesmo padrao do `comparador/layout.tsx`.
 *
 * ★ Canonical proprio (decisao do Du, 14/09): sem ele a rota herdava o
 * `canonical: "https://bynx.gg"` absoluto do layout raiz e dizia ao Google que
 * a versao canonica dela era a HOME -- e ela esta no sitemap.
 * A imagem vem do opengraph-image.tsx desta pasta. /marketplace/negociacao/[id]
 * herda titulo e canonical daqui (e tela logada, sem metadata propria).
 */
export const metadata: Metadata = {
  title: 'Mercado — cartas Pokémon TCG à venda',
  description: 'Cartas Pokémon TCG à venda de colecionador para colecionador, com preço em reais.',
  alternates: { canonical: 'https://bynx.gg/marketplace' },
  openGraph: {
    title: 'Mercado — cartas Pokémon TCG à venda | Bynx',
    description: 'Cartas Pokémon TCG à venda de colecionador para colecionador, com preço em reais.',
    url: 'https://bynx.gg/marketplace',
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mercado — cartas Pokémon TCG à venda | Bynx',
    description: 'Cartas Pokémon TCG à venda de colecionador para colecionador, com preço em reais.',
  },
}

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
