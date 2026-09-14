import type { Metadata } from 'next'

/**
 * Metadata do /master-sets. A `page.tsx` e `'use client'` e nao pode exportar
 * `metadata`, entao sem este arquivo o WhatsApp e o X mostravam titulo,
 * descricao e url da home. Mesmo padrao do `comparador/layout.tsx`.
 *
 * ★ Canonical proprio (decisao do Du, 14/09): sem ele a rota herdava o
 * `canonical: "https://bynx.gg"` absoluto do layout raiz e dizia ao Google que
 * a versao canonica dela era a HOME.
 * A imagem vem do opengraph-image.tsx desta pasta. /master-sets/[setId] herda
 * titulo, imagem e canonical daqui (nao tem metadata propria) -- canonical
 * por set exige metadata no [setId], que e client.
 */
export const metadata: Metadata = {
  title: 'Master Sets — complete um set inteiro',
  description: 'Complete um set inteiro sem perder o controle: suas cartas já vêm marcadas, imprima e preencha só o que falta.',
  alternates: { canonical: 'https://bynx.gg/master-sets' },
  openGraph: {
    title: 'Master Sets — complete um set inteiro | Bynx',
    description: 'Suas cartas já vêm marcadas: imprima e preencha só o que falta.',
    url: 'https://bynx.gg/master-sets',
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Master Sets — complete um set inteiro | Bynx',
    description: 'Suas cartas já vêm marcadas: imprima e preencha só o que falta.',
  },
}

export default function MasterSetsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
