import { CSSProperties } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'

// ─── SEO ──────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title:
    'Scan IA Pokémon TCG — Bynx | Aponte a câmera e identifique cartas em segundos',
  description:
    'A primeira IA brasileira que reconhece sua coleção Pokémon TCG em segundos. Aponta a câmera, identifica até 8 cartas de uma vez, e adiciona à coleção com preço em reais atualizado. Funciona com cartas em português, inglês e japonês. Powered by Claude Opus 4.5 — modelo de visão mais avançado do mercado.',
  keywords: [
    'scanner carta pokemon', 'identificar carta pokemon', 'app scan pokemon',
    'leitor de cartas pokemon', 'ia reconhecer carta pokemon', 'scan pokemon tcg brasil',
    'reconhecer pokemon foto', 'scanner pokemon tcg', 'app identificar pokemon tcg',
    'scan carta pokemon brasil', 'ler carta pokemon foto', 'cadastrar carta pokemon foto',
    'inteligencia artificial pokemon tcg', 'pokemon tcg ia brasil', 'scan multi cartas pokemon',
    'pokellector alternativa brasileira', 'reconhecer carta pokemon japones',
    'scan carta pokemon portugues', 'claude pokemon tcg', 'identificar valor carta pokemon foto',
  ],
  openGraph: {
    title: 'Scan IA Pokémon TCG — Bynx | Reconhece sua coleção em segundos',
    description:
      'Aponte a câmera. A IA identifica até 8 cartas Pokémon TCG por foto, em PT, EN ou JP, e adiciona à sua coleção com preço em reais. Powered by Claude Opus 4.5.',
    url: 'https://bynx.gg/scan-ia',
    siteName: 'Bynx',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: 'https://bynx.gg/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Scan IA Pokémon TCG — Bynx',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Scan IA Pokémon TCG — Bynx | Aponte e a IA identifica',
    description:
      'IA brasileira reconhece até 8 cartas Pokémon TCG por foto, em PT, EN ou JP, com preço em R$. Powered by Claude Opus 4.5.',
    images: ['https://bynx.gg/og-image.jpg'],
  },
  alternates: {
    canonical: 'https://bynx.gg/scan-ia',
  },
}

// ─── JSON-LD: WebPage + BreadcrumbList + FAQPage + SoftwareApplication ─────────
//
// 4 schemas pra rich results agressivos:
// - WebPage: contexto principal
// - BreadcrumbList: navegação hierárquica nos resultados
// - FAQPage: accordion direto na SERP
// - SoftwareApplication: lista os 3 pacotes como Offers (carrossel rico)

const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Scan IA Pokémon TCG — Bynx',
  description:
    'A primeira IA brasileira que reconhece cartas Pokémon TCG por foto. Multi-card, PT/EN/JP, preço em reais.',
  url: 'https://bynx.gg/scan-ia',
  inLanguage: 'pt-BR',
  isPartOf: {
    '@type': 'WebSite',
    name: 'Bynx',
    url: 'https://bynx.gg',
  },
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://bynx.gg' },
    { '@type': 'ListItem', position: 2, name: 'Scan IA Pokémon TCG', item: 'https://bynx.gg/scan-ia' },
  ],
}

const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Bynx Scan IA',
  applicationCategory: 'UtilitiesApplication',
  applicationSubCategory: 'Pokémon TCG Card Recognition',
  operatingSystem: 'Web, iOS, Android',
  inLanguage: 'pt-BR',
  description:
    'Reconhecimento de cartas Pokémon TCG por foto com IA. Multi-card detection, suporte a português, inglês e japonês, integração com banco de 22.861 cartas e preços em reais.',
  offers: [
    {
      '@type': 'Offer',
      name: 'Pacote Básico — 5 scans',
      price: '5.90',
      priceCurrency: 'BRL',
      description: '5 scans de IA. Ideal pra testar a tecnologia.',
    },
    {
      '@type': 'Offer',
      name: 'Pacote Popular — 15 scans',
      price: '14.90',
      priceCurrency: 'BRL',
      description: '15 scans de IA. Pacote mais escolhido pelo custo-benefício.',
    },
    {
      '@type': 'Offer',
      name: 'Pacote Colecionador — 40 scans',
      price: '34.90',
      priceCurrency: 'BRL',
      description: '40 scans de IA. Pra cadastrar coleções inteiras de uma vez.',
    },
  ],
  featureList: [
    'Multi-card por foto (até 8 cartas)',
    'Suporte a português, inglês, japonês',
    'Cross-reference com banco de 22.861 cartas',
    'Preço em reais atualizado',
    'Powered by Claude Opus 4.5',
    'Mobile-first',
  ],
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Como funciona o Scan IA do Bynx?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Você abre o app, aponta a câmera pra uma ou várias cartas Pokémon TCG, e a IA do Bynx (Claude Opus 4.5 da Anthropic) analisa a imagem em segundos. Cada carta é identificada com nome, número, set e raridade, e automaticamente cruzada com nossa Pokédex de 22.861 cartas pra trazer o preço em reais. Aí é só confirmar e a coleção atualiza sozinha.',
      },
    },
    {
      '@type': 'Question',
      name: 'Funciona com cartas em japonês ou inglês?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sim. O Scan IA do Bynx é multilíngue nativo — reconhece cartas em português (PT-BR), inglês (EN) e japonês (JP). É a única solução brasileira que faz isso. Útil pra quem tem cartas internacionais, importa do Japão ou compra eventos com lotes mistos.',
      },
    },
    {
      '@type': 'Question',
      name: 'Posso escanear várias cartas ao mesmo tempo?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sim. O scan do Bynx é multi-card — em uma única foto a IA pode identificar até 8 cartas dispostas lado a lado. É a forma mais rápida de cadastrar uma coleção inteira: organiza as cartas em grid, tira uma foto, e a IA processa todas de uma vez.',
      },
    },
    {
      '@type': 'Question',
      name: 'Qual o tempo médio de reconhecimento?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Menos de 8 segundos por foto, geralmente entre 3 e 6 segundos pra a IA identificar as cartas. Depois disso, o cross-reference com a Pokédex e a busca de imagens é instantânea. Em uma foto com 5 cartas, você adiciona todas à coleção em menos de 10 segundos no total.',
      },
    },
    {
      '@type': 'Question',
      name: 'Como funcionam os pacotes de scan?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Os scans são vendidos em pacotes pré-pagos: Básico (5 scans / R$ 5,90), Popular (15 scans / R$ 14,90) e Colecionador (40 scans / R$ 34,90). Você compra uma vez, os créditos não expiram, e usa quando quiser. Cada foto consome 1 crédito, independente de quantas cartas a IA identificar nela. Quanto maior o pacote, menor o custo por scan.',
      },
    },
    {
      '@type': 'Question',
      name: 'Os créditos de scan expiram?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Não. Os créditos comprados não têm validade — você usa quando quiser, sem prazo. Se comprar um pacote de 40 scans hoje e usar 1 por mês durante 3 anos, os 40 estão lá esperando. Sem assinatura recorrente, sem cobrança surpresa.',
      },
    },
    {
      '@type': 'Question',
      name: 'A IA reconhece variantes (Holo, Reverse, Foil)?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A IA identifica a carta (nome, número, set, raridade) e o Bynx mostra todas as variantes disponíveis daquela carta no banco — Normal, Holo, Reverse Holo, Foil, Promo. Você escolhe qual variante tem na sua coleção e o preço se ajusta automaticamente. Em alguns casos a IA também consegue inferir a variante pela aparência visual, mas a confirmação humana é sempre rápida.',
      },
    },
    {
      '@type': 'Question',
      name: 'Funciona offline?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Não. O scan precisa de internet pra enviar a imagem pra IA processar e pra buscar o preço atualizado. Mas é leve — funciona bem em 4G fora de casa. A foto é processada em servidores seguros e descartada após o scan; nada fica armazenado.',
      },
    },
    {
      '@type': 'Question',
      name: 'Posso testar antes de comprar pacote?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sim. Quem cria conta no Bynx ganha 7 dias de Pro grátis e nesse período pode testar todas as ferramentas, incluindo a Pokédex completa, gestão de coleção e marketplace. Os scans são à parte (pré-pagos), mas o pacote Básico de R$ 5,90 (5 scans) é uma forma barata de testar a tecnologia antes de investir num pacote maior.',
      },
    },
    {
      '@type': 'Question',
      name: 'Como o preço em reais é calculado?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Após a IA identificar a carta, o Bynx busca os preços em marketplaces brasileiros e exibe mínimo, médio e máximo por variante (Normal, Holo, Reverse, Foil, Promo). É a média real do mercado BR — nada de dólar convertido na correria. Você vê quanto sua carta vale hoje, em reais, sem precisar fazer conta.',
      },
    },
  ],
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
//
// PALETA: 100% B2C laranja-vermelho (consistente com pokedex-pokemon-tcg,
// colecionadores e separadores-pokemon). Sem accents tech (roxo/cyan).
//   ORANGE = '#f59e0b'
//   RED    = '#ef4444'
//   BRAND_GRADIENT = laranja → vermelho

const BG_DARK = '#080a0f'
const BG_CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const ORANGE = '#f59e0b'
const RED = '#ef4444'

const BRAND_GRADIENT = 'linear-gradient(135deg, #f59e0b, #ef4444)'

const S = {
  page: {
    fontFamily: "'DM Sans', 'Sora', system-ui, sans-serif",
    background: BG_DARK,
    color: '#f0f0f0',
    minHeight: '100vh',
    overflowX: 'hidden' as const,
  },
  container: { maxWidth: 1280, margin: '0 auto' },

  // ─── HERO ──────────────────────────────────────────────────────────────
  hero: {
    position: 'relative' as const,
    padding: '88px 32px 64px',
    background: `radial-gradient(ellipsis at 20% 0%, rgba(245,158,11,0.12) 0%, transparent 55%), radial-gradient(ellipsis at 80% 30%, rgba(239,68,68,0.10) 0%, transparent 50%), ${BG_DARK}`,
    overflow: 'hidden' as const,
  },
  heroInner: {
    maxWidth: 1280,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 64,
    alignItems: 'center',
  },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.30)',
    borderRadius: 100,
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 600,
    color: '#fcd34d',
    marginBottom: 20,
    letterSpacing: '0.02em',
  },
  heroTitle: {
    fontSize: 'clamp(34px, 4.5vw, 56px)',
    fontWeight: 900,
    letterSpacing: '-0.04em',
    lineHeight: 1.05,
    marginBottom: 20,
  },
  heroTitleAccent: {
    background: BRAND_GRADIENT,
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent' as const,
  },
  heroSubtitle: {
    fontSize: 17,
    lineHeight: 1.6,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 28,
    maxWidth: 540,
  },
  heroCtas: {
    display: 'flex',
    gap: 12,
    marginBottom: 24,
    flexWrap: 'wrap' as const,
  },
  ctaPrimary: {
    background: BRAND_GRADIENT,
    color: '#000',
    padding: '14px 28px',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 8px 24px rgba(245,158,11,0.25)',
  },
  ctaSecondary: {
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.85)',
    padding: '14px 24px',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    textDecoration: 'none',
    border: '1px solid rgba(255,255,255,0.15)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  },
  heroTrust: {
    display: 'flex',
    gap: 20,
    flexWrap: 'wrap' as const,
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
  },
  heroTrustItem: { display: 'flex', alignItems: 'center', gap: 6 },

  // ─── HERO MOCKUP (B2C laranja agora) ──────────────────────────────────
  heroMockup: {
    position: 'relative' as const,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
    border: '1px solid rgba(245,158,11,0.30)',
    borderRadius: 24,
    padding: 24,
    boxShadow: '0 30px 80px -30px rgba(245,158,11,0.40), 0 0 0 1px rgba(245,158,11,0.15) inset',
  },
  mockupHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottom: `1px solid ${BORDER}`,
  },
  mockupHeaderLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  mockupCameraBadge: {
    width: 28, height: 28, borderRadius: 8,
    background: 'rgba(245,158,11,0.15)',
    border: '1px solid rgba(245,158,11,0.40)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14,
  },
  mockupTitle: { fontSize: 13, fontWeight: 700, color: '#f0f0f0' },
  mockupStatus: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 11, fontWeight: 600,
    color: '#22c55e',
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.25)',
    borderRadius: 100,
    padding: '4px 10px',
  },
  mockupStatusDot: {
    width: 6, height: 6, borderRadius: '50%', background: '#22c55e',
    boxShadow: '0 0 8px #22c55e',
  },

  // Cards reconhecidas no mockup
  recognizedRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 14,
    alignItems: 'center',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.02)',
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
  },
  recognizedImg: {
    width: 44,
    height: 60,
    objectFit: 'contain' as const,
    borderRadius: 6,
    flexShrink: 0,
  },
  recognizedName: { fontSize: 13, fontWeight: 700, color: '#f0f0f0', marginBottom: 2 },
  recognizedMeta: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  recognizedPrice: {
    marginLeft: 'auto',
    fontSize: 14,
    fontWeight: 800,
    background: BRAND_GRADIENT,
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent' as const,
    flexShrink: 0,
  },
  recognizedConfidence: {
    fontSize: 9,
    fontWeight: 700,
    color: '#22c55e',
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.20)',
    borderRadius: 6,
    padding: '2px 6px',
    letterSpacing: '0.05em',
  },
  mockupFooter: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: `1px solid ${BORDER}`,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center' as const,
  },

  // ─── STATS (B2C laranja agora) ─────────────────────────────────────────
  statsSection: {
    padding: '56px 32px',
    borderTop: `1px solid ${BORDER}`,
    borderBottom: `1px solid ${BORDER}`,
    background: 'linear-gradient(180deg, rgba(245,158,11,0.03), transparent)',
  },
  statsInner: {
    maxWidth: 1280,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 24,
  },
  statBox: { textAlign: 'center' as const },
  statNumber: {
    fontSize: 38,
    fontWeight: 900,
    letterSpacing: '-0.03em',
    background: BRAND_GRADIENT,
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent' as const,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: 500,
  },

  // ─── SECTIONS ──────────────────────────────────────────────────────────
  section: { padding: '88px 32px' },
  sectionDark: {
    padding: '88px 32px',
    background: 'rgba(255,255,255,0.02)',
    borderTop: `1px solid ${BORDER}`,
    borderBottom: `1px solid ${BORDER}`,
  },

  // ─── SECTION HEADER (centralizado, igual pokedex-pokemon-tcg) ──────────
  sectionHeader: {
    textAlign: 'center' as const,
    marginBottom: 56,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 700,
    color: ORANGE,
    letterSpacing: '0.10em',
    textTransform: 'uppercase' as const,
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
    maxWidth: 720,
    margin: 0,
  },

  // ─── DEMO STEPS (B2C laranja agora) ───────────────────────────────────
  stepsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 24,
  },
  stepCard: {
    background: BG_CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    padding: 28,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  stepNumber: {
    position: 'absolute' as const,
    top: 18,
    right: 18,
    fontSize: 64,
    fontWeight: 900,
    letterSpacing: '-0.05em',
    background: BRAND_GRADIENT,
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent' as const,
    opacity: 0.20,
    lineHeight: 1,
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    marginBottom: 18,
  },
  stepTitle: { fontSize: 18, fontWeight: 700, marginBottom: 8 },
  stepDesc: { fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 },
  stepFooter: {
    marginTop: 16,
    paddingTop: 14,
    borderTop: `1px solid ${BORDER}`,
    fontSize: 12,
    color: ORANGE,
    fontWeight: 600,
  },

  // ─── TECH CARDS (B2C laranja agora) ───────────────────────────────────
  techGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 20,
  },
  techCard: {
    background: BG_CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    padding: 24,
  },
  techCardHighlight: {
    background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.05))',
    border: '1px solid rgba(245,158,11,0.30)',
  },
  techIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.30)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    marginBottom: 16,
  },
  techTitle: { fontSize: 16, fontWeight: 700, marginBottom: 8 },
  techDesc: { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 },

  // ─── PERSONAS ──────────────────────────────────────────────────────────
  personasGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 20,
  },
  personaCard: {
    background: BG_CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    padding: 28,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  personaEmoji: { fontSize: 32, marginBottom: 12 },
  personaTag: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    color: ORANGE,
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.25)',
    borderRadius: 6,
    padding: '3px 8px',
    marginBottom: 12,
    letterSpacing: '0.05em',
  },
  personaTitle: { fontSize: 18, fontWeight: 700, marginBottom: 8 },
  personaDesc: { fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 16 },
  personaQuote: {
    fontSize: 13,
    fontStyle: 'italic' as const,
    color: 'rgba(255,255,255,0.45)',
    paddingLeft: 14,
    borderLeft: `2px solid ${ORANGE}`,
    lineHeight: 1.6,
  },

  // ─── COMPARATIVO ──────────────────────────────────────────────────────
  compTableWrap: {
    background: BG_CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  compTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 14,
  },
  compHead: {
    background: 'rgba(255,255,255,0.03)',
    borderBottom: `1px solid ${BORDER}`,
  },
  compHeadCell: {
    padding: '16px 12px',
    textAlign: 'left' as const,
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  compHeadBynx: {
    padding: '16px 12px',
    textAlign: 'left' as const,
    fontSize: 13,
    fontWeight: 800,
    color: ORANGE,
    background: 'rgba(245,158,11,0.06)',
    letterSpacing: '0.02em',
  },
  compRow: { borderBottom: `1px solid ${BORDER}` },
  compCellLabel: {
    padding: '14px 12px',
    fontSize: 14,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.85)',
  },
  compCell: {
    padding: '14px 12px',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  compCellBynx: {
    padding: '14px 12px',
    fontSize: 13,
    color: '#22c55e',
    fontWeight: 600,
    background: 'rgba(245,158,11,0.04)',
  },
  compCheck: { color: '#22c55e', fontWeight: 700 },
  compX: { color: 'rgba(255,255,255,0.25)', fontWeight: 700 },

  // ─── PACOTES ──────────────────────────────────────────────────────────
  pkgGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 24,
    marginTop: 8,
  },
  pkgCard: {
    background: BG_CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: 20,
    padding: 32,
    position: 'relative' as const,
    textAlign: 'center' as const,
  },
  pkgCardPopular: {
    background: 'linear-gradient(180deg, rgba(245,158,11,0.06), rgba(239,68,68,0.04))',
    border: '2px solid rgba(245,158,11,0.50)',
    transform: 'scale(1.03)',
    boxShadow: '0 30px 60px -30px rgba(245,158,11,0.4)',
  },
  pkgBadge: {
    position: 'absolute' as const,
    top: -14,
    left: '50%',
    transform: 'translateX(-50%)',
    background: BRAND_GRADIENT,
    color: '#000',
    fontSize: 11,
    fontWeight: 800,
    padding: '5px 14px',
    borderRadius: 100,
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap' as const,
  },
  pkgName: {
    fontSize: 14,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.10em',
    marginBottom: 4,
  },
  pkgScans: {
    fontSize: 56,
    fontWeight: 900,
    letterSpacing: '-0.04em',
    lineHeight: 1,
    marginBottom: 4,
  },
  pkgScansLabel: { fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 20 },
  pkgPrice: {
    fontSize: 32,
    fontWeight: 800,
    background: BRAND_GRADIENT,
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent' as const,
    marginBottom: 4,
  },
  pkgPricePer: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 24,
  },
  pkgFeatures: {
    listStyle: 'none' as const,
    padding: 0,
    margin: '0 0 24px',
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.9,
    textAlign: 'left' as const,
  },
  pkgFeatureLi: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  pkgCheck: { color: '#22c55e', fontWeight: 700, flexShrink: 0 },
  pkgCta: {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#f0f0f0',
    padding: '13px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'block',
    cursor: 'pointer',
  },
  pkgCtaPopular: {
    background: BRAND_GRADIENT,
    color: '#000',
    border: 'none',
  },

  // ─── GARANTIAS ────────────────────────────────────────────────────────
  guaranteesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
  },
  guaranteeCard: {
    background: BG_CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: 14,
    padding: 24,
    textAlign: 'center' as const,
  },
  guaranteeEmoji: { fontSize: 32, marginBottom: 12 },
  guaranteeTitle: { fontSize: 14, fontWeight: 700, marginBottom: 6 },
  guaranteeDesc: { fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 },

  // ─── FAQ ──────────────────────────────────────────────────────────────
  faqWrap: {
    maxWidth: 800,
    margin: '0 auto',
  },
  faqItem: {
    background: BG_CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden' as const,
  },
  faqSummary: {
    padding: '18px 22px',
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 600,
    color: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    listStyle: 'none' as const,
    userSelect: 'none' as const,
  },
  faqAnswer: {
    padding: '0 22px 22px',
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.7,
  },

  // ─── CTA FINAL (B2C laranja agora) ────────────────────────────────────
  finalSection: {
    padding: '120px 32px',
    background: `radial-gradient(ellipsis at center, rgba(245,158,11,0.10) 0%, transparent 60%), ${BG_DARK}`,
    textAlign: 'center' as const,
    borderTop: `1px solid ${BORDER}`,
  },
  finalInner: { maxWidth: 720, margin: '0 auto' },
  finalTitle: {
    fontSize: 'clamp(32px, 4.2vw, 48px)',
    fontWeight: 900,
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
    marginBottom: 16,
  },
  finalSubtitle: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.6,
    marginBottom: 32,
  },
  finalCtas: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
  },
} as const

// ─── SectionHeader (componente centralizado, igual outras landings) ──────────

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: React.ReactNode
  subtitle?: string
}) {
  return (
    <div style={S.sectionHeader}>
      <span style={S.eyebrow}>{eyebrow}</span>
      <h2 style={S.sectionTitle}>{title}</h2>
      {subtitle && <p style={S.sectionSubtitle}>{subtitle}</p>}
    </div>
  )
}

// ─── Component principal ─────────────────────────────────────────────────────

export default function ScanIaLanding() {
  return (
    <div style={S.page}>
      <PublicHeader />

      {/* JSON-LD schemas (4 schemas pra rich results) */}
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* CSS responsivo */}
      <style>{`
        @media (max-width: 1024px) {
          .scan-hero-inner   { grid-template-columns: 1fr !important; gap: 40px !important; }
          .scan-stats-grid   { grid-template-columns: repeat(4, 1fr) !important; gap: 16px !important; }
          .scan-tech-grid    { grid-template-columns: repeat(2, 1fr) !important; }
          .scan-steps-grid   { grid-template-columns: 1fr !important; }
          .scan-personas-grid{ grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .scan-hero         { padding: 56px 20px 40px !important; }
          .scan-stats-grid   { grid-template-columns: repeat(2, 1fr) !important; gap: 24px !important; }
          .scan-tech-grid    { grid-template-columns: 1fr !important; }
          .scan-pkg-grid     { grid-template-columns: 1fr !important; }
          .scan-pkg-popular  { transform: none !important; }
          .scan-guarantees-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .scan-section      { padding: 56px 20px !important; }
          .scan-stats        { padding: 40px 20px !important; }
          .scan-final        { padding: 80px 20px !important; }
          .scan-comp-table-wrap { overflow-x: auto !important; }
          .scan-comp-table   { min-width: 600px !important; }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 1. HERO (assimétrico — copy esquerda, mockup direita)                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="scan-hero" style={S.hero}>
        <div className="scan-hero-inner" style={S.heroInner}>
          {/* Esquerda: copy */}
          <div>
            <span style={S.heroBadge}>
              <span>🤖</span> Powered by Claude Opus 4.5 · Anthropic
            </span>

            <h1 style={S.heroTitle}>
              Aponte. A IA reconhece.{' '}
              <span style={S.heroTitleAccent}>A coleção atualiza.</span>
            </h1>

            <p style={S.heroSubtitle}>
              A primeira IA brasileira que identifica suas cartas Pokémon TCG por foto.{' '}
              <strong style={{ color: '#f0f0f0' }}>Multi-card</strong>: até 8 cartas em uma só imagem.{' '}
              <strong style={{ color: '#f0f0f0' }}>Multilíngue</strong>: PT, EN, JP. E o preço em reais aparece já,{' '}
              cruzado com nossa Pokédex de 22.861 cartas.
            </p>

            <div style={S.heroCtas}>
              <Link href="?auth=signup&next=/minha-colecao" style={S.ctaPrimary}>
                Criar conta grátis →
              </Link>
              <Link href="#pacotes" style={S.ctaSecondary}>
                Ver pacotes e preços
              </Link>
            </div>

            <div style={S.heroTrust}>
              <span style={S.heroTrustItem}>
                <span style={{ color: ORANGE, fontWeight: 700 }}>✓</span> Multi-card por foto
              </span>
              <span style={S.heroTrustItem}>
                <span style={{ color: ORANGE, fontWeight: 700 }}>✓</span> PT · EN · JP
              </span>
              <span style={S.heroTrustItem}>
                <span style={{ color: ORANGE, fontWeight: 700 }}>✓</span> Preço R$ instantâneo
              </span>
            </div>
          </div>

          {/* Direita: mockup interativo */}
          <div style={S.heroMockup}>
            <div style={S.mockupHeader}>
              <div style={S.mockupHeaderLeft}>
                <div style={S.mockupCameraBadge}>📷</div>
                <span style={S.mockupTitle}>Scan IA</span>
              </div>
              <div style={S.mockupStatus}>
                <span style={S.mockupStatusDot} />
                Processado em 2,4s
              </div>
            </div>

            <div style={S.recognizedRow}>
              <img
                src="https://images.pokemontcg.io/sv8/199.png"
                alt="Charizard ex Surging Sparks"
                style={S.recognizedImg}
                loading="lazy"
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.recognizedName}>Charizard ex</div>
                <div style={S.recognizedMeta}>199/191 · Surging Sparks · Special Illustration</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={S.recognizedConfidence}>98%</span>
                <span style={S.recognizedPrice}>R$ 850</span>
              </div>
            </div>

            <div style={S.recognizedRow}>
              <img
                src="https://images.pokemontcg.io/sv8pt5/161.png"
                alt="Umbreon ex Prismatic Evolutions"
                style={S.recognizedImg}
                loading="lazy"
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.recognizedName}>Umbreon ex</div>
                <div style={S.recognizedMeta}>161/131 · Prismatic Evolutions · Special Illustration</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={S.recognizedConfidence}>99%</span>
                <span style={S.recognizedPrice}>R$ 4.570</span>
              </div>
            </div>

            <div style={S.recognizedRow}>
              <img
                src="https://images.pokemontcg.io/sv4pt5/232.png"
                alt="Mew ex Paldean Fates"
                style={S.recognizedImg}
                loading="lazy"
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.recognizedName}>Mew ex</div>
                <div style={S.recognizedMeta}>232/091 · Paldean Fates · Special Illustration</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={S.recognizedConfidence}>97%</span>
                <span style={S.recognizedPrice}>R$ 2.144</span>
              </div>
            </div>

            <div style={S.mockupFooter}>
              3 cartas reconhecidas · 1 foto · 1 crédito de scan
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 2. STATS                                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="scan-stats" style={S.statsSection}>
        <div className="scan-stats-grid" style={S.statsInner}>
          <div style={S.statBox}>
            <div style={S.statNumber}>22.861</div>
            <div style={S.statLabel}>Cartas reconhecíveis</div>
          </div>
          <div style={S.statBox}>
            <div style={S.statNumber}>8+</div>
            <div style={S.statLabel}>Cartas por foto</div>
          </div>
          <div style={S.statBox}>
            <div style={S.statNumber}>3</div>
            <div style={S.statLabel}>Idiomas (PT, EN, JP)</div>
          </div>
          <div style={S.statBox}>
            <div style={S.statNumber}>{'<8s'}</div>
            <div style={S.statLabel}>Tempo médio</div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 3. DEMO 3 PASSOS                                                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="scan-section" style={S.section}>
        <div style={S.container}>
          <SectionHeader
            eyebrow="Como funciona"
            title={<>Três passos. <span style={S.heroTitleAccent}>Sem digitar uma palavra.</span></>}
            subtitle="Você não precisa saber o nome em japonês. Não precisa decorar o número da carta. Não precisa procurar set. A IA faz tudo."
          />

          <div className="scan-steps-grid" style={S.stepsGrid}>
            <div style={S.stepCard}>
              <span style={S.stepNumber}>01</span>
              <div style={S.stepIcon}>📸</div>
              <div style={S.stepTitle}>Aponte a câmera</div>
              <p style={S.stepDesc}>
                Pode ser uma carta solta, uma fileira, ou até uma página inteira de classificador.
                Funciona com a câmera traseira do celular ou foto da galeria.
              </p>
              <div style={S.stepFooter}>Suporta luz baixa e ângulos diagonais</div>
            </div>

            <div style={S.stepCard}>
              <span style={S.stepNumber}>02</span>
              <div style={S.stepIcon}>🤖</div>
              <div style={S.stepTitle}>A IA processa</div>
              <p style={S.stepDesc}>
                A imagem é enviada pra Claude Opus 4.5 (Anthropic) — modelo de visão mais avançado
                do mercado. Identifica nome, número, set, raridade e idioma de cada carta.
              </p>
              <div style={S.stepFooter}>Cross-reference com banco de 22.861 cartas</div>
            </div>

            <div style={S.stepCard}>
              <span style={S.stepNumber}>03</span>
              <div style={S.stepIcon}>✨</div>
              <div style={S.stepTitle}>Confirma e pronto</div>
              <p style={S.stepDesc}>
                Cartas reconhecidas aparecem com imagem oficial, set, número e preço médio em reais.
                Você só confirma a variante (Normal, Holo, Reverse) e clica em adicionar.
              </p>
              <div style={S.stepFooter}>Coleção, patrimônio e marketplace atualizam sozinhos</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 4. POR DENTRO DA TECNOLOGIA                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="scan-section" style={S.sectionDark}>
        <div style={S.container}>
          <SectionHeader
            eyebrow="Por dentro da tecnologia"
            title={<>A IA mais avançada do mercado, <span style={S.heroTitleAccent}>treinada pra TCG brasileiro.</span></>}
            subtitle="Não é um algoritmo qualquer. É o modelo de visão de ponta da Anthropic, integrado com a Pokédex Bynx e cruzado com preços de marketplaces brasileiros em tempo real."
          />

          <div className="scan-tech-grid" style={S.techGrid}>
            <div style={{ ...S.techCard, ...S.techCardHighlight }}>
              <div style={S.techIcon}>🧠</div>
              <div style={S.techTitle}>Claude Opus 4.5</div>
              <p style={S.techDesc}>
                Modelo de visão de última geração da Anthropic. State-of-the-art em reconhecimento
                visual estruturado — identifica detalhes finos que outros modelos perdem.
              </p>
            </div>

            <div style={S.techCard}>
              <div style={S.techIcon}>📷</div>
              <div style={S.techTitle}>Multi-card detection</div>
              <p style={S.techDesc}>
                Uma foto, várias cartas. A IA detecta cada carta separadamente em layouts complexos
                — fileiras, grids, classificadores cheios. Já testamos com 8+ cartas em 1 foto.
              </p>
            </div>

            <div style={S.techCard}>
              <div style={S.techIcon}>🌎</div>
              <div style={S.techTitle}>Multilíngue nativo</div>
              <p style={S.techDesc}>
                Reconhece cartas em português, inglês e japonês. Útil pra coleções mistas,
                imports do Japão, lotes de evento. É a única solução brasileira que faz isso.
              </p>
            </div>

            <div style={S.techCard}>
              <div style={S.techIcon}>🔗</div>
              <div style={S.techTitle}>Cross-reference automático</div>
              <p style={S.techDesc}>
                Após reconhecer, a carta é automaticamente cruzada com a Pokédex Bynx (22.861 cartas)
                pra trazer imagem oficial, raridade, set e variantes disponíveis.
              </p>
            </div>

            <div style={S.techCard}>
              <div style={S.techIcon}>💰</div>
              <div style={S.techTitle}>Preço R$ em tempo real</div>
              <p style={S.techDesc}>
                Mínimo, médio e máximo coletados de marketplaces brasileiros. Nada de dólar
                convertido na correria — você vê quanto a carta vale aqui, hoje, em reais.
              </p>
            </div>

            <div style={S.techCard}>
              <div style={S.techIcon}>📱</div>
              <div style={S.techTitle}>Mobile-first</div>
              <p style={S.techDesc}>
                Otimizado pra câmera de celular: foco rápido, correção de perspectiva, tolerância
                a sombra e luz baixa. Funciona até em 4G fora de casa.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 5. CASOS DE USO (3 PERSONAS)                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="scan-section" style={S.section}>
        <div style={S.container}>
          <SectionHeader
            eyebrow="Quem usa"
            title={<>Pra quem perdeu paciência <span style={S.heroTitleAccent}>com cadastro manual.</span></>}
            subtitle="Três tipos de colecionador que economizam horas todo mês usando o Scan IA."
          />

          <div className="scan-personas-grid" style={S.personasGrid}>
            <div style={S.personaCard}>
              <div style={S.personaEmoji}>📦</div>
              <span style={S.personaTag}>BULK</span>
              <div style={S.personaTitle}>O Cadastrador em Massa</div>
              <p style={S.personaDesc}>
                Tem 200+ cartas pra organizar. Em vez de digitar uma a uma, abre o classificador,
                tira foto da página inteira, e a IA identifica 9 cartas de uma vez.
              </p>
              <div style={S.personaQuote}>
                "Cadastrei 50 cartas em 5 minutos. Antes levava uma tarde inteira."
              </div>
            </div>

            <div style={S.personaCard}>
              <div style={S.personaEmoji}>💼</div>
              <span style={S.personaTag}>TRADER</span>
              <div style={S.personaTitle}>O Negociador Ágil</div>
              <p style={S.personaDesc}>
                Vai em eventos, vê um lote, quer saber valor antes de fazer proposta. Aponta a câmera,
                a IA identifica e mostra preço médio em R$. Decisão em segundos, não minutos.
              </p>
              <div style={S.personaQuote}>
                "Antes de fechar negócio, eu já sei se tô ganhando ou perdendo."
              </div>
            </div>

            <div style={S.personaCard}>
              <div style={S.personaEmoji}>🌱</div>
              <span style={S.personaTag}>INICIANTE</span>
              <div style={S.personaTitle}>O Curioso Recém-Chegado</div>
              <p style={S.personaDesc}>
                Acabou de receber cartas de presente, ganhou pacote vintage do tio, ou comprou
                lote em japonês. Não sabe o nome em outro idioma. A IA descobre por ele.
              </p>
              <div style={S.personaQuote}>
                "Recebi uma carta em japonês. Em 3 segundos descobri que valia R$ 800."
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 6. COMPARATIVO                                                        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="scan-section" style={S.sectionDark}>
        <div style={S.container}>
          <SectionHeader
            eyebrow="Comparativo"
            title={<>Por que ninguém mais <span style={S.heroTitleAccent}>chega perto.</span></>}
            subtitle="Outras soluções existem, mas nenhuma combina IA de ponta + multilíngue + preço R$ + mobile-first em uma plataforma brasileira."
          />

          <div className="scan-comp-table-wrap" style={S.compTableWrap}>
            <table className="scan-comp-table" style={S.compTable}>
              <thead style={S.compHead}>
                <tr>
                  <th style={S.compHeadCell}>Recurso</th>
                  <th style={S.compHeadBynx}>Bynx Scan IA</th>
                  <th style={S.compHeadCell}>Digitação manual</th>
                  <th style={S.compHeadCell}>Pokellector</th>
                  <th style={S.compHeadCell}>TCGPlayer</th>
                </tr>
              </thead>
              <tbody>
                <tr style={S.compRow}>
                  <td style={S.compCellLabel}>Multi-card por foto</td>
                  <td style={S.compCellBynx}><span style={S.compCheck}>✓</span> até 8 cartas</td>
                  <td style={S.compCell}><span style={S.compX}>—</span></td>
                  <td style={S.compCell}><span style={S.compX}>✕</span></td>
                  <td style={S.compCell}><span style={S.compX}>✕</span></td>
                </tr>
                <tr style={S.compRow}>
                  <td style={S.compCellLabel}>Cartas em português</td>
                  <td style={S.compCellBynx}><span style={S.compCheck}>✓</span></td>
                  <td style={S.compCell}><span style={S.compCheck}>✓</span></td>
                  <td style={S.compCell}><span style={S.compX}>✕</span></td>
                  <td style={S.compCell}><span style={S.compX}>✕</span></td>
                </tr>
                <tr style={S.compRow}>
                  <td style={S.compCellLabel}>Cartas em japonês</td>
                  <td style={S.compCellBynx}><span style={S.compCheck}>✓</span></td>
                  <td style={S.compCell}><span style={S.compX}>—</span></td>
                  <td style={S.compCell}><span style={S.compX}>✕</span></td>
                  <td style={S.compCell}>parcial</td>
                </tr>
                <tr style={S.compRow}>
                  <td style={S.compCellLabel}>Preço em reais (R$)</td>
                  <td style={S.compCellBynx}><span style={S.compCheck}>✓</span></td>
                  <td style={S.compCell}><span style={S.compX}>—</span></td>
                  <td style={S.compCell}><span style={S.compX}>✕</span> (USD)</td>
                  <td style={S.compCell}><span style={S.compX}>✕</span> (USD)</td>
                </tr>
                <tr style={S.compRow}>
                  <td style={S.compCellLabel}>Modelo IA</td>
                  <td style={S.compCellBynx}>Claude Opus 4.5</td>
                  <td style={S.compCell}>—</td>
                  <td style={S.compCell}>proprietário</td>
                  <td style={S.compCell}>—</td>
                </tr>
                <tr style={S.compRow}>
                  <td style={S.compCellLabel}>Tempo médio</td>
                  <td style={S.compCellBynx}>{'< 8s'}</td>
                  <td style={S.compCell}>~30s/carta</td>
                  <td style={S.compCell}>~10s/carta</td>
                  <td style={S.compCell}>—</td>
                </tr>
                <tr style={S.compRow}>
                  <td style={S.compCellLabel}>Mobile-first</td>
                  <td style={S.compCellBynx}><span style={S.compCheck}>✓</span></td>
                  <td style={S.compCell}><span style={S.compCheck}>✓</span></td>
                  <td style={S.compCell}><span style={S.compCheck}>✓</span></td>
                  <td style={S.compCell}>parcial</td>
                </tr>
                <tr style={S.compRow}>
                  <td style={S.compCellLabel}>Integra com coleção</td>
                  <td style={S.compCellBynx}><span style={S.compCheck}>✓</span></td>
                  <td style={S.compCell}>depende</td>
                  <td style={S.compCell}><span style={S.compCheck}>✓</span></td>
                  <td style={S.compCell}><span style={S.compCheck}>✓</span></td>
                </tr>
                <tr>
                  <td style={S.compCellLabel}>Suporte BR</td>
                  <td style={S.compCellBynx}><span style={S.compCheck}>✓</span></td>
                  <td style={S.compCell}>—</td>
                  <td style={S.compCell}><span style={S.compX}>✕</span></td>
                  <td style={S.compCell}><span style={S.compX}>✕</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 7. PACOTES DE PREÇOS                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section id="pacotes" className="scan-section" style={S.section}>
        <div style={S.container}>
          <SectionHeader
            eyebrow="Pacotes"
            title={<>Pague pelo que usar. <span style={S.heroTitleAccent}>Sem assinatura.</span></>}
            subtitle="Os créditos não expiram. Compra uma vez, usa quando quiser. Cada foto consome 1 crédito — independente de quantas cartas a IA identificar nela."
          />

          <div className="scan-pkg-grid" style={S.pkgGrid}>
            {/* Básico */}
            <div style={S.pkgCard}>
              <div style={S.pkgName}>Básico</div>
              <div style={S.pkgScans}>5</div>
              <div style={S.pkgScansLabel}>scans de IA</div>
              <div style={S.pkgPrice}>R$ 5,90</div>
              <div style={S.pkgPricePer}>R$ 1,18 por scan</div>
              <ul style={S.pkgFeatures}>
                <li style={S.pkgFeatureLi}><span style={S.pkgCheck}>✓</span> 5 fotos com IA</li>
                <li style={S.pkgFeatureLi}><span style={S.pkgCheck}>✓</span> Multi-card por foto</li>
                <li style={S.pkgFeatureLi}><span style={S.pkgCheck}>✓</span> Créditos não expiram</li>
                <li style={S.pkgFeatureLi}><span style={S.pkgCheck}>✓</span> Cartas em PT, EN, JP</li>
                <li style={S.pkgFeatureLi}><span style={S.pkgCheck}>✓</span> Preço R$ instantâneo</li>
              </ul>
              <Link href="?auth=signup&next=/minha-colecao" style={S.pkgCta}>
                Começar com Básico
              </Link>
            </div>

            {/* Popular — destaque */}
            <div className="scan-pkg-popular" style={{ ...S.pkgCard, ...S.pkgCardPopular }}>
              <span style={S.pkgBadge}>⭐ MAIS ESCOLHIDO</span>
              <div style={S.pkgName}>Popular</div>
              <div style={S.pkgScans}>15</div>
              <div style={S.pkgScansLabel}>scans de IA</div>
              <div style={S.pkgPrice}>R$ 14,90</div>
              <div style={S.pkgPricePer}>R$ 0,99 por scan · 16% off</div>
              <ul style={S.pkgFeatures}>
                <li style={S.pkgFeatureLi}><span style={S.pkgCheck}>✓</span> 15 fotos com IA</li>
                <li style={S.pkgFeatureLi}><span style={S.pkgCheck}>✓</span> Tudo do Básico</li>
                <li style={S.pkgFeatureLi}><span style={S.pkgCheck}>✓</span> Custo por scan menor</li>
                <li style={S.pkgFeatureLi}><span style={S.pkgCheck}>✓</span> Ideal pra coleção média</li>
                <li style={S.pkgFeatureLi}><span style={S.pkgCheck}>✓</span> Suporte prioritário</li>
              </ul>
              <Link href="?auth=signup&next=/minha-colecao" style={{ ...S.pkgCta, ...S.pkgCtaPopular }}>
                Começar com Popular
              </Link>
            </div>

            {/* Colecionador */}
            <div style={S.pkgCard}>
              <div style={S.pkgName}>Colecionador</div>
              <div style={S.pkgScans}>40</div>
              <div style={S.pkgScansLabel}>scans de IA</div>
              <div style={S.pkgPrice}>R$ 34,90</div>
              <div style={S.pkgPricePer}>R$ 0,87 por scan · 26% off</div>
              <ul style={S.pkgFeatures}>
                <li style={S.pkgFeatureLi}><span style={S.pkgCheck}>✓</span> 40 fotos com IA</li>
                <li style={S.pkgFeatureLi}><span style={S.pkgCheck}>✓</span> Tudo do Popular</li>
                <li style={S.pkgFeatureLi}><span style={S.pkgCheck}>✓</span> Melhor custo por scan</li>
                <li style={S.pkgFeatureLi}><span style={S.pkgCheck}>✓</span> Ideal pra cadastrar coleções inteiras</li>
                <li style={S.pkgFeatureLi}><span style={S.pkgCheck}>✓</span> Reembolso em 7 dias</li>
              </ul>
              <Link href="?auth=signup&next=/minha-colecao" style={S.pkgCta}>
                Começar com Colecionador
              </Link>
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 24 }}>
            Pagamento seguro via Stripe. PIX, cartão e boleto. Os créditos aparecem na sua conta na hora.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 8. GARANTIAS                                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="scan-section" style={S.sectionDark}>
        <div style={S.container}>
          <SectionHeader
            eyebrow="Garantias"
            title={<>Sem pegadinhas. <span style={S.heroTitleAccent}>Sem letra miúda.</span></>}
          />

          <div className="scan-guarantees-grid" style={S.guaranteesGrid}>
            <div style={S.guaranteeCard}>
              <div style={S.guaranteeEmoji}>♾️</div>
              <div style={S.guaranteeTitle}>Créditos não expiram</div>
              <p style={S.guaranteeDesc}>
                Compra uma vez. Usa quando quiser. Sem prazo, sem renovação automática.
              </p>
            </div>
            <div style={S.guaranteeCard}>
              <div style={S.guaranteeEmoji}>💸</div>
              <div style={S.guaranteeTitle}>Reembolso em 7 dias</div>
              <p style={S.guaranteeDesc}>
                Não gostou? Devolvemos o dinheiro em até 7 dias, sem perguntas.
              </p>
            </div>
            <div style={S.guaranteeCard}>
              <div style={S.guaranteeEmoji}>🇧🇷</div>
              <div style={S.guaranteeTitle}>Suporte em português</div>
              <p style={S.guaranteeDesc}>
                Time brasileiro, atendimento humano, resposta no mesmo dia.
              </p>
            </div>
            <div style={S.guaranteeCard}>
              <div style={S.guaranteeEmoji}>🔒</div>
              <div style={S.guaranteeTitle}>Pagamento seguro</div>
              <p style={S.guaranteeDesc}>
                Processado por Stripe. PIX, cartão e boleto. Nada armazenado.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 9. FAQ                                                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="scan-section" style={S.section}>
        <div style={S.container}>
          <SectionHeader
            eyebrow="FAQ"
            title={<>Perguntas que <span style={S.heroTitleAccent}>todo mundo faz.</span></>}
          />

          <div style={S.faqWrap}>
            {[
              {
                q: 'Como funciona o Scan IA do Bynx?',
                a: 'Você abre o app, aponta a câmera pra uma ou várias cartas Pokémon TCG, e a IA do Bynx (Claude Opus 4.5 da Anthropic) analisa a imagem em segundos. Cada carta é identificada com nome, número, set e raridade, e automaticamente cruzada com nossa Pokédex de 22.861 cartas pra trazer o preço em reais. Aí é só confirmar e a coleção atualiza sozinha.',
              },
              {
                q: 'Funciona com cartas em japonês ou inglês?',
                a: 'Sim. O Scan IA do Bynx é multilíngue nativo — reconhece cartas em português (PT-BR), inglês (EN) e japonês (JP). É a única solução brasileira que faz isso. Útil pra quem tem cartas internacionais, importa do Japão ou compra eventos com lotes mistos.',
              },
              {
                q: 'Posso escanear várias cartas ao mesmo tempo?',
                a: 'Sim. O scan do Bynx é multi-card — em uma única foto a IA pode identificar até 8 cartas dispostas lado a lado. É a forma mais rápida de cadastrar uma coleção inteira: organiza as cartas em grid, tira uma foto, e a IA processa todas de uma vez.',
              },
              {
                q: 'Qual o tempo médio de reconhecimento?',
                a: 'Menos de 8 segundos por foto, geralmente entre 3 e 6 segundos pra a IA identificar as cartas. Depois disso, o cross-reference com a Pokédex e a busca de imagens é instantânea. Em uma foto com 5 cartas, você adiciona todas à coleção em menos de 10 segundos no total.',
              },
              {
                q: 'Como funcionam os pacotes de scan?',
                a: 'Os scans são vendidos em pacotes pré-pagos: Básico (5 scans / R$ 5,90), Popular (15 scans / R$ 14,90) e Colecionador (40 scans / R$ 34,90). Você compra uma vez, os créditos não expiram, e usa quando quiser. Cada foto consome 1 crédito, independente de quantas cartas a IA identificar nela. Quanto maior o pacote, menor o custo por scan.',
              },
              {
                q: 'Os créditos de scan expiram?',
                a: 'Não. Os créditos comprados não têm validade — você usa quando quiser, sem prazo. Se comprar um pacote de 40 scans hoje e usar 1 por mês durante 3 anos, os 40 estão lá esperando. Sem assinatura recorrente, sem cobrança surpresa.',
              },
              {
                q: 'A IA reconhece variantes (Holo, Reverse, Foil)?',
                a: 'A IA identifica a carta (nome, número, set, raridade) e o Bynx mostra todas as variantes disponíveis daquela carta no banco — Normal, Holo, Reverse Holo, Foil, Promo. Você escolhe qual variante tem na sua coleção e o preço se ajusta automaticamente. Em alguns casos a IA também consegue inferir a variante pela aparência visual, mas a confirmação humana é sempre rápida.',
              },
              {
                q: 'Funciona offline?',
                a: 'Não. O scan precisa de internet pra enviar a imagem pra IA processar e pra buscar o preço atualizado. Mas é leve — funciona bem em 4G fora de casa. A foto é processada em servidores seguros e descartada após o scan; nada fica armazenado.',
              },
              {
                q: 'Posso testar antes de comprar pacote?',
                a: 'Sim. Quem cria conta no Bynx ganha 7 dias de Pro grátis e nesse período pode testar todas as ferramentas, incluindo a Pokédex completa, gestão de coleção e marketplace. Os scans são à parte (pré-pagos), mas o pacote Básico de R$ 5,90 (5 scans) é uma forma barata de testar a tecnologia antes de investir num pacote maior.',
              },
              {
                q: 'Como o preço em reais é calculado?',
                a: 'Após a IA identificar a carta, o Bynx busca os preços em marketplaces brasileiros e exibe mínimo, médio e máximo por variante (Normal, Holo, Reverse, Foil, Promo). É a média real do mercado BR — nada de dólar convertido na correria. Você vê quanto sua carta vale hoje, em reais, sem precisar fazer conta.',
              },
            ].map((item, idx) => (
              <details key={idx} name="scan-faq" style={S.faqItem}>
                <summary style={S.faqSummary}>
                  <span>{item.q}</span>
                  <span style={{ color: ORANGE, fontWeight: 800, fontSize: 20 }}>+</span>
                </summary>
                <p style={S.faqAnswer}>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 10. CTA FINAL                                                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <section className="scan-final" style={S.finalSection}>
        <div style={S.finalInner}>
          <span style={S.heroBadge}>
            <span>🚀</span> Junte-se à nova geração de colecionadores
          </span>
          <h2 style={S.finalTitle}>
            Pare de digitar.{' '}
            <span style={S.heroTitleAccent}>Comece a apontar.</span>
          </h2>
          <p style={S.finalSubtitle}>
            Crie sua conta grátis, ganhe 7 dias de Pro e teste a Pokédex completa.
            Quando quiser usar o Scan IA, escolha o pacote que cabe no seu bolso —
            os créditos não expiram nunca.
          </p>
          <div style={S.finalCtas}>
            <Link href="?auth=signup&next=/minha-colecao" style={S.ctaPrimary}>
              Criar conta grátis →
            </Link>
            <Link href="#pacotes" style={S.ctaSecondary}>
              Ver pacotes
            </Link>
            <Link href="/suporte" style={S.ctaSecondary}>
              Falar com suporte
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
