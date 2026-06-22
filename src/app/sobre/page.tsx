import Link from 'next/link'
import PublicFooter from '@/components/ui/PublicFooter'
import ContactButton from '@/components/ui/ContactButton'

export const metadata = {
  title: 'Quem somos',
  description:
    'Conheca a Bynx, a plataforma brasileira de Pokemon TCG: precos em reais, gestao de colecao, scan com IA e marketplace. Saiba quem somos e o que oferecemos.',
  alternates: { canonical: 'https://bynx.gg/sobre' },
}

export default function SobrePage() {
  return (
    <div style={{ background: '#080a0f', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0' }}>

      {/* Header simples */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 28, width: 'auto' }} />
        </Link>
        <Link href="/" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
          Criar conta gratis →
        </Link>
      </div>

      {/* Conteudo */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '60px 24px 100px' }}>

        <p style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>A Bynx</p>
        <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 16 }}>Quem somos</h1>

        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginBottom: 48 }}>
          A Bynx é a plataforma brasileira para quem coleciona Pokémon TCG. Reunimos preços em reais, gestão de coleção, scan de cartas com inteligência artificial e um marketplace nacional em um só lugar — para que cada colecionador saiba exatamente o que tem, quanto vale e onde negociar.
        </p>

        <Section title="Nossa missão">
          <P>Acreditamos que o colecionador brasileiro merece ferramentas no mesmo nível das internacionais, mas pensadas para a nossa realidade. Por isso a Bynx trabalha com preços em reais, baseados no mercado nacional, e não em conversões de dólar que nunca refletem o que acontece aqui.</P>
        </Section>

        <Section title="O que oferecemos">
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Item>Uma Pokédex com dezenas de milhares de cartas catalogadas, com preço, raridade e variantes.</Item>
            <Item>ScanIA: identificação de cartas por foto, com inteligência artificial.</Item>
            <Item>Acompanhamento de preços em reais, carta por carta e por variante.</Item>
            <Item>Um Marketplace para comprar e vender com outros colecionadores.</Item>
            <Item>Guia de lojas e um painel para lojistas parceiros.</Item>
            <Item>Ferramentas de organização, como separadores de fichário e Master Sets para impressão.</Item>
          </ul>
        </Section>

        <Section title="Por que preços em reais">
          <P>O mercado brasileiro de cartas tem dinâmica própria: disponibilidade, câmbio e demanda fazem os preços daqui serem diferentes dos de fora. A Bynx acompanha o mercado nacional para entregar valores que fazem sentido para quem compra e vende no Brasil.</P>
        </Section>

        <Section title="Para quem é a Bynx">
          <P>Para o colecionador que quer organizar e proteger a sua coleção, para o investidor que acompanha a valorização das cartas e para o lojista que precisa de ferramentas profissionais de catálogo e vitrine.</P>
        </Section>

        <Section title="Nosso compromisso">
          <P>Mantemos a Bynx atualizada todos os dias, com dados de preço revisados constantemente e conteúdo original. Respeitamos a sua privacidade e os seus dados conforme a LGPD, e mantemos a publicidade do site discreta, sem atrapalhar a sua experiência.</P>
        </Section>

        <Section title="Fale conosco">
          <P>Tem uma dúvida, sugestão ou quer falar sobre uma parceria? Use o formulário abaixo ou escreva diretamente para <a href="mailto:suporte@bynx.gg" style={{ color: '#f59e0b' }}>suporte@bynx.gg</a>.</P>
          <div style={{ marginTop: 16 }}>
            <ContactButton label="Abrir formulário de contato" />
          </div>
        </Section>

      </div>

      <PublicFooter />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.02em', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, marginBottom: 12 }}>{children}</p>
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, paddingLeft: 22, position: 'relative' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, color: '#f59e0b', fontWeight: 800 }}>›</span>
      {children}
    </li>
  )
}
