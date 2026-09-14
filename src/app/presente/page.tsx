import type { Metadata } from 'next'
import { buscarConvite, carimbarConvite, emailJaTemConta } from '@/lib/campanhaConvites'
import PresenteClient from './PresenteClient'

// Landing da campanha Presente (e-mail pros leads, ate 18/09/2026 23h59).
// Pagina pessoal: le o token do link, entao nunca e cacheada nem indexada.
// Sem token valido, mostra a pagina sem nome e sem cadastro.

export const metadata: Metadata = {
  title: 'Um presente para a sua coleção — Bynx',
  description: '50% de desconto na primeira cobrança de qualquer plano da Bynx.',
  robots: { index: false, follow: false },
}

export default async function PresentePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams
  const convite = await buscarConvite(t)

  if (convite) await carimbarConvite(convite.id, 'landing_aberta_em')
  const jaTemConta = convite ? await emailJaTemConta(convite.email) : false

  const nome = convite?.nome?.trim() || ''
  const primeiro = nome.split(' ')[0] || ''
  const primeiroNome = /^[\p{L}'-]{2,}$/u.test(primeiro)
    ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase()
    : ''

  return (
    <PresenteClient
      token={convite?.token || null}
      nome={nome}
      primeiroNome={primeiroNome}
      email={convite?.email || ''}
      jaTemConta={jaTemConta}
    />
  )
}
