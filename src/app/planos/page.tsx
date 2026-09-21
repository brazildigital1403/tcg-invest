import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import PlanosClient from './PlanosClient'

export const metadata = {
  title: 'Planos e preços',
  description:
    'Os planos da Bynx: comece de graça e assine quando fizer sentido. Coleção, Scan com IA, Pokédex completa, dashboard e marketplace, com preços em reais.',
  alternates: { canonical: 'https://bynx.gg/planos' },
  openGraph: {
    title: 'Planos e preços — Bynx',
    description:
      'Comece de graça e assine quando fizer sentido. Coleção, Scan com IA, Pokédex completa e marketplace, com preços em reais.',
    url: 'https://bynx.gg/planos',
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Planos e preços — Bynx',
    description: 'Comece de graça e assine quando fizer sentido. Preços em reais.',
  },
}

export default function PlanosPage() {
  return (
    <div style={{ background: '#080a0f', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0' }}>

      <PublicHeader />

      <div className="bx-gutter" style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px 100px' }}>

        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
            Planos
          </p>
          <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 14 }}>
            Comece de graça. Assine quando fizer sentido.
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, maxWidth: 560, margin: '0 auto' }}>
            Sem cartão para começar, e você cancela quando quiser. Todos os planos incluem
            preços em reais do mercado brasileiro.
          </p>
        </div>

        <PlanosClient />

        <p style={{ marginTop: 44, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.7 }}>
          Tem loja de card? O plano de lojista é outro —{' '}
          <a href="/para-lojistas" style={{ color: '#f59e0b', textDecoration: 'none', fontWeight: 600 }}>
            veja a página para lojistas
          </a>.
        </p>

      </div>

      <PublicFooter />
    </div>
  )
}
