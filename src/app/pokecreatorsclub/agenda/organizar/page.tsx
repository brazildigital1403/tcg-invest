import type { Metadata } from 'next'
import OrganizarClient from './OrganizarClient'

// Area do organizador da Agenda do Club (08/11/2026). So conta com o papel
// "agenda" consegue agir; o banco confere em cada acao. Sem indexacao.

export const metadata: Metadata = {
  title: 'Organizar agenda',
  robots: { index: false, follow: false },
}

export default function OrganizarPage() {
  return <OrganizarClient />
}
