import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'

/**
 * Content-Security-Policy (S-atual).
 *
 * MODO: Report-Only. O browser NAO bloqueia nada — apenas reporta violacoes
 * pra /api/csp-report (aparecem nos runtime logs da Vercel). Depois de rodar
 * alguns dias sem violacao legitima, trocar a chave do header para
 * 'Content-Security-Policy' (enforcing).
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
  `connect-src 'self' ${SUPABASE_HOST} ${SUPABASE_WSS} https://www.google-analytics.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://www.googletagmanager.com https://challenges.cloudflare.com https://api.pokemontcg.io https://economia.awesomeapi.com.br https://connect.facebook.net https://www.facebook.com`,
  "frame-src 'self' https://challenges.cloudflare.com https://www.googletagmanager.com https://www.facebook.com",
  "worker-src 'self' blob:",
  "media-src 'self' data: https:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.facebook.com",
  "frame-ancestors 'none'",
  // 'upgrade-insecure-requests' — REATIVAR ao virar pra enforcing.
  // Em Report-Only ela e IGNORADA pelo browser e ainda gera um warning no
  // console a cada pagina ('...is ignored when delivered in a report-only
  // policy'), abafando as violacoes de verdade.
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
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.pokemontcg.io',
      },
      {
        protocol: 'https',
        hostname: 'repositorio.sbrauble.com',
      },
      {
        protocol: 'https',
        hostname: 'www.ligapokemon.com.br', // S39: fix - tava com markdown link quebrado
      },
      {
        protocol: 'https',
        hostname: 'ligapokemon.com.br',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // CSP em modo RELATORIO (nao bloqueia; so reporta em /api/csp-report).
          // Trocar a chave pra 'Content-Security-Policy' quando estiver limpo.
          { key: 'Content-Security-Policy-Report-Only', value: CSP },
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
