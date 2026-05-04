import { CSSProperties } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'

// ─── SEO ──────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title:
    'Pokédex Pokémon TCG — Bynx | 22.861 cartas, 1.025 Pokémons, preços em reais',
  description:
    'A Pokédex mais completa do Brasil pra colecionador de Pokémon TCG. 22.861 cartas catalogadas, 1.025 Pokémons de Bulbasaur a Pecharunt, 236 sets, 38 tipos de raridade e preços em reais por variante. 25+ anos de TCG cobertos, da Base Set (1999) ao Mega Evolution (2026).',
  keywords: [
    'pokedex pokemon tcg', 'pokedex completa pokemon', 'buscar carta pokemon',
    'catálogo pokemon tcg brasil', 'pokedex em português', 'lista cartas pokemon',
    'preço carta pokemon brasil', 'pokémon tcg 9 gerações', 'raridade carta pokemon',
    'set pokemon tcg lista', 'banco de dados pokemon tcg', 'pokédex brasileira pokemon',
    'cartas pokemon em reais', 'pokemon tcg português', 'identificar carta pokemon',
    'valor cartas pokemon', 'enciclopédia pokemon tcg', 'pokemon tcg banco completo',
    'umbreon ex prismatic evolutions', 'charizard pokemon preço',
  ],
  openGraph: {
    title: 'Pokédex Pokémon TCG — Bynx | 22.861 cartas em reais',
    description:
      'A Pokédex mais completa do Brasil. 22.861 cartas, 1.025 Pokémons, 236 sets, preços em reais por variante. Da Base Set (1999) ao Mega Evolution (2026).',
    url: 'https://bynx.gg/pokedex-pokemon-tcg',
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: 'https://bynx.gg/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Pokédex Pokémon TCG — Bynx',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pokédex Pokémon TCG — Bynx',
    description:
      '22.861 cartas, 1.025 Pokémons, 236 sets, preços em reais por variante.',
    images: ['https://bynx.gg/og-image.jpg'],
  },
  alternates: {
    canonical: 'https://bynx.gg/pokedex-pokemon-tcg',
  },
}

// ─── JSON-LD: WebPage + BreadcrumbList + FAQPage + ItemList ────────────────────
//
// 4 schemas pra rich results agressivos no Google.
// ItemList captura os 9 sets icônicos como lista estruturada (carrossel rico).

const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Pokédex Pokémon TCG — Bynx',
  description:
    'A Pokédex mais completa do Brasil pra Pokémon TCG. 22.861 cartas, 1.025 Pokémons, 236 sets, preços em reais por variante.',
  url: 'https://bynx.gg/pokedex-pokemon-tcg',
  inLanguage: 'pt-BR',
  isPartOf: { '@type': 'WebSite', name: 'Bynx', url: 'https://bynx.gg' },
  primaryImageOfPage: 'https://bynx.gg/og-image.jpg',
  about: {
    '@type': 'Thing',
    name: 'Pokémon Trading Card Game',
    description: 'Jogo de cartas colecionáveis Pokémon, lançado em 1996 no Japão',
  },
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://bynx.gg/' },
    { '@type': 'ListItem', position: 2, name: 'Pokédex Pokémon TCG', item: 'https://bynx.gg/pokedex-pokemon-tcg' },
  ],
}

const itemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Sets Pokémon TCG mais recentes',
  description: 'Os sets mais recentes do Pokémon TCG catalogados na Pokédex Bynx',
  itemListOrder: 'https://schema.org/ItemListOrderDescending',
  numberOfItems: 9,
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Perfect Order', url: 'https://bynx.gg/pokedex-pokemon-tcg' },
    { '@type': 'ListItem', position: 2, name: 'Ascended Heroes', url: 'https://bynx.gg/pokedex-pokemon-tcg' },
    { '@type': 'ListItem', position: 3, name: 'Phantasmal Flames', url: 'https://bynx.gg/pokedex-pokemon-tcg' },
    { '@type': 'ListItem', position: 4, name: 'Mega Evolution', url: 'https://bynx.gg/pokedex-pokemon-tcg' },
    { '@type': 'ListItem', position: 5, name: 'Black Bolt', url: 'https://bynx.gg/pokedex-pokemon-tcg' },
    { '@type': 'ListItem', position: 6, name: 'White Flare', url: 'https://bynx.gg/pokedex-pokemon-tcg' },
    { '@type': 'ListItem', position: 7, name: 'Destined Rivals', url: 'https://bynx.gg/pokedex-pokemon-tcg' },
    { '@type': 'ListItem', position: 8, name: 'Journey Together', url: 'https://bynx.gg/pokedex-pokemon-tcg' },
    { '@type': 'ListItem', position: 9, name: 'Prismatic Evolutions', url: 'https://bynx.gg/pokedex-pokemon-tcg' },
  ],
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'O que é a Pokédex do Bynx?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A Pokédex do Bynx é o catálogo mais completo do Pokémon TCG em português brasileiro. São 22.861 cartas catalogadas, organizadas por set, raridade, geração e variante (Normal, Holo, Reverse, Foil, Promo). Cada carta tem preço em reais (mínimo, médio e máximo) atualizado continuamente. A busca é em português e funciona com nomes parciais — digite "char" e aparece Charizard, Charmander, Charmeleon.',
      },
    },
    {
      '@type': 'Question',
      name: 'Quantas cartas Pokémon TCG existem ao todo?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'O Pokémon TCG completou mais de 25 anos de história (lançado em 1996 no Japão, 1999 nos EUA) e tem mais de 22.000 cartas únicas oficialmente lançadas em sets internacionais. O Bynx tem 22.861 cartas catalogadas, cobrindo da Base Set (1999) até os sets mais recentes como Perfect Order (2026) e Ascended Heroes. Isso inclui sets em inglês, japonês, espanhol e francês — quando há tradução oficial.',
      },
    },
    {
      '@type': 'Question',
      name: 'Como o Bynx organiza as 9 gerações de Pokémon?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'O Bynx cobre as 9 gerações de Pokémon (Kanto, Johto, Hoenn, Sinnoh, Unova, Kalos, Alola, Galar, Paldea) através de 17 séries de TCG: Base, Gym, Neo, E-Card, EX, Diamond & Pearl, Platinum, HeartGold & SoulSilver, Black & White, XY, Sun & Moon, Sword & Shield, Scarlet & Violet, Mega Evolution, e séries especiais como Pop e Trainer Galleries. Cada série tem múltiplos sets — só Sword & Shield, por exemplo, tem 25 sets.',
      },
    },
    {
      '@type': 'Question',
      name: 'A Pokédex do Bynx é gratuita?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sim. A consulta à Pokédex é 100% gratuita pra qualquer pessoa, sem precisar de cadastro. Você pode buscar cartas, ver preços em reais por variante, conferir raridade e set, ver o histórico de cartas raras. Recursos avançados como adicionar à coleção, scan com IA, perfil público e exportar dados ficam no plano Pro (com 7 dias grátis pra novos usuários).',
      },
    },
    {
      '@type': 'Question',
      name: 'Como a Pokédex do Bynx se compara com TCGPlayer e pokemon.com?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'TCGPlayer tem o maior catálogo do mundo, mas é 100% em inglês, preços em dólar e foco no mercado americano. Pokemon.com é a fonte oficial mas só lista cartas (sem preços). LigaPokémon tem dados em português mas interface datada e busca limitada. O Bynx combina o melhor: catálogo completo (22.861 cartas), preços em reais por variante atualizados continuamente, busca em português, mobile-first, scan com IA e marketplace BR — tudo no mesmo lugar.',
      },
    },
    {
      '@type': 'Question',
      name: 'O que são as variantes de uma carta Pokémon?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Cada carta Pokémon TCG pode ter várias variantes com preços muito diferentes: Normal (versão padrão), Holo (com brilho holográfico no Pokémon), Reverse Holo (brilho na borda em vez do Pokémon), Foil/Promo (versões especiais), e variantes premium como Pokeball Pattern e Master Ball Pattern. Uma Charizard Holo pode valer 5x mais que a versão Normal. O Bynx mostra preço separado pra cada variante — você sabe exatamente quanto vale a sua.',
      },
    },
    {
      '@type': 'Question',
      name: 'Quais são os tipos de raridade no Pokémon TCG?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'O Pokémon TCG tem 38 tipos de raridade catalogados no Bynx. Os principais: Common (5.251 cartas), Uncommon (4.836), Rare (2.539), Rare Holo (1.617), Promo (1.255), Rare Ultra (798), Illustration Rare (470), Special Illustration Rare (210), Hyper Rare (74). Raridades modernas como Special Illustration Rare e Hyper Rare são as mais buscadas — Umbreon ex Prismatic Evolutions, por exemplo, vale mais de R$ 4.500 em média no Brasil.',
      },
    },
    {
      '@type': 'Question',
      name: 'Como o Bynx atualiza os preços das cartas?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Os preços vêm de coleta contínua de marketplaces brasileiros do Pokémon TCG. Pra cada carta, o Bynx mostra preço mínimo, médio e máximo de mercado, separado por variante. A atualização é automatizada e diária. Diferente de sites americanos que mostram USD convertido, os preços do Bynx são em reais reais — o que você efetivamente paga no Brasil.',
      },
    },
    {
      '@type': 'Question',
      name: 'Posso buscar cartas pelo número do set?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sim. A busca da Pokédex aceita busca por nome (em português ou inglês), por número da carta no set (ex: "Pikachu 25/102"), por set, por raridade, por geração e por tipo do Pokémon. Você pode filtrar por múltiplos critérios ao mesmo tempo: "todos os Charizard tipo Fogo da geração Sword & Shield", por exemplo.',
      },
    },
    {
      '@type': 'Question',
      name: 'Quais são as cartas mais valiosas do Bynx hoje?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No mercado BR, as cartas mais valiosas catalogadas no Bynx incluem Mew Star da Holon Phantoms (R$ 19.000), Umbreon ex Prismatic Evolutions (R$ 4.570), Mew ex Paldean Fates (R$ 2.144), Reshiram e Charizard (R$ 1.800), Pikachu ex Surging Sparks (R$ 1.500) e Charizard-V CPA (R$ 1.398). Cartas vintage como as Star da era Holon e Special Illustration Rares modernas dominam o topo.',
      },
    },
  ],
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function PokedexPokemonTcgPage() {
  return (
    <div style={S.page}>
      {/* CSS responsivo + animações */}
      <style>{`
        @media (max-width: 768px) {
          .pdx-hero { padding: 56px 20px 72px !important; }
          .pdx-hero-grid {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
            text-align: center;
          }
          .pdx-hero-ctas {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .pdx-hero-ctas > a { text-align: center; }
          .pdx-hero-mockup { margin: 0 auto; max-width: 380px; }
          .pdx-stats-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 20px !important; }
          .pdx-anatomy-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .pdx-anatomy-card { margin: 0 auto; }
          .pdx-spec-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .pdx-anatomy-dossie { grid-column: auto !important; padding: 0 !important; }
          .pdx-comparativo-table { font-size: 12px !important; }
          .pdx-comparativo-table th, .pdx-comparativo-table td { padding: 8px 6px !important; }
          .pdx-comparativo-table th:nth-child(n+3), .pdx-comparativo-table td:nth-child(n+3) {
            display: none;
          }
          .pdx-sets-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .pdx-rarity-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .pdx-glossary-grid { grid-template-columns: 1fr !important; }
          .pdx-final-ctas { flex-direction: column !important; }
          .pdx-final-ctas > a { width: 100%; text-align: center; }
          .pdx-search-mockup { max-width: 360px !important; }
          .pdx-cards-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .pdx-cards-grid > div:nth-child(n+5) { display: none; }
          .pdx-series-timeline { font-size: 13px !important; }
          .pdx-series-timeline > div { padding: 12px 14px !important; }
        }

        /* FAQ accordion */
        details[name="bynx-pdx-faq"] > summary {
          list-style: none;
          cursor: pointer;
        }
        details[name="bynx-pdx-faq"] > summary::-webkit-details-marker {
          display: none;
        }
        details[name="bynx-pdx-faq"][open] > summary > .pdx-faq-icon {
          transform: rotate(45deg);
        }

        /* Pulso suave no badge "ao vivo" */
        @keyframes pdx-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.4); }
        }
        .pdx-live-dot {
          animation: pdx-pulse 2s ease-in-out infinite;
        }

        /* Highlight hover nas linhas do comparativo */
        .pdx-comparativo-table tbody tr:hover {
          background: rgba(245,158,11,0.04);
        }

        /* Scroll smooth no glossário */
        .pdx-glossary-grid > div {
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .pdx-glossary-grid > div:hover {
          transform: translateY(-2px);
          border-color: rgba(245,158,11,0.3);
        }
      `}</style>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <PublicHeader />

      <main>
        {/* ─── HERO ───────────────────────────────────── */}
        <section className="pdx-hero" style={S.hero}>
          <div style={S.heroGlow1} />
          <div style={S.heroGlow2} />
          <div style={S.heroGlow3} />

          <div className="pdx-hero-grid" style={S.heroGrid}>
            {/* Coluna esquerda */}
            <div style={S.heroLeft}>
              <span style={S.heroBadge}>
                <span style={S.heroBadgeDot} className="pdx-live-dot" />
                Atualizada diariamente
              </span>

              <h1 style={S.heroTitle}>
                A Pokédex mais{' '}
                <span style={S.heroTitleAccent}>completa do Brasil</span>{' '}
                pra Pokémon TCG.
              </h1>

              <p style={S.heroSubtitle}>
                <strong style={{ color: '#f0f0f0' }}>22.861 cartas</strong>,{' '}
                <strong style={{ color: '#f0f0f0' }}>1.025 Pokémons</strong>,{' '}
                <strong style={{ color: '#f0f0f0' }}>236 sets</strong> e preços em reais por variante. Da Base Set de 1999 ao Mega Evolution de 2026 — tudo em português, mobile-first, sem dólar convertido na correria.
              </p>

              <div className="pdx-hero-ctas" style={S.heroCtas}>
                <Link href="/pokedex" style={S.ctaPrimary}>
                  Explorar Pokédex →
                </Link>
                <Link href="/?auth=signup&next=/pokedex" style={S.ctaSecondary}>
                  Criar conta grátis
                </Link>
              </div>

              <div style={S.heroTrust}>
                <span style={S.heroTrustItem}>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>✓</span> Sem cadastro pra consultar
                </span>
                <span style={S.heroTrustItem}>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>✓</span> 100% em português
                </span>
                <span style={S.heroTrustItem}>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>✓</span> Preços em R$
                </span>
              </div>
            </div>

            {/* Coluna direita: mockup interativo da Pokédex */}
            <div className="pdx-hero-mockup" style={S.heroMockup}>
              <div style={S.mockupBrowser}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                <span style={S.mockupUrl}>bynx.gg/pokedex</span>
              </div>

              <div style={S.mockupBody}>
                {/* Search input mockup */}
                <div style={S.mockupSearchBox}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="9" cy="9" r="6" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
                    <path d="M14 14l3 3" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontSize: 12, color: '#f0f0f0', flex: 1 }}>charizard</span>
                  <span style={S.mockupSearchCount}>87 resultados</span>
                </div>

                {/* Filtros */}
                <div style={S.mockupFilters}>
                  <span style={{ ...S.mockupFilter, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' }}>
                    Tipo: Fogo
                  </span>
                  <span style={S.mockupFilter}>Raridade: Todas</span>
                  <span style={S.mockupFilter}>Geração: Todas</span>
                </div>

                {/* Grid 2x2 de cartas reais */}
                <div style={S.mockupCardsGrid}>
                  {[
                    { name: 'Charizard ex', set: '199/197', img: 'https://images.pokemontcg.io/sv3pt5/199.png', price: 'R$ 245', variant: 'Special Illustration', rarityColor: '#a855f7' },
                    { name: 'Charizard VMAX', set: '020/189', img: 'https://images.pokemontcg.io/swsh3/20.png', price: 'R$ 312', variant: 'Rare Holo VMAX', rarityColor: '#f59e0b' },
                    { name: 'Charizard', set: '004/102', img: 'https://images.pokemontcg.io/base1/4.png', price: 'R$ 1.890', variant: 'Holo · Base Set', rarityColor: '#ef4444' },
                    { name: 'Charizard-V', set: '079/172', img: 'https://images.pokemontcg.io/swsh1/19.png', price: 'R$ 89', variant: 'Rare Holo V', rarityColor: '#3b82f6' },
                  ].map((c) => (
                    <div key={c.name + c.set} style={S.mockupCard}>
                      <div style={S.mockupCardImg}>
                        <img
                          src={c.img}
                          alt={`Carta Pokémon ${c.name}`}
                          loading="lazy"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      </div>
                      <div style={S.mockupCardName}>{c.name}</div>
                      <div style={{ ...S.mockupVariant, color: c.rarityColor, borderColor: c.rarityColor + '40' }}>{c.variant}</div>
                      <div style={S.mockupCardMeta}>
                        <span style={S.mockupCardSet}>{c.set}</span>
                        <span style={S.mockupPrice}>{c.price}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={S.mockupFooter}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Mostrando 4 de 87 · Charizard</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── STATS PROFUNDAS ────────────────────────── */}
        <section style={S.statsSection}>
          <div style={S.container}>
            <p style={S.statsLabel}>O catálogo Pokémon TCG mais completo em português</p>
            <div className="pdx-stats-grid" style={S.statsGrid}>
              {[
                { num: '22.861', label: 'cartas catalogadas' },
                { num: '1.025', label: 'Pokémons (Bulbasaur → Pecharunt)' },
                { num: '236', label: 'sets cobertos' },
                { num: '38', label: 'tipos de raridade' },
                { num: '17', label: 'séries TCG (Base → Mega Evolution)' },
                { num: '25+', label: 'anos de história TCG' },
                { num: '4', label: 'idiomas (PT, EN, JP, ES)' },
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

        {/* ─── ANATOMIA DE UMA CARTA ──────────────────── */}
        <section style={S.section}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Anatomia"
              title="Tudo que a Pokédex te conta sobre uma carta."
              subtitle="Não é só nome e imagem. Cada entrada na Pokédex Bynx é um dossiê completo."
            />

            <div className="pdx-anatomy-grid" style={S.anatomyGrid}>
              {/* Esquerda: carta destacada */}
              <div style={S.anatomyVisual}>
                <div className="pdx-anatomy-card" style={S.anatomyCard}>
                  <img
                    src="https://images.pokemontcg.io/sv8pt5/161.png"
                    alt="Umbreon ex Special Illustration Rare — Prismatic Evolutions"
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 20px 40px rgba(245,158,11,0.2))' }}
                  />
                </div>
              </div>

              {/* Direita: grid 3x2 de specs (estável em qualquer viewport) */}
              <div className="pdx-spec-grid" style={S.specGrid}>
                <SpecCard label="Nome (PT/EN)" value="Umbreon ex" />
                <SpecCard label="Set" value="Prismatic Evolutions" />
                <SpecCard label="Raridade" value="Special Illustration" highlight />
                <SpecCard label="Número" value="161/131" />
                <SpecCard label="Preço médio (BRL)" value="R$ 4.570" highlight />
                <SpecCard label="Variante" value="Foil" />
              </div>

              {/* Dossiê: largura completa abaixo, evita conflito com specs ao lado */}
              <div className="pdx-anatomy-dossie" style={S.anatomyDossie}>
                <h3 style={S.anatomyTitle}>Cada carta é um dossiê.</h3>
                <ul style={S.anatomyList}>
                  <li style={S.anatomyItem}>
                    <strong style={{ color: '#f59e0b' }}>Identificação:</strong> nome em PT e EN, número exato no set, ID da carta no banco.
                  </li>
                  <li style={S.anatomyItem}>
                    <strong style={{ color: '#f59e0b' }}>Set + geração:</strong> qual coleção pertence, série TCG e data de lançamento.
                  </li>
                  <li style={S.anatomyItem}>
                    <strong style={{ color: '#f59e0b' }}>Raridade exata:</strong> 38 tipos catalogados — Common, Holo, Reverse, Promo, Special Illustration, Hyper Rare e mais.
                  </li>
                  <li style={S.anatomyItem}>
                    <strong style={{ color: '#f59e0b' }}>Preço por variante:</strong> mínimo, médio e máximo em R$, separados pra Normal, Holo, Reverse, Foil, Promo e Pokeball Pattern.
                  </li>
                  <li style={S.anatomyItem}>
                    <strong style={{ color: '#f59e0b' }}>Stats de batalha:</strong> HP, tipos, ataques, fraquezas, resistências, custo de retreat e ilustrador.
                  </li>
                  <li style={S.anatomyItem}>
                    <strong style={{ color: '#f59e0b' }}>Histórico:</strong> quando foi lançada, valorização recente e legalidade em formatos competitivos.
                  </li>
                </ul>
                <p style={S.anatomyNote}>
                  Cobertura completa, sem precisar abrir 4 abas no navegador.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── COMPARATIVO BRUTAL ─────────────────────── */}
        <section style={S.sectionDark}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Comparativo"
              title="Bynx vs o resto do mundo."
              subtitle="Existem várias Pokédex. Nenhuma combina catálogo completo, preços em reais, busca em português e mobile-first como o Bynx."
            />

            <div style={S.comparativoWrap}>
              <table className="pdx-comparativo-table" style={S.comparativoTable}>
                <thead>
                  <tr>
                    <th style={{ ...S.compTh, textAlign: 'left' }}>Feature</th>
                    <th style={{ ...S.compTh, ...S.compThBynx }}>Bynx</th>
                    <th style={S.compTh}>HeyPikachu</th>
                    <th style={S.compTh}>LigaPokémon</th>
                    <th style={S.compTh}>pokemon.com</th>
                    <th style={S.compTh}>TCGPlayer</th>
                    <th style={S.compTh}>Pokellector</th>
                  </tr>
                </thead>
                <tbody>
                  <CompRow feature="Português brasileiro completo" bynx="full" hp="no" lp="full" pc="no" tcg="no" pk="no" />
                  <CompRow feature="Preços em reais (BRL)" bynx="full" hp="no" lp="full" pc="no" tcg="no" pk="no" />
                  <CompRow feature="Preço por variante (Normal, Holo, Reverse...)" bynx="full" hp="full" lp="partial" pc="no" tcg="full" pk="no" />
                  <CompRow feature="Scan de carta com IA" bynx="full" hp="full" lp="no" pc="no" tcg="no" pk="no" />
                  <CompRow feature="Marketplace integrado" bynx="full" hp="no" lp="full" pc="no" tcg="full" pk="no" />
                  <CompRow feature="Mobile-first" bynx="full" hp="full" lp="no" pc="full" tcg="no" pk="no" />
                  <CompRow feature="Plano gratuito útil" bynx="full" hp="partial" lp="full" pc="full" tcg="full" pk="full" />
                  <CompRow feature="Perfil público com URL" bynx="full" hp="full" lp="no" pc="no" tcg="no" pk="no" />
                  <CompRow feature="Patrimônio em tempo real" bynx="full" hp="no" lp="no" pc="no" tcg="no" pk="no" />
                  <CompRow feature="Catálogo > 20.000 cartas" bynx="full" hp="full" lp="full" pc="full" tcg="full" pk="full" />
                </tbody>
              </table>

              <p style={S.compFootnote}>
                Comparativo público feito com base nos sites e apps oficiais. Última atualização: maio/2026. Se algo estiver desatualizado, mande feedback pelo suporte — corrigimos.
              </p>
            </div>
          </div>
        </section>

        {/* ─── TOP 9 SETS RECENTES ────────────────────── */}
        <section style={S.section}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Sets recentes"
              title="Os 9 sets mais novos do TCG, todos cobertos."
              subtitle="Quando um set sai, o Bynx tá lá. Logos oficiais, total de cartas, data de lançamento e preços por variante já no primeiro dia."
            />

            <div className="pdx-sets-grid" style={S.setsGrid}>
              {[
                { name: 'Perfect Order', date: 'Mar/2026', cards: 124, logo: 'https://images.scrydex.com/pokemon/me3-logo/logo', highlight: 'Novíssimo' },
                { name: 'Ascended Heroes', date: 'Jan/2026', cards: 295, logo: 'https://images.scrydex.com/pokemon/me2pt5-logo/logo' },
                { name: 'Phantasmal Flames', date: 'Nov/2025', cards: 130, logo: 'https://images.pokemontcg.io/me2/logo.png' },
                { name: 'Mega Evolution', date: 'Set/2025', cards: 188, logo: 'https://images.pokemontcg.io/me1/logo.png' },
                { name: 'Black Bolt', date: 'Jul/2025', cards: 172, logo: 'https://images.pokemontcg.io/zsv10pt5/logo.png' },
                { name: 'White Flare', date: 'Jul/2025', cards: 173, logo: 'https://images.pokemontcg.io/rsv10pt5/logo.png' },
                { name: 'Destined Rivals', date: 'Mai/2025', cards: 244, logo: 'https://images.pokemontcg.io/sv10/logo.png' },
                { name: 'Journey Together', date: 'Mar/2025', cards: 190, logo: 'https://images.pokemontcg.io/sv9/logo.png' },
                { name: 'Prismatic Evolutions', date: 'Jan/2025', cards: 180, logo: 'https://images.pokemontcg.io/sv8pt5/logo.png', highlight: 'Cult' },
              ].map((s) => (
                <div key={s.name} style={S.setCard}>
                  {s.highlight && <span style={S.setBadge}>{s.highlight}</span>}
                  <div style={S.setLogoWrap}>
                    <img src={s.logo} alt={`Logo do set ${s.name}`} loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                  <div>
                    <div style={S.setName}>{s.name}</div>
                    <div style={S.setMeta}>
                      <span>{s.date}</span>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span>{s.cards} cartas</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── TOP 5 CARTAS VALIOSAS BR ───────────────── */}
        <section style={S.sectionDark}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Top valiosas"
              title="As cartas mais caras catalogadas em reais."
              subtitle="Preço de mercado brasileiro, médio. Algumas dessas você só encontra em coleções fechadas — outras valem mais que um carro."
            />

            <div className="pdx-cards-grid" style={S.topCardsGrid}>
              {[
                { name: 'Mew Star', desc: 'Holon Phantoms · Vintage', price: 'R$ 19.000', img: null, fallback: '⭐', rank: 1 },
                { name: 'Umbreon ex', desc: 'Prismatic Evolutions · Special Illustration', price: 'R$ 4.570', img: 'https://images.pokemontcg.io/sv8pt5/161.png', rank: 2 },
                { name: 'Mew ex', desc: 'Paldean Fates · Special Illustration', price: 'R$ 2.144', img: 'https://images.pokemontcg.io/sv4pt5/232.png', rank: 3 },
                { name: 'Pikachu ex', desc: 'Surging Sparks · Special Illustration', price: 'R$ 1.500', img: 'https://images.pokemontcg.io/sv8/238.png', rank: 4 },
                { name: 'Flareon ex', desc: 'Prismatic Evolutions · Special Illustration', price: 'R$ 1.399', img: 'https://images.pokemontcg.io/sv8pt5/146.png', rank: 5 },
                { name: 'Charizard-V', desc: 'Liga BR — CPA · Promo', price: 'R$ 1.398', img: null, fallback: '🔥', rank: 6 },
              ].map((c) => (
                <div key={c.name + c.rank} style={S.topCard}>
                  <span style={S.topCardRank}>#{c.rank}</span>
                  <div style={S.topCardImg}>
                    {c.img ? (
                      <img src={c.img} alt={c.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={S.topCardFallback}>{c.fallback}</div>
                    )}
                  </div>
                  <div style={S.topCardName}>{c.name}</div>
                  <div style={S.topCardDesc}>{c.desc}</div>
                  <div style={S.topCardPrice}>{c.price}</div>
                </div>
              ))}
            </div>

            <p style={S.topCardsNote}>
              Preços médios coletados de marketplaces brasileiros. Variam por condição (NM, LP, MP) e disponibilidade — abra a carta no app pra ver mínimo, médio e máximo atualizados.
            </p>
          </div>
        </section>

        {/* ─── SHOWCASE DE RARIDADES ──────────────────── */}
        <section style={S.section}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Raridades"
              title="Da Common à Hyper Rare — todas catalogadas."
              subtitle="Pokémon TCG tem 38 tipos de raridade. O Bynx mostra a raridade exata de cada carta, com cor diferente, ícone e exemplos visuais."
            />

            <div className="pdx-rarity-grid" style={S.rarityGrid}>
              {[
                { name: 'Common', count: 5251, color: '#9ca3af', desc: 'Carta básica, sem brilho. Encontrada em todos os boosters.', symbol: '●' },
                { name: 'Uncommon', count: 4836, color: '#22c55e', desc: 'Diamante simples. 1/3 das cartas de um booster, em média.', symbol: '◆' },
                { name: 'Rare', count: 2539, color: '#3b82f6', desc: 'Estrela preta. Última carta de um booster comum.', symbol: '★' },
                { name: 'Rare Holo', count: 1617, color: '#a855f7', desc: 'Estrela preta + brilho holográfico no corpo da carta.', symbol: '✦' },
                { name: 'Promo', count: 1255, color: '#f59e0b', desc: 'Distribuição limitada — eventos, McDonalds, Black Star Promo.', symbol: '◈' },
                { name: 'Rare Ultra', count: 798, color: '#ec4899', desc: 'Carta inteira holográfica. EX, GX, V, VMAX, VSTAR, ex.', symbol: '✶' },
                { name: 'Illustration Rare', count: 470, color: '#f97316', desc: 'Arte estendida, cobrindo borda. Era moderna.', symbol: '✺' },
                { name: 'Special Illustration', count: 210, color: '#ef4444', desc: 'A jóia da era moderna. Umbreon ex Prismatic é exemplo.', symbol: '✷' },
                { name: 'Hyper Rare', count: 74, color: '#fbbf24', desc: 'Borda dourada/rainbow. As mais raras nos boosters atuais.', symbol: '✸' },
              ].map((r) => (
                <div key={r.name} style={{ ...S.rarityCard, borderColor: r.color + '30' }}>
                  <div style={{ ...S.raritySymbol, background: r.color + '15', color: r.color, borderColor: r.color + '40' }}>
                    {r.symbol}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={S.rarityHeader}>
                      <div style={{ ...S.rarityName, color: r.color }}>{r.name}</div>
                      <div style={S.rarityCount}>{r.count.toLocaleString('pt-BR')}</div>
                    </div>
                    <div style={S.rarityDesc}>{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <p style={S.rarityNote}>
              + 29 outras raridades catalogadas: Rainbow, Secret, BREAK, Prism Star, ACE SPEC, Trainer Gallery, Radiant, Amazing, Mega Hyper Rare e mais.
            </p>
          </div>
        </section>

        {/* ─── 17 SÉRIES TCG ──────────────────────────── */}
        <section style={S.sectionDark}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="25+ anos de TCG"
              title="Da Base Set ao Mega Evolution."
              subtitle="O Pokémon TCG nasceu em 1996 no Japão. O Bynx cobre 17 séries diferentes — algumas com 25+ sets cada."
            />

            <div className="pdx-series-timeline" style={S.seriesTimeline}>
              {[
                { name: 'Mega Evolution', years: '2025 — 2026', cards: 737, sets: 4, current: true },
                { name: 'Scarlet & Violet', years: '2023 — 2025', cards: 3630, sets: 18, recent: true },
                { name: 'Sword & Shield', years: '2020 — 2023', cards: 3667, sets: 25 },
                { name: 'Sun & Moon', years: '2017 — 2019', cards: 2973, sets: 18 },
                { name: 'XY', years: '2014 — 2016', cards: 1926, sets: 16 },
                { name: 'Black & White', years: '2011 — 2013', cards: 1437, sets: 13 },
                { name: 'EX Series', years: '2003 — 2007', cards: 1766, sets: 20 },
                { name: 'Diamond & Pearl', years: '2007 — 2009', cards: 900, sets: 8 },
                { name: 'HeartGold & SoulSilver', years: '2010 — 2011', cards: 545, sets: 6 },
                { name: 'Platinum', years: '2009 — 2010', cards: 517, sets: 4 },
                { name: 'E-Card', years: '2002 — 2003', cards: 529, sets: 3 },
                { name: 'Base / Jungle / Fossil', years: '1999 — 2001', cards: 494, sets: 6, classic: true },
                { name: 'Neo', years: '2000 — 2001', cards: 365, sets: 4, classic: true },
                { name: 'Gym Heroes / Gym Challenge', years: '2000', cards: 264, sets: 2, classic: true },
              ].map((s) => (
                <div key={s.name} style={{
                  ...S.seriesItem,
                  ...(s.current ? S.seriesItemCurrent : {}),
                  ...(s.recent ? S.seriesItemRecent : {}),
                  ...(s.classic ? S.seriesItemClassic : {}),
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    {s.current && <span style={S.seriesBadgeCurrent}>ATUAL</span>}
                    {s.classic && <span style={S.seriesBadgeClassic}>VINTAGE</span>}
                    <div>
                      <div style={S.seriesName}>{s.name}</div>
                      <div style={S.seriesYears}>{s.years}</div>
                    </div>
                  </div>
                  <div style={S.seriesStats}>
                    <span style={S.seriesStatBig}>{s.cards.toLocaleString('pt-BR')}</span>
                    <span style={S.seriesStatLabel}>cartas · {s.sets} sets</span>
                  </div>
                </div>
              ))}
            </div>

            <p style={S.seriesNote}>
              + outras séries: Pop (153 cartas distribuídas em eventos), NP (Nintendo Power), Other e Trainer Galleries.
            </p>
          </div>
        </section>

        {/* ─── BUSCA INTELIGENTE ──────────────────────── */}
        <section style={S.section}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Busca inteligente"
              title="Digite 3 letras. Encontre a carta certa."
              subtitle="A busca da Pokédex Bynx tem autocomplete em português, aceita nomes parciais e filtra por raridade, geração e variante na hora."
            />

            <div className="pdx-search-mockup" style={S.searchMockup}>
              <div style={S.searchInput}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="9" cy="9" r="6" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" />
                  <path d="M14 14l4 4" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <span style={{ flex: 1, color: '#f0f0f0', fontSize: 15 }}>char</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', padding: '2px 6px', background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>ENTER</span>
              </div>

              <div style={S.searchSuggestions}>
                {[
                  { name: 'Charizard', count: '87 cartas', flame: '🔥' },
                  { name: 'Charmander', count: '34 cartas', flame: '🔥' },
                  { name: 'Charmeleon', count: '21 cartas', flame: '🔥' },
                  { name: 'Charjabug', count: '12 cartas', flame: '⚡' },
                  { name: 'Chansey', count: '28 cartas', flame: '💞' },
                ].map((s) => (
                  <div key={s.name} style={S.searchSuggestion}>
                    <span style={{ fontSize: 18 }}>{s.flame}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f0' }}>
                        <span style={{ color: '#f59e0b' }}>Char</span>{s.name.slice(4)}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{s.count}</div>
                    </div>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>↗</span>
                  </div>
                ))}
              </div>

              <div style={S.searchTips}>
                <strong style={{ color: '#f59e0b' }}>Dica:</strong> a busca aceita também número de carta ("25/102"), nome de set ("prismatic") e raridade ("special illustration").
              </div>
            </div>
          </div>
        </section>

        {/* ─── GLOSSÁRIO ──────────────────────────────── */}
        <section style={S.sectionDark}>
          <div style={S.container}>
            <SectionHeader
              eyebrow="Glossário"
              title="O que significa cada termo no Pokémon TCG."
              subtitle="Pra quem tá começando — ou pra quem quer revisar. 15 termos essenciais explicados."
            />

            <div className="pdx-glossary-grid" style={S.glossaryGrid}>
              {[
                { term: 'Booster', desc: 'Pacote selado com 10-11 cartas aleatórias de um set específico.' },
                { term: 'ETB (Elite Trainer Box)', desc: 'Caixa contendo 8-10 boosters + acessórios (sleeves, dados, marcadores).' },
                { term: 'Set', desc: 'Coleção temática lançada como um produto. Ex: Prismatic Evolutions tem 180 cartas.' },
                { term: 'Holo', desc: 'Variante com brilho holográfico no corpo da carta (no Pokémon).' },
                { term: 'Reverse Holo', desc: 'Brilho na borda da carta, em vez de no Pokémon. Mesma raridade, valor diferente.' },
                { term: 'Foil', desc: 'Termo genérico pra qualquer carta com brilho. Inclui Holo, Reverse, Promo Foil.' },
                { term: 'Promo', desc: 'Carta de distribuição limitada — eventos, parcerias (McDonalds), Black Star Promo.' },
                { term: 'PSA / BGS / CGC', desc: 'Empresas que avaliam e encapsulam cartas em "slabs" com nota de 1 a 10.' },
                { term: 'NM / LP / MP / HP', desc: 'Condições da carta: Near Mint, Lightly Played, Moderately Played, Heavily Played.' },
                { term: 'Pull rate', desc: 'Probabilidade estatística de pegar uma carta rara em um booster.' },
                { term: 'Slab', desc: 'Cápsula plástica selada usada por empresas de gradação (PSA, BGS).' },
                { term: 'Master Set', desc: 'Coleção 100% completa de um set, incluindo todas as variantes.' },
                { term: 'Pokeball Pattern', desc: 'Variante especial com Pokébolas aplicadas no foil. Era SV.' },
                { term: 'Rotation', desc: 'Sets que saem do formato Standard a cada ano. Vintage permanece em Expanded.' },
                { term: 'Reprint', desc: 'Carta lançada em set anterior, republicada em set novo. Pode mudar valor.' },
              ].map((g) => (
                <div key={g.term} style={S.glossaryItem}>
                  <div style={S.glossaryTerm}>{g.term}</div>
                  <div style={S.glossaryDesc}>{g.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FAQ ─────────────────────────────────────── */}
        <section style={S.section}>
          <div style={{ ...S.container, maxWidth: 820 }}>
            <SectionHeader
              eyebrow="Perguntas frequentes"
              title="Tudo que perguntam sobre a Pokédex Bynx."
            />

            <div style={S.faqList}>
              {[
                {
                  q: 'O que é a Pokédex do Bynx?',
                  a: 'A Pokédex do Bynx é o catálogo mais completo do Pokémon TCG em português brasileiro. São 22.861 cartas catalogadas, organizadas por set, raridade, geração e variante (Normal, Holo, Reverse, Foil, Promo). Cada carta tem preço em reais (mínimo, médio e máximo) atualizado continuamente. A busca é em português e funciona com nomes parciais — digite "char" e aparece Charizard, Charmander, Charmeleon.',
                },
                {
                  q: 'Quantas cartas Pokémon TCG existem ao todo?',
                  a: 'O Pokémon TCG completou mais de 25 anos de história (lançado em 1996 no Japão, 1999 nos EUA) e tem mais de 22.000 cartas únicas oficialmente lançadas. O Bynx tem 22.861 cartas catalogadas, cobrindo da Base Set (1999) até os sets mais recentes como Perfect Order (2026) e Ascended Heroes. Isso inclui sets em inglês, japonês, espanhol e francês — quando há tradução oficial.',
                },
                {
                  q: 'Como o Bynx organiza as 9 gerações de Pokémon?',
                  a: 'O Bynx cobre as 9 gerações de Pokémon (Kanto, Johto, Hoenn, Sinnoh, Unova, Kalos, Alola, Galar, Paldea) através de 17 séries de TCG: Base, Gym, Neo, E-Card, EX, Diamond & Pearl, Platinum, HeartGold & SoulSilver, Black & White, XY, Sun & Moon, Sword & Shield, Scarlet & Violet, Mega Evolution, e séries especiais como POP e Trainer Galleries. Cada série tem múltiplos sets — só Sword & Shield, por exemplo, tem 25 sets.',
                },
                {
                  q: 'A Pokédex do Bynx é gratuita?',
                  a: 'Sim. A consulta à Pokédex é 100% gratuita pra qualquer pessoa, sem precisar de cadastro. Você pode buscar cartas, ver preços em reais por variante, conferir raridade e set. Recursos avançados como adicionar à coleção, scan com IA, perfil público e exportar dados ficam no plano Pro (com 7 dias grátis pra novos usuários).',
                },
                {
                  q: 'Como a Pokédex do Bynx se compara com TCGPlayer e pokemon.com?',
                  a: 'TCGPlayer tem o maior catálogo do mundo, mas é 100% em inglês, preços em dólar e foco no mercado americano. Pokemon.com é a fonte oficial mas só lista cartas (sem preços). LigaPokémon tem dados em português mas interface datada e busca limitada. O Bynx combina o melhor: catálogo completo (22.861 cartas), preços em reais por variante atualizados continuamente, busca em português, mobile-first, scan com IA e marketplace BR — tudo no mesmo lugar.',
                },
                {
                  q: 'O que são as variantes de uma carta Pokémon?',
                  a: 'Cada carta Pokémon TCG pode ter várias variantes com preços muito diferentes: Normal (versão padrão), Holo (com brilho holográfico no Pokémon), Reverse Holo (brilho na borda em vez do Pokémon), Foil/Promo (versões especiais), e variantes premium como Pokeball Pattern e Master Ball Pattern. Uma Charizard Holo pode valer 5x mais que a versão Normal. O Bynx mostra preço separado pra cada variante — você sabe exatamente quanto vale a sua.',
                },
                {
                  q: 'Quais são os tipos de raridade no Pokémon TCG?',
                  a: 'O Pokémon TCG tem 38 tipos de raridade catalogados no Bynx. Os principais: Common (5.251 cartas), Uncommon (4.836), Rare (2.539), Rare Holo (1.617), Promo (1.255), Rare Ultra (798), Illustration Rare (470), Special Illustration Rare (210), Hyper Rare (74). Raridades modernas como Special Illustration Rare e Hyper Rare são as mais buscadas — Umbreon ex Prismatic Evolutions, por exemplo, vale mais de R$ 4.500 em média no Brasil.',
                },
                {
                  q: 'Como o Bynx atualiza os preços das cartas?',
                  a: 'Os preços vêm de coleta contínua de marketplaces brasileiros do Pokémon TCG. Pra cada carta, o Bynx mostra preço mínimo, médio e máximo de mercado, separado por variante. A atualização é automatizada e diária. Diferente de sites americanos que mostram USD convertido, os preços do Bynx são em reais reais — o que você efetivamente paga no Brasil.',
                },
                {
                  q: 'Posso buscar cartas pelo número do set?',
                  a: 'Sim. A busca da Pokédex aceita busca por nome (em português ou inglês), por número da carta no set (ex: "Pikachu 25/102"), por set, por raridade, por geração e por tipo do Pokémon. Você pode filtrar por múltiplos critérios ao mesmo tempo.',
                },
                {
                  q: 'Quais são as cartas mais valiosas do Bynx hoje?',
                  a: 'No mercado BR, as cartas mais valiosas catalogadas no Bynx incluem Mew Star da Holon Phantoms (R$ 19.000), Umbreon ex Prismatic Evolutions (R$ 4.570), Mew ex Paldean Fates (R$ 2.144), Reshiram e Charizard (R$ 1.800), Pikachu ex Surging Sparks (R$ 1.500) e Charizard-V CPA (R$ 1.398). Cartas vintage como as Star da era Holon e Special Illustration Rares modernas dominam o topo.',
                },
              ].map((item, i) => (
                <details key={i} name="bynx-pdx-faq" style={S.faqItem}>
                  <summary style={S.faqSummary}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f0' }}>{item.q}</span>
                    <span className="pdx-faq-icon" style={S.faqIcon}>+</span>
                  </summary>
                  <p style={S.faqAnswer}>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA FINAL ──────────────────────────────── */}
        <section style={S.finalSection}>
          <div style={S.container}>
            <div style={S.finalCta}>
              <h2 style={S.finalTitle}>
                A Pokédex tá pronta. Bora explorar?
              </h2>
              <p style={S.finalSubtitle}>
                22.861 cartas, 1.025 Pokémons, 236 sets e preços em reais. Sem cadastro pra consultar — mas se quiser organizar sua coleção,{' '}
                <strong style={{ color: '#f0f0f0' }}>7 dias de Pro grátis</strong> pra começar.
              </p>
              <div className="pdx-final-ctas" style={S.finalCtas}>
                <Link href="/pokedex" style={S.ctaPrimary}>
                  Explorar Pokédex →
                </Link>
                <Link href="/?auth=signup&next=/minha-colecao" style={S.ctaSecondary}>
                  Criar conta grátis
                </Link>
                <Link href="/colecionadores" style={S.ctaTertiary}>
                  Saber mais sobre o Bynx
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

function SpecCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ ...S.specCard, ...(highlight ? S.specCardHighlight : {}) }}>
      <div style={S.specLabel}>{label}</div>
      <div style={{ ...S.specValue, ...(highlight ? S.specValueHighlight : {}) }}>{value}</div>
    </div>
  )
}

type CompCell = 'full' | 'partial' | 'no'

function CompRow({ feature, bynx, hp, lp, pc, tcg, pk }: { feature: string; bynx: CompCell; hp: CompCell; lp: CompCell; pc: CompCell; tcg: CompCell; pk: CompCell }) {
  return (
    <tr>
      <td style={{ ...S.compTd, textAlign: 'left', fontWeight: 600, color: '#f0f0f0' }}>{feature}</td>
      <td style={{ ...S.compTd, ...S.compTdBynx }}><CompCellRender v={bynx} /></td>
      <td style={S.compTd}><CompCellRender v={hp} /></td>
      <td style={S.compTd}><CompCellRender v={lp} /></td>
      <td style={S.compTd}><CompCellRender v={pc} /></td>
      <td style={S.compTd}><CompCellRender v={tcg} /></td>
      <td style={S.compTd}><CompCellRender v={pk} /></td>
    </tr>
  )
}

function CompCellRender({ v }: { v: CompCell }) {
  if (v === 'full') return <span style={{ color: '#22c55e', fontSize: 18, fontWeight: 700 }} aria-label="Sim">✓</span>
  if (v === 'partial') return <span style={{ color: '#f59e0b', fontSize: 14, fontWeight: 700 }} aria-label="Parcial">~</span>
  return <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18, fontWeight: 400 }} aria-label="Não">−</span>
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

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
    top: '15%', left: '60%',
    width: 600, height: 500,
    background: 'radial-gradient(ellipse, rgba(245,158,11,0.14), transparent 70%)',
    pointerEvents: 'none',
  },
  heroGlow2: {
    position: 'absolute',
    top: '40%', left: '5%',
    width: 360, height: 360,
    background: 'radial-gradient(ellipse, rgba(239,68,68,0.1), transparent 70%)',
    pointerEvents: 'none',
  },
  heroGlow3: {
    position: 'absolute',
    bottom: '10%', left: '40%',
    width: 280, height: 280,
    background: 'radial-gradient(ellipse, rgba(168,85,247,0.06), transparent 70%)',
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
  heroLeft: { display: 'flex', flexDirection: 'column', gap: 24 },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: 600,
    padding: '6px 14px',
    borderRadius: 999,
    background: 'rgba(34,197,94,0.08)',
    color: '#22c55e',
    border: '1px solid rgba(34,197,94,0.25)',
    letterSpacing: '0.02em',
  },
  heroBadgeDot: {
    width: 6, height: 6, borderRadius: 999,
    background: '#22c55e',
    boxShadow: '0 0 0 3px rgba(34,197,94,0.2)',
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
  heroCtas: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 },
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
  ctaTertiary: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontWeight: 600,
    padding: '14px 20px',
    textDecoration: 'none',
    display: 'inline-block',
  },
  heroTrust: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 8,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },
  heroTrustItem: { display: 'inline-flex', alignItems: 'center', gap: 6 },

  // ─── HERO MOCKUP ───────────────────────────────────
  heroMockup: { position: 'relative', width: '100%' },
  mockupBrowser: {
    background: 'rgba(255,255,255,0.04)',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    borderBottom: 'none',
    padding: '10px 14px',
    display: 'flex', alignItems: 'center', gap: 6,
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
    background: 'rgba(13,15,20,0.85)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderTopLeftRadius: 0, borderTopRightRadius: 0,
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
    padding: 18,
    backdropFilter: 'blur(8px)',
    boxShadow: '0 30px 80px -20px rgba(0,0,0,0.7)',
  },
  mockupSearchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '9px 12px',
    marginBottom: 12,
  },
  mockupSearchCount: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'monospace',
    background: 'rgba(255,255,255,0.04)',
    padding: '2px 6px',
    borderRadius: 4,
  },
  mockupFilters: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  mockupFilter: {
    fontSize: 10,
    padding: '4px 10px',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.6)',
    fontWeight: 600,
  },
  mockupCardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
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
    marginBottom: 3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  mockupVariant: {
    fontSize: 9,
    fontWeight: 600,
    padding: '1px 6px',
    borderRadius: 4,
    border: '1px solid',
    display: 'inline-block',
    marginBottom: 4,
  },
  mockupCardMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  mockupCardSet: { fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' },
  mockupPrice: { fontSize: 11, fontWeight: 800, color: '#f59e0b' },
  mockupFooter: { marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' },

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
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 32,
    maxWidth: 1100,
    margin: '0 auto',
  },
  stat: { textAlign: 'center' },
  statNum: {
    fontSize: 'clamp(28px, 3.5vw, 38px)',
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
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    lineHeight: 1.4,
  },

  // ─── SEÇÕES GENÉRICAS ──────────────────────────────
  section: { padding: '96px 0' },
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
    maxWidth: 760,
    margin: 0,
    color: '#f0f0f0',
  },
  sectionSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.6,
    maxWidth: 620,
    margin: 0,
  },

  // ─── ANATOMIA ──────────────────────────────────────
  // Layout: grid 2-col (carta à esquerda + specs à direita), com o
  // bloco "dossiê" ocupando largura completa abaixo. Sem position
  // absolute — robusto em qualquer viewport.
  anatomyGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 48,
    alignItems: 'center',
    maxWidth: 1080,
    margin: '0 auto',
  },
  anatomyVisual: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  anatomyCard: {
    width: 240,
    aspectRatio: '5/7',
  },
  // Grid 3x2 de specs ao lado da carta (desktop) / 2x3 em mobile
  specGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gridAutoRows: 'minmax(72px, auto)',
    gap: 10,
  },
  specCard: {
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 4,
    minWidth: 0, // permite truncate em containers flex/grid
  },
  specCardHighlight: {
    border: '1px solid rgba(245,158,11,0.4)',
    background: 'linear-gradient(180deg, rgba(245,158,11,0.08), rgba(13,15,20,1))',
  },
  specLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 700,
  },
  specValue: {
    fontSize: 14,
    fontWeight: 700,
    color: '#f0f0f0',
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  specValueHighlight: {
    color: '#f59e0b',
  },
  // Dossiê ocupa largura completa abaixo (não mais coluna lateral)
  anatomyDossie: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    paddingTop: 24,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    marginTop: 24,
  },
  anatomyTitle: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: '-0.025em',
    margin: 0,
    color: '#f0f0f0',
    textAlign: 'center',
  },
  anatomyList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 12,
  },
  anatomyItem: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.6,
    paddingLeft: 16,
    borderLeft: '2px solid rgba(245,158,11,0.3)',
  },
  anatomyNote: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
    margin: 0,
    marginTop: 8,
    textAlign: 'center',
  },

  // ─── COMPARATIVO ───────────────────────────────────
  comparativoWrap: {
    overflowX: 'auto',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#0d0f14',
  },
  comparativoTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  compTh: {
    padding: '16px 12px',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  compThBynx: {
    color: '#f59e0b',
    background: 'rgba(245,158,11,0.06)',
    borderLeft: '1px solid rgba(245,158,11,0.2)',
    borderRight: '1px solid rgba(245,158,11,0.2)',
  },
  compTd: {
    padding: '14px 12px',
    textAlign: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  compTdBynx: {
    background: 'rgba(245,158,11,0.04)',
    borderLeft: '1px solid rgba(245,158,11,0.15)',
    borderRight: '1px solid rgba(245,158,11,0.15)',
  },
  compFootnote: {
    padding: '16px 20px',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
    margin: 0,
    borderTop: '1px solid rgba(255,255,255,0.04)',
  },

  // ─── SETS GRID ─────────────────────────────────────
  setsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
  },
  setCard: {
    position: 'relative',
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    minHeight: 180,
    transition: 'border-color 0.2s ease',
  },
  setBadge: {
    position: 'absolute',
    top: 10, right: 10,
    fontSize: 9,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 999,
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    color: '#000',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  setLogoWrap: {
    width: 120,
    height: 70,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setName: {
    fontSize: 15,
    fontWeight: 700,
    color: '#f0f0f0',
    textAlign: 'center',
    marginBottom: 4,
  },
  setMeta: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },

  // ─── TOP CARDS ─────────────────────────────────────
  topCardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
  },
  topCard: {
    position: 'relative',
    background: 'linear-gradient(180deg, rgba(245,158,11,0.04), #0d0f14 60%)',
    border: '1px solid rgba(245,158,11,0.15)',
    borderRadius: 14,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  topCardRank: {
    position: 'absolute',
    top: 10, left: 10,
    fontSize: 10,
    fontWeight: 800,
    color: '#f59e0b',
    background: 'rgba(245,158,11,0.1)',
    padding: '3px 8px',
    borderRadius: 6,
    letterSpacing: '0.05em',
  },
  topCardImg: {
    width: 130,
    aspectRatio: '5/7',
    borderRadius: 8,
    overflow: 'hidden',
    background: 'rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCardFallback: {
    fontSize: 56,
    filter: 'drop-shadow(0 4px 12px rgba(245,158,11,0.4))',
  },
  topCardName: {
    fontSize: 16,
    fontWeight: 800,
    color: '#f0f0f0',
    letterSpacing: '-0.015em',
    marginTop: 4,
  },
  topCardDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 1.4,
  },
  topCardPrice: {
    fontSize: 22,
    fontWeight: 800,
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    letterSpacing: '-0.02em',
    marginTop: 4,
  },
  topCardsNote: {
    textAlign: 'center',
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    fontStyle: 'italic',
    marginTop: 32,
    maxWidth: 700,
    marginLeft: 'auto',
    marginRight: 'auto',
  },

  // ─── RARIDADES ─────────────────────────────────────
  rarityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  rarityCard: {
    background: '#0d0f14',
    border: '1px solid',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
  },
  raritySymbol: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 10,
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 700,
  },
  rarityHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  rarityName: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  rarityCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'monospace',
  },
  rarityDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.5,
  },
  rarityNote: {
    textAlign: 'center',
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
    marginTop: 24,
  },

  // ─── SÉRIES TIMELINE ───────────────────────────────
  seriesTimeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxWidth: 880,
    margin: '0 auto',
  },
  seriesItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: '14px 18px',
  },
  seriesItemCurrent: {
    background: 'linear-gradient(90deg, rgba(245,158,11,0.08), #0d0f14 80%)',
    border: '1px solid rgba(245,158,11,0.3)',
  },
  seriesItemRecent: {
    background: 'linear-gradient(90deg, rgba(245,158,11,0.03), #0d0f14 80%)',
    border: '1px solid rgba(245,158,11,0.15)',
  },
  seriesItemClassic: {
    background: 'linear-gradient(90deg, rgba(168,85,247,0.04), #0d0f14 80%)',
    border: '1px solid rgba(168,85,247,0.2)',
  },
  seriesBadgeCurrent: {
    fontSize: 9,
    fontWeight: 800,
    padding: '3px 8px',
    borderRadius: 6,
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    color: '#000',
    letterSpacing: '0.05em',
  },
  seriesBadgeClassic: {
    fontSize: 9,
    fontWeight: 800,
    padding: '3px 8px',
    borderRadius: 6,
    background: 'rgba(168,85,247,0.15)',
    color: '#a855f7',
    border: '1px solid rgba(168,85,247,0.3)',
    letterSpacing: '0.05em',
  },
  seriesName: {
    fontSize: 15,
    fontWeight: 700,
    color: '#f0f0f0',
    marginBottom: 2,
  },
  seriesYears: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'monospace',
  },
  seriesStats: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 0,
  },
  seriesStatBig: {
    fontSize: 16,
    fontWeight: 800,
    color: '#f59e0b',
    letterSpacing: '-0.02em',
  },
  seriesStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  seriesNote: {
    textAlign: 'center',
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
    marginTop: 24,
  },

  // ─── BUSCA INTELIGENTE ─────────────────────────────
  searchMockup: {
    maxWidth: 540,
    margin: '0 auto',
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 30px 80px -20px rgba(245,158,11,0.15)',
  },
  searchInput: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(245,158,11,0.3)',
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 12,
    boxShadow: '0 0 0 4px rgba(245,158,11,0.08)',
  },
  searchSuggestions: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  searchSuggestion: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  searchTips: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 1.6,
  },

  // ─── GLOSSÁRIO ─────────────────────────────────────
  glossaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  glossaryItem: {
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 16,
  },
  glossaryTerm: {
    fontSize: 14,
    fontWeight: 700,
    color: '#f59e0b',
    letterSpacing: '-0.01em',
    marginBottom: 6,
  },
  glossaryDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.55,
  },

  // ─── FAQ ───────────────────────────────────────────
  faqList: { display: 'flex', flexDirection: 'column', gap: 8 },
  faqItem: {
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
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
    maxWidth: 600,
    margin: '0 0 12px',
  },
  finalCtas: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
}
