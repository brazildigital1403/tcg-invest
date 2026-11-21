import type { Metadata } from 'next'
import OrganizarAlbumClient from './OrganizarAlbumClient'

// Área de quem organiza o álbum do Club (21/11/2026). Só conta com o papel "colecao" consegue
// agir; o banco confere em cada ação. Fora do AppLayout, sem indexação e fora do sitemap.

export const metadata: Metadata = {
  title: 'Organizar álbum',
  robots: { index: false, follow: false },
}

export default function OrganizarAlbumPage() {
  return <OrganizarAlbumClient />
}
