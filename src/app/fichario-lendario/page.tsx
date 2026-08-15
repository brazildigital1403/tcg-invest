import type { Metadata } from 'next'
import LandingLendarias from '@/components/paginas-lendarias/LandingLendarias'

// Landing publica de trafego pago das Paginas Lendarias.
// Fora do AppLayout de proposito: pagina de anuncio, sem chrome de app.
// A rota do PRODUTO logado segue /paginas-lendarias; esta aqui e a vitrine.

export const metadata: Metadata = {
  title: 'Fichário Lendário — Bynx | Páginas de fichário com a arte da carta estendida',
  description:
    'A arte da carta continua pela página inteira do fichário. 19 páginas com as 30 cartas mais desejadas do Pokémon TCG, no fichário virtual e em folha A4 pra imprimir e recortar. A primeira página é grátis.',
  keywords: [
    'arte estendida pokemon', 'fichario pokemon', 'binder art pokemon', 'pagina de fichario pokemon',
    'arte estendida fichario', 'extended art binder', 'fichario 9 bolsos pokemon', 'moonbreon',
    'umbreon vmax fichario', 'imprimir arte pokemon fichario', 'pokemon tcg brasil', 'fundo continuo fichario',
    'metodo michi', 'michi method brasil', 'pagina 9 bolsos pokemon', 'arte continua fichario pokemon',
  ],
  openGraph: {
    title: 'Fichário Lendário — a arte da carta não acaba na borda',
    description:
      'Páginas de fichário onde o cenário da carta continua pelos 9 bolsos. 30 cartas lendárias, fichário virtual + folha A4 pra imprimir. Primeira página grátis.',
    url: 'https://bynx.gg/fichario-lendario',
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
    images: [{ url: 'https://bynx.gg/paginas-lendarias/moonbreon.webp', width: 1792, height: 2400, alt: 'Página Lendária Moonbreon — Bynx' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fichário Lendário — Bynx',
    description: 'A arte da carta continua pela página inteira do fichário. Primeira página grátis.',
    images: ['https://bynx.gg/paginas-lendarias/moonbreon.webp'],
  },
  alternates: { canonical: 'https://bynx.gg/fichario-lendario' },
}

const productSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Páginas Lendárias — Bynx',
  description:
    'Páginas de fichário com a arte da carta estendida pelos 9 bolsos. Fichário virtual + folha A4 com linhas de recorte pra imprimir. 19 páginas com as 30 cartas mais desejadas do Pokémon TCG.',
  image: 'https://bynx.gg/paginas-lendarias/moonbreon.webp',
  brand: { '@type': 'Brand', name: 'Bynx' },
  category: 'Acessórios para Trading Card Game',
  offers: [
    {
      '@type': 'Offer',
      name: 'Página Lendária avulsa',
      url: 'https://bynx.gg/fichario-lendario',
      price: '12.90',
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      priceValidUntil: '2027-12-31',
      seller: { '@type': 'Organization', name: 'Bynx' },
    },
    {
      '@type': 'Offer',
      name: 'Coleção Lendária — 19 páginas',
      url: 'https://bynx.gg/fichario-lendario',
      price: '79.90',
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      priceValidUntil: '2027-12-31',
      seller: { '@type': 'Organization', name: 'Bynx' },
    },
  ],
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'O que é uma Página Lendária?',
      acceptedAnswer: { '@type': 'Answer', text: 'É uma página de fichário 3x3 onde o cenário da ilustração da carta continua pelos 9 bolsos. No fichário virtual da Bynx ela aparece atrás das suas cartas; na versão impressa, você recorta a folha A4 nas linhas marcadas e monta no seu fichário físico, com a carta real por cima.' },
    },
    {
      '@type': 'Question',
      name: 'As cartas vêm junto?',
      acceptedAnswer: { '@type': 'Answer', text: 'Não. Você compra a arte da página, digital e vitalícia. As cartas são as da sua coleção — a Bynx inclusive marca automaticamente quais você já tem e quanto custa fechar a página.' },
    },
    {
      '@type': 'Question',
      name: 'Funciona em qualquer fichário?',
      acceptedAnswer: { '@type': 'Answer', text: 'Sim. O recorte segue o bolso padrão de 63x88mm dos fichários 9-pocket. A folha sai em A4 com linhas de corte marcadas.' },
    },
    {
      '@type': 'Question',
      name: 'Posso imprimir quantas vezes quiser?',
      acceptedAnswer: { '@type': 'Answer', text: 'Sim. A compra é única e vitalícia, com impressão ilimitada — em casa ou na gráfica.' },
    },
    {
      '@type': 'Question',
      name: 'Tem página grátis pra testar?',
      acceptedAnswer: { '@type': 'Answer', text: 'Tem. A página da Moonbreon (Umbreon VMAX de Evolving Skies) é liberada de graça pra qualquer pessoa, sem cartão.' },
    },
  ],
}

export default function FicharioLendarioPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <LandingLendarias />
    </>
  )
}
