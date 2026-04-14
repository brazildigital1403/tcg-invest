import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
        hostname: 'www.ligapokemon.com.br',
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
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Controla informações enviadas ao navegar para outros sites
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          // Desativa funcionalidades desnecessárias do browser
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
};

export default nextConfig;