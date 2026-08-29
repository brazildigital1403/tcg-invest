import type { Metadata } from 'next'
import LandingLendarias from '@/components/paginas-lendarias/LandingLendarias'

// Landing publica de trafego pago das Paginas Lendarias.
// Fora do AppLayout de proposito: pagina de anuncio, sem chrome de app.
// A rota do PRODUTO logado segue /paginas-lendarias; esta aqui e a vitrine.

// ★ O layout raiz ja aplica o template "%s | Bynx.gg" -- NAO repetir "Bynx"
// aqui. O title anterior fechava em 86 chars com "Bynx" duas vezes, e o
// Google corta em ~60: a keyword ("arte estendida") nem aparecia no
// resultado. Agora fecha em 58. Mesma logica na description (200 -> 152,
// corte do Google e ~155).
export const metadata: Metadata = {
  title: 'Fichário Lendário — arte estendida pelos 9 bolsos',
  description:
    'A arte da carta continua pelos 9 bolsos do fichário. 52 páginas das cartas mais desejadas do Pokémon TCG, em folha A4 pra imprimir. A primeira é grátis.',
  keywords: [
    'arte estendida pokemon', 'fichario pokemon', 'binder art pokemon', 'pagina de fichario pokemon',
    'arte estendida fichario', 'extended art binder', 'fichario 9 bolsos pokemon', 'moonbreon',
    'umbreon vmax fichario', 'imprimir arte pokemon fichario', 'pokemon tcg brasil', 'fundo continuo fichario',
    'metodo michi', 'michi method brasil', 'pagina 9 bolsos pokemon', 'arte continua fichario pokemon',
  ],
  openGraph: {
    title: 'Fichário Lendário — a arte da carta não acaba na borda',
    description:
      'Páginas de fichário onde o cenário da carta continua pelos 9 bolsos. 52 páginas lendárias, fichário virtual + folha A4 pra imprimir. Primeira página grátis.',
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

/**
 * Product + Offer da landing.
 *
 * O Search Console lista 5 campos como AUSENTES (OPCIONAL) — sao avisos, nao
 * erros: a pagina ja e elegivel a rich result sem eles. Decisao por campo:
 *
 * - aggregateRating / review: FICAM DE FORA ate existir avaliacao real de
 *   comprador. Inventar nota viola as diretrizes de spam de dados estruturados
 *   do Google (ação manual derruba os rich results do dominio inteiro, nao so
 *   desta pagina) e e propaganda enganosa pelo CDC.
 * - shippingDetails: nao se aplica. E arte DIGITAL, entregue na conta — nao ha
 *   envio, e declarar frete zero afirmaria um envio que nao existe.
 * - hasMerchantReturnPolicy: cabivel, mas exige politica de reembolso escrita.
 *   Os Termos hoje so tratam de assinatura e cobranca indevida, nada sobre
 *   compra avulsa de produto digital. Schema nao pode prometer o que a pagina
 *   de Termos nao sustenta.
 * - validFrom: preenchido abaixo.
 */
const productSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Páginas Lendárias — Bynx',
  description:
    'Páginas de fichário com a arte da carta estendida pelos 9 bolsos. Fichário virtual + folha A4 com linhas de recorte pra imprimir. 52 páginas com as cartas mais desejadas do Pokémon TCG.',
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
      // validFrom: dia em que a oferta entrou no ar. Factual — os outros
      // campos que o Search Console pede como opcionais NAO entram:
      // shippingDetails nao se aplica (produto digital, sem envio) e
      // hasMerchantReturnPolicy exigiria declarar uma politica que os Termos
      // ainda nao tem. Ver comentario acima do schema.
      validFrom: '2026-08-16',
      priceValidUntil: '2027-12-31',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'Bynx' },
    },
    {
      '@type': 'Offer',
      name: 'Coleção Lendária — 52 páginas',
      url: 'https://bynx.gg/fichario-lendario',
      price: '79.90',
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      // validFrom: dia em que a oferta entrou no ar. Factual — os outros
      // campos que o Search Console pede como opcionais NAO entram:
      // shippingDetails nao se aplica (produto digital, sem envio) e
      // hasMerchantReturnPolicy exigiria declarar uma politica que os Termos
      // ainda nao tem. Ver comentario acima do schema.
      validFrom: '2026-08-16',
      priceValidUntil: '2027-12-31',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'Bynx' },
    },
  ],
}

// ★ ESTE SCHEMA TEM QUE ESPELHAR O FAQ VISIVEL da LandingLendarias.tsx,
// pergunta por pergunta, no texto exato. O Google exige que o conteudo do
// FAQPage esteja visivel na pagina -- schema com pergunta que nao existe
// na tela faz o rich result ser rejeitado. Antes daqui tinha 5 perguntas
// (uma delas, "O que e uma Pagina Lendaria?", nao existia na pagina) contra
// as 7 renderizadas. Mexeu no FAQ da landing? Mexe aqui junto.
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'As cartas vêm junto?',
      acceptedAnswer: { '@type': 'Answer', text: 'Não — as cartas são as da sua coleção. Você compra a arte da página, digital e vitalícia. A Bynx marca automaticamente quais das 30 cartas você já tem e soma quanto custa fechar cada página no Mercado Brasileiro.' },
    },
    {
      '@type': 'Question',
      name: 'Serve no meu fichário?',
      acceptedAnswer: { '@type': 'Answer', text: 'Serve em qualquer fichário 9-pocket padrão: o recorte segue o bolso de 63x88mm, o mesmo das cartas. A folha sai em A4 com as linhas de corte marcadas.' },
    },
    {
      '@type': 'Question',
      name: 'Quantas vezes posso imprimir?',
      acceptedAnswer: { '@type': 'Answer', text: 'Quantas quiser, pra sempre. Errou o corte, mudou de fichário, quer uma cópia na gráfica e outra em casa? É só imprimir de novo.' },
    },
    {
      '@type': 'Question',
      name: 'E se eu não gostar?',
      acceptedAnswer: { '@type': 'Answer', text: 'Você testa antes: a página da Moonbreon é grátis, sem cartão — dá pra folhear, ver o encaixe e imprimir a amostra antes de gastar um real.' },
    },
    {
      '@type': 'Question',
      name: 'Que papel usar na impressão?',
      acceptedAnswer: { '@type': 'Answer', text: 'Sulfite comum já funciona pra testar. Pro acabamento de loja, couché ou papel fotográfico fosco de 180g a 230g — o fosco não briga com o brilho da carta. Qualquer gráfica rápida imprime uma folha A4 por poucos reais.' },
    },
    {
      '@type': 'Question',
      name: 'Encaixa certinho no meu fichário?',
      acceptedAnswer: { '@type': 'Answer', text: 'As linhas de corte seguem o bolso padrão de 63x88mm. Marcas de fichário variam alguns milímetros entre si, então a primeira peça pode pedir um ajuste fino de tesoura — imprima uma folha de teste em sulfite antes da definitiva.' },
    },
    {
      '@type': 'Question',
      name: 'Preciso de conta na Bynx?',
      acceptedAnswer: { '@type': 'Answer', text: 'Pra folhear a página grátis, não. Pra desbloquear e imprimir, sim — a conta é grátis e é ela que guarda suas páginas pra sempre (e marca as cartas que você já tem).' },
    },
  ],
}

// Breadcrumb estruturado -- padrao da casa (seo-hub sec A2: hrefs relativos
// na UI, absolutos no JSON-LD). So o structured data: numa landing de
// trafego pago a trilha visivel daria uma saida antes da conversao, mas o
// Google usa isso pro rich result de caminho no resultado de busca.
const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://bynx.gg' },
    { '@type': 'ListItem', position: 2, name: 'Fichário Lendário', item: 'https://bynx.gg/fichario-lendario' },
  ],
}

export default function FicharioLendarioPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <LandingLendarias />
    </>
  )
}
