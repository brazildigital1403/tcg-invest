import type { Metadata } from 'next'
import PokefanfestClient from './PokefanfestClient'
import { OFERTAS_EVENTO } from '@/lib/ofertasEvento'
import { fetchStatsConvite } from '@/lib/conviteStats'

// Landing da oferta de evento Poke Fan Fest 4 (Curitiba, 17 e 18/10/2026),
// destino do anuncio geolocalizado. Fora do indice de proposito: e uma pagina
// de campanha de dois dias. Segue o molde da /tcgcon (Quadro #318), com a
// regra vinda da lista de ofertas (src/lib/ofertasEvento.ts, #321) e os
// numeros de prova vindos do banco (conviteStats), nao cravados.

const O = OFERTAS_EVENTO.pokefanfest
const title = `Oferta ${O.evento}: ${O.descontoPct}% em qualquer plano`
const description = `Para quem está na ${O.evento}, em ${O.cidade}: ${O.descontoPct}% de desconto na primeira cobrança de qualquer plano da Bynx. Scan de cartas, coleção e preço em real.`

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: false },
  openGraph: { title: `${title} | Bynx`, description, url: `https://bynx.gg${O.landing}`, siteName: 'Bynx', locale: 'pt_BR', type: 'website' },
  twitter: { card: 'summary_large_image', title: `${title} | Bynx`, description },
}

export default async function PokefanfestPage() {
  const stats = await fetchStatsConvite()
  return <PokefanfestClient colecionadores={stats.colecionadores} cartas={stats.cartas} />
}
