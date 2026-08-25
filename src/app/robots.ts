import type { MetadataRoute } from 'next'

/**
 * robots.txt dinâmico do Next 13+.
 *
 * - Substitui o /public/robots.txt estático
 * - Permite páginas públicas, bloqueia rotas privadas e API
 * - BLOQUEIA bots agressivos sem valor (Ahrefs, Bytespider, DotBot, etc.)
 *   -> reduz invocacoes/custo sem perder Google, Bing, OpenAI ou Claude
 * - Aponta o sitemap pra https://bynx.gg/sitemap.xml (gerado por sitemap.ts)
 *
 * Acessível em: https://bynx.gg/robots.txt
 *
 * MANTIDOS de proposito (trazem trafego/visibilidade):
 *   Googlebot, GoogleOther, Bingbot, YandexBot (busca)
 *   OAI-SearchBot / ChatGPT-User (OpenAI), ClaudeBot (Anthropic), PerplexityBot (IA)
 *   facebookexternalhit / meta-externalads (previews + anuncios Meta)
 *   -> nao precisam de regra: caem no '*' e sao permitidos nas paginas publicas.
 *
 * Se um dia o ClaudeBot (o mais pesado) incomodar no custo, e so adicionar
 * 'ClaudeBot' na lista de bloqueados abaixo (ele respeita robots.txt).
 */

// Crawlers de baixo/nenhum valor pra Bynx (ferramentas de SEO de terceiros,
// scrapers de IA agressivos). Todos respeitam robots.txt.
const BOTS_BLOQUEADOS = [
  'AhrefsBot',
  'SemrushBot',
  'DotBot',
  'MJ12bot',
  'Bytespider',
  'DataForSeoBot',
  'PetalBot',
  'Barkrowler',
  'BLEXBot',
  'Amazonbot',
  'ImagesiftBot',
  'Timpibot',
]

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
          '/colecionadores',
          '/pokedex-pokemon-tcg',
          '/scan-ia',
          '/blog',
          '/blog/',
        ],
        disallow: [
          '/minha-colecao',
          '/dashboard-financeiro',
          '/minha-conta',
          '/minha-loja',
          '/admin',
          // ★ NAO TIRAR '/api/' daqui sem falar com quem cuida de
          // src/app/api/marketplace/sinais-carta/route.ts. O renderizador do
          // Googlebot nao busca subrecurso bloqueado por robots.txt, e e SO
          // isso que impede o beacon de sinal de disparar nas ~66,9k paginas
          // de carta. Afrouxar aqui poluiria "carta mais acessada" com a
          // cadencia de recrawl -- em silencio, sem erro nenhum.
          '/api/',
          '/reset-password',
          '/suporte',
          '/indique-e-ganhe',
          '/recompensas',
          // Produto logado do Fichario Lendario -- nao funciona deslogado,
          // entao pro Google e uma pagina sem conteudo util que ainda por
          // cima competiria com a landing /fichario-lendario pela mesma
          // busca. A landing (essa sim publica) segue no sitemap e indexavel.
          // Decisao do Du, 06/08/2026.
          '/paginas-lendarias',
        ],
      },
      {
        // Bots agressivos sem valor -> bloqueio total.
        userAgent: BOTS_BLOQUEADOS,
        disallow: '/',
      },
    ],
    sitemap: 'https://bynx.gg/sitemap.xml',
    host: 'https://bynx.gg',
  }
}
