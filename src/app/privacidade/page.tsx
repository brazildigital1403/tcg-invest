import Link from 'next/link'

export const metadata = {
  title: 'Política de Privacidade — Bynx',
  description: 'Saiba como o Bynx coleta, usa e protege seus dados pessoais conforme a LGPD.',
}

const UPDATED = '23 de abril de 2026'

export default function PrivacidadePage() {
  return (
    <div style={{ background: '#080a0f', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 28, width: 'auto' }} />
        </Link>
        <Link href="/termos" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
          Termos de Uso →
        </Link>
      </div>

      {/* Conteúdo */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '60px 24px 100px' }}>

        <p style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Documento legal</p>
        <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 8 }}>Política de Privacidade</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>Última atualização: {UPDATED}</p>

        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 48 }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, margin: 0 }}>
            Esta Política de Privacidade descreve como a <strong>Bynx</strong> coleta, utiliza, armazena e compartilha seus dados pessoais, em conformidade com a <strong>Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018)</strong> e demais legislações aplicáveis.
          </p>
        </div>

        <Section title="1. Quem Somos (Controlador)">
          <P>A <strong>Bynx</strong> é a controladora dos dados pessoais tratados por esta plataforma. Para fins desta Política, entende-se por Bynx a plataforma digital disponível em <strong>bynx.gg</strong>, voltada à organização de coleções de Pokémon TCG.</P>
          <P><strong>Contato do Encarregado (DPO):</strong> <a href="mailto:privacidade@bynx.gg" style={{ color: '#f59e0b' }}>privacidade@bynx.gg</a></P>
        </Section>

        <Section title="2. Quais Dados Coletamos">
          <SubTitle>2.1 Dados fornecidos pelo usuário no cadastro:</SubTitle>
          <ul style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, paddingLeft: 24, margin: '8px 0 16px' }}>
            <li>Nome completo;</li>
            <li>Endereço de e-mail;</li>
            <li>CPF (Cadastro de Pessoas Físicas) — coletado para fins fiscais e de identificação;</li>
            <li>Cidade;</li>
            <li>Número de WhatsApp (opcional, para exibição no Marketplace);</li>
            <li>Senha (armazenada com criptografia, nunca em texto puro).</li>
          </ul>

          <SubTitle>2.2 Dados gerados pelo uso da plataforma:</SubTitle>
          <ul style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, paddingLeft: 24, margin: '8px 0 16px' }}>
            <li>Cartas cadastradas na coleção (nome, variante, quantidade, links);</li>
            <li>Anúncios publicados no Marketplace;</li>
            <li>Histórico de preços consultados;</li>
            <li>Imagens de cartas enviadas para escaneamento por IA;</li>
            <li>Tickets de suporte abertos e mensagens trocadas;</li>
            <li>Dados de uso e navegação (páginas acessadas, funcionalidades utilizadas);</li>
            <li>Endereço IP e informações do dispositivo/navegador.</li>
          </ul>

          <SubTitle>2.3 Dados de pagamento:</SubTitle>
          <P>Dados de cartão de crédito são processados diretamente pela <strong>Stripe</strong> e <strong>nunca armazenados</strong> em nossos servidores. Armazenamos apenas o identificador da assinatura e do cliente no Stripe, para gestão da conta.</P>
        </Section>

        <Section title="3. Por Que Coletamos Esses Dados (Base Legal — LGPD Art. 7º)">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Finalidade</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Base Legal</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Criar e gerenciar sua conta', 'Execução de contrato (Art. 7º, V)'],
                ['Processar pagamentos e assinaturas', 'Execução de contrato (Art. 7º, V)'],
                ['Exibir anúncios no Marketplace', 'Execução de contrato (Art. 7º, V)'],
                ['Enviar e-mails transacionais', 'Execução de contrato (Art. 7º, V)'],
                ['Escaneamento de cartas por IA', 'Consentimento (Art. 7º, I)'],
                ['Emissão de nota fiscal / obrigações fiscais', 'Cumprimento de obrigação legal (Art. 7º, II)'],
                ['Segurança e prevenção de fraudes', 'Legítimo interesse (Art. 7º, IX)'],
                ['Melhorias na plataforma e analytics', 'Legítimo interesse (Art. 7º, IX)'],
                ['Comunicações de marketing', 'Consentimento (Art. 7º, I)'],
              ].map(([fin, base], i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                  <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.65)' }}>{fin}</td>
                  <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{base}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="4. Compartilhamento de Dados com Terceiros">
          <P>O Bynx compartilha seus dados apenas com parceiros essenciais à operação da plataforma, todos com adequada política de privacidade:</P>
          <ul style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, paddingLeft: 24, margin: '12px 0' }}>
            <li><strong style={{ color: '#f0f0f0' }}>Supabase</strong> — banco de dados e autenticação (servidores nos EUA, com cláusulas contratuais padrão da LGPD);</li>
            <li><strong style={{ color: '#f0f0f0' }}>Stripe</strong> — processamento de pagamentos (certificado PCI-DSS Level 1);</li>
            <li><strong style={{ color: '#f0f0f0' }}>Resend</strong> — envio de e-mails transacionais;</li>
            <li><strong style={{ color: '#f0f0f0' }}>Anthropic (Claude)</strong> — processamento de imagens no recurso de Scan com IA. As imagens são enviadas apenas durante o escaneamento e não são armazenadas pela Anthropic para treinamento;</li>
            <li><strong style={{ color: '#f0f0f0' }}>Vercel</strong> — infraestrutura de hospedagem;</li>
            <li><strong style={{ color: '#f0f0f0' }}>Pokémon TCG API</strong> — consulta de dados de cartas (apenas nome/código da carta, sem dados pessoais).</li>
          </ul>
          <P>Não vendemos, alugamos ou cedemos seus dados pessoais a terceiros para fins comerciais.</P>
        </Section>

        <Section title="5. Retenção de Dados">
          <P>Seus dados são mantidos pelo tempo necessário às finalidades descritas nesta Política:</P>
          <ul style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, paddingLeft: 24, margin: '12px 0' }}>
            <li>Dados da conta: enquanto a conta estiver ativa;</li>
            <li>Dados fiscais (CPF, histórico de pagamentos): 5 (cinco) anos, conforme obrigação legal tributária;</li>
            <li>Logs de acesso: 6 (seis) meses, conforme Marco Civil da Internet (Lei nº 12.965/2014);</li>
            <li>Imagens de escaneamento: não armazenadas — processadas em tempo real e descartadas;</li>
            <li>Após exclusão da conta: dados são anonimizados ou excluídos em até 30 (trinta) dias, exceto onde houver obrigação legal de retenção.</li>
          </ul>
        </Section>

        <Section title="6. Seus Direitos como Titular (LGPD Art. 18)">
          <P>Você tem os seguintes direitos em relação aos seus dados pessoais:</P>
          <ul style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, paddingLeft: 24, margin: '12px 0' }}>
            <li><strong style={{ color: '#f0f0f0' }}>Acesso:</strong> confirmar se tratamos seus dados e obter cópia deles;</li>
            <li><strong style={{ color: '#f0f0f0' }}>Correção:</strong> corrigir dados incompletos, inexatos ou desatualizados;</li>
            <li><strong style={{ color: '#f0f0f0' }}>Anonimização/Bloqueio/Eliminação:</strong> solicitar que dados desnecessários ou tratados em desconformidade sejam anonimizados, bloqueados ou eliminados;</li>
            <li><strong style={{ color: '#f0f0f0' }}>Portabilidade:</strong> receber seus dados em formato estruturado e legível por máquina;</li>
            <li><strong style={{ color: '#f0f0f0' }}>Eliminação:</strong> solicitar a exclusão dos dados tratados com base em consentimento;</li>
            <li><strong style={{ color: '#f0f0f0' }}>Revogação do consentimento:</strong> revogar o consentimento a qualquer tempo, sem prejuízo do tratamento já realizado;</li>
            <li><strong style={{ color: '#f0f0f0' }}>Informação sobre compartilhamento:</strong> obter informação sobre com quais entidades seus dados são compartilhados;</li>
            <li><strong style={{ color: '#f0f0f0' }}>Oposição:</strong> opor-se a tratamentos realizados com base em legítimo interesse.</li>
          </ul>
          <P>Para exercer seus direitos, entre em contato por <a href="mailto:privacidade@bynx.gg" style={{ color: '#f59e0b' }}>privacidade@bynx.gg</a>. Responderemos em até 15 (quinze) dias úteis.</P>
          <P>Você também pode exercer seus direitos diretamente na plataforma, na seção <strong>Minha Conta → Zona de Perigo</strong>, onde é possível solicitar a exclusão completa da conta e dos dados.</P>
        </Section>

        <Section title="7. Segurança dos Dados">
          <P>Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, perda, alteração ou divulgação indevida, incluindo:</P>
          <ul style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, paddingLeft: 24, margin: '12px 0' }}>
            <li>Criptografia de senhas com algoritmos seguros (bcrypt via Supabase Auth);</li>
            <li>Comunicação via HTTPS/TLS;</li>
            <li>Controle de acesso baseado em função (RLS no banco de dados);</li>
            <li>Autenticação de administradores com token HMAC;</li>
            <li>Monitoramento de acessos e logs de auditoria.</li>
          </ul>
          <P>Em caso de incidente de segurança que afete seus dados, notificaremos a ANPD e os titulares afetados nos prazos legais.</P>
        </Section>

        <Section title="8. Cookies e Tecnologias de Rastreamento">
          <P>Utilizamos cookies e tecnologias similares para manter sua sessão autenticada e melhorar a experiência na plataforma. Não utilizamos cookies de rastreamento de terceiros para publicidade.</P>
          <P>O Bynx não exibe publicidade de terceiros. Nossa plataforma é livre de anúncios publicitários externos.</P>
        </Section>

        <Section title="9. Transferência Internacional de Dados">
          <P>Alguns de nossos fornecedores (Supabase, Stripe, Resend, Anthropic, Vercel) processam dados em servidores localizados nos Estados Unidos. Essas transferências são realizadas com base em cláusulas contratuais padrão e garantias adequadas de proteção, conforme exigido pela LGPD.</P>
        </Section>

        <Section title="10. Dados de Crianças e Adolescentes">
          <P>O Bynx não coleta intencionalmente dados de menores de 13 (treze) anos. Para usuários entre 13 e 18 anos, é necessário o consentimento dos pais ou responsáveis legais, conforme o Art. 14 da LGPD.</P>
          <P>Caso identifiquemos o tratamento de dados de crianças sem o devido consentimento, esses dados serão imediatamente excluídos.</P>
        </Section>

        <Section title="11. Alterações nesta Política">
          <P>Esta Política pode ser atualizada periodicamente. Alterações relevantes serão comunicadas por e-mail e/ou notificação na plataforma. Recomendamos a revisão periódica deste documento.</P>
          <P>O uso continuado da plataforma após a notificação implica aceitação da nova Política.</P>
        </Section>

        <Section title="12. Autoridade Nacional de Proteção de Dados (ANPD)">
          <P>Sem prejuízo de outros meios administrativos ou judiciais, você tem o direito de apresentar reclamação à <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>, caso entenda que o tratamento de seus dados viola a LGPD. Mais informações em <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>gov.br/anpd</a>.</P>
        </Section>

        <Section title="13. Contato">
          <P><strong>Encarregado pelo Tratamento de Dados (DPO):</strong></P>
          <P>E-mail: <a href="mailto:privacidade@bynx.gg" style={{ color: '#f59e0b' }}>privacidade@bynx.gg</a></P>
          <P>Para solicitações gerais de suporte: <a href="mailto:suporte@bynx.gg" style={{ color: '#f59e0b' }}>suporte@bynx.gg</a></P>
        </Section>

        {/* Footer nav */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 60, paddingTop: 32, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>← Voltar ao início</Link>
          <Link href="/termos" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Termos de Uso →</Link>
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
  return <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 6, marginTop: 16 }}>{children}</p>
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, marginBottom: 12 }}>{children}</p>
}