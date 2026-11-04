import type { Metadata } from 'next'
import AmigoSecretoLanding from './AmigoSecretoLanding'

// Landing do Amigo Secreto do Poké Creators Club (04/11/2026). Pagina
// ESTATICA: a edicao (datas, contagem, @ de quem entrou) e lida no navegador
// pela funcao amigo_secreto_edicao_publica. Fora do AppLayout, sem indexacao e
// fora do sitemap: o link circula no grupo de WhatsApp dos criadores.

export const metadata: Metadata = {
  title: 'Amigo Secreto do Poké Creators Club',
  description: 'Troca de presentes entre criadores de Pokémon TCG. Presente até R$ 100, sorteio anônimo e um mural de recados até a revelação.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Amigo Secreto do Poké Creators Club',
    description: 'Troca de presentes entre criadores de Pokémon TCG. Presente até R$ 100, sorteio anônimo e um mural de recados até a revelação.',
    url: 'https://bynx.gg/amigo-secreto',
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Amigo Secreto do Poké Creators Club',
    description: 'Troca de presentes entre criadores de Pokémon TCG. Presente até R$ 100 e sorteio anônimo.',
  },
}

export default function AmigoSecretoPage() {
  return <AmigoSecretoLanding />
}
