import type { Metadata } from 'next'
import OrganizarAniversariosClient from './OrganizarAniversariosClient'

// Organizador dos Aniversariantes do Club (08/11/2026): remover foto impropria.
// So conta com o papel "aniversariantes" age; a rota do servidor confere. Sem indexacao.

export const metadata: Metadata = {
  title: 'Organizar aniversários',
  robots: { index: false, follow: false },
}

export default function OrganizarAniversariosPage() {
  return <OrganizarAniversariosClient />
}
