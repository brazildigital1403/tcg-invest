import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'

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
