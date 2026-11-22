import type { Metadata } from 'next'
import CriadorClient from './CriadorClient'

// Página pública de um criador do Poké Creators Club (Fase 2, decisão do Du de 21/11/2026: todo
// membro com conteúdo tem página, sem opt-in). ESTÁTICA: o @ vem em ?u= e o conteúdo é lido no
// navegador por club_portfolio_publico, então não existe rota dinâmica nem render por pedido.
// Nasce SEM indexação e fora do sitemap, como o resto do Club: abrir para o Google é decisão à parte.

const titulo = 'Criador do Poké Creators Club'
const descricao = 'O portfólio de conteúdo de um criador do Poké Creators Club.'

export const metadata: Metadata = {
  title: titulo,
  description: descricao,
  robots: { index: false, follow: false },
  openGraph: { title: titulo, description: descricao, url: 'https://bynx.gg/pokecreatorsclub/criador', siteName: 'Bynx', locale: 'pt_BR', type: 'website' },
}

export default function CriadorPage() {
  return <CriadorClient />
}
