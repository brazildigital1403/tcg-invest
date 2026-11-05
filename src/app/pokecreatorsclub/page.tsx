import type { Metadata } from 'next'
import CasaClub from './CasaClub'

// Casa do Poké Creators Club (05/11/2026). Pagina estatica: o estado da edicao e
// as tarefas da pessoa sao lidos no navegador, pelas funcoes amigo_secreto_*.
// Fora do AppLayout (casca propria aprovada pelo Du em 05/11), sem indexacao e
// fora do sitemap: o link circula no grupo de WhatsApp.

const titulo = 'Poké Creators Club'
const descricao = 'O que o grupo faz junto, em um lugar só.'

export const metadata: Metadata = {
  title: titulo,
  description: descricao,
  robots: { index: false, follow: false },
  openGraph: {
    title: titulo,
    description: descricao,
    url: 'https://bynx.gg/pokecreatorsclub',
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: titulo, description: descricao },
}

export default function PokeCreatorsClubPage() {
  return <CasaClub />
}
