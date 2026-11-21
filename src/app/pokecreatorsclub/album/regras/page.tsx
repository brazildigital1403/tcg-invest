import type { Metadata } from 'next'
import RegrasAlbumClient from './RegrasAlbumClient'

// Regra pública do Álbum do Poké Creators Club (21/11/2026). Página ESTÁTICA, aberta para
// qualquer pessoa, sem entrar: o texto vai no HTML e só as datas, a tiragem do set e a lista de
// missões são lidas no navegador pela função club_colecao_regras_publica. Segue o resto do Club:
// fora do AppLayout, sem indexação e fora do sitemap (o link circula no grupo).

const titulo = 'Regra do Álbum do Club'
const descricao = 'Como ganhar as cartas, os prazos e o set físico do Álbum do Poké Creators Club.'

export const metadata: Metadata = {
  title: titulo,
  description: descricao,
  robots: { index: false, follow: false },
  openGraph: {
    title: titulo,
    description: descricao,
    url: 'https://bynx.gg/pokecreatorsclub/album/regras',
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: titulo, description: descricao },
}

export default function RegrasAlbumPage() {
  return <RegrasAlbumClient />
}
