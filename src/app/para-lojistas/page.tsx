import { CSSProperties } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import LojistasFAQ from '@/components/lojas/LojistasFAQ'

// ─── SEO ──────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Para Lojistas — Bynx | A plataforma 100% Pokémon TCG do Brasil',
  description:
    'Cadastre sua loja Pokémon TCG no Bynx — onde colecionadores brasileiros encontram lojas como a sua. Grátis pra começar, 14 dias de Pro no trial. Beta fechado: 27 vagas restantes de Pro grátis por 6 meses.',
  openGraph: {
    title: 'Para Lojistas — Bynx',
    description:
      'A única plataforma 100% focada em Pokémon TCG do Brasil. Onde colecionadores encontram lojas como a sua. Cadastre grátis.',
    url: 'https://bynx.gg/para-lojistas',
    type: 'website',
  },
  alternates: {
    canonical: 'https://bynx.gg/para-lojistas',
  },
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ParaLojistasPage() {
  return (
    <div style={S.page}>
      {/* CSS responsivo — empilha hero no mobile e ajusta paddings */}
      <style>{`
        @media (max-width: 768px) {
          .pl-hero {
            padding: 48px 20px 64px !important;
          }
          .pl-hero-inner {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
          .pl-hero-ctas {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .pl-hero-ctas > a {
            text-align: center;
          }
          .pl-final-ctas {
            flex-direction: column !important;
            align-items: stretch !important;
            width: 100%;
            max-width: 360px;
          }
          .pl-final-ctas > a {
            text-align: center;
          }
        }
      `}</style>

      <PublicHeader />

      <main>
        {/* ─── HERO ───────────────────────────────────────── */}
        <section className="pl-hero" style={S.hero}>
          <div className="pl-hero-inner" style={S.heroInner}>
            <div style={S.heroLeft}>
              <span style={S.heroBadge}>
                <span style={S.heroBadgeDot} />
                Beta fechado · 27 vagas restantes
              </span>

              <h1 style={S.heroTitle}>
                Onde colecionadores Pokémon do Brasil{' '}
                <span style={S.heroTitleAccent}>encontram lojas</span> como a sua.
              </h1>

              <p style={S.heroSubtitle}>
                O Bynx é a única plataforma 100% focada em Pokémon TCG do Brasil. Cada visitante que entra aqui já tá decidido a comprar — só precisa achar uma loja boa.{' '}
                <strong style={{ color: '#f0f0f0' }}>Faça com que essa loja seja a sua.</strong>
              </p>

              <div className="pl-hero-ctas" style={S.heroCtas}>
                <Link href="/?auth=signup&next=/minha-loja/nova" style={S.ctaPrimary}>
                  Cadastrar minha loja grátis
                </Link>
                <Link href="/lojas" style={S.ctaSecondary}>
                  Ver o guia de lojas →
                </Link>
              </div>

              <div style={S.heroTrialNote}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M16.5 6.5L8 15l-4.5-4.5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <strong style={{ color: '#f0f0f0' }}>14 dias de Pro grátis</strong> · Sem cartão de crédito · Cancele quando quiser
                </span>
              </div>
            </div>

            {/* Preview visual do card Premium */}
            <div style={S.heroRight}>
              <div style={S.previewFloatLabel}>Como sua loja Premium aparece no guia ↓</div>
              <div style={S.previewCard}>
                <div style={S.previewCardGlow} />
                <div style={S.previewCardHeader}>
                  <div style={S.previewLogo}>M</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.previewCardTitle}>
                      Mestre dos Baralhos
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ marginLeft: 4 }}>
                        <path d="M10 2l2.4 2.8 3.6-.4.4 3.6L19 10l-2.6 2 .4 3.6-3.6.4L10 19l-2.4-2.8-3.6.4-.4-3.6L1 10l2.6-2L3.2 4.4 6.8 4 10 1z"
                          fill="#60a5fa" stroke="#60a5fa" strokeWidth="1.2" strokeLinejoin="round" />
                        <path d="M6 10l2.5 2.5L14 7" stroke="#0d0f14" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div style={S.previewCardMeta}>São Paulo, SP · Física + Online</div>
                  </div>
                  <span style={S.previewBadge}>Premium</span>
                </div>

                <div style={S.previewCardChips}>
                  <span style={S.previewChip}>Pokémon TCG</span>
                  <span style={S.previewChip}>Singles</span>
                  <span style={S.previewChip}>Sealed</span>
                </div>

                <div style={S.previewPhotos}>
                  <div style={{ ...S.previewPhoto, background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)' }} />
                  <div style={{ ...S.previewPhoto, background: 'linear-gradient(135deg, #4c1d95, #7c3aed)' }} />
                  <div style={{ ...S.previewPhoto, background: 'linear-gradient(135deg, #064e3b, #059669)' }} />
                </div>

                <div style={S.previewEvent}>
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="4" width="14" height="13" rx="2" stroke="#60a5fa" strokeWidth="1.4" />
                    <path d="M3 8h14M7 2v4M13 2v4" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <span>Próxima liga: <strong>02/mai</strong> — Torneio Pokémon TCG</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── MÉTRICAS ─────────────────────────────────────── */}
        <section style={S.metricsSection}>
          <div style={S.container}>
            <div style={S.metricsGrid}>
              <div style={S.metric}>
                <div style={S.metricValue}>22.000+</div>
                <div style={S.metricLabel}>Cartas Pokémon catalogadas no Bynx</div>
              </div>
              <div style={S.metric}>
                <div style={S.metricValue}>240+</div>
                <div style={S.metricLabel}>Coleções (sets) cobertas</div>
              </div>
              <div style={S.metric}>
                <div style={S.metricValue}>R$ 0</div>
                <div style={S.metricLabel}>Para começar no plano Básico</div>
              </div>
              <div style={S.metric}>
                <div style={S.metricValue}>5 min</div>
                <div style={S.metricLabel}>Pra cadastrar e começar seu trial Pro</div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── PRA QUEM É ──────────────────────────────────── */}
        <section style={S.section}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Pra quem é"
              title="Se você tem essas dores, é pra você."
            />

            <div style={S.benefitsGrid}>
              <BenefitCard
                icon={
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M5 12L14 5l9 7v10a1 1 0 01-1 1h-5v-7h-6v7H6a1 1 0 01-1-1V12z" stroke="#60a5fa" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                }
                title="Loja física na sua cidade"
                description="O cliente novo da região pesquisa 'carta Pokémon [cidade]' e cai em loja online de outro estado. Você não aparece. No Bynx, você é a primeira opção pra quem é da sua área."
              />
              <BenefitCard
                icon={
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="4" y="6" width="20" height="14" rx="2" stroke="#60a5fa" strokeWidth="1.6" />
                    <path d="M4 10h20M9 16h4" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                }
                title="Loja online focada em Pokémon"
                description="Você vende pelo Instagram, WhatsApp e marketplace, mas todo mês perde clientes pra concorrente que aparece primeiro no Google. No Bynx, quem busca compra logo — sem disputa de tráfego."
              />
              <BenefitCard
                icon={
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="3" y="4" width="22" height="20" rx="2" stroke="#60a5fa" strokeWidth="1.6" />
                    <path d="M3 9h22M8 2v4M20 2v4" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round" />
                    <circle cx="14" cy="16" r="3" stroke="#60a5fa" strokeWidth="1.4" />
                  </svg>
                }
                title="Casa de torneios e ligas"
                description="Você organiza torneio toda semana, mas só a galera fixa vem. Quem nunca foi nem sabe que existe. Premium publica sua liga no Bynx — e quem nunca foi descobre."
              />
              <BenefitCard
                icon={
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="4" y="6" width="14" height="18" rx="1.5" stroke="#60a5fa" strokeWidth="1.6" />
                    <rect x="10" y="2" width="14" height="18" rx="1.5" stroke="#60a5fa" strokeWidth="1.6" />
                    <path d="M14 11l2 2 4-4" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
                title="Vendedor de single ou sealed"
                description="Você fecha trade no zap e tem estoque que ninguém vê. No Bynx, colecionador que tá com a grana na mão atrás de uma carta específica acha você — sem precisar postar 10 vezes na comunidade."
              />
            </div>
          </div>
        </section>

        {/* ─── COMO FUNCIONA ──────────────────────────────── */}
        <section style={S.sectionDark}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Como funciona"
              title="Da inscrição ao primeiro cliente, em 3 passos."
            />

            <div style={S.stepsGrid}>
              <StepCard
                num="01"
                title="Cadastre sua loja"
                description="Leva 5 minutos. Você preenche dados básicos, fotos, especialidades e redes sociais. Já ganha 14 dias de Pro no trial, sem cartão."
              />
              <StepCard
                num="02"
                title="Nós aprovamos em até 48h"
                description="Nossa equipe confere CNPJ e dados básicos pra garantir que só lojas reais aparecem no guia. Você recebe um email quando aprovada."
              />
              <StepCard
                num="03"
                title="Apareça pra quem compra"
                description="Sua loja entra na busca do Bynx. Colecionadores encontram você por cidade, especialidade e tipo. Clique direto no seu WhatsApp."
              />
            </div>
          </div>
        </section>

        {/* ─── ROI / VALE A PENA? ─────────────────────────── */}
        <section style={S.section}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Vale a pena?"
              title="A matemática é direta."
            />

            <div style={S.roiCard}>
              <div style={S.roiRow}>
                <div style={S.roiNumber}>R$ 39<span style={S.roiUnit}>/mês</span></div>
                <div style={S.roiArrow}>→</div>
                <div style={S.roiBig}>
                  <strong>1 venda de R$ 200</strong>
                  <span style={S.roiSmall}>paga 5 meses do Pro</span>
                </div>
              </div>

              <div style={S.roiDivider} />

              <p style={S.roiText}>
                Se o Bynx te trouxer <strong style={{ color: '#60a5fa' }}>1 cliente novo por trimestre</strong>, o plano já se paga.
                A questão não é se vale — é quantos clientes novos você não está captando hoje porque não aparece na primeira busca de quem mora na sua cidade.
              </p>
            </div>
          </div>
        </section>

        {/* ─── PLANOS ─────────────────────────────────────── */}
        <section style={S.sectionDark}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Planos"
              title="Comece grátis. Cresça no seu ritmo."
              subtitle="Sem fidelidade. Sem letras miúdas. Cancele quando quiser."
            />

            <div style={S.plansGrid}>
              {/* BÁSICO */}
              <div style={S.planCard}>
                <div style={S.planHeader}>
                  <h3 style={S.planName}>Básico</h3>
                  <p style={S.planTagline}>Pra começar e aparecer no guia.</p>
                </div>
                <div style={S.planPricing}>
                  <div style={S.planPriceMain}>Grátis</div>
                  <div style={S.planPriceNote}>Para sempre</div>
                </div>
                <ul style={S.planFeatures}>
                  <FeatureItem>Listagem no Guia de Lojas</FeatureItem>
                  <FeatureItem>Página própria com WhatsApp</FeatureItem>
                  <FeatureItem>Endereço + link Google Maps</FeatureItem>
                  <FeatureItem>1 especialidade (jogo)</FeatureItem>
                  <FeatureItem>Descrição de até 160 caracteres</FeatureItem>
                  <FeatureItem muted>Sem fotos, redes sociais, eventos</FeatureItem>
                </ul>
                <Link href="/?auth=signup&next=/minha-loja/nova" style={S.planCta}>Começar grátis</Link>
              </div>

              {/* PRO */}
              <div style={{ ...S.planCard, ...S.planCardHighlight }}>
                <div style={S.planHighlightBadge}>Recomendado</div>
                <div style={S.planHeader}>
                  <h3 style={{ ...S.planName, color: '#60a5fa' }}>Pro</h3>
                  <p style={S.planTagline}>Pra quem quer ser levado a sério.</p>
                </div>
                <div style={S.planPricing}>
                  <div style={S.planPriceMain}>
                    R$ 39<span style={S.planPriceUnit}>/mês</span>
                  </div>
                  <div style={S.planPriceNote}>
                    ou R$ 390/ano · economize 2 meses
                  </div>
                </div>
                <ul style={S.planFeatures}>
                  <FeatureItem highlight>Tudo do Básico, e mais:</FeatureItem>
                  <FeatureItem>Até <strong>5 fotos</strong> da sua loja</FeatureItem>
                  <FeatureItem>Instagram, Facebook e website</FeatureItem>
                  <FeatureItem>Especialidades ilimitadas</FeatureItem>
                  <FeatureItem>Descrição sem limite de caracteres</FeatureItem>
                  <FeatureItem>Badge <strong>Pro</strong> no card</FeatureItem>
                  <FeatureItem>Aparece acima das lojas Básico</FeatureItem>
                </ul>
                <Link href="/?auth=signup&next=/minha-loja/nova" style={{ ...S.planCta, ...S.planCtaPrimary }}>
                  Começar 14 dias grátis
                </Link>
              </div>

              {/* PREMIUM */}
              <div style={{ ...S.planCard, ...S.planCardPremium }}>
                <div style={S.planHeader}>
                  <h3 style={{ ...S.planName, color: '#a855f7' }}>Premium</h3>
                  <p style={S.planTagline}>Pra quem quer ser o topo.</p>
                </div>
                <div style={S.planPricing}>
                  <div style={S.planPriceMain}>
                    R$ 89<span style={S.planPriceUnit}>/mês</span>
                  </div>
                  <div style={S.planPriceNote}>
                    ou R$ 890/ano · economize 2 meses
                  </div>
                </div>
                <ul style={S.planFeatures}>
                  <FeatureItem highlight>Tudo do Pro, e mais:</FeatureItem>
                  <FeatureItem>Até <strong>10 fotos</strong> da sua loja</FeatureItem>
                  <FeatureItem><strong>Eventos e torneios</strong> ilimitados</FeatureItem>
                  <FeatureItem><strong>Card 1.5x maior</strong> e borda destacada</FeatureItem>
                  <FeatureItem>Preview de fotos e evento no card</FeatureItem>
                  <FeatureItem><strong>Rotação no topo</strong> da listagem</FeatureItem>
                  <FeatureItem>Analytics: views e cliques no WhatsApp</FeatureItem>
                  <FeatureItem>SEO customizável por loja</FeatureItem>
                </ul>
                <Link href="/?auth=signup&next=/minha-loja/nova" style={{ ...S.planCta, ...S.planCtaPremium }}>
                  Começar 14 dias grátis
                </Link>
              </div>
            </div>

            <p style={S.renewalNote}>
              ✨ Depois de 12 meses no plano anual, sua renovação tem <strong>20% de desconto</strong>.{' '}
              <strong style={{ color: '#60a5fa' }}>Beta fechado: 27 vagas restantes</strong> dos primeiros 30 lojistas que ganham Pro grátis por 6 meses.
            </p>
          </div>
        </section>

        {/* ─── BENEFÍCIOS VISUAIS ──────────────────────── */}
        <section style={S.section}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Como aparece"
              title="O que o colecionador vê quando encontra sua loja."
            />

            <div style={S.benefitsGrid}>
              <BenefitCard
                icon={
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="3" y="5" width="22" height="18" rx="3" stroke="#60a5fa" strokeWidth="1.6" />
                    <path d="M3 10h22" stroke="#60a5fa" strokeWidth="1.6" />
                    <circle cx="7" cy="7.5" r="0.8" fill="#60a5fa" />
                    <circle cx="10" cy="7.5" r="0.8" fill="#60a5fa" />
                    <path d="M7 15h8M7 18h5" stroke="rgba(96,165,250,0.5)" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                }
                title="Página própria com identidade"
                description="URL única (bynx.gg/lojas/sua-loja) com hero, descrição, fotos, redes sociais e botão direto pro WhatsApp. Sem isso: cliente avalia 'será que existe loja melhor?' e some."
              />
              <BenefitCard
                icon={
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <circle cx="14" cy="11" r="5" stroke="#60a5fa" strokeWidth="1.6" />
                    <path d="M14 26c-5-7-9-11-9-15a9 9 0 0118 0c0 4-4 8-9 15z" stroke="#60a5fa" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                }
                title="Geo-relevância na busca"
                description="Colecionador filtra por estado, cidade, especialidade. Sua loja aparece pra quem é da sua área e procura exatamente o que você vende. Sem isso: ele cai em loja de outro estado."
              />
              <BenefitCard
                icon={
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M9 12c.7 1.4 1.8 3 3.5 4 1.7 1 3 1.2 3.5.7l3-3-2.5-2.5-1.5 1c-1 .5-2-.5-3-1.5s-2-2-1.5-3l1-1.5L9 4 6 7c-.5.5-.3 1.8.7 3.5z"
                      stroke="#60a5fa" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                }
                title="WhatsApp em 1 clique"
                description="O botão principal da sua página abre o WhatsApp direto, com mensagem pré-preenchida. Zero fricção entre descobrir e comprar."
              />
              <BenefitCard
                icon={
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M4 20l6-6 4 4 10-10" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M18 8h6v6" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
                title="Analytics do Premium"
                description="Veja quantos colecionadores visualizaram sua loja, quantos clicaram no WhatsApp e em quais dias da semana. Métricas reais pra decisões reais."
              />
            </div>
          </div>
        </section>

        {/* ─── FAQ ─────────────────────────────────────── */}
        <section style={S.sectionDark}>
          <div style={{ ...S.container, maxWidth: 840 }}>
            <SectionHeader
              eyebrow="Perguntas frequentes"
              title="Tudo que você precisa saber antes de cadastrar."
            />
            <LojistasFAQ />
          </div>
        </section>

        {/* ─── CTA FINAL ──────────────────────────────── */}
        <section style={S.finalCtaSection}>
          <div style={S.container}>
            <div style={S.finalCta}>
              <h2 style={S.finalCtaTitle}>
                27 vagas restantes do beta fechado.
              </h2>
              <p style={S.finalCtaSubtitle}>
                Cadastre sua loja agora e ganhe Pro grátis por 6 meses.
                Sem cartão, sem pegadinha. Quando essas 27 vagas acabarem, fecha.
              </p>
              <div className="pl-final-ctas" style={{ ...S.heroCtas, justifyContent: 'center' }}>
                <Link href="/?auth=signup&next=/minha-loja/nova" style={S.ctaPrimary}>
                  Garantir minha vaga
                </Link>
                <Link href="/lojas" style={S.ctaSecondary}>
                  Ver o guia →
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

function BenefitCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div style={S.benefitCard}>
      <div style={S.benefitIcon}>{icon}</div>
      <h3 style={S.benefitTitle}>{title}</h3>
      <p style={S.benefitDescription}>{description}</p>
    </div>
  )
}

function FeatureItem({ children, muted, highlight }: { children: React.ReactNode; muted?: boolean; highlight?: boolean }) {
  return (
    <li style={{
      ...S.featureItem,
      ...(muted ? S.featureItemMuted : {}),
      ...(highlight ? S.featureItemHighlight : {}),
    }}>
      {!muted && !highlight && (
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
          <path d="M16.5 6.5L8 15l-4.5-4.5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {muted && (
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginTop: 2, opacity: 0.5 }}>
          <path d="M5 10h10" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      <span>{children}</span>
    </li>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
//
// Paleta: azul/roxo (B2B). Diferente da landing principal (laranja/vermelho)
// porque o segmento de lojistas pede tom mais profissional e premium.
//   #60a5fa  → blue-400  (primária)
//   #a855f7  → purple-500 (secundária)
//
// ──────────────────────────────────────────────────────────────────────────────

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

  // ─── HERO ─────────────────────────────────────────────
  hero: {
    position: 'relative',
    padding: '72px 24px 96px',
    background:
      'radial-gradient(ellipse 60% 80% at 70% 30%, rgba(96,165,250,0.08), transparent 60%), ' +
      'radial-gradient(ellipse 50% 70% at 20% 80%, rgba(168,85,247,0.05), transparent 60%), ' +
      '#080a0f',
    overflow: 'hidden',
  },
  heroInner: {
    maxWidth: 1160,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
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
    padding: '6px 12px',
    borderRadius: 999,
    background: 'rgba(96,165,250,0.08)',
    color: '#60a5fa',
    border: '1px solid rgba(96,165,250,0.2)',
    letterSpacing: '0.02em',
  },
  heroBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: '#60a5fa',
    boxShadow: '0 0 0 3px rgba(96,165,250,0.2)',
  },
  heroTitle: {
    fontSize: 'clamp(36px, 5vw, 54px)',
    fontWeight: 800,
    lineHeight: 1.08,
    letterSpacing: '-0.035em',
    margin: 0,
    color: '#f0f0f0',
  },
  heroTitleAccent: {
    background: 'linear-gradient(135deg, #60a5fa, #a855f7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSubtitle: {
    fontSize: 'clamp(15px, 1.6vw, 18px)',
    lineHeight: 1.65,
    color: 'rgba(255,255,255,0.62)',
    maxWidth: 560,
    margin: 0,
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

  // Preview card (direita do hero)
  heroRight: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  previewFloatLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  previewCard: {
    position: 'relative',
    width: '100%',
    maxWidth: 400,
    background: 'linear-gradient(180deg, rgba(96,165,250,0.04), rgba(13,15,20,1) 60%)',
    border: '1px solid rgba(96,165,250,0.35)',
    borderRadius: 20,
    padding: 20,
    boxShadow: '0 20px 60px -20px rgba(96,165,250,0.25), 0 0 0 1px rgba(96,165,250,0.08)',
  },
  previewCardGlow: {
    position: 'absolute',
    inset: -1,
    borderRadius: 20,
    background: 'linear-gradient(135deg, rgba(96,165,250,0.15), transparent 60%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  previewCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
    marginBottom: 14,
  },
  previewLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #60a5fa, #a855f7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    fontWeight: 800,
    color: '#0d0f14',
    flexShrink: 0,
  },
  previewCardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  previewCardMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  previewBadge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '4px 8px',
    borderRadius: 6,
    background: 'linear-gradient(135deg, #60a5fa, #a855f7)',
    color: '#0d0f14',
    flexShrink: 0,
  },
  previewCardChips: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 12,
    position: 'relative',
  },
  previewChip: {
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.7)',
  },
  previewPhotos: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 6,
    marginBottom: 12,
    position: 'relative',
  },
  previewPhoto: {
    height: 64,
    borderRadius: 8,
  },
  previewEvent: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    padding: '10px 12px',
    background: 'rgba(96,165,250,0.06)',
    border: '1px solid rgba(96,165,250,0.15)',
    borderRadius: 10,
    position: 'relative',
  },

  // ─── CTA ─────────────────────────────────────────────
  ctaPrimary: {
    background: 'linear-gradient(135deg, #60a5fa, #a855f7)',
    color: '#0d0f14',
    fontSize: 15,
    fontWeight: 700,
    padding: '14px 26px',
    borderRadius: 12,
    textDecoration: 'none',
    display: 'inline-block',
    letterSpacing: '-0.01em',
    boxShadow: '0 10px 30px -10px rgba(96,165,250,0.5)',
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

  // ─── MÉTRICAS ────────────────────────────────────
  metricsSection: {
    padding: '56px 0',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.015)',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 32,
  },
  metric: {
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 'clamp(36px, 4vw, 48px)',
    fontWeight: 800,
    letterSpacing: '-0.035em',
    background: 'linear-gradient(135deg, #60a5fa, #a855f7)',
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

  // ─── SEÇÕES ──────────────────────────────────────
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
    color: '#60a5fa',
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

  // ─── STEPS ───────────────────────────────────────
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
    color: '#60a5fa',
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

  // ─── ROI ─────────────────────────────────────────
  roiCard: {
    maxWidth: 760,
    margin: '0 auto',
    padding: '40px 32px',
    borderRadius: 20,
    background: 'linear-gradient(135deg, rgba(96,165,250,0.06), rgba(168,85,247,0.04))',
    border: '1px solid rgba(96,165,250,0.2)',
    textAlign: 'center',
  },
  roiRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    flexWrap: 'wrap',
  },
  roiNumber: {
    fontSize: 'clamp(32px, 4vw, 44px)',
    fontWeight: 800,
    letterSpacing: '-0.035em',
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 1,
  },
  roiUnit: {
    fontSize: 16,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.35)',
    marginLeft: 4,
  },
  roiArrow: {
    fontSize: 28,
    color: 'rgba(96,165,250,0.6)',
    fontWeight: 300,
  },
  roiBig: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    textAlign: 'left',
    gap: 4,
  },
  roiSmall: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },
  roiDivider: {
    height: 1,
    width: '60%',
    margin: '32px auto',
    background: 'rgba(96,165,250,0.15)',
  },
  roiText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.7,
    maxWidth: 600,
    margin: '0 auto',
  },

  // ─── PLANOS ──────────────────────────────────────
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
    gap: 20,
  },
  planCardHighlight: {
    border: '1px solid rgba(96,165,250,0.35)',
    background:
      'linear-gradient(180deg, rgba(96,165,250,0.04), rgba(13,15,20,1) 40%)',
    transform: 'scale(1.02)',
    boxShadow: '0 20px 60px -30px rgba(96,165,250,0.3)',
  },
  planCardPremium: {
    border: '1px solid rgba(168,85,247,0.25)',
    background:
      'linear-gradient(180deg, rgba(168,85,247,0.03), rgba(13,15,20,1) 40%)',
  },
  planHighlightBadge: {
    position: 'absolute',
    top: -12,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'linear-gradient(135deg, #60a5fa, #a855f7)',
    color: '#0d0f14',
    fontSize: 11,
    fontWeight: 700,
    padding: '5px 14px',
    borderRadius: 999,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  planHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  planName: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    margin: 0,
    color: '#f0f0f0',
  },
  planTagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    margin: 0,
    lineHeight: 1.4,
  },
  planPricing: {
    padding: '12px 0',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  planPriceMain: {
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
  planPriceNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 6,
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
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.45,
  },
  featureItemMuted: {
    color: 'rgba(255,255,255,0.35)',
  },
  featureItemHighlight: {
    color: '#60a5fa',
    fontWeight: 700,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    paddingBottom: 4,
    borderBottom: '1px dashed rgba(96,165,250,0.2)',
    marginBottom: 4,
  },
  planCta: {
    textAlign: 'center',
    background: 'rgba(255,255,255,0.05)',
    color: '#f0f0f0',
    fontSize: 14,
    fontWeight: 600,
    padding: '12px 20px',
    borderRadius: 10,
    textDecoration: 'none',
    border: '1px solid rgba(255,255,255,0.1)',
    transition: 'background 0.15s ease',
  },
  planCtaPrimary: {
    background: 'linear-gradient(135deg, #60a5fa, #a855f7)',
    color: '#0d0f14',
    border: 'none',
    fontWeight: 700,
  },
  planCtaPremium: {
    background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
    color: '#f0f0f0',
    border: 'none',
    fontWeight: 700,
  },
  renewalNote: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.7,
    maxWidth: 640,
    marginLeft: 'auto',
    marginRight: 'auto',
  },

  // ─── BENEFÍCIOS ──────────────────────────────────
  benefitsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 24,
  },
  benefitCard: {
    padding: 28,
    borderRadius: 16,
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: 'rgba(96,165,250,0.08)',
    border: '1px solid rgba(96,165,250,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  benefitTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: '#f0f0f0',
    letterSpacing: '-0.015em',
    margin: '0 0 8px',
  },
  benefitDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.58)',
    lineHeight: 1.65,
    margin: 0,
  },

  // ─── CTA FINAL ──────────────────────────────────
  finalCtaSection: {
    padding: '96px 0',
    background:
      'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(96,165,250,0.06), transparent 70%), #080a0f',
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
}
