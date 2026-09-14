import type { Metadata } from 'next'
import TcgconClient from './TcgconClient'
import { OFERTA_TCGCON } from '@/lib/ofertaTcgcon'

// Landing da oferta de evento TCG CON 2026 (13/09/2026), destino do anuncio
// geolocalizado. Fora do indice de proposito: e uma pagina de campanha de um dia.

// ★ Metadata sem "so hoje" nem preco cravado (14/09/2026): a oferta fechou em
// 13/09 e o link segue circulando no WhatsApp. Percentual sai da mesma
// constante da pagina e do checkout. Sem "— Bynx" no title: o template do
// layout raiz ja acrescenta " | Bynx.gg". openGraph/twitter proprios porque sem
// eles a previa herdava titulo, descricao e url da home.
const title = `Oferta TCG CON: Pro Anual com ${OFERTA_TCGCON.descontoPct}% de desconto`
const description = `Oferta da TCG CON 2026: Bynx Pro Anual com ${OFERTA_TCGCON.descontoPct}% de desconto na primeira cobrança. Scan de cartas, coleção e preço em real.`

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: false },
  openGraph: {
    title: `${title} | Bynx`,
    description,
    url: 'https://bynx.gg/tcgcon',
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${title} | Bynx`,
    description,
  },
}

export default function TcgconPage() {
  return <TcgconClient />
}
