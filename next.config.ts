import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'

/**
 * Content-Security-Policy (S-atual).
 *
 * MODO: ENFORCING. O browser BLOQUEIA o que nao esta na lista. O report-uri
 * segue ativo pra logar o que for bloqueado (ver /api/csp-report nos runtime
 * logs da Vercel).
 *
 * Decisoes:
 * - script-src usa 'unsafe-inline': o Next injeta ~53 inline scripts de
 *   hidratacao por pagina. Nonce exigiria renderizacao dinamica e mataria o
 *   ISR do site inteiro — troca ruim.
 * - img-src libera https: geral: lojas cadastram logo_url de qualquer dominio.
 * - PostHog (/ingest) e Sentry (/monitoring) sao tunelados pelo proprio
 *   dominio (ver rewrites + tunnelRoute), entao entram em 'self'.
 * - Fontes vem do next/font (self-hosted no build) — nao precisa gstatic.
 * - META PIXEL (via GTM): descoberto no Report-Only que ele precisa de TRES
 *   coisas alem do script — `connect-src` (envio), `frame-src` (ele cria um
 *   iframe pro facebook.com) e `form-action` (ele posta em /tr/). Sem os dois
 *   ultimos o pixel morre em silencio no enforcing: as conversoes somem e
 *   parece bug de outra coisa.
 * - `style-src` inclui googletagmanager.com por causa do badge do modo Preview
 *   do GTM (so aparece em debug, mas polui o relatorio).
 */
const SUPABASE_HOST = 'https://hvkcwfcvizrvhkerupfc.supabase.co'
const SUPABASE_WSS  = 'wss://hvkcwfcvizrvhkerupfc.supabase.co'

const CSP = [
  "default-src 'self'",
  // GTM (gated no consentimento) + Turnstile (captcha do cadastro)
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://challenges.cloudflare.com https://www.google-analytics.com https://ssl.google-analytics.com https://tagmanager.google.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://tagmanager.google.com https://www.googletagmanager.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' ${SUPABASE_HOST} ${SUPABASE_WSS} https://www.google-analytics.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://www.googletagmanager.com https://challenges.cloudflare.com https://api.pokemontcg.io https://economia.awesomeapi.com.br https://connect.facebook.net https://www.facebook.com https://viacep.com.br`,
  "frame-src 'self' https://challenges.cloudflare.com https://www.googletagmanager.com https://www.facebook.com",
  "worker-src 'self' blob:",
  "media-src 'self' data: https:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.facebook.com",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
  'report-uri /api/csp-report',
].join('; ')

// 'upgrade-insecure-requests' fica de fora daqui: o browser ignora essa
// diretiva quando entregue via Report-Only e loga warning no console —
// ruido sem efeito nenhum, ja que a CSP enforcing acima ja aplica ela.
/**
 * CSP_BLOG_REPORT_ONLY (blog: embeds de YouTube/Instagram/TikTok).
 *
 * Testando em paralelo com a CSP enforcing acima, NAO trocando ela — assim o
 * site inteiro continua protegido enquanto so validamos os 3 hosts novos.
 * Depois de confirmar 0 violacao em /api/csp-report numa visita a um post com
 * os 3 embeds, mover as adicoes pra dentro do CSP enforcing e apagar este
 * bloco (mesmo processo que ja resolveu o caso do Meta Pixel).
 */
const CSP_BLOG_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://challenges.cloudflare.com https://www.google-analytics.com https://ssl.google-analytics.com https://tagmanager.google.com https://connect.facebook.net https://www.instagram.com https://www.tiktok.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://tagmanager.google.com https://www.googletagmanager.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' ${SUPABASE_HOST} ${SUPABASE_WSS} https://www.google-analytics.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://www.googletagmanager.com https://challenges.cloudflare.com https://api.pokemontcg.io https://economia.awesomeapi.com.br https://connect.facebook.net https://www.facebook.com https://viacep.com.br https://www.instagram.com https://www.tiktok.com`,
  "frame-src 'self' https://challenges.cloudflare.com https://www.googletagmanager.com https://www.facebook.com https://www.youtube-nocookie.com https://www.instagram.com https://www.tiktok.com",
  "worker-src 'self' blob:",
  "media-src 'self' data: https:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.facebook.com",
  "frame-ancestors 'none'",
  'report-uri /api/csp-report',
].join('; ')

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  /**
   * Rewrites pra PostHog (S39).
   *
   * Por quê: roteamos as requisições do PostHog (`/ingest/*`) através do
   * nosso próprio domínio (bynx.gg) ao invés de chamar `us.i.posthog.com`
   * direto do browser. Isso traz 3 ganhos:
   *
   * 1. Anti ad-block (uBlock, Brave, etc. bloqueiam *.posthog.com)
   * 2. LGPD: dados ficam no mesmo domínio do Bynx (1st-party cookies)
   * 3. Performance: leve, mas evita 1 DNS lookup separado
   */
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
      {
        source: '/ingest/decide',
        destination: 'https://us.i.posthog.com/decide',
      },
    ]
  },

  // PostHog requer essa flag pros rewrites funcionarem corretamente
  skipTrailingSlashRedirect: true,

  images: {
    // Hosts levantados do banco (28/07/2026), por volume de cartas:
    //   supabase.co          48.516  <- o maior, e estava FALTANDO aqui
    //   images.pokemontcg.io 19.682
    //   images.scrydex.com      661 cartas + 172 logos de set
    //   repositorio.sbrauble.com 39
    //   pokecardex.b-cdn.net      6 logos
    // Sem o host na lista o next/image nao otimiza: ele lanca erro e a imagem
    // some. Por isso a lista tem que acompanhar o banco.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hvkcwfcvizrvhkerupfc.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.pokemontcg.io',
      },
      {
        protocol: 'https',
        hostname: 'images.scrydex.com',
      },
      {
        protocol: 'https',
        hostname: 'repositorio.sbrauble.com',
      },
      {
        protocol: 'https',
        hostname: 'pokecardex.b-cdn.net',
      },
    ],
    // Imagem de carta e imutavel: o arquivo nunca muda depois de publicado.
    // O default de 60s faz a Vercel re-otimizar a mesma imagem sem parar, o que
    // e lento pro usuario e cobrado. 1 ano.
    minimumCacheTTL: 31536000,
    // O default do Next sao 16 larguras (8 deviceSizes + 8 imageSizes), e ele
    // escreve uma URL por largura no srcset. Numa grade de 766 cartas isso
    // inchou o HTML de /set/mc em ~60 KB comprimido (medido 28/07/2026).
    //
    // Carta e imagem pequena — o arquivo original tem no maximo 734px de
    // largura, entao metade das larguras do default nunca seria usada. Estas
    // 8 cobrem de miniatura de grade ate a hero em retina.
    deviceSizes: [640, 828, 1080, 1920],
    imageSizes: [64, 128, 256, 384],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // CSP em ENFORCING (bloqueia de verdade). O `report-uri` continua
          // ativo: mesmo bloqueando, cada violacao vira log em /api/csp-report,
          // entao da pra ver o que quebrou sem depender do usuario reclamar.
          //
          // Rodou ~1 dia em Report-Only antes. As violacoes encontradas foram
          // todas legitimas e ja estao liberadas (badge do GTM preview + os
          // frame-src/form-action do Meta Pixel).
          //
          // SE ALGO QUEBRAR: voltar a chave pra 'Content-Security-Policy-Report-Only'
          // e dar push — o site volta ao normal na hora.
          { key: 'Content-Security-Policy', value: CSP },
          // Blog (embeds YouTube/Instagram/TikTok) em paralelo, so relatando
          // -- remover esta linha quando as adicoes forem incorporadas ao CSP
          // enforcing acima (ver comentario de CSP_BLOG_REPORT_ONLY).
          { key: 'Content-Security-Policy-Report-Only', value: CSP_BLOG_REPORT_ONLY },
          // Impede que o site seja carregado dentro de iframes (clickjacking)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Impede que o browser adivinhe o tipo de arquivo (sniffing)
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Força HTTPS em produção
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Controla informações enviadas ao navegar para outros sites
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          // Desativa funcionalidades desnecessárias do browser (câmera liberada para o próprio site)
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: 'brazil-digital',

  project: 'bynx-tcg-app',

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: '/monitoring',

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
})
