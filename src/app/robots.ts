import type { MetadataRoute } from 'next'

/**
 * robots.txt dinâmico do Next 13+.
 *
 * - Substitui o /public/robots.txt estático
 * - Permite páginas públicas, bloqueia rotas privadas e API
 * - Aponta o sitemap pra https://bynx.gg/sitemap.xml (gerado por sitemap.ts)
 *
 * Acessível em: https://bynx.gg/robots.txt
 */

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/pokedex',
          '/marketplace',
          '/lojas',
          '/perfil/',
          '/para-lojistas',
          '/separadores',
          '/separadores-pokemon',
        ],
        disallow: [
          '/minha-colecao',
          '/dashboard-financeiro',
          '/minha-conta',
          '/minha-loja',
          '/admin',
          '/api/',
          '/reset-password',
          '/suporte',
        ],
      },
    ],
    sitemap: 'https://bynx.gg/sitemap.xml',
    host: 'https://bynx.gg',
  }
}
