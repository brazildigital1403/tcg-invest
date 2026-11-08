import type { Metadata } from 'next'
import AgendaClient from './AgendaClient'

// Agenda do Poke Creators Club (08/11/2026). Lida no navegador, so com sessao,
// pelas funcoes club_agenda_*. Fora do AppLayout, sem indexacao e fora do sitemap.

export const metadata: Metadata = {
  title: 'Agenda do Club',
  description: 'Lives, collabs, feiras e as datas do Poké Creators Club.',
  robots: { index: false, follow: false },
}

export default function AgendaPage() {
  return <AgendaClient />
}
