import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { PLAN_PRECOS } from '@/lib/plan'
import PlanosClient from './PlanosClient'

const BASE = 'https://bynx.gg'
const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
const MENSAL = PLAN_PRECOS.pro.mensal
const ANUAL = PLAN_PRECOS.pro_anual.anual
const PLUS = PLAN_PRECOS.plus.mensal
const MESES_GRATIS = Math.floor((MENSAL * 12 - ANUAL) / MENSAL)

export const metadata = {
  // Quem procura preco nao digita "planos", digita "quanto custa".
  title: 'Planos e preços — quanto custa a Bynx',
  description:
    `Quanto custa a Bynx: plano grátis para sempre, Plus por ${brl(PLUS)} e Pro por ${brl(MENSAL)} ao mês. ` +
    'Coleção, Scan com IA, Pokédex completa e marketplace, com preços em reais do mercado brasileiro.',
  alternates: { canonical: `${BASE}/planos` },
  openGraph: {
    title: 'Planos e preços — Bynx',
    description:
      `Grátis para sempre, Plus ${brl(PLUS)} e Pro ${brl(MENSAL)} ao mês. Preços em reais do mercado brasileiro.`,
    url: `${BASE}/planos`,
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Planos e preços — Bynx',
    description: `Grátis para sempre, Plus ${brl(PLUS)} e Pro ${brl(MENSAL)} ao mês. Preços em reais.`,
  },
}

const CRUMBS = [
  { name: 'Início', href: '/' },
  { name: 'Planos', href: '/planos' },
]

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: CRUMBS.map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.name,
    item: `${BASE}${c.href === '/' ? '/' : c.href}`,
  })),
}

/**
 * As perguntas sao as que o usuario faz de verdade e o site nao respondia em
 * lugar nenhum. Duas delas dizem coisa desconfortavel de proposito (so cartao,
 * e o que acontece no fim do trial): FAQ que esconde condicao vira ticket.
 *
 * ★ FALTA UMA, DE PROPOSITO: "o Scan IA esta em qual plano?". A home diz que e
 * recurso do Pro e a /scan-ia vende credito avulso "sem assinatura" -- decidir
 * qual das duas e a verdade e do Du, e a resposta entra aqui numa linha.
 */
const FAQ: { q: string; a: string }[] = [
  {
    q: 'Quanto custa a Bynx?',
    a: `A Bynx tem um plano grátis para sempre. O Plus custa ${brl(PLUS)} por mês, o Pro custa `
      + `${brl(MENSAL)} por mês e o Pro Anual sai por ${brl(ANUAL)} ao ano, o equivalente a `
      + `${brl(ANUAL / 12)} por mês — cerca de ${MESES_GRATIS} meses grátis em relação ao mensal.`,
  },
  {
    q: 'Dá para usar de graça?',
    a: 'Dá. O plano grátis não expira e permite catalogar até 100 cartas, manter um fichário, '
      + 'publicar 3 anúncios no marketplace e ter perfil público. O catálogo de cartas e os preços '
      + 'em reais podem ser consultados sem nem criar conta.',
  },
  {
    q: 'Preciso de cartão de crédito para começar?',
    a: 'Não. A conta é criada sem cartão e você começa com 7 dias de acesso Pro incluídos. '
      + 'O cartão só é pedido se você decidir assinar.',
  },
  {
    q: 'O que acontece quando os 7 dias de Pro terminam?',
    a: 'Nada é apagado. Sua coleção, seu fichário e seus anúncios continuam lá. O que deixa de '
      + 'funcionar são os recursos pagos, como o dashboard financeiro e a exportação. Você volta '
      + 'para o plano grátis automaticamente, sem cobrança nenhuma.',
  },
  {
    q: 'Quais formas de pagamento a Bynx aceita?',
    a: 'Hoje a assinatura é cobrada apenas no cartão de crédito, processada pela Stripe. '
      + 'Ainda não aceitamos Pix nem boleto para assinatura.',
  },
  {
    q: 'Como faço para cancelar?',
    a: 'Em Minha Conta existe o botão "Gerenciar assinatura", que abre o portal da Stripe. '
      + 'Por lá você cancela, troca o cartão ou vê suas faturas. O cancelamento vale no fim do '
      + 'período já pago, sem multa e sem fidelidade.',
  },
  {
    q: 'Os preços das cartas são em reais?',
    a: 'São. A Bynx trabalha com preços do mercado brasileiro, em reais, e não com conversão de '
      + 'dólar. Quando existe referência internacional, ela aparece separada e identificada.',
  },
  {
    q: 'Tenho uma loja de cards. Serve para mim?',
    a: 'O plano de lojista é outro, com vitrine, checkout e frete calculado. A página para '
      + 'lojistas tem os valores e o que cada plano de loja inclui.',
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

export default function PlanosPage() {
  return (
    <div style={{ background: 'var(--bx-bg)', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif", color: 'var(--bx-text)' }}>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <PublicHeader />

      <div className="bx-gutter" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 100px' }}>

        <Breadcrumb items={CRUMBS} />

        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--ac-1)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
            Planos
          </p>
          <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 14 }}>
            Comece de graça. Assine quando fizer sentido.
          </h1>
          <p style={{ fontSize: 16, color: 'var(--bx-text-2)', lineHeight: 1.6, maxWidth: 580, margin: '0 auto' }}>
            Sem cartão para começar, e você cancela quando quiser. Todos os planos usam preços em
            reais do mercado brasileiro, não conversão de dólar.
          </p>
        </div>

        <PlanosClient />

        {/* ── FAQ ── */}
        <section style={{ marginTop: 72, maxWidth: 780, marginLeft: 'auto', marginRight: 'auto' }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 8, textAlign: 'center' }}>
            Perguntas frequentes
          </h2>
          <p style={{ fontSize: 14, color: 'var(--bx-text-3)', textAlign: 'center', marginBottom: 32 }}>
            O que as pessoas costumam perguntar antes de assinar.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FAQ.map(f => (
              <div
                key={f.q}
                style={{
                  background: 'var(--bx-surface)',
                  border: '1px solid var(--bx-border)',
                  borderRadius: 14,
                  padding: '18px 20px',
                }}
              >
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 7, color: 'var(--bx-text)' }}>{f.q}</h3>
                <p style={{ fontSize: 14, color: 'var(--bx-text-2)', lineHeight: 1.65, margin: 0 }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <p style={{ marginTop: 44, textAlign: 'center', fontSize: 13, color: 'var(--bx-text-3)', lineHeight: 1.7 }}>
          Tem loja de card? O plano de lojista é outro —{' '}
          <a href="/para-lojistas" style={{ color: 'var(--ac-1)', textDecoration: 'none', fontWeight: 600 }}>
            veja a página para lojistas
          </a>.
        </p>

      </div>

      <PublicFooter />
    </div>
  )
}
