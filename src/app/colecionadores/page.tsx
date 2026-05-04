import { CSSProperties } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'

// ─── SEO ──────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title:
    'Colecionar Pokémon TCG no Brasil — Bynx | Pokédex completa, preços em reais e ferramentas pra colecionador',
  description:
    'A casa do colecionador brasileiro de Pokémon TCG. 22.861 cartas catalogadas, 1.025 Pokémons de Bulbasaur a Pecharunt, preços em reais por variante, scan com IA e perfil público. 7 dias de Pro grátis sem cartão.',
  keywords: [
    'colecionar pokemon brasil', 'app coleção pokemon', 'organizar coleção pokemon',
    'pokémon tcg brasil', 'app pokemon tcg', 'pokédex completa pokemon',
    'preço carta pokemon brasil', 'valor coleção pokemon', 'rastrear coleção pokemon',
    'scan carta pokemon ia', 'perfil colecionador pokemon', 'compartilhar coleção pokemon',
    'binder pokemon online', 'inventário pokemon tcg', 'planilha coleção pokemon',
    'aplicativo colecionador pokemon brasileiro', 'cartas pokémon em reais',
  ],
  openGraph: {
    title: 'Colecionar Pokémon TCG no Brasil — Bynx',
    description:
      '22.861 cartas catalogadas, 1.025 Pokémons, preços em reais por variante. A casa do colecionador BR. 7 dias de Pro grátis.',
    url: 'https://bynx.gg/colecionadores',
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: 'https://bynx.gg/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Bynx — A plataforma do colecionador brasileiro de Pokémon TCG',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bynx — A plataforma do colecionador BR de Pokémon TCG',
    description:
      '22.861 cartas, 1.025 Pokémons, preços em reais. 7 dias de Pro grátis.',
    images: ['https://bynx.gg/og-image.jpg'],
  },
  alternates: {
    canonical: 'https://bynx.gg/colecionadores',
  },
}

// ─── JSON-LD: WebPage + BreadcrumbList + FAQPage ─────────────────────────────
//
// Diferente de /separadores-pokemon (Product schema com Offer), esta landing
// é institucional/funil e usa WebPage + FAQPage. BreadcrumbList ajuda o Google
// a entender a hierarquia (Home → Para Colecionadores).

const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Colecionar Pokémon TCG no Brasil — Bynx',
  description:
    'A casa do colecionador brasileiro de Pokémon TCG. Pokédex de 22.861 cartas, 1.025 Pokémons, preços em reais e ferramentas pra organizar a coleção.',
  url: 'https://bynx.gg/colecionadores',
  inLanguage: 'pt-BR',
  isPartOf: { '@type': 'WebSite', name: 'Bynx', url: 'https://bynx.gg' },
  primaryImageOfPage: 'https://bynx.gg/og-image.jpg',
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://bynx.gg/' },
    { '@type': 'ListItem', position: 2, name: 'Para Colecionadores', item: 'https://bynx.gg/colecionadores' },
  ],
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'O Bynx é grátis?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sim, o plano gratuito é 100% gratuito e permite organizar até 6 cartas. Todo cadastro novo ainda ganha 7 dias de Pro grátis pra testar todas as funcionalidades sem precisar de cartão de crédito.',
      },
    },
    {
      '@type': 'Question',
      name: 'Funciona com cartas em português, inglês e japonês?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sim. O Bynx tem o catálogo internacional completo (sets em inglês e japonês) e também as edições brasileiras da Liga Pokémon. Os preços são exibidos em reais (R$) atualizados.',
      },
    },
    {
      '@type': 'Question',
      name: 'Como o Bynx separa as variantes (Normal, Holo, Reverse, Foil, Promo)?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Cada variante tem preço próprio no Bynx. Uma Holo pode valer 2x a Normal; uma Reverse Holo pode valer 5x. Quando você adiciona a carta, escolhe qual variante tem na mão e o valor exibido reflete exatamente isso.',
      },
    },
    {
      '@type': 'Question',
      name: 'Posso compartilhar minha coleção?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sim, no plano Pro você ganha um perfil público com URL própria (bynx.gg/perfil/seu-nome). Compartilhe nas redes sociais, em grupos de WhatsApp ou com outros colecionadores. Você controla o que aparece — pode esconder valores, por exemplo.',
      },
    },
    {
      '@type': 'Question',
      name: 'O scan com IA realmente funciona?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Funciona. Aponta a câmera do celular pra carta e a IA reconhece automaticamente — nome, set, número e raridade. É o jeito mais rápido pra colecionador com muita carta que não quer digitar nome um por um. Disponível no plano Pro com créditos mensais.',
      },
    },
    {
      '@type': 'Question',
      name: 'Como o Bynx sabe o preço das cartas em reais?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'O Bynx coleta preços de referência do mercado brasileiro continuamente. Os valores vêm em reais, organizados por variante, e mostrados como mínimo, médio e máximo — pra você ter uma faixa real de mercado, não um único número que pode estar fora da realidade.',
      },
    },
    {
      '@type': 'Question',
      name: 'Posso vender cartas pelo Bynx?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sim, no Marketplace do Bynx. Você cria o anúncio, colecionadores interessados entram em contato direto via WhatsApp e vocês fecham o trade do jeito que quiserem. O Bynx é a vitrine; a negociação é entre você e o comprador.',
      },
    },
  ],
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ColecionadoresPage() {
  return (
    <div style={S.page}>
      {/* CSS responsivo */}
      <style>{`
        @media (max-width: 768px) {
          .col-hero { padding: 56px 20px 72px !important; }
          .col-hero-grid {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
            text-align: center;
          }
          .col-hero-ctas {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .col-hero-ctas > a { text-align: center; }
          .col-hero-trust { justify-content: center; }
          .col-hero-mockup { margin: 0 auto; max-width: 360px; }
          .col-personas-grid { grid-template-columns: 1fr !important; }
          .col-tools-grid { grid-template-columns: 1fr !important; }
          .col-plans-grid { grid-template-columns: 1fr !important; }
          .col-final-ctas {
            flex-direction: column !important;
            align-items: stretch !important;
            width: 100%;
            max-width: 360px;
          }
          .col-final-ctas > a { text-align: center; }
        }

        /* FAQ accordion mutually-exclusive (HTML5 details/summary) */
        details[name="bynx-col-faq"] > summary {
          list-style: none;
          cursor: pointer;
        }
        details[name="bynx-col-faq"] > summary::-webkit-details-marker {
          display: none;
        }
        details[name="bynx-col-faq"][open] > summary > .col-faq-icon {
          transform: rotate(45deg);
        }
      `}</style>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <PublicHeader />

      <main>
        {/* ─── HERO ───────────────────────────────────── */}
        <section className="col-hero" style={S.hero}>
          {/* Glows decorativos */}
          <div style={S.heroGlow1} />
          <div style={S.heroGlow2} />

          <div className="col-hero-grid" style={S.heroGrid}>
            {/* Coluna esquerda: copy + CTAs */}
            <div style={S.heroLeft}>
              <span style={S.heroBadge}>
                <span style={S.heroBadgeDot} />
                A casa do colecionador BR
              </span>

              <h1 style={S.heroTitle}>
                Sua coleção Pokémon merece{' '}
                <span style={S.heroTitleAccent}>mais que uma planilha.</span>
              </h1>

              <p style={S.heroSubtitle}>
                O Bynx é onde colecionadores brasileiros catalogam, valoram e compartilham suas cartas Pokémon TCG.{' '}
                <strong style={{ color: '#f0f0f0' }}>22.861 cartas</strong>,{' '}
                <strong style={{ color: '#f0f0f0' }}>1.025 Pokémons</strong>, preços em reais por variante. Sem caça-níquel, sem pop-up, sem inglês embolado.
              </p>

              <div className="col-hero-ctas" style={S.heroCtas}>
                <Link href="/?auth=signup&next=/minha-colecao" style={S.ctaPrimary}>
                  Começar grátis →
                </Link>
                <Link href="/pokedex" style={S.ctaSecondary}>
                  Explorar a Pokédex
                </Link>
              </div>

              <div className="col-hero-trust" style={S.heroTrust}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M16.5 6.5L8 15l-4.5-4.5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <strong style={{ color: '#f0f0f0' }}>7 dias de Pro grátis</strong> · Sem cartão · Cancele quando quiser
                </span>
              </div>
            </div>

            {/* Coluna direita: mockup do dashboard */}
            <div className="col-hero-mockup" style={S.heroMockup}>
              <div style={S.mockupBrowser}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                <span style={S.mockupUrl}>bynx.gg/minha-colecao</span>
              </div>

              <div style={S.mockupBody}>
                {/* Header dentro do mockup */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    Patrimônio total
                  </div>
                  <div style={S.mockupValue}>R$ 4.832,50</div>
                  <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, marginTop: 4 }}>
                    +R$ 412,30 este mês ↑
                  </div>
                </div>

                {/* Grid 3x2 de cards */}
                <div style={S.mockupCardsGrid}>
                  {[
                    { name: 'Charizard ex', img: 'https://images.pokemontcg.io/sv3pt5/183.png', price: 'R$189', variant: 'Foil' },
                    { name: 'Pikachu ex', img: 'https://images.pokemontcg.io/sv3pt5/25.png', price: 'R$87', variant: 'Normal' },
                    { name: 'Mewtwo ex', img: 'https://images.pokemontcg.io/sv3pt5/150.png', price: 'R$134', variant: 'Foil' },
                  ].map((c) => (
                    <div key={c.name} style={S.mockupCard}>
                      <div style={S.mockupCardImg}>
                        <img
                          src={c.img}
                          alt={`Carta Pokémon ${c.name}`}
                          loading="lazy"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      </div>
                      <div style={S.mockupCardName}>{c.name}</div>
                      <div style={S.mockupCardMeta}>
                        <span style={S.mockupVariant}>{c.variant}</span>
                        <span style={S.mockupPrice}>{c.price}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={S.mockupFooter}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>+ 44 cartas na coleção</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── STATS ──────────────────────────────────── */}
        <section style={S.statsSection}>
          <div style={S.container}>
            <p style={S.statsLabel}>O maior catálogo Pokémon TCG em português</p>
            <div style={S.statsGrid}>
              {[
                { num: '22.861', label: 'cartas catalogadas' },
                { num: '1.025', label: 'Pokémons de Kanto a Paldea' },
                { num: '236', label: 'sets cobertos' },
                { num: '100%', label: 'preços em reais' },
              ].map((s) => (
                <div key={s.label} style={S.stat}>
                  <div style={S.statNum}>{s.num}</div>
                  <div style={S.statLabel}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── PERSONAS ───────────────────────────────── */}
        <section style={S.section}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Pra quem é"
              title="Você é desse tipo de colecionador?"
              subtitle="Não importa o estilo. Se cartas Pokémon te dão alegria, o Bynx te entende."
            />

            <div className="col-personas-grid" style={S.personasGrid}>
              <PersonaCard
                emoji="🎯"
                title="O curador"
                desc="Você tem coleção montada há tempos. Quer organizar por set, ver o que falta pra completar, e olhar pra prateleira sabendo exatamente o que tem. Bynx é seu inventário visual, com filtros por geração, raridade e variante."
                tags={['Pokédex completa', 'Filtros avançados', 'Por set/geração']}
              />
              <PersonaCard
                emoji="📈"
                title="O estrategista"
                desc="Você compra com olho no valor. Acompanha mercado, faz trade, sabe que carta valoriza. Bynx te dá preço médio em reais por variante, histórico de oscilação, e patrimônio total da coleção atualizado."
                tags={['Preços por variante', 'Histórico de preço', 'Patrimônio total']}
              />
              <PersonaCard
                emoji="✨"
                title="O nostálgico"
                desc="Você voltou a colecionar agora — abriu o álbum antigo, achou aquela carta da infância, e quer reviver. Bynx tem a Pokédex completa de Bulbasaur a Pecharunt, e o scan com IA pra digitalizar tudo sem precisar digitar nome."
                tags={['1.025 Pokémons', 'Scan com IA', 'Pokédex visual']}
              />
            </div>
          </div>
        </section>

        {/* ─── FERRAMENTAS ────────────────────────────── */}
        <section style={S.sectionDark}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Ferramentas"
              title="Tudo que falta na planilha do Excel."
              subtitle="O Bynx foi feito por colecionador, pra colecionador. Cada feature resolve uma dor real."
            />

            <div className="col-tools-grid" style={S.toolsGrid}>
              <ToolCard
                icon={<IconPokedex />}
                title="Pokédex de 22.861 cartas"
                desc="Catálogo completo dos sets internacionais (TCG global) e das edições brasileiras Liga Pokémon. Busca por nome com autocomplete. Filtro por tipo, raridade e geração."
              />
              <ToolCard
                icon={<IconCollection />}
                title="Coleção visual"
                desc="Adicione cartas em 2 cliques. Veja sua coleção em grade ou lista, agrupada por set. Cada carta mostra variante, quantidade e valor atual em reais."
              />
              <ToolCard
                icon={<IconPrice />}
                title="Preços em reais"
                desc="Mínimo, médio e máximo de mercado, atualizados continuamente. Por variante (Normal, Holo, Reverse, Foil, Promo). Sem chute, sem dólar convertido na correria."
              />
              <ToolCard
                icon={<IconScan />}
                title="Scan com IA"
                desc="Aponta a câmera, a IA reconhece a carta e adiciona automaticamente. Set, número, raridade — tudo. Pra quem tem coleção grande e não vai digitar nome um por um."
              />
              <ToolCard
                icon={<IconChart />}
                title="Patrimônio total"
                desc="Quanto vale sua coleção hoje? E mês passado? O dashboard financeiro mostra o gráfico. Coleção valorizou ou caiu? Você tem a resposta antes de qualquer trade."
              />
              <ToolCard
                icon={<IconShare />}
                title="Perfil público"
                desc="URL própria pra compartilhar (bynx.gg/perfil/voce). Mostre o que você coleciona — ou esconda os valores se preferir. Pro plan."
              />
            </div>
          </div>
        </section>

        {/* ─── PERFIL PÚBLICO — destaque ───────────────── */}
        <section style={S.section}>
          <div style={S.container}>
            <div style={S.profileCard}>
              <div style={S.profileText}>
                <span style={S.eyebrow}>Compartilhe</span>
                <h2 style={S.profileTitle}>
                  Sua coleção,{' '}
                  <span style={S.heroTitleAccent}>sua vitrine.</span>
                </h2>
                <p style={S.profileDesc}>
                  Cada conta Pro ganha um perfil público com URL própria. Mostre suas cartas, suas raridades, sua jornada como colecionador. Ou esconda valores e exiba só a coleção — você decide.
                </p>
                <p style={S.profileDesc}>
                  É a versão BR do que existe lá fora — só que melhor adaptado pro nosso jeito: links pro WhatsApp, badge "verificado" e modo privado pra quem não quer expor patrimônio.
                </p>
                <Link href="/?auth=signup&next=/minha-conta" style={S.ctaInline}>
                  Criar meu perfil grátis →
                </Link>
              </div>

              <div style={S.profileMockup}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, color: '#000', fontSize: 18, flexShrink: 0,
                  }}>
                    AC
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0' }}>Ana Costa</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>São Paulo · 142 cartas</div>
                  </div>
                  <span style={{
                    marginLeft: 'auto', fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
                    padding: '3px 8px', borderRadius: 6,
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#000',
                  }}>
                    PRO
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
                  {[
                    'https://images.pokemontcg.io/sv3pt5/183.png',
                    'https://images.pokemontcg.io/sv2/210.png',
                    'https://images.pokemontcg.io/sv3pt5/150.png',
                  ].map((src, i) => (
                    <div key={i} style={{
                      aspectRatio: '5/7', background: 'rgba(255,255,255,0.04)',
                      borderRadius: 8, overflow: 'hidden',
                    }}>
                      <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={S.profileTag}>Charizard fan</span>
                  <span style={S.profileTag}>Eeveelutions</span>
                  <span style={S.profileTag}>Vintage 1999</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── PLANOS ─────────────────────────────────── */}
        <section style={S.sectionDark}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Planos"
              title="Comece grátis. Cresça quando quiser."
              subtitle="Sem fidelidade. Cancele a qualquer momento."
            />

            <div className="col-plans-grid" style={S.plansGrid}>
              {/* Free */}
              <div style={S.planCard}>
                <h3 style={S.planName}>Grátis</h3>
                <div style={S.planPrice}>R$ 0</div>
                <p style={S.planTagline}>Pra começar a organizar.</p>
                <ul style={S.planFeatures}>
                  <PlanFeature>6 cartas na coleção</PlanFeature>
                  <PlanFeature>Pokédex completa</PlanFeature>
                  <PlanFeature>Dashboard financeiro</PlanFeature>
                  <PlanFeature>3 anúncios no Marketplace</PlanFeature>
                  <PlanFeature muted>Scan com IA, perfil público, exportar</PlanFeature>
                </ul>
                <Link href="/?auth=signup&next=/minha-colecao" style={S.planCtaSecondary}>
                  Começar grátis
                </Link>
              </div>

              {/* Pro Mensal — destaque */}
              <div style={{ ...S.planCard, ...S.planCardHighlight }}>
                <span style={S.planHighlightBadge}>Recomendado</span>
                <h3 style={{ ...S.planName, color: '#f59e0b' }}>Pro Mensal</h3>
                <div style={S.planPrice}>
                  R$ 29,90<span style={S.planPriceUnit}>/mês</span>
                </div>
                <p style={S.planTagline}>Pra quem leva coleção a sério.</p>
                <ul style={S.planFeatures}>
                  <PlanFeature highlight>Cartas ilimitadas</PlanFeature>
                  <PlanFeature>Scan com IA (créditos mensais)</PlanFeature>
                  <PlanFeature>Perfil público compartilhável</PlanFeature>
                  <PlanFeature>Histórico de preços</PlanFeature>
                  <PlanFeature>Exportar CSV</PlanFeature>
                  <PlanFeature>Marketplace ilimitado</PlanFeature>
                </ul>
                <Link href="/?auth=signup&next=/minha-colecao" style={S.planCtaPrimary}>
                  Começar 7 dias grátis
                </Link>
              </div>

              {/* Pro Anual */}
              <div style={S.planCard}>
                <h3 style={S.planName}>Pro Anual</h3>
                <div style={S.planPrice}>
                  R$ 249<span style={S.planPriceUnit}>/ano</span>
                </div>
                <p style={S.planTagline}>R$ 20,75/mês · economize R$ 109,80.</p>
                <ul style={S.planFeatures}>
                  <PlanFeature highlight>Tudo do Pro Mensal</PlanFeature>
                  <PlanFeature>Suporte prioritário</PlanFeature>
                  <PlanFeature>Acesso antecipado a novidades</PlanFeature>
                  <PlanFeature>Renovação com 20% off no 2º ano</PlanFeature>
                </ul>
                <Link href="/?auth=signup&next=/minha-colecao" style={S.planCtaSecondary}>
                  Começar 7 dias grátis
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FAQ ─────────────────────────────────────── */}
        <section style={S.section}>
          <div style={{ ...S.container, maxWidth: 800 }}>
            <SectionHeader
              eyebrow="Perguntas frequentes"
              title="Dúvidas comuns de quem tá começando."
            />

            <div style={S.faqList}>
              {[
                {
                  q: 'O Bynx é grátis?',
                  a: 'Sim. O plano gratuito é 100% gratuito e permite organizar até 6 cartas. Todo cadastro novo ainda ganha 7 dias de Pro grátis pra testar tudo, sem precisar de cartão de crédito.',
                },
                {
                  q: 'Funciona com cartas em português, inglês e japonês?',
                  a: 'Sim. O Bynx tem o catálogo internacional completo (sets em inglês e japonês) e também as edições brasileiras da Liga Pokémon. Os preços são exibidos em reais (R$) atualizados.',
                },
                {
                  q: 'Como o Bynx separa as variantes (Normal, Holo, Reverse, Foil, Promo)?',
                  a: 'Cada variante tem preço próprio. Uma Holo pode valer 2x a Normal; uma Reverse Holo pode valer 5x. Quando você adiciona a carta, escolhe a variante que tem na mão e o valor exibido reflete exatamente isso.',
                },
                {
                  q: 'Posso compartilhar minha coleção?',
                  a: 'Sim. No plano Pro você ganha um perfil público com URL própria (bynx.gg/perfil/seu-nome). Compartilhe nas redes, em grupos de WhatsApp ou com outros colecionadores. Você controla o que aparece — pode esconder valores, por exemplo.',
                },
                {
                  q: 'O scan com IA realmente funciona?',
                  a: 'Funciona. Aponta a câmera do celular pra carta e a IA reconhece automaticamente — nome, set, número e raridade. É o jeito mais rápido pra colecionador com muita carta. Disponível no plano Pro com créditos mensais.',
                },
                {
                  q: 'Como o Bynx sabe o preço das cartas em reais?',
                  a: 'O Bynx coleta preços de referência do mercado brasileiro continuamente. Os valores são organizados por variante e mostrados como mínimo, médio e máximo — pra você ter uma faixa real de mercado, não um número único que pode estar fora da realidade.',
                },
                {
                  q: 'Posso vender cartas pelo Bynx?',
                  a: 'Sim, no Marketplace. Você cria o anúncio e colecionadores interessados entram em contato direto via WhatsApp. Vocês fecham o trade do jeito que quiserem. O Bynx é a vitrine; a negociação é entre você e o comprador.',
                },
              ].map((item, i) => (
                <details key={i} name="bynx-col-faq" style={S.faqItem}>
                  <summary style={S.faqSummary}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f0' }}>{item.q}</span>
                    <span className="col-faq-icon" style={S.faqIcon}>+</span>
                  </summary>
                  <p style={S.faqAnswer}>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA FINAL ─────────────────────────────── */}
        <section style={S.finalSection}>
          <div style={S.container}>
            <div style={S.finalCta}>
              <h2 style={S.finalTitle}>
                Sua coleção merece estar organizada.
              </h2>
              <p style={S.finalSubtitle}>
                7 dias de Pro grátis pra testar. Sem cartão, sem pegadinha.
                Depois disso, plano gratuito com 6 cartas pra sempre — ou Pro a partir de R$ 29,90/mês.
              </p>
              <div className="col-final-ctas" style={S.heroCtas}>
                <Link href="/?auth=signup&next=/minha-colecao" style={S.ctaPrimary}>
                  Começar grátis →
                </Link>
                <Link href="/pokedex" style={S.ctaSecondary}>
                  Explorar a Pokédex
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div style={S.sectionHeader}>
      <span style={S.eyebrow}>{eyebrow}</span>
      <h2 style={S.sectionTitle}>{title}</h2>
      {subtitle && <p style={S.sectionSubtitle}>{subtitle}</p>}
    </div>
  )
}

function PersonaCard({ emoji, title, desc, tags }: { emoji: string; title: string; desc: string; tags: string[] }) {
  return (
    <div style={S.personaCard}>
      <div style={S.personaEmoji} aria-hidden="true">{emoji}</div>
      <h3 style={S.personaTitle}>{title}</h3>
      <p style={S.personaDesc}>{desc}</p>
      <div style={S.personaTags}>
        {tags.map((t) => (
          <span key={t} style={S.personaTag}>{t}</span>
        ))}
      </div>
    </div>
  )
}

function ToolCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div style={S.toolCard}>
      <div style={S.toolIcon}>{icon}</div>
      <h3 style={S.toolTitle}>{title}</h3>
      <p style={S.toolDesc}>{desc}</p>
    </div>
  )
}

function PlanFeature({ children, muted, highlight }: { children: React.ReactNode; muted?: boolean; highlight?: boolean }) {
  return (
    <li style={{
      ...S.planFeature,
      ...(muted ? { color: 'rgba(255,255,255,0.35)' } : {}),
      ...(highlight ? { color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.05em', borderBottom: '1px dashed rgba(245,158,11,0.2)', paddingBottom: 6, marginBottom: 4 } : {}),
    }}>
      {!highlight && (
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginTop: 2, opacity: muted ? 0.4 : 1 }}>
          <path d="M16.5 6.5L8 15l-4.5-4.5" stroke={muted ? 'rgba(255,255,255,0.4)' : '#22c55e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <span>{children}</span>
    </li>
  )
}

// ─── Ícones inline (SVG) ─────────────────────────────────────────────────────

function IconPokedex() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
      <rect x="3" y="5" width="22" height="18" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="14" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="14" r="1" fill="currentColor" />
      <path d="M16 11h6M16 14h6M16 17h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconCollection() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
      <rect x="4" y="6" width="14" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="10" y="2" width="14" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 11l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconPrice() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
      <path d="M14 4v20M19 9c0-2-2-3-5-3s-5 1-5 3 2 3 5 3 5 1 5 3-2 3-5 3-5-1-5-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconScan() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
      <path d="M5 9V7a2 2 0 012-2h2M19 5h2a2 2 0 012 2v2M23 19v2a2 2 0 01-2 2h-2M9 23H7a2 2 0 01-2-2v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="9" y="10" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 14h18" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 2" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
      <path d="M4 22V6M4 22h20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 18l5-7 4 4 5-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 6h4v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconShare() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
      <circle cx="7" cy="14" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="21" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="21" cy="21" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9.5 12.5L18.5 8.5M9.5 15.5l9 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
//
// Cores B2C (laranja/vermelho), igual à home e /separadores-pokemon. Diferente
// de /para-lojistas (azul/roxo, B2B).

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#080a0f',
    color: '#f0f0f0',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  container: {
    maxWidth: 1160,
    margin: '0 auto',
    padding: '0 24px',
  },

  // ─── HERO ──────────────────────────────────────────
  hero: {
    position: 'relative',
    padding: '88px 24px 112px',
    overflow: 'hidden',
  },
  heroGlow1: {
    position: 'absolute',
    top: '15%',
    left: '60%',
    width: 500,
    height: 400,
    background: 'radial-gradient(ellipse, rgba(245,158,11,0.12), transparent 70%)',
    pointerEvents: 'none',
  },
  heroGlow2: {
    position: 'absolute',
    top: '40%',
    left: '10%',
    width: 320,
    height: 320,
    background: 'radial-gradient(ellipse, rgba(239,68,68,0.08), transparent 70%)',
    pointerEvents: 'none',
  },
  heroGrid: {
    position: 'relative',
    maxWidth: 1160,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1.1fr 1fr',
    gap: 56,
    alignItems: 'center',
  },
  heroLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: 600,
    padding: '6px 14px',
    borderRadius: 999,
    background: 'rgba(245,158,11,0.08)',
    color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.25)',
    letterSpacing: '0.02em',
  },
  heroBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: '#f59e0b',
    boxShadow: '0 0 0 3px rgba(245,158,11,0.2)',
  },
  heroTitle: {
    fontSize: 'clamp(36px, 5.5vw, 60px)',
    fontWeight: 800,
    lineHeight: 1.05,
    letterSpacing: '-0.04em',
    margin: 0,
    color: '#f0f0f0',
  },
  heroTitleAccent: {
    background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSubtitle: {
    fontSize: 'clamp(15px, 1.6vw, 18px)',
    lineHeight: 1.65,
    color: 'rgba(255,255,255,0.62)',
    maxWidth: 580,
    margin: 0,
  },
  heroCtas: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  ctaPrimary: {
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    color: '#000',
    fontSize: 15,
    fontWeight: 700,
    padding: '14px 28px',
    borderRadius: 12,
    textDecoration: 'none',
    display: 'inline-block',
    letterSpacing: '-0.01em',
    boxShadow: '0 0 40px rgba(245,158,11,0.3)',
  },
  ctaSecondary: {
    background: 'rgba(255,255,255,0.06)',
    color: '#f0f0f0',
    fontSize: 15,
    fontWeight: 600,
    padding: '14px 24px',
    borderRadius: 12,
    textDecoration: 'none',
    display: 'inline-block',
    border: '1px solid rgba(255,255,255,0.12)',
  },
  heroTrust: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
  },

  // Hero mockup (direita)
  heroMockup: {
    position: 'relative',
    width: '100%',
  },
  mockupBrowser: {
    background: 'rgba(255,255,255,0.04)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    borderBottom: 'none',
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  mockupUrl: {
    flex: 1,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 6,
    padding: '4px 12px',
    marginLeft: 8,
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  mockupBody: {
    background: 'rgba(13,15,20,0.8)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    padding: 20,
    backdropFilter: 'blur(8px)',
    boxShadow: '0 30px 80px -20px rgba(0,0,0,0.6)',
  },
  mockupValue: {
    fontSize: 36,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    lineHeight: 1,
  },
  mockupCardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  mockupCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 8,
  },
  mockupCardImg: {
    aspectRatio: '5/7',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 6,
  },
  mockupCardName: {
    fontSize: 11,
    fontWeight: 700,
    color: '#f0f0f0',
    marginBottom: 4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  mockupCardMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  mockupVariant: {
    fontSize: 9,
    fontWeight: 600,
    padding: '1px 6px',
    borderRadius: 5,
    background: 'rgba(245,158,11,0.15)',
    color: '#f59e0b',
  },
  mockupPrice: {
    fontSize: 11,
    fontWeight: 800,
    color: '#f59e0b',
  },
  mockupFooter: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    textAlign: 'center',
  },

  // ─── STATS ─────────────────────────────────────────
  statsSection: {
    padding: '64px 24px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.015)',
    textAlign: 'center',
  },
  statsLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 40,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 32,
    maxWidth: 1000,
    margin: '0 auto',
  },
  stat: {
    textAlign: 'center',
  },
  statNum: {
    fontSize: 'clamp(32px, 4vw, 44px)',
    fontWeight: 800,
    letterSpacing: '-0.035em',
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    lineHeight: 1,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },

  // ─── SEÇÕES ────────────────────────────────────────
  section: {
    padding: '96px 0',
  },
  sectionDark: {
    padding: '96px 0',
    background: 'rgba(255,255,255,0.015)',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  sectionHeader: {
    textAlign: 'center',
    marginBottom: 56,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 700,
    color: '#f59e0b',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 'clamp(28px, 3.6vw, 40px)',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.15,
    maxWidth: 720,
    margin: 0,
    color: '#f0f0f0',
  },
  sectionSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.6,
    maxWidth: 580,
    margin: 0,
  },

  // ─── PERSONAS ──────────────────────────────────────
  personasGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20,
  },
  personaCard: {
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  personaEmoji: {
    fontSize: 32,
    lineHeight: 1,
  },
  personaTitle: {
    fontSize: 19,
    fontWeight: 700,
    color: '#f0f0f0',
    letterSpacing: '-0.02em',
    margin: 0,
  },
  personaDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.65,
    margin: 0,
    flex: 1,
  },
  personaTags: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  personaTag: {
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 6,
    background: 'rgba(245,158,11,0.08)',
    color: 'rgba(245,158,11,0.85)',
    border: '1px solid rgba(245,158,11,0.15)',
  },

  // ─── TOOLS ─────────────────────────────────────────
  toolsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 20,
  },
  toolCard: {
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 28,
  },
  toolIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.15)',
    color: '#f59e0b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  toolTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: '#f0f0f0',
    letterSpacing: '-0.015em',
    margin: '0 0 8px',
  },
  toolDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.58)',
    lineHeight: 1.65,
    margin: 0,
  },

  // ─── PERFIL ────────────────────────────────────────
  profileCard: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: 48,
    alignItems: 'center',
    background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(239,68,68,0.04))',
    border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: 24,
    padding: '48px 56px',
  },
  profileText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    alignItems: 'flex-start',
  },
  profileTitle: {
    fontSize: 'clamp(26px, 3vw, 36px)',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.15,
    margin: 0,
    color: '#f0f0f0',
  },
  profileDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.7,
    margin: 0,
  },
  ctaInline: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: 700,
    textDecoration: 'none',
    marginTop: 8,
  },
  profileMockup: {
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 18,
    boxShadow: '0 20px 60px -20px rgba(245,158,11,0.15)',
  },
  profileTag: {
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.7)',
  },

  // ─── PLANOS ────────────────────────────────────────
  plansGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20,
    maxWidth: 1080,
    margin: '0 auto',
  },
  planCard: {
    position: 'relative',
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  planCardHighlight: {
    border: '1px solid rgba(245,158,11,0.4)',
    background: 'linear-gradient(180deg, rgba(245,158,11,0.06), rgba(13,15,20,1) 50%)',
    transform: 'scale(1.02)',
    boxShadow: '0 20px 60px -30px rgba(245,158,11,0.3)',
  },
  planHighlightBadge: {
    position: 'absolute',
    top: -12,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    color: '#000',
    fontSize: 11,
    fontWeight: 700,
    padding: '5px 14px',
    borderRadius: 999,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  planName: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    margin: 0,
    color: '#f0f0f0',
  },
  planPrice: {
    fontSize: 36,
    fontWeight: 800,
    letterSpacing: '-0.035em',
    color: '#f0f0f0',
    lineHeight: 1,
  },
  planPriceUnit: {
    fontSize: 14,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.4)',
    marginLeft: 4,
  },
  planTagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    margin: 0,
    paddingBottom: 16,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  planFeatures: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    flex: 1,
  },
  planFeature: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.5,
  },
  planCtaPrimary: {
    textAlign: 'center',
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    color: '#000',
    fontSize: 14,
    fontWeight: 700,
    padding: '12px 20px',
    borderRadius: 10,
    textDecoration: 'none',
    border: 'none',
  },
  planCtaSecondary: {
    textAlign: 'center',
    background: 'rgba(255,255,255,0.05)',
    color: '#f0f0f0',
    fontSize: 14,
    fontWeight: 600,
    padding: '12px 20px',
    borderRadius: 10,
    textDecoration: 'none',
    border: '1px solid rgba(255,255,255,0.1)',
  },

  // ─── FAQ ───────────────────────────────────────────
  faqList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  faqItem: {
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '0',
  },
  faqSummary: {
    padding: '20px 22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  faqIcon: {
    fontSize: 20,
    color: '#f59e0b',
    flexShrink: 0,
    transition: 'transform 0.2s ease',
    fontWeight: 300,
  },
  faqAnswer: {
    padding: '0 22px 20px',
    fontSize: 14,
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 1.7,
    margin: 0,
  },

  // ─── CTA FINAL ─────────────────────────────────────
  finalSection: {
    padding: '96px 0',
    background:
      'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(245,158,11,0.08), transparent 70%), #080a0f',
  },
  finalCta: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  finalTitle: {
    fontSize: 'clamp(32px, 4vw, 48px)',
    fontWeight: 800,
    letterSpacing: '-0.035em',
    lineHeight: 1.1,
    margin: 0,
    color: '#f0f0f0',
  },
  finalSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.65,
    maxWidth: 560,
    margin: '0 0 12px',
  },
}
