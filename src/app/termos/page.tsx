import Link from 'next/link'

export const metadata = {
  title: 'Termos de Uso — Bynx',
  description: 'Termos e condições de uso da plataforma Bynx.',
}

const UPDATED = '30 de abril de 2026'

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
          <P>O uso da plataforma por menores de 18 anos deve ser realizado com o consentimento e supervisão dos pais ou responsáveis legais, observadas as restrições de idade descritas no item 3.</P>
        </Section>

        <Section title="2. Descrição do Serviço">
          <P>O Bynx é uma plataforma digital voltada ao público colecionador de cartas do Pokémon TCG (Trading Card Game) no Brasil, que oferece as seguintes funcionalidades:</P>
          <ul style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, paddingLeft: 24, margin: '12px 0' }}>
            <li>Organização e catalogação de coleções de cartas TCG;</li>
            <li>Acompanhamento de preços de referência de mercado;</li>
            <li>Dashboard financeiro da coleção pessoal;</li>
            <li>Marketplace para negociação entre colecionadores, com sistema de status de venda e avaliações pós-compra;</li>
            <li>Pokédex de referência;</li>
            <li>Separadores de fichário para impressão;</li>
            <li>Identificação de cartas por escaneamento com Inteligência Artificial;</li>
            <li>Guia de Lojas especializadas em TCG;</li>
            <li>Painel de Lojista (B2B) com perfil público, divulgação de eventos e métricas de visualização;</li>
            <li>Suporte por tickets diretamente na plataforma;</li>
            <li>Notificações in-app sobre atividades da conta.</li>
          </ul>
          <P>O Bynx é um organizador de coleções e facilitador de contatos entre colecionadores. Não somos parte das negociações realizadas entre usuários no Marketplace, não intermediamos pagamentos entre particulares e não nos responsabilizamos por transações realizadas fora da plataforma.</P>
        </Section>

        <Section title="3. Cadastro e Conta de Usuário">
          <P>Para utilizar os recursos da plataforma, é necessário criar uma conta fornecendo: nome completo, endereço de e-mail, CPF, data de nascimento, cidade, número de WhatsApp e senha. O aceite de comunicações de marketing é opcional e pode ser revogado a qualquer momento na seção <strong>Minha Conta</strong>.</P>
          <P>Você é responsável pela veracidade das informações fornecidas e pela segurança de suas credenciais de acesso.</P>

          <SubTitle>3.1 Idade Mínima</SubTitle>
          <P>Em conformidade com o Art. 14 da LGPD (Lei nº 13.709/2018), o cadastro é vedado a menores de 13 (treze) anos.</P>
          <P>Usuários entre 13 e 17 anos só podem se cadastrar com o consentimento expresso e supervisão dos pais ou responsáveis legais. O Bynx pode, a qualquer momento, solicitar comprovação desse consentimento e suspender a conta caso não seja apresentado.</P>

          <SubTitle>3.2 Uso da Conta</SubTitle>
          <P>É vedado criar contas falsas, utilizar dados de terceiros sem autorização ou criar múltiplas contas com o intuito de burlar limitações do plano gratuito.</P>
          <P>O Bynx reserva-se o direito de suspender ou encerrar contas que violem estes Termos, sem prejuízo de outras medidas cabíveis.</P>
        </Section>

        <Section title="4. Planos e Pagamentos (Colecionadores)">
          <P><strong style={{ color: '#f59e0b' }}>Plano Gratuito (Free):</strong> Permite o cadastro de até 6 cartas na coleção e 3 anúncios no Marketplace, com acesso às funcionalidades básicas da plataforma.</P>
          <P><strong style={{ color: '#f59e0b' }}>Trial Pro:</strong> Ao criar uma conta, o usuário recebe 7 (sete) dias de acesso gratuito ao plano Pro para avaliação. Findo o período, o acesso retorna automaticamente ao plano Free, salvo assinatura.</P>
          <P><strong style={{ color: '#f59e0b' }}>Plano Pro Mensal:</strong> R$ 29,90 (vinte e nove reais e noventa centavos) por mês, com renovação automática. Libera funcionalidades ilimitadas, incluindo cartas e anúncios sem limite, scan com IA, histórico completo de preços e dashboard avançado.</P>
          <P><strong style={{ color: '#f59e0b' }}>Plano Pro Anual:</strong> R$ 249,00 (duzentos e quarenta e nove reais) por ano, equivalente a um desconto significativo sobre o valor mensal. Mesma cobertura do Pro Mensal.</P>
          <P>Os valores e periodicidades podem ser alterados mediante comunicação prévia de 30 (trinta) dias. Pagamentos são processados pela plataforma <strong>Stripe</strong>. O Bynx não armazena dados de cartão de crédito.</P>
          <P>Em caso de cobrança indevida, o usuário deve contatar <strong>suporte@bynx.gg</strong> em até 7 (sete) dias da cobrança. O cancelamento da assinatura pode ser solicitado a qualquer momento, com acesso Pro mantido até o fim do período pago.</P>
        </Section>

        <Section title="4.1 Planos para Lojistas (B2B)">
          <P>Lojas físicas e online especializadas em Pokémon TCG podem cadastrar perfis dedicados na plataforma, separados das contas de colecionadores, com os seguintes planos:</P>
          <P><strong style={{ color: '#f59e0b' }}>Básico (gratuito):</strong> Perfil público da loja com informações de contato, endereço, redes sociais e botão de WhatsApp. Sem custo.</P>
          <P><strong style={{ color: '#f59e0b' }}>Pro:</strong> R$ 39,00 (trinta e nove reais) por mês, por loja. Inclui métricas básicas de visualização, divulgação de eventos da loja e destaque na busca regional.</P>
          <P><strong style={{ color: '#f59e0b' }}>Premium:</strong> R$ 89,00 (oitenta e nove reais) por mês, por loja. Inclui todas as funcionalidades do Pro, mais destaque nacional, métricas avançadas e prioridade no atendimento ao lojista.</P>

          <SubTitle>4.1.1 Beta de Lançamento</SubTitle>
          <P>Durante a fase de lançamento, há 30 (trinta) vagas no programa beta para lojistas, sendo as 27 (vinte e sete) vagas restantes oferecidas com 6 (seis) meses do plano Pro gratuito. Após o período beta, o lojista pode optar por seguir no plano gratuito Básico, contratar o Pro ou Premium ou cancelar a presença na plataforma.</P>

          <SubTitle>4.1.2 Multi-loja</SubTitle>
          <P>Um único usuário pode cadastrar e gerenciar múltiplas lojas (por exemplo, filiais ou marcas distintas), sendo cada loja faturada de forma independente. O plano contratado e o estado da assinatura são vinculados a cada loja individualmente.</P>

          <SubTitle>4.1.3 Aprovação Manual</SubTitle>
          <P>Cada cadastro de loja passa por aprovação manual da equipe Bynx, com prazo de até 48 (quarenta e oito) horas úteis. O Bynx pode solicitar documentação adicional (como CNPJ, comprovante de atividade) e reserva-se o direito de recusar cadastros que não atendam aos critérios de qualidade da plataforma.</P>
        </Section>

        <Section title="5. Marketplace e Negociações">
          <P>O Marketplace do Bynx é um ambiente para que colecionadores anunciem e encontrem cartas para negociação direta. O contato entre compradores e vendedores é facilitado via WhatsApp, e cada anúncio percorre status de venda (disponível, reservado, em negociação, enviado, concluído ou cancelado) registrados na plataforma.</P>
          <P>Após a finalização da venda, ambas as partes (comprador e vendedor) podem deixar uma avaliação pública sobre a transação, contribuindo para a reputação dos usuários na plataforma.</P>
          <P>O Bynx não é parte das negociações, não garante a entrega de produtos, não responde por vícios ou defeitos das cartas negociadas e não intermedia pagamentos entre usuários.</P>

          <SubTitle>5.1 Moderação Ativa</SubTitle>
          <P>O Bynx exerce moderação ativa do Marketplace e pode remover anúncios que, a seu exclusivo critério, sejam considerados:</P>
          <ul style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, paddingLeft: 24, margin: '12px 0' }}>
            <li>Falsificados ou suspeitos de falsificação;</li>
            <li>Fora da categoria Pokémon TCG;</li>
            <li>Com preços notoriamente abusivos ou enganosos;</li>
            <li>Fraudulentos, com descrição que induz o comprador a erro;</li>
            <li>Em duplicidade ou em desacordo com estes Termos.</li>
          </ul>
          <P>A remoção é registrada com motivo, podendo ser revertida pela equipe Bynx em caso de equívoco. Anúncios removidos não aparecem publicamente, mas o vendedor pode contestar a decisão via <strong>suporte@bynx.gg</strong>.</P>
        </Section>

        <Section title="6. Preços de Referência">
          <P>Os preços exibidos na plataforma são valores de referência de mercado coletados de fontes públicas, destinados exclusivamente à organização e acompanhamento da coleção pessoal do usuário. Não constituem oferta de compra ou venda, avaliação oficial ou garantia de valor.</P>
          <P>O Bynx não se responsabiliza por decisões financeiras tomadas com base nos preços de referência exibidos.</P>
        </Section>

        <Section title="7. Propriedade Intelectual">
          <P>Todo o conteúdo da plataforma Bynx — incluindo logotipo, interface, código-fonte, textos e funcionalidades — é de propriedade exclusiva da Bynx ou de seus licenciadores, sendo vedada sua reprodução, distribuição ou uso comercial sem autorização prévia por escrito.</P>
          <P>Imagens de cartas Pokémon são de propriedade da The Pokémon Company International e exibidas para fins organizacionais e de referência, conforme uso legítimo.</P>
          <P>Ao publicar conteúdo na plataforma (anúncios, perfil público, fotos de loja), o usuário concede ao Bynx licença não exclusiva para exibição e divulgação dentro da plataforma.</P>
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
          <P>A plataforma é fornecida &quot;no estado em que se encontra&quot;, sem garantias de disponibilidade ininterrupta. Realizamos manutenções periódicas e podemos suspender o serviço por razões técnicas ou operacionais.</P>
        </Section>

        <Section title="10. Suspensão e Encerramento">
          <P>O Bynx pode suspender ou encerrar a conta de usuário que viole estes Termos, mediante notificação por e-mail, exceto em casos de violação grave, onde a suspensão pode ser imediata.</P>
          <P>Ações de suspensão são executadas pela equipe Bynx através de painel administrativo interno e ficam registradas com data, motivo e responsável pela ação. O usuário suspenso recebe notificação e pode contestar a decisão via <strong>suporte@bynx.gg</strong>.</P>
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

function SubTitle({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 6, marginTop: 20 }}>{children}</p>
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, marginBottom: 12 }}>{children}</p>
}
