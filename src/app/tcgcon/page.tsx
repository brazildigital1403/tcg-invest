import type { Metadata } from 'next'
import TcgconClient from './TcgconClient'

// Landing da oferta de evento TCG CON 2026 (13/09/2026), destino do anuncio
// geolocalizado. Fora do indice de proposito: e uma pagina de campanha de um dia.

export const metadata: Metadata = {
  title: 'Oferta TCG CON: Pro Anual com 30% de desconto — Bynx',
  description: 'Só hoje, pra quem está na TCG CON: Bynx Pro Anual de R$ 249 por R$ 174,30. Scan de cartas, coleção e preço em real.',
  robots: { index: false, follow: false },
}

export default function TcgconPage() {
  return <TcgconClient />
}
