import type { Metadata } from 'next'
import Link from 'next/link'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'

// ─── SEO ──────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Perguntas Frequentes (FAQ)',
  description:
    'Tire suas dúvidas sobre o Bynx: como adicionar cartas, scanner por foto, marketplace, programa Indique e Ganhe, planos e mais. Respostas claras pra colecionadores brasileiros de Pokémon TCG.',
  alternates: { canonical: 'https://bynx.gg/faq' },
  openGraph: {
    title: 'Perguntas Frequentes · Bynx',
    description:
      'Tudo que você precisa saber sobre o Bynx — a plataforma brasileira de Pokémon TCG.',
    url: 'https://bynx.gg/faq',
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
  },
}

// ─── Dados ────────────────────────────────────────────────────────────────────

const faqs: { q: string; a: string }[] = [
  {
    q: 'O que é o Bynx?',
    a: 'O Bynx é a plataforma brasileira para colecionadores de Pokémon TCG gerenciarem suas cartas, acompanharem o valor da coleção em tempo real e venderem ou comprarem cartas no marketplace nacional. Toda a base de preços é cotada em real (BRL) com dados reais do mercado brasileiro.',
  },
  {
    q: 'É grátis? Tem plano pago?',
    a: 'Sim, o Bynx tem um plano gratuito que permite gerenciar até uma quantidade limitada de cartas, com acesso a marketplace, ranking e Indique e Ganhe. Para limite ilimitado e features avançadas, oferecemos o plano Pro (mensal ou anual). Você pode testar o Pro por alguns dias antes de decidir.',
  },
  {
    q: 'Como adiciono uma carta na minha coleção?',
    a: 'Vá em Minha Coleção e clique em "Adicionar carta". Você pode buscar pelo nome, número da carta ou escanear uma foto. Depois é só escolher a variante (Normal, Foil, Reverse, etc), a quantidade, e pronto — a carta entra na sua coleção e o valor é calculado automaticamente.',
  },
  {
    q: 'De onde vêm os preços das cartas?',
    a: 'Os preços vêm de fontes do mercado brasileiro (lojas e plataformas de comércio nacionais) e são atualizados diariamente por um sistema automatizado. Mostramos sempre o valor mínimo, médio e máximo — então você sabe o cenário real de venda da sua carta.',
  },
  {
    q: 'Como funciona o scanner por foto?',
    a: 'No botão "Escanear foto" da Minha Coleção, você tira ou envia uma foto da carta. Nossa IA identifica o Pokémon, número e set, e te mostra o resultado pra você confirmar antes de adicionar. Funciona melhor com luz boa e a carta enquadrada de frente.',
  },
  {
    q: 'O que são as variantes (Normal, Foil, Reverse, Promo)?',
    a: 'Cada carta pode existir em versões diferentes — a Normal é a versão padrão, a Foil tem brilho (holográfico) na arte, a Reverse tem brilho no fundo (não na arte), e Promo são cartas promocionais especiais. Cada variante tem preço diferente. Selecione a correta ao adicionar a carta na coleção.',
  },
  {
    q: 'Como funciona o Marketplace?',
    a: 'O Marketplace conecta colecionadores brasileiros pra negociar cartas. Você pode anunciar cartas da sua coleção pra venda definindo o preço, e comprar cartas anunciadas por outros usuários. Mostramos sempre o valor de referência pra você não cair em preço fora da realidade do mercado.',
  },
  {
    q: 'Como funciona o programa Indique e Ganhe?',
    a: 'Cada usuário tem um link único de indicação. Quando alguém se cadastra pelo seu link, vocês dois ganham recompensas. Existem tiers de premiação conforme você indica mais pessoas, e os top 3 mensais recebem prêmios em dinheiro. Tudo transparente no painel /indique-e-ganhe.',
  },
  {
    q: 'Como pagar ou cancelar o plano Pro?',
    a: 'O pagamento é feito via Stripe (cartão de crédito) na seção Minha Conta. Você pode escolher mensal ou anual. Pra cancelar, é só ir em Minha Conta → Plano e clicar em cancelar. A assinatura continua ativa até o fim do período pago, sem cobrança no próximo ciclo.',
  },
  {
    q: 'Posso exportar minha coleção (CSV ou PDF)?',
    a: 'Sim! Na Minha Coleção tem os botões CSV e PDF. O CSV é útil pra abrir em Excel ou Google Sheets, e o PDF gera um relatório visual da coleção. Essa funcionalidade é exclusiva do plano Pro.',
  },
  {
    q: 'Como atualizo meu email ou senha?',
    a: 'Vai em Minha Conta no menu lateral. Lá você consegue alterar email, senha e outras informações de perfil. Se esqueceu a senha, use o link "Esqueci a senha" na tela de login pra receber um email de recuperação.',
  },
  {
    q: 'Como entro em contato com o suporte?',
    a: 'Você pode abrir um ticket na seção Suporte da plataforma (visível depois de logar) ou enviar email pra suporte@bynx.gg. Respondemos em até 48h úteis. Pra dúvidas rápidas, dá uma olhada nas perguntas dessa página antes — provavelmente já tem a resposta aqui!',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FAQPage() {
  return (
    <>
      <PublicHeader />

      <main
        style={{
          minHeight: '100vh',
          background: '#0a0a0a',
          color: '#f0f0f0',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          padding: '64px 24px 96px',
        }}
      >
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: 48, textAlign: 'center' }}>
            <p
              style={{
                fontSize: 13,
                color: '#f59e0b',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              Central de Ajuda
            </p>
            <h1
              style={{
                fontSize: 44,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                marginBottom: 16,
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Perguntas Frequentes
            </h1>
            <p
              style={{
                fontSize: 16,
                color: 'rgba(255,255,255,0.55)',
                lineHeight: 1.6,
                maxWidth: 560,
                margin: '0 auto',
              }}
            >
              Tudo o que você precisa saber sobre o Bynx. Não achou sua resposta?{' '}
              <a
                href="mailto:suporte@bynx.gg"
                style={{ color: '#f59e0b', textDecoration: 'none', fontWeight: 600 }}
              >
                fale com o suporte
              </a>
              .
            </p>
          </div>

          {/* Acordeão */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {faqs.map((item, i) => (
              <details
                key={i}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14,
                  padding: '4px 20px',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                <summary
                  style={{
                    listStyle: 'none',
                    cursor: 'pointer',
                    padding: '18px 0',
                    fontSize: 16,
                    fontWeight: 600,
                    color: '#f0f0f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <span>{item.q}</span>
                  <span
                    aria-hidden
                    className="faq-icon"
                    style={{
                      fontSize: 22,
                      color: '#f59e0b',
                      fontWeight: 400,
                      flexShrink: 0,
                      transition: 'transform 0.2s',
                    }}
                  >
                    +
                  </span>
                </summary>
                <p
                  style={{
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.65)',
                    lineHeight: 1.75,
                    paddingBottom: 20,
                    paddingRight: 36,
                    margin: 0,
                  }}
                >
                  {item.a}
                </p>
              </details>
            ))}
          </div>

          {/* CTA Suporte */}
          <div
            style={{
              marginTop: 56,
              padding: 32,
              background: 'rgba(245,158,11,0.05)',
              border: '1px solid rgba(245,158,11,0.15)',
              borderRadius: 16,
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 8,
                letterSpacing: '-0.02em',
              }}
            >
              Ainda com dúvida?
            </h2>
            <p
              style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.55)',
                marginBottom: 20,
              }}
            >
              Manda mensagem pro nosso suporte. A gente responde em até 48h úteis.
            </p>
            <a
              href="mailto:suporte@bynx.gg"
              style={{
                display: 'inline-block',
                padding: '12px 28px',
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                color: '#000',
                fontWeight: 700,
                fontSize: 14,
                borderRadius: 12,
                textDecoration: 'none',
                boxShadow: '0 0 20px rgba(245,158,11,0.2)',
              }}
            >
              suporte@bynx.gg
            </a>
          </div>

          {/* Voltar landing */}
          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <Link
              href="/"
              style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.4)',
                textDecoration: 'none',
              }}
            >
              ← Voltar à página inicial
            </Link>
          </div>
        </div>

        {/* CSS pro detalhe visual do acordeon */}
        <style>{`
          details[open] {
            background: rgba(245,158,11,0.04) !important;
            border-color: rgba(245,158,11,0.2) !important;
          }
          details[open] summary .faq-icon {
            transform: rotate(45deg);
          }
          details summary::-webkit-details-marker {
            display: none;
          }
          details summary:hover {
            opacity: 0.85;
          }
        `}</style>
      </main>
      <PublicFooter />
    </>
  )
}
