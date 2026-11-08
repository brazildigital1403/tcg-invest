import type { Metadata } from 'next'
import OrganizarAvisosClient from './OrganizarAvisosClient'

// Area do organizador dos Avisos do Club (08/11/2026). So conta com o papel
// "avisos" consegue agir; o banco confere em cada acao. Sem indexacao.

export const metadata: Metadata = {
  title: 'Organizar avisos',
  robots: { index: false, follow: false },
}

export default function OrganizarAvisosPage() {
  return <OrganizarAvisosClient />
}
