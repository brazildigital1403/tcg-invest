import { CSSProperties } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'

// ─── SEO ──────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Separadores Pokémon TCG — Bynx | Imprima divisórias customizadas pro seu fichário',
  description:
    'Separadores prontos pra imprimir com os 1.025 Pokémons de Kanto a Paldea. Personalize por geração, baixe o PDF e imprima em casa ou na gráfica. R$ 14,90 pagamento único, sem assinatura. Ideal pra fichário 9-pocket.',
  keywords: [
    'separadores pokemon', 'separador fichario pokemon', 'divisórias pokemon tcg',
    'organizar fichário pokemon', 'separador tcg', 'imprimir separador pokemon',
    'divisória coleção pokemon', 'separadores pokemon pdf', 'organizador fichário pokemon',
    'separadores 9 gerações pokemon', 'separador kanto johto hoenn', 'fichário pokemon TCG',
    'pokémon TCG Brasil', 'cartas pokémon organização',
  ],
  openGraph: {
    title: 'Separadores Pokémon TCG — Imprima divisórias customizadas',
    description:
      'Separadores prontos pra imprimir com os 1.025 Pokémons de Kanto a Paldea. R$ 14,90 pagamento único, sem assinatura. Baixe o PDF e imprima.',
    url: 'https://bynx.gg/separadores-pokemon',
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: 'https://bynx.gg/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Separadores Pokémon TCG — Bynx',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Separadores Pokémon TCG — Bynx',
    description:
      '1.025 Pokémons em PDF imprimível pro seu fichário 9-pocket. R$ 14,90 pagamento único.',
    images: ['https://bynx.gg/og-image.jpg'],
  },
  alternates: {
    canonical: 'https://bynx.gg/separadores-pokemon',
  },
}

// ─── JSON-LD (Product + FAQPage para rich results no Google) ─────────────────

const productSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Separadores Pokémon TCG — Bynx',
  description:
    'Separadores prontos pra imprimir com os 1.025 Pokémons de Kanto a Paldea. PDF customizável por geração, ideal pra fichários 9-pocket. Pagamento único, sem assinatura.',
  image: 'https://bynx.gg/og-image.jpg',
  brand: { '@type': 'Brand', name: 'Bynx' },
  category: 'Acessórios para Trading Card Game',
  offers: {
    '@type': 'Offer',
    url: 'https://bynx.gg/separadores-pokemon',
    price: '14.90',
    priceCurrency: 'BRL',
    availability: 'https://schema.org/InStock',
    priceValidUntil: '2027-12-31',
    seller: { '@type': 'Organization', name: 'Bynx' },
  },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Em qual formato vem o arquivo dos separadores?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'O arquivo é um PDF pronto pra imprimir, com várias páginas no formato A4. Cada página traz separadores no tamanho ideal pra fichários de 9 bolsos (9-pocket binder), o padrão usado em coleções Pokémon TCG.',
      },
    },
    {
      '@type': 'Question',
      name: 'Os separadores cabem em qualquer fichário Pokémon?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sim. Os separadores foram desenhados pro tamanho padrão de fichários 9-pocket (com 9 bolsos por página), que é o formato mais comum no Brasil. Funciona em pastas Ultra Pro, Dragon Shield, Vault X e similares.',
      },
    },
    {
      '@type': 'Question',
      name: 'Posso escolher quais Pokémons quero nos separadores?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Pode. Você escolhe entre as 9 gerações (Kanto, Johto, Hoenn, Sinnoh, Unova, Kalos, Alola, Galar e Paldea) e gera o PDF apenas com os Pokémons das gerações que quiser. Total de 1.025 Pokémons disponíveis.',
      },
    },
    {
      '@type': 'Question',
      name: 'Quanto custa? Tem mensalidade?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'R$ 14,90 — pagamento único. Sem mensalidade, sem assinatura. Você paga uma vez e gera quantos PDFs quiser, sempre que precisar.',
      },
    },
    {
      '@type': 'Question',
      name: 'Onde imprimo os separadores?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Você pode imprimir em casa (impressora jato de tinta ou laser, papel sulfite comum funciona) ou levar o PDF pra qualquer gráfica rápida. Recomendamos papel 90g ou superior pra mais durabilidade.',
      },
    },
    {
      '@type': 'Question',
      name: 'Como recebo o arquivo depois de comprar?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Você gera e baixa o PDF direto na sua conta Bynx, no momento que quiser. O acesso fica desbloqueado pra sempre — gere quantas versões precisar.',
      },
    },
  ],
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function SeparadoresPokemonPage() {
  return (
    <div style={S.page}>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* CSS responsivo + comportamento de FAQ + smooth scroll */}
      <style>{`
        html { scroll-behavior: smooth; }

        /* Esconde marker default de <summary> em todos os browsers */
        .sp-faq-summary { list-style: none; }
        .sp-faq-summary::-webkit-details-marker { display: none; }

        /* Animação do chevron quando FAQ abre */
        .sp-faq-chevron { transition: transform 0.2s ease; }
        details[open] > .sp-faq-summary .sp-faq-chevron { transform: rotate(180deg); }

        @media (max-width: 768px) {
          .sp-hero {
            padding: 48px 20px 64px !important;
          }
          .sp-hero-inner {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
          .sp-hero-ctas {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .sp-hero-ctas > a {
            text-align: center;
          }
          .sp-final-ctas {
            flex-direction: column !important;
            align-items: stretch !important;
            width: 100%;
            max-width: 360px;
          }
          .sp-final-ctas > a {
            text-align: center;
          }
          .sp-section {
            padding: 64px 0 !important;
          }
          .sp-gen-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .sp-gen-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <PublicHeader />

      <main>
        {/* ─── HERO ─────────────────────────────────────────────────────── */}
        <section className="sp-hero" style={S.hero}>
          <div className="sp-hero-inner" style={S.heroInner}>
            <div style={S.heroLeft}>
              <span style={S.heroBadge}>
                <span style={S.heroBadgeDot} />
                Pagamento único · R$ 14,90
              </span>

              <h1 style={S.heroTitle}>
                Separadores Pokémon TCG{' '}
                <span style={S.heroTitleAccent}>customizados</span>{' '}
                pro seu fichário.
              </h1>

              <p style={S.heroSubtitle}>
                Os 1.025 Pokémons de <strong style={{ color: '#f0f0f0' }}>Kanto a Paldea</strong> em
                um PDF pronto pra imprimir. Escolha as gerações que quiser, baixe e organize sua
                coleção em fichários 9-pocket.{' '}
                <strong style={{ color: '#f0f0f0' }}>Sem assinatura, sem mensalidade.</strong>
              </p>

              <div className="sp-hero-ctas" style={S.heroCtas}>
                <Link href="/cadastro?next=/separadores" style={S.ctaPrimary}>
                  Comprar agora — R$ 14,90
                </Link>
                <Link href="#como-funciona" style={S.ctaSecondary}>
                  Como funciona →
                </Link>
              </div>

              <div style={S.heroTrialNote}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M16.5 6.5L8 15l-4.5-4.5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <strong style={{ color: '#f0f0f0' }}>Download imediato</strong> · Imprima quantas vezes quiser · Sem assinatura
                </span>
              </div>
            </div>

            {/* Preview visual de uma página de separadores */}
            <div style={S.heroRight}>
              <div style={S.previewFloatLabel}>Preview de 1 página A4 ↓</div>
              <div style={S.previewCard}>
                <div style={S.previewCardGlow} />

                <div style={S.previewHeader}>
                  <div style={S.previewHeaderTitle}>
                    <span style={S.previewHeaderRegion}>Gen I — Kanto</span>
                    <span style={S.previewHeaderRange}>Pokémon #001 — #009</span>
                  </div>
                  <div style={S.previewHeaderLogo}>BYNX</div>
                </div>

                <div style={S.previewGrid}>
                  {[
                    { id: 1, name: 'Bulbasaur' },
                    { id: 2, name: 'Ivysaur' },
                    { id: 3, name: 'Venusaur' },
                    { id: 4, name: 'Charmander' },
                    { id: 5, name: 'Charmeleon' },
                    { id: 6, name: 'Charizard' },
                    { id: 7, name: 'Squirtle' },
                    { id: 8, name: 'Wartortle' },
                    { id: 9, name: 'Blastoise' },
                  ].map(p => (
                    <div key={p.id} style={S.previewCell}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.id}.png`}
                        alt={p.name}
                        loading="lazy"
                        style={S.previewCellImg}
                      />
                      <div style={S.previewCellNum}>#{String(p.id).padStart(3, '0')}</div>
                      <div style={S.previewCellName}>{p.name}</div>
                    </div>
                  ))}
                </div>

                <div style={S.previewFooter}>
                  9 separadores por folha · A4 · Pronto pra fichário
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── MÉTRICAS ─────────────────────────────────────────────────── */}
        <section style={S.metricsSection}>
          <div style={S.container}>
            <div style={S.metricsGrid}>
              <div style={S.metric}>
                <div style={S.metricValue}>1.025</div>
                <div style={S.metricLabel}>Pokémons disponíveis</div>
              </div>
              <div style={S.metric}>
                <div style={S.metricValue}>9</div>
                <div style={S.metricLabel}>Gerações: Kanto a Paldea</div>
              </div>
              <div style={S.metric}>
                <div style={S.metricValue}>R$ 14,90</div>
                <div style={S.metricLabel}>Pagamento único · sem assinatura</div>
              </div>
              <div style={S.metric}>
                <div style={S.metricValue}>∞</div>
                <div style={S.metricLabel}>Imprima quantas vezes quiser</div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── COMO FUNCIONA ───────────────────────────────────────────── */}
        <section className="sp-section" id="como-funciona" style={S.section}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Como funciona"
              title="3 passos. Em menos de 5 minutos sua coleção tá organizada."
            />

            <div style={S.stepsGrid}>
              <StepCard
                num="01"
                title="Escolha as gerações"
                description="Selecione quais das 9 gerações quer nos separadores — Kanto, Johto, Hoenn, Sinnoh, Unova, Kalos, Alola, Galar ou Paldea. Pode escolher uma, várias ou todas."
              />
              <StepCard
                num="02"
                title="Personalize o PDF"
                description="O Bynx gera automaticamente um PDF com 9 separadores por página A4, com nome, número e arte oficial de cada Pokémon. Tudo pronto pra fichário 9-pocket."
              />
              <StepCard
                num="03"
                title="Baixe e imprima"
                description="Imprima em casa (papel sulfite comum funciona) ou leve numa gráfica rápida. Recorte e organize seu fichário. Zero complicação."
              />
            </div>
          </div>
        </section>

        {/* ─── GALERIA DAS 9 GERAÇÕES ──────────────────────────────────── */}
        <section className="sp-section" style={S.sectionDark}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="As 9 gerações"
              title="De Bulbasaur a Pecharunt — todos os Pokémons cobertos."
              subtitle="Cada geração tem cor própria pra você identificar de longe no fichário."
            />

            <div className="sp-gen-grid" style={S.genGrid}>
              {GENERATIONS.map(gen => (
                <div key={gen.region} style={{ ...S.genCard, borderColor: `${gen.color}40` }}>
                  <div style={{ ...S.genCardHeader, background: `${gen.color}15` }}>
                    <span style={S.genCardShort}>{gen.short}</span>
                    <span style={S.genCardRange}>#{String(gen.from).padStart(3, '0')} — #{String(gen.to).padStart(3, '0')}</span>
                  </div>
                  <div style={S.genCardBody}>
                    <div style={S.genCardRegion}>{gen.region}</div>
                    <div style={S.genCardCount}>{gen.to - gen.from + 1} Pokémons</div>

                    <div style={S.genCardTop}>
                      {gen.top.map(p => (
                        <div key={p.id} style={S.genCardPokemon}>
                          <div style={{ ...S.genCardPokemonImgWrap, background: `${gen.color}10`, borderColor: `${gen.color}30` }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.id}.png`}
                              alt={p.name}
                              loading="lazy"
                              style={S.genCardPokemonImg}
                            />
                          </div>
                          <div style={S.genCardPokemonName}>{p.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ ...S.genCardBar, background: gen.color }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── PRA QUEM É ──────────────────────────────────────────────── */}
        <section className="sp-section" style={S.section}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Pra quem é"
              title="Você se vê em alguma dessas?"
            />

            <div style={S.personasGrid}>
              <PersonaCard
                emoji="📂"
                title="O Organizador"
                description="Você abre o fichário e quer ver tudo no lugar — geração separada de geração, coleção de coleção. Hoje tá uma bagunça e você sabe que dá pra ficar muito melhor."
              />
              <PersonaCard
                emoji="✨"
                title="O Perfeccionista"
                description="Sua coleção tem que ser bonita. Não basta guardar, tem que ter visual de coleção mesmo. Separadores feitos à mão? Nem pensar — quer algo profissional."
              />
              <PersonaCard
                emoji="🎁"
                title="O Presenteador"
                description="Vai dar de presente pra alguém que coleciona Pokémon — filho, sobrinho, parceiro(a) — e quer um mimo a mais. Os separadores deixam a coleção com cara de loja."
              />
            </div>
          </div>
        </section>

        {/* ─── PREÇO + GARANTIA ────────────────────────────────────────── */}
        <section className="sp-section" style={S.sectionDark}>
          <div style={S.container}>
            <div style={S.priceCard}>
              <div style={S.priceCardGlow} />

              <span style={S.priceEyebrow}>Acesso vitalício</span>

              <div style={S.priceWrapper}>
                <span style={S.priceValue}>R$ 14,90</span>
                <span style={S.priceUnit}>pagamento único</span>
              </div>

              <p style={S.priceTagline}>
                Sem assinatura. Sem mensalidade. Sem pegadinha.
              </p>

              <ul style={S.priceFeatures}>
                <FeatureLine>Os 1.025 Pokémons de Kanto a Paldea</FeatureLine>
                <FeatureLine>PDF customizável por geração</FeatureLine>
                <FeatureLine>Imprima quantas vezes quiser, pra sempre</FeatureLine>
                <FeatureLine>Formato A4 com 9 separadores por página</FeatureLine>
                <FeatureLine>Compatível com qualquer fichário 9-pocket</FeatureLine>
                <FeatureLine>Download imediato após o pagamento</FeatureLine>
              </ul>

              <Link href="/cadastro?next=/separadores" style={S.priceCta}>
                Comprar agora — R$ 14,90
              </Link>
            </div>
          </div>
        </section>

        {/* ─── FAQ ─────────────────────────────────────────────────────── */}
        <section className="sp-section" style={S.section}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Dúvidas frequentes"
              title="As respostas que todo mundo quer saber."
            />

            <div style={S.faqList}>
              {faqSchema.mainEntity.map((q, i) => (
                <FAQItem key={i} question={q.name} answer={q.acceptedAnswer.text} />
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA FINAL ───────────────────────────────────────────────── */}
        <section style={S.finalCtaSection}>
          <div style={S.container}>
            <div style={S.finalCta}>
              <h2 style={S.finalCtaTitle}>
                Sua coleção merece ficar bonita.
              </h2>
              <p style={S.finalCtaSubtitle}>
                R$ 14,90 e pronto. Imprima hoje, organize hoje, mostre orgulhoso pro próximo amigo
                que aparecer.
              </p>

              <div className="sp-final-ctas" style={S.finalCtas}>
                <Link href="/cadastro?next=/separadores" style={S.ctaPrimary}>
                  Comprar agora — R$ 14,90
                </Link>
                <Link href="/" style={S.ctaSecondary}>
                  Conhecer o Bynx →
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

function StepCard({ num, title, description }: { num: string; title: string; description: string }) {
  return (
    <div style={S.stepCard}>
      <div style={S.stepNum}>{num}</div>
      <h3 style={S.stepTitle}>{title}</h3>
      <p style={S.stepDescription}>{description}</p>
    </div>
  )
}

function PersonaCard({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <div style={S.personaCard}>
      <div style={S.personaEmoji}>{emoji}</div>
      <h3 style={S.personaTitle}>{title}</h3>
      <p style={S.personaDescription}>{description}</p>
    </div>
  )
}

function FeatureLine({ children }: { children: React.ReactNode }) {
  return (
    <li style={S.featureItem}>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
        <path d="M16.5 6.5L8 15l-4.5-4.5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </li>
  )
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details name="bynx-faq" style={S.faqItem}>
      <summary className="sp-faq-summary" style={S.faqSummary}>
        {question}
        <svg className="sp-faq-chevron" width="14" height="14" viewBox="0 0 20 20" fill="none" style={S.faqChevron}>
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div style={S.faqAnswer}>{answer}</div>
    </details>
  )
}

// ─── Dados ────────────────────────────────────────────────────────────────────

const GENERATIONS = [
  {
    short: 'GEN 1', region: 'Kanto',  from: 1,    to: 151,  color: '#ef4444',
    top: [{ id: 25, name: 'Pikachu' }, { id: 6, name: 'Charizard' }, { id: 150, name: 'Mewtwo' }],
  },
  {
    short: 'GEN 2', region: 'Johto',  from: 152,  to: 251,  color: '#f59e0b',
    top: [{ id: 249, name: 'Lugia' }, { id: 250, name: 'Ho-Oh' }, { id: 248, name: 'Tyranitar' }],
  },
  {
    short: 'GEN 3', region: 'Hoenn',  from: 252,  to: 386,  color: '#22c55e',
    top: [{ id: 384, name: 'Rayquaza' }, { id: 257, name: 'Blaziken' }, { id: 282, name: 'Gardevoir' }],
  },
  {
    short: 'GEN 4', region: 'Sinnoh', from: 387,  to: 493,  color: '#3b82f6',
    top: [{ id: 448, name: 'Lucario' }, { id: 445, name: 'Garchomp' }, { id: 493, name: 'Arceus' }],
  },
  {
    short: 'GEN 5', region: 'Unova',  from: 494,  to: 649,  color: '#a855f7',
    top: [{ id: 643, name: 'Reshiram' }, { id: 644, name: 'Zekrom' }, { id: 635, name: 'Hydreigon' }],
  },
  {
    short: 'GEN 6', region: 'Kalos',  from: 650,  to: 721,  color: '#06b6d4',
    top: [{ id: 658, name: 'Greninja' }, { id: 700, name: 'Sylveon' }, { id: 716, name: 'Xerneas' }],
  },
  {
    short: 'GEN 7', region: 'Alola',  from: 722,  to: 809,  color: '#f97316',
    top: [{ id: 724, name: 'Decidueye' }, { id: 792, name: 'Lunala' }, { id: 800, name: 'Necrozma' }],
  },
  {
    short: 'GEN 8', region: 'Galar',  from: 810,  to: 905,  color: '#dc2626',
    top: [{ id: 815, name: 'Cinderace' }, { id: 888, name: 'Zacian' }, { id: 890, name: 'Eternatus' }],
  },
  {
    short: 'GEN 9', region: 'Paldea', from: 906,  to: 1025, color: '#84cc16',
    top: [{ id: 1007, name: 'Koraidon' }, { id: 1008, name: 'Miraidon' }, { id: 1025, name: 'Pecharunt' }],
  },
]

// ─── Estilos ──────────────────────────────────────────────────────────────────

const BRAND_GRADIENT = 'linear-gradient(135deg, #f59e0b, #ef4444)'

const S: Record<string, CSSProperties> = {
  // ─── BASE ────────────────────────────────────────────
  page: {
    background: '#080a0f',
    color: '#f0f0f0',
    minHeight: '100vh',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 24px',
  },

  // ─── HERO ────────────────────────────────────────────
  hero: {
    padding: '80px 24px 96px',
    background:
      'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(245,158,11,0.08), transparent 60%), #080a0f',
    position: 'relative',
  },
  heroInner: {
    maxWidth: 1200,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1.1fr 1fr',
    gap: 64,
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
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.2)',
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: 700,
    padding: '6px 12px',
    borderRadius: 999,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    width: 'fit-content',
  },
  heroBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#f59e0b',
    boxShadow: '0 0 8px rgba(245,158,11,0.6)',
  },
  heroTitle: {
    fontSize: 'clamp(36px, 5vw, 56px)',
    fontWeight: 800,
    letterSpacing: '-0.035em',
    lineHeight: 1.1,
    margin: 0,
    color: '#f0f0f0',
  },
  heroTitleAccent: {
    background: BRAND_GRADIENT,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSubtitle: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.6,
    margin: 0,
    maxWidth: 540,
  },
  heroCtas: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  heroTrialNote: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
  },

  // ─── HERO PREVIEW ────────────────────────────────────
  heroRight: {
    position: 'relative',
  },
  previewFloatLabel: {
    position: 'absolute',
    top: -28,
    right: 16,
    fontSize: 11,
    color: 'rgba(245,158,11,0.7)',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  previewCard: {
    background: '#fafafa',
    color: '#1a1a1a',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 18,
    position: 'relative',
    boxShadow: '0 30px 80px -30px rgba(245,158,11,0.4), 0 0 0 1px rgba(245,158,11,0.15)',
    overflow: 'hidden',
  },
  previewCardGlow: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 0% 0%, rgba(245,158,11,0.15), transparent 60%)',
    pointerEvents: 'none',
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottom: '1.5px dashed #ddd',
    marginBottom: 14,
    position: 'relative',
  },
  previewHeaderTitle: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  previewHeaderRegion: {
    fontSize: 13,
    fontWeight: 800,
    color: '#1a1a1a',
    letterSpacing: '-0.01em',
  },
  previewHeaderRange: {
    fontSize: 10,
    color: '#999',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  previewHeaderLogo: {
    fontSize: 11,
    fontWeight: 800,
    color: '#f59e0b',
    letterSpacing: '0.1em',
  },
  previewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 6,
    position: 'relative',
  },
  previewCell: {
    aspectRatio: '1 / 1.4',
    background: '#fff',
    border: '1.5px solid #eaeaea',
    borderRadius: 6,
    padding: '8px 6px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    position: 'relative',
  },
  previewCellImg: {
    width: 56,
    height: 56,
    objectFit: 'contain',
    marginBottom: 2,
    imageRendering: 'auto' as CSSProperties['imageRendering'],
  },
  previewCellNum: {
    fontSize: 9,
    color: '#999',
    fontWeight: 600,
    letterSpacing: '0.04em',
  },
  previewCellName: {
    fontSize: 10,
    fontWeight: 700,
    color: '#1a1a1a',
    textAlign: 'center',
    letterSpacing: '-0.01em',
  },
  previewFooter: {
    marginTop: 14,
    paddingTop: 10,
    borderTop: '1px dashed #ddd',
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    fontWeight: 600,
    position: 'relative',
  },

  // ─── CTAs ────────────────────────────────────────────
  ctaPrimary: {
    background: BRAND_GRADIENT,
    color: '#0d0f14',
    fontSize: 15,
    fontWeight: 700,
    padding: '14px 26px',
    borderRadius: 12,
    textDecoration: 'none',
    display: 'inline-block',
    letterSpacing: '-0.01em',
    boxShadow: '0 10px 30px -10px rgba(245,158,11,0.5)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  ctaSecondary: {
    background: 'rgba(255,255,255,0.04)',
    color: '#f0f0f0',
    fontSize: 15,
    fontWeight: 600,
    padding: '14px 24px',
    borderRadius: 12,
    textDecoration: 'none',
    display: 'inline-block',
    border: '1px solid rgba(255,255,255,0.1)',
    letterSpacing: '-0.01em',
  },

  // ─── MÉTRICAS ────────────────────────────────────────
  metricsSection: {
    padding: '56px 0',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.015)',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 32,
  },
  metric: {
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 'clamp(32px, 4vw, 44px)',
    fontWeight: 800,
    letterSpacing: '-0.035em',
    background: BRAND_GRADIENT,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    marginBottom: 8,
    lineHeight: 1,
  },
  metricLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.5,
    maxWidth: 220,
    margin: '0 auto',
  },

  // ─── SEÇÕES ──────────────────────────────────────────
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
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.6,
    maxWidth: 560,
    margin: 0,
  },

  // ─── STEPS ───────────────────────────────────────────
  stepsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 24,
  },
  stepCard: {
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 28,
  },
  stepNum: {
    fontSize: 12,
    fontWeight: 700,
    color: '#f59e0b',
    letterSpacing: '0.1em',
    marginBottom: 16,
    fontFamily: "'DM Sans', monospace",
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#f0f0f0',
    letterSpacing: '-0.02em',
    margin: '0 0 10px',
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 1.65,
    color: 'rgba(255,255,255,0.6)',
    margin: 0,
  },

  // ─── GERAÇÕES GRID ───────────────────────────────────
  genGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
  },
  genCard: {
    background: '#0d0f14',
    border: '1px solid',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  genCardHeader: {
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  genCardShort: {
    fontSize: 11,
    fontWeight: 800,
    color: '#f0f0f0',
    letterSpacing: '0.08em',
  },
  genCardRange: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: '0.04em',
    fontFamily: "'DM Sans', monospace",
  },
  genCardBody: {
    padding: '16px 16px 18px',
  },
  genCardRegion: {
    fontSize: 18,
    fontWeight: 800,
    color: '#f0f0f0',
    letterSpacing: '-0.02em',
    marginBottom: 4,
  },
  genCardCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 16,
  },
  genCardTop: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  genCardPokemon: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  genCardPokemonImgWrap: {
    width: '100%',
    aspectRatio: '1 / 1',
    borderRadius: 10,
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  genCardPokemonImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain' as CSSProperties['objectFit'],
  },
  genCardPokemonName: {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    letterSpacing: '-0.01em',
    lineHeight: 1.3,
  },
  genCardBar: {
    height: 3,
    width: '100%',
    marginTop: 'auto',
  },

  // ─── PERSONAS ────────────────────────────────────────
  personasGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 24,
  },
  personaCard: {
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 28,
    textAlign: 'center',
  },
  personaEmoji: {
    fontSize: 36,
    marginBottom: 16,
    lineHeight: 1,
  },
  personaTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#f0f0f0',
    letterSpacing: '-0.02em',
    margin: '0 0 10px',
  },
  personaDescription: {
    fontSize: 14,
    lineHeight: 1.65,
    color: 'rgba(255,255,255,0.6)',
    margin: 0,
  },

  // ─── PRICE CARD ──────────────────────────────────────
  priceCard: {
    maxWidth: 540,
    margin: '0 auto',
    padding: '40px 36px',
    borderRadius: 20,
    background:
      'linear-gradient(180deg, rgba(245,158,11,0.06), rgba(13,15,20,1) 50%)',
    border: '1px solid rgba(245,158,11,0.25)',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  priceCardGlow: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 50% 0%, rgba(245,158,11,0.12), transparent 60%)',
    pointerEvents: 'none',
  },
  priceEyebrow: {
    fontSize: 11,
    fontWeight: 800,
    color: '#f59e0b',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    display: 'inline-block',
    padding: '4px 10px',
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: 999,
    marginBottom: 16,
    position: 'relative',
  },
  priceWrapper: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
    position: 'relative',
  },
  priceValue: {
    fontSize: 48,
    fontWeight: 800,
    letterSpacing: '-0.04em',
    background: BRAND_GRADIENT,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    lineHeight: 1,
  },
  priceUnit: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  priceTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    margin: '0 0 24px',
    position: 'relative',
  },
  priceFeatures: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    textAlign: 'left',
    position: 'relative',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: 14,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 1.5,
  },
  priceCta: {
    display: 'inline-block',
    background: BRAND_GRADIENT,
    color: '#0d0f14',
    fontSize: 16,
    fontWeight: 800,
    padding: '15px 32px',
    borderRadius: 12,
    textDecoration: 'none',
    letterSpacing: '-0.01em',
    boxShadow: '0 10px 30px -10px rgba(245,158,11,0.5)',
    position: 'relative',
    width: '100%',
    boxSizing: 'border-box',
    textAlign: 'center',
  },

  // ─── FAQ ─────────────────────────────────────────────
  faqList: {
    maxWidth: 760,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  faqItem: {
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '16px 20px',
  },
  faqSummary: {
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    fontSize: 15,
    fontWeight: 600,
    color: '#f0f0f0',
    letterSpacing: '-0.01em',
    listStyle: 'none',
  },
  faqChevron: {
    flexShrink: 0,
    color: 'rgba(255,255,255,0.4)',
    transition: 'transform 0.2s ease',
  },
  faqAnswer: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 1.65,
    marginTop: 12,
    paddingTop: 12,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },

  // ─── CTA FINAL ───────────────────────────────────────
  finalCtaSection: {
    padding: '96px 0',
    background:
      'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(245,158,11,0.06), transparent 70%), #080a0f',
  },
  finalCta: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  finalCtaTitle: {
    fontSize: 'clamp(32px, 4vw, 44px)',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.15,
    margin: 0,
    color: '#f0f0f0',
  },
  finalCtaSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.6,
    maxWidth: 520,
    margin: '0 0 8px',
  },
  finalCtas: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 8,
  },
}
