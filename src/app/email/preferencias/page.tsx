import type { Metadata } from 'next'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import EmailPreferencias from '@/components/conta/EmailPreferencias'

// Preferencias de e-mail SEM login (regua F0, card #391). Chega aqui quem
// clicou em "Descadastrar ou escolher o que recebo" no rodape: o GET do
// descadastro registra a saida e redireciona com `saiu=1`. O token e o mesmo
// do descadastro.
//
// Pagina pessoal (o token identifica a conta): fora do indice, sempre.

export const metadata: Metadata = {
  title: 'Preferências de e-mail',
  robots: { index: false, follow: false },
}

export default async function PreferenciasEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; saiu?: string }>
}) {
  const { t, saiu } = await searchParams
  const token = typeof t === 'string' && /^[0-9a-f-]{36}$/i.test(t) ? t : null

  return (
    <>
      <PublicHeader />
      <main className="bx-gutter" style={{ minHeight: '70vh', paddingTop: 32, paddingBottom: 48 }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--bx-text)', margin: '0 0 8px' }}>
            {saiu === '1' ? 'Pronto, você saiu da lista' : 'Escolha o que recebe'}
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--bx-text-2)', margin: '0 0 20px' }}>
            {saiu === '1'
              ? 'Você não vai mais receber e-mails de relacionamento da Bynx. Se preferir receber só uma parte, escolha abaixo.'
              : 'Ligue só o que interessa. A mudança vale na hora.'}
          </p>
          {token ? (
            <EmailPreferencias token={token} />
          ) : (
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--bx-text-2)' }}>
              Este link parece inválido. Se você tem conta, as mesmas opções estão em Minha Conta.
            </p>
          )}
        </div>
      </main>
      <PublicFooter />
    </>
  )
}
