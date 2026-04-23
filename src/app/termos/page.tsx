import Link from 'next/link'

export const metadata = {
  title: 'Termos de Uso — Bynx',
  description: 'Termos e condições de uso da plataforma Bynx.',
}

const UPDATED = '23 de abril de 2026'

export default function TermosPage() {
  return (
    <div style={{ background: '#080a0f', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0' }}>

      {/* Header simples */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 28, width: 'auto' }} />
        </Link>
        <Link href="/privacidade" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
          Política de Privacidade →
        </Link>
      </div>

      {/* Conteúdo */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '60px 24px 100px' }}>

        <p style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Documento legal</p>
        <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 8 }}>Termos de Uso</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 48 }}>Última atualização: {UPDATED}</p>

        <Section title="1. Aceitação dos Termos">
          <P>Ao acessar ou utilizar a plataforma Bynx, disponível em <strong>bynx.gg</strong>, você declara que leu, compreendeu e concorda com estes Termos de Uso. Caso não concorde com qualquer disposição, você deverá interromper imediatamente o uso da plataforma.</P>
          <P>O uso da plataforma por menores de 18 anos deve ser realizado com o consentimento e supervisão dos pais ou responsáveis legais.</P>
        </Section>

        <Section title="2. Descrição do Serviço">
          <P>O Bynx é uma plataforma digital voltada ao público colecionador de cartas do Pokémon TCG (Trading Card Game) no Brasil, que oferece as seguintes funcionalidades:</P>
          <ul style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, paddingLeft: 24, margin: '12px 0' }}>
            <li>Organização e catalogação de coleções de cartas TCG;</li>
            <li>Acompanhamento de preços de referência de mercado;</li>
            <li>Dashboard financeiro da coleção pessoal;</li>
            <li>Marketplace para negociação entre colecionadores;</li>
            <li>Pokédex de referência;</li>
            <li>Separadores de fichário para impressão;</li>
            <li>Identificação de cartas por escaneamento com Inteligência Artificial;</li>
            <li>Guia de Lojas especializadas em TCG.</li>
          </ul>
          <P>O Bynx é um organizador de coleções e facilitador de contatos entre colecionadores. Não somos parte das negociações realizadas entre usuários no Marketplace, não intermediamos pagamentos entre particulares e não nos responsabilizamos por transações realizadas fora da plataforma.</P>
        </Section>

        <Section title="3. Cadastro e Conta de Usuário">
          <P>Para utilizar os recursos da plataforma, é necessário criar uma conta fornecendo nome completo, endereço de e-mail, CPF, cidade, número de WhatsApp e senha. Você é responsável pela veracidade das informações fornecidas e pela segurança de suas credenciais de acesso.</P>
          <P>É vedado criar contas falsas, utilizar dados de terceiros sem autorização ou criar múltiplas contas com o intuito de burlar limitações do plano gratuito.</P>
          <P>O Bynx reserva-se o direito de suspender ou encerrar contas que violem estes Termos, sem prejuízo de outras medidas cabíveis.</P>
        </Section>

        <Section title="4. Planos e Pagamentos">
          <P><strong style={{ color: '#f59e0b' }}>Plano Gratuito (Free):</strong> Permite o cadastro de até 6 cartas na coleção e 3 anúncios no Marketplace, com acesso às funcionalidades básicas da plataforma.</P>
          <P><strong style={{ color: '#f59e0b' }}>Trial Pro:</strong> Ao criar uma conta, o usuário recebe 7 (sete) dias de acesso gratuito ao plano Pro para avaliação. Findo o período, o acesso retorna automaticamente ao plano Free, salvo assinatura.</P>
          <P><strong style={{ color: '#f59e0b' }}>Plano Pro:</strong> Assinatura paga que libera funcionalidades ilimitadas, conforme descrito na página de preços. Os valores, periodicidades e condições estão disponíveis em <strong>bynx.gg</strong> e podem ser alterados mediante comunicação prévia de 30 (trinta) dias.</P>
          <P>Pagamentos são processados pela plataforma Stripe. O Bynx não armazena dados de cartão de crédito. Em caso de cobrança indevida, o usuário deve contatar <strong>suporte@bynx.gg</strong> em até 7 (sete) dias da cobrança.</P>
          <P>O cancelamento da assinatura pode ser solicitado a qualquer momento via e-mail, com acesso Pro mantido até o fim do período pago.</P>
        </Section>

        <Section title="5. Marketplace e Negociações">
          <P>O Marketplace do Bynx é um ambiente para que colecionadores anunciem e encontrem cartas para negociação direta. O contato entre compradores e vendedores é facilitado via WhatsApp.</P>
          <P>O Bynx não é parte das negociações, não garante a entrega de produtos, não responde por vícios ou defeitos das cartas negociadas e não intermedia pagamentos entre usuários.</P>
          <P>É proibido anunciar produtos falsificados, itens fora da categoria TCG, ou realizar qualquer prática enganosa ou fraudulenta. O Bynx pode remover anúncios e suspender contas que violem estas regras.</P>
        </Section>

        <Section title="6. Preços de Referência">
          <P>Os preços exibidos na plataforma são valores de referência de mercado coletados de fontes públicas, destinados exclusivamente à organização e acompanhamento da coleção pessoal do usuário. Não constituem oferta de compra ou venda, avaliação oficial ou garantia de valor.</P>
          <P>O Bynx não se responsabiliza por decisões financeiras tomadas com base nos preços de referência exibidos.</P>
        </Section>

        <Section title="7. Propriedade Intelectual">
          <P>Todo o conteúdo da plataforma Bynx — incluindo logotipo, interface, código-fonte, textos e funcionalidades — é de propriedade exclusiva da Bynx ou de seus licenciadores, sendo vedada sua reprodução, distribuição ou uso comercial sem autorização prévia por escrito.</P>
          <P>Imagens de cartas Pokémon são de propriedade da The Pokémon Company International e exibidas para fins organizacionais e de referência, conforme uso legítimo.</P>
          <P>Ao publicar conteúdo na plataforma (anúncios, perfil público), o usuário concede ao Bynx licença não exclusiva para exibição e divulgação dentro da plataforma.</P>
        </Section>

        <Section title="8. Conduta do Usuário">
          <P>O usuário concorda em não utilizar a plataforma para:</P>
          <ul style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, paddingLeft: 24, margin: '12px 0' }}>
            <li>Praticar fraude, estelionato ou qualquer ato ilícito;</li>
            <li>Assediar, ameaçar ou difamar outros usuários;</li>
            <li>Disseminar conteúdo ofensivo, discriminatório ou ilegal;</li>
            <li>Realizar engenharia reversa, scraping ou extração automatizada de dados;</li>
            <li>Sobrecarregar ou prejudicar a infraestrutura da plataforma;</li>
            <li>Violar direitos de terceiros, incluindo propriedade intelectual.</li>
          </ul>
        </Section>

        <Section title="9. Limitação de Responsabilidade">
          <P>Na máxima extensão permitida pela legislação brasileira, o Bynx não se responsabiliza por danos indiretos, incidentais ou consequenciais decorrentes do uso ou impossibilidade de uso da plataforma, incluindo perdas financeiras relacionadas a decisões de coleção ou negociação.</P>
          <P>A plataforma é fornecida "no estado em que se encontra", sem garantias de disponibilidade ininterrupta. Realizamos manutenções periódicas e podemos suspender o serviço por razões técnicas ou operacionais.</P>
        </Section>

        <Section title="10. Suspensão e Encerramento">
          <P>O Bynx pode suspender ou encerrar a conta de usuário que viole estes Termos, mediante notificação por e-mail, exceto em casos de violação grave, onde a suspensão pode ser imediata.</P>
          <P>O usuário pode solicitar o encerramento de sua conta e a exclusão de seus dados a qualquer momento, conforme descrito na Política de Privacidade.</P>
        </Section>

        <Section title="11. Alterações nos Termos">
          <P>Estes Termos podem ser atualizados periodicamente. Alterações relevantes serão comunicadas por e-mail ou notificação na plataforma com antecedência mínima de 15 (quinze) dias. O uso continuado após o prazo implica aceitação das novas condições.</P>
        </Section>

        <Section title="12. Lei Aplicável e Foro">
          <P>Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer controvérsias decorrentes deste instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</P>
        </Section>

        <Section title="13. Contato">
          <P>Para dúvidas, solicitações ou reclamações relacionadas a estes Termos, entre em contato:</P>
          <P><strong>E-mail:</strong> <a href="mailto:suporte@bynx.gg" style={{ color: '#f59e0b' }}>suporte@bynx.gg</a></P>
          <P><strong>Plataforma:</strong> <a href="https://bynx.gg" style={{ color: '#f59e0b' }}>bynx.gg</a></P>
        </Section>

        {/* Footer nav */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 60, paddingTop: 32, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>← Voltar ao início</Link>
          <Link href="/privacidade" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Política de Privacidade →</Link>
        </div>
      </div>
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