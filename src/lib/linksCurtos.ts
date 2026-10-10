// Links curtos: bynx.gg/<slug> -> destino (com UTM escondida). Criados em
// /admin/links, resolvidos pela rota src/app/[slug]/route.ts.
//
// A rota [slug] na raiz so recebe o que NENHUMA pagina real atende, mas o admin
// nao pode deixar criar um slug que vire pagina amanha nem um que ja e pagina
// hoje -- por isso a lista de reservados espelha os diretorios de 1o nivel de
// src/app (ls em 09/10/2026) mais o que a Vercel/Next servem sozinhos.

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,31}$/

export const SLUGS_RESERVADOS = new Set([
  'acompanhando', 'admin', 'anuncio', 'api', 'auth', 'blog', 'busca', 'cadastro', 'carrinho', 'carta',
  'cartas-graduadas', 'checkout', 'colecionadores', 'comparador', 'compras', 'dashboard-financeiro',
  'destaque', 'email', 'faq', 'fichario-lendario', 'ilustrador', 'indique-e-ganhe', 'login', 'lojas',
  'lorcana', 'marketplace', 'master-sets', 'metas', 'minha-colecao', 'minha-conta', 'minha-loja',
  'paginas-lendarias', 'para-lojistas', 'parceiros', 'pedido', 'perfil', 'planos', 'pokedex-pokemon-tcg',
  'pokedex', 'pokemon', 'pre-grading', 'presente', 'privacidade', 'pro-ativado', 'produto', 'ranking',
  'recebimentos', 'recompensas', 'reset-password', 'restauracao-de-cartas', 'scan-ia',
  'separadores-pokemon', 'separadores', 'servico', 'servicos', 'set', 'sitemap', 'sobre',
  'subprocessadores', 'suporte', 'tcgcon', 'termos', 'vendas',
  // servidos pelo Next/Vercel ou por arquivo em public/
  'robots', 'favicon', 'manifest', 'ingest', 'monitoring', '_next', '_vercel', 'static', 'public',
  // nomes que confundem com rota curta "do sistema"
  'go', 'l', 'r', 's', 'link', 'links',
])

export type LinkCurto = {
  slug: string
  destino: string
  descricao: string | null
  ativo: boolean
  cliques: number
  criado_em: string
  atualizado_em: string
}

export function validarSlug(slug: unknown): { ok: true; slug: string } | { ok: false; erro: string } {
  const s = String(slug ?? '').trim().toLowerCase()
  if (!s) return { ok: false, erro: 'Informe o slug (o que vem depois de bynx.gg/).' }
  if (!SLUG_RE.test(s)) return { ok: false, erro: 'Slug só com letras minúsculas, números e hífen, até 32 caracteres.' }
  if (SLUGS_RESERVADOS.has(s)) return { ok: false, erro: `"${s}" é uma página da Bynx. Escolha outro slug.` }
  return { ok: true, slug: s }
}

export function validarDestino(destino: unknown): { ok: true; destino: string } | { ok: false; erro: string } {
  const d = String(destino ?? '').trim()
  if (!d) return { ok: false, erro: 'Informe o destino (a URL completa, com as UTMs).' }
  let u: URL
  try { u = new URL(d) } catch { return { ok: false, erro: 'Destino precisa ser uma URL completa, começando com https://.' } }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, erro: 'Destino precisa começar com https://.' }
  if (d.length > 2000) return { ok: false, erro: 'Destino longo demais (máximo 2000 caracteres).' }
  return { ok: true, destino: d }
}

export function urlCurta(slug: string) {
  return `https://bynx.gg/${slug}`
}

// ─── Sugestao de slug a partir das UTMs ────────────────────────────────────
//
// Regra da casa (Du, 09/10/2026): slug = canal-campanha, com a campanha igual
// a utm_campaign do destino. Assim o painel de cliques se le sozinho
// (yt-o-que-e-a-bynx, ig-caixa) e casa com o PostHog. O admin preenche o slug
// com isto enquanto a pessoa nao digitar um por conta propria.

const CANAL_POR_SOURCE: Record<string, string> = {
  youtube: 'yt', instagram: 'ig', tiktok: 'tt', whatsapp: 'zap', email: 'email', newsletter: 'email',
  facebook: 'fb', twitter: 'x', x: 'x', telegram: 'tg', linkedin: 'li', discord: 'dc', google: 'g',
}

export function slugificar(s: string) {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** 'https://bynx.gg/?utm_source=youtube&utm_campaign=o-que-e-a-bynx' -> 'yt-o-que-e-a-bynx'. Vazio se nao der para sugerir. */
export function sugerirSlug(destino: string): string {
  let u: URL
  try { u = new URL(destino.trim()) } catch { return '' }
  const source = slugificar(u.searchParams.get('utm_source') || '')
  const campanha = slugificar(u.searchParams.get('utm_campaign') || '')
  const canal = CANAL_POR_SOURCE[source] || source
  const partes = [canal, campanha].filter(Boolean)
  if (partes.length === 0) return ''
  let slug = partes.join('-').replace(/-+/g, '-')
  if (slug.length > 32) slug = slug.slice(0, 32).replace(/-+$/g, '')
  return SLUG_RE.test(slug) && !SLUGS_RESERVADOS.has(slug) ? slug : ''
}
