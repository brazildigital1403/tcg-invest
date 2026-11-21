import type { Metadata } from 'next'
import AlbumClient from './AlbumClient'

// Álbum do Poké Creators Club (19/11/2026). O álbum da pessoa é lido no navegador, só com
// sessão, pelas funções club_colecao_minha, club_carta_virar e club_retirada_pedir. Fora do
// AppLayout (casca do Club), sem indexação e fora do sitemap.

export const metadata: Metadata = {
  title: 'Álbum do Club',
  description: 'As cartas do Poké Creators Club, uma por missão cumprida.',
  robots: { index: false, follow: false },
}

export default function AlbumPage() {
  return <AlbumClient />
}
