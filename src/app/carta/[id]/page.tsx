/**
 * src/app/carta/[id]/page.tsx
 *
 * SERVER COMPONENT (S38: SEO Fase 1).
 *
 * Antes (S33-S37): `'use client'` puro, sem SSR. Resultado: title genérico,
 * canonical apontando pra "/" (vazado do layout root) e SEM Schema.org Product.
 * Google nunca indexou as ~22k páginas de carta.
 *
 * Agora (S38): fetch server-side da carta (pokemontcg.io + Supabase),
 * generateMetadata dinâmico por carta (title/desc/OG/canonical específicos),
 * Product schema.org com oferta em BRL, ISR 24h. Interatividade UI fica
 * no CardClient.tsx (componente Client filho, recebe props pré-fetched).
 *
 * SEO crítico:
 * - canonical: `https://bynx.gg/carta/{id}` (não mais "/")
 * - title: "Charizard ex 199/091 — Destinos de Paldea | Bynx"
 * - description: inclui o MENOR preço em BRL pra atrair clique (regra de 25/08/2026)
 * - schema.org Product + AggregateOffer (rich snippet com R$ no Google)
 */

import type { Metadata } from 'next'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { notFound, permanentRedirect } from 'next/navigation'
import CardClient from './CardClient'

// Variantes exibidas na pagina publica da carta. Leem as colunas fixas ja
// scaneadas em pokemon_cards (preco_<var>_min/medio/max). So entram as com preco.
const VAR_DEFS_CARTA: Array<{ key: string; label: string; pre: string }> = [
  { key: 'normal',   label: 'Normal',   pre: 'preco_' },
  { key: 'foil',     label: 'Foil',     pre: 'preco_foil_' },
  { key: 'reverse',  label: 'Reverse',  pre: 'preco_reverse_' },
  { key: 'pokeball', label: 'Pokéball', pre: 'preco_pokeball_' },
  { key: 'promo',    label: 'Promo',    pre: 'preco_promo_' },
]
function precoNum(v: any): number | null {
  const f = Number(v)
  return f > 0 ? f : null
}
function buildVariantesCarta(b: any) {
  if (!b) return []
  return VAR_DEFS_CARTA.map((v) => ({
    key: v.key,
    label: v.label,
    min: precoNum(b[v.pre + 'min']),
    med: precoNum(b[v.pre + 'medio']),
    max: precoNum(b[v.pre + 'max']),
  })).filter((v) => v.min || v.med || v.max)
}
import CartasRelacionadas from '@/components/cards/CartasRelacionadas'
import MercadoLivre from '@/components/ui/MercadoLivre'
import { getMlAfiliadoLink, getMlAfiliadoProdutos } from '@/lib/mlAfiliado'
import Link from 'next/link'

function slugifyName(s: string): string {
  return s
    .replace(/♀/g, '-f')
    .replace(/♂/g, '-m')
    .toLowerCase()
    .replace(/[áàâãä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôõö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/ +/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ─── ISR: revalida cada 24h ───────────────────────────────────────────────
// Preço dinâmico mas estável; 24h equilibra freshness vs custo Vercel.
//
// ★ Até 04/09/2026 a linha abaixo dizia "on-demand revalidate via
// /api/revalidate quando scan atualiza preço" e essa rota NUNCA EXISTIU — era
// promessa em comentário. Na prática o preço atualizado pelo scan podia ficar
// 24h velho justamente na página que o Google indexa com o preço no snippet.
// A rota existe agora (`src/app/api/revalidate/route.ts`, Bearer CRON_SECRET,
// caminho fechado em /carta/{slug}); falta o scan passar a chamá-la.
//
// Invalidar por SLUG basta: quem chega pelo id leva 308 pro slug, então é a
// entrada do slug que serve o tráfego.
export const revalidate = 86400

/**
 * ★ Sem isto, o `revalidate` acima nao valia NADA.
 *
 * Rota com segmento dinamico e SEM generateStaticParams o Next classifica como
 * `f` (server-rendered on demand) e responde
 * `cache-control: private, no-cache, no-store` — 100% MISS, sempre. Medido em
 * 29/07/2026: cinco requests identicos seguidos, cinco MISS.
 *
 * Na pratica: toda visita a qualquer uma das 66.897 paginas de carta acordava
 * uma lambda e batia no Postgres. Foi esse o combustivel do apagao — varredura
 * de crawler em rota sem cache, cada request segurando conexao, ate o pool
 * estourar e derrubar o site inteiro junto.
 *
 * Declarar generateStaticParams muda o modo da rota: com `dynamicParams`, o
 * caminho que ainda nao existe e gerado na primeira visita e FICA CACHEADO pelo
 * `revalidate`. Da segunda visita em diante sai do CDN sem tocar no banco.
 *
 * Devolve lista vazia de proposito. Prerenderizar no build custaria leitura da
 * tabela de 187 MB — exatamente o tipo de operacao que esgotou o orcamento de
 * IO. Aqui o custo e uma renderizacao por carta, distribuida no tempo, so pras
 * cartas que alguem realmente visita.
 */
export async function generateStaticParams() {
  return []
}

export const dynamicParams = true

// INCIDENTE 29/07/2026: esta rota e dinamica (o build classifica como `f`) e
// nao tinha maxDuration, entao herdava o teto de 300s da Vercel. Sob carga de
// crawler, cada request travado segurava lambda E conexao do Postgres por
// CINCO MINUTOS — o pool esgotou e derrubou o site inteiro junto (/pokemon,
// /api/admin, ate o acesso administrativo ao banco).
//
// 20s e folga generosa: a pagina responde em ~1s. O que passar disso ja e
// falha, e falhar rapido devolve a conexao 15x mais cedo.
//
// Isto e contencao, nao cura. A cura e a rota deixar de ser dinamica.
export const maxDuration = 20

// ─── Tipos normalizados (merge pokemontcg.io + Supabase) ──────────────────

type NormalizedCard = {
  id: string
  name: string
  number: string | null
  setName: string | null
  setId: string | null
  slug: string | null
  setTotal: number | null
  setReleaseYear: string | null
  rarity: string | null
  hp: number | null
  types: string[]
  imageSmall: string | null
  imageLarge: string | null
  attacks: Array<{ name: string; text?: string; damage?: string }> | null
  // Preço (apenas Bynx tem)
  /** Guard de preco: true = valor nao serve pra divulgacao (ver card_preco_baseline). */
  precoSuspeito: boolean
  precoMin: number | null
  precoMedio: number | null
  precoMax: number | null
  // `variantes` ja era devolvido por fetchCardData desde a S43, mas nunca foi
  // declarado aqui — o excess property check reclamava dele desde entao.
  variantes?: Array<{
    key: string
    label: string
    min: number | null
    med: number | null
    max: number | null
  }>
  // Range da varredura de listagem. Tri-estado: null = nunca varrida ·
  // 0 = varrida e sem oferta · >0 = tem oferta. Cruza variante, entao alimenta
  // so o estado vazio da UI — nunca o grid de preco (ver BRIEF 10.2/10.8).
  ligaRangeMin: number | null
  ligaRangeMax: number | null
}

// ─── Helper: normaliza attacks (pode vir como array da API TCG, ou como
// string JSON serializada vinda do Supabase/Bynx). Garante sempre array|null. ─
function normalizeAttacks(
  raw: unknown,
): Array<{ name: string; text?: string; damage?: string }> | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    return raw as Array<{ name: string; text?: string; damage?: string }>
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

// ─── Fetch de dados (server-side, com cache ISR) ──────────────────────────

async function fetchCardData(idOrSlug: string): Promise<NormalizedCard | null> {
  // A rota aceita a URL nova (slug) e a antiga (id, ainda circulando em links
  // compartilhados e no indice do Google). Resolvemos no banco ANTES de chamar
  // a API oficial, porque ela so entende o id — mandar um slug pra la seria
  // uma chamada desperdicada em toda visita.
  let bynx: any = null
  let printedTotal: number | null = null
  let precoSuspeito = false
  const sb = getServiceSupabase()
  if (sb) {
    const COLS =
      'id, slug, name, number, set_id, set_name, set_release_date, set_total, ' +
      'rarity, hp, types, image_small, image_large, attacks, ' +
      'preco_min, preco_medio, preco_max, ' +
      'preco_foil_min, preco_foil_medio, preco_foil_max, ' +
      'preco_reverse_min, preco_reverse_medio, preco_reverse_max, ' +
      'preco_pokeball_min, preco_pokeball_medio, preco_pokeball_max, ' +
      'preco_promo_min, preco_promo_medio, preco_promo_max, ' +
      // Range da varredura de listagem (BRIEF-LIGA-ZENROWS.md 10.8). NAO e
      // preco de variante: cruza variantes, entao so alimenta o estado vazio
      // da UI, nunca o grid de Minimo/Medio/Maximo.
      'liga_range_min, liga_range_max'
    const porSlug = await sb.from('pokemon_cards').select(COLS).eq('slug', idOrSlug).maybeSingle()
    bynx = porSlug.data
    if (!bynx) {
      const porId = await sb.from('pokemon_cards').select(COLS).eq('id', idOrSlug).maybeSingle()
      bynx = porId.data
    }

    // ★ Marca do guard de preco (card_preco_baseline).
    //
    // A carta pode ter um preco que o guard ja considera nao-confiavel --
    // oferta unica muito acima da mediana historica dela mesma. O marketplace
    // ja respeitava isso; a pagina de carta nao, e era JUSTAMENTE ela que
    // levava o numero pro <title> e pro JSON-LD do Google. Caso concreto: o
    // Surfing Pikachu VMAX anunciava R$ 999 no SERP com mercado real em ~R$ 60.
    //
    // Lookup por PK numa tabela de ~14k linhas, e a rota e ISR de 24h: custa
    // uma vez por revalidacao. Falha aqui NAO derruba a pagina -- sem a marca
    // ela volta ao comportamento anterior, que e degradar, nao quebrar.
    if (bynx?.id) {
      try {
        const { data: marca } = await sb
          .from('card_preco_baseline')
          .select('suspeito')
          .eq('card_id', bynx.id)
          .maybeSingle()
        precoSuspeito = !!(marca as any)?.suspeito
      } catch (err) {
        console.error('[carta] marca de preco:', (err as Error)?.message)
      }
    }
  }

  const idReal = bynx?.id || idOrSlug

  // ─── Vale a pena chamar a API oficial? ────────────────────────────────────
  //
  // Medido em 28/07/2026: essa chamada custava ~800ms de TTFB e na imensa
  // maioria das visitas nao entregava nada.
  //
  //  - id `liga-*` (46.411 cartas, 69,4% do catalogo) e cunhado pelo NOSSO
  //    scan. A API oficial nao tem como conhecer esse id — a resposta so pode
  //    ser erro. Chamada 100% perdida.
  //  - das 20.486 com id oficial, 17.056 (83%) ja tem attacks+hp+types no
  //    banco. Nada a ganhar.
  //
  // Sobra ~5% das visitas, que sao justamente as que precisam.
  const temDadosDeJogo = Boolean(
    bynx?.attacks && bynx?.hp && bynx?.types?.length,
  )
  const idEhNosso = idReal.startsWith('liga-')
  const vaiChamarApi = !idEhNosso && !temDadosDeJogo

  // printed_total = o numero impresso NA carta (23/132), nao o total com
  // secretas (23/188). E o que o colecionador digita na busca.
  //
  // Roda em paralelo com a API: as duas so dependem do `bynx`, nao uma da
  // outra. Em serie eram dois RTTs empilhados.
  const [stRes, tcgRes] = await Promise.all([
    bynx?.set_id && sb
      ? sb.from('pokemon_sets').select('printed_total').eq('id', bynx.set_id).maybeSingle()
      : Promise.resolve(null),
    vaiChamarApi
      ? fetch(`https://api.pokemontcg.io/v2/cards/${idReal}`, {
          headers: { 'X-Api-Key': process.env.POKEMON_API_KEY || '' },
          next: { revalidate: 86400, tags: [`card:${idReal}`] },
          // ★ TIMEOUT OBRIGATORIO (30/07/2026). O `.catch` abaixo pega ERRO,
          // nao PENDURA: sem signal, uma API de terceiro que nao responde
          // segura o Promise.all inteiro ate o maxDuration de 20s e a pagina
          // devolve 504. Aconteceu — 17 paginas de carta cairam em 24h com a
          // pokemontcg.io degradada (medido: 25s sem resposta em me1-121, a
          // mesma carta do log). 5s e folga de sobra: o resto da pagina leva
          // ~1s, e dado de jogo e ENRIQUECIMENTO — a pagina renderiza sem ele
          // em 95% das visitas de qualquer forma.
          signal: AbortSignal.timeout(5000),
        }).catch(() => {
          console.warn(`[carta] pokemontcg.io nao respondeu em 5s para ${idReal} — seguindo sem dados de jogo`)
          return null
        })
      : Promise.resolve(null),
  ])

  printedTotal = stRes?.data?.printed_total ?? null

  const tcgJson: any = tcgRes?.ok ? await tcgRes.json().catch(() => null) : null
  const tcg = tcgJson?.data || null

  // Se nenhuma fonte achou, é 404
  if (!tcg && !bynx) return null

  // Merge: TCG api tem dados de jogo melhores (image grande, ataques),
  // Bynx tem preço em BRL. Combina os dois.
  return {
    id: idReal,
    name: tcg?.name || bynx?.name || 'Carta',
    number: tcg?.number || bynx?.number || null,
    setName: tcg?.set?.name || bynx?.set_name || null,
    setId: bynx?.set_id || tcg?.set?.id || null,
    slug: bynx?.slug || null,
    setTotal: printedTotal ?? tcg?.set?.printedTotal ?? bynx?.set_total ?? null,
    setReleaseYear:
      tcg?.set?.releaseDate?.slice(0, 4) ||
      bynx?.set_release_date?.slice(0, 4) ||
      null,
    rarity: tcg?.rarity || bynx?.rarity || null,
    hp: tcg?.hp ? Number(tcg.hp) : bynx?.hp || null,
    types: tcg?.types || bynx?.types || [],
    imageSmall: tcg?.images?.small || bynx?.image_small || null,
    imageLarge: tcg?.images?.large || bynx?.image_large || null,
    attacks: normalizeAttacks(tcg?.attacks || bynx?.attacks),
    precoSuspeito,
    precoMin: bynx?.preco_min ? Number(bynx.preco_min) : null,
    precoMedio: bynx?.preco_medio ? Number(bynx.preco_medio) : null,
    precoMax: bynx?.preco_max ? Number(bynx.preco_max) : null,
    variantes: buildVariantesCarta(bynx),
    // ATENCAO ao `!= null`: aqui 0 e um valor CARREGADO DE SENTIDO ("a
    // varredura passou e ninguem esta vendendo"), diferente de null ("a
    // varredura nunca passou"). O `? :` usado nos precos acima achataria os
    // dois em null e mataria justamente a distincao que essa coluna existe
    // pra fazer.
    ligaRangeMin: bynx?.liga_range_min != null ? Number(bynx.liga_range_min) : null,
    ligaRangeMax: bynx?.liga_range_max != null ? Number(bynx.liga_range_max) : null,
  }
}

// --- Cartas relacionadas (link building / SEO) ---
type MiniCard = {
  id: string
  name: string
  number: string | null
  image_small: string | null
  set_name: string | null
  slug: string | null
}
type RelatedCards = {
  pokemon_name: string | null
  same_set: MiniCard[]
  same_pokemon: MiniCard[]
}

async function fetchRelatedCards(id: string): Promise<RelatedCards> {
  const empty: RelatedCards = { pokemon_name: null, same_set: [], same_pokemon: [] }
  const sb = getServiceSupabase()
  if (!sb) return empty
  try {
    const { data, error } = await sb.rpc('get_related_cards', { p_id: id, p_limit: 8 })
    if (error || !data) return empty
    const d = data as { pokemon_name?: string | null; same_set?: MiniCard[]; same_pokemon?: MiniCard[] }
    return {
      pokemon_name: d.pokemon_name ?? null,
      same_set: Array.isArray(d.same_set) ? d.same_set : [],
      same_pokemon: Array.isArray(d.same_pokemon) ? d.same_pokemon : [],
    }
  } catch {
    return empty
  }
}

// ─── Helper: formata BRL ───────────────────────────────────────────────────

const formatBRL = (v: number | null) =>
  v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : null

// ─── generateMetadata (DINÂMICO POR CARTA — KEY do SEO) ───────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const card = await fetchCardData(id)

  // Carta não encontrada: noindex + title genérico
  if (!card) {
    return {
      title: 'Carta não encontrada',
      description: 'Esta carta não está cadastrada na Bynx.',
      alternates: { canonical: `https://bynx.gg/carta/${id}` },
      robots: { index: false, follow: false },
    }
  }

  // Composição do title: "Charizard ex 199/091 — Destinos de Paldea"
  const numStr = card.number
    ? card.setTotal
      ? ` ${card.number}/${card.setTotal}`
      : ` #${card.number}`
    : ''
  const setStr = card.setName ? ` — ${card.setName}` : ''
  // ★ O preco que representa a carta no Google e o MENOR (25/08/2026).
  // Quem compra leva pelo menor, entao e esse que o SERP deve anunciar --
  // prometer a media e prometer um numero que ninguem paga.
  // Carta marcada pelo guard nao leva preco pro SERP: um numero errado no
  // titulo do Google e pior que titulo sem numero -- ele atrai o clique e
  // quebra a confianca na chegada.
  const precoStr = card.precoSuspeito ? null : formatBRL(card.precoMin)

  // Title com preco em R$ no SERP (diferencial Bynx). Guarda de tamanho:
  // nome+numero+preco sempre; set so entra se couber (~50 chars antes de " | Bynx.gg").
  let title: string
  if (precoStr) {
    const baseComPreco = `${card.name}${numStr} — ${precoStr}`
    const restante = 50 - baseComPreco.length
    const sufixoSet = card.setName ? ` | ${card.setName}` : ''
    title = sufixoSet && sufixoSet.length <= restante ? baseComPreco + sufixoSet : baseComPreco
  } else {
    title = `${card.name}${numStr}${setStr}`
  }
  const description = precoStr
    ? `Quanto vale ${card.name}${numStr} de ${card.setName || 'Pokémon TCG'}? A partir de ${precoStr}, atualizado em reais na Bynx. Veja a faixa (mín–máx), as variantes e acompanhe na sua coleção.`
    : `Quanto vale ${card.name}${numStr}${card.setName ? ` de ${card.setName}` : ''}? Veja o preço em reais, variantes, raridade e ataques, e acompanhe na sua coleção Pokémon TCG na Bynx.`

  const ogImage = card.imageLarge || card.imageSmall || 'https://bynx.gg/og-image.jpg'

  return {
    title,
    description,
    alternates: {
      canonical: `https://bynx.gg/carta/${card.slug || id}`,
    },
    openGraph: {
      title: `${title} | Bynx.gg`,
      description,
      url: `https://bynx.gg/carta/${card.slug || id}`,
      type: 'website',
      siteName: 'Bynx',
      locale: 'pt_BR',
      images: [
        {
          url: ogImage,
          width: 734,
          height: 1024,
          alt: card.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@bynxgg',
      creator: '@bynxgg',
      title: `${title} | Bynx.gg`,
      description,
      images: [ogImage],
    },
    other: {
      // Hint pra crawlers de imagem
      'og:image:type': 'image/png',
    },
  }
}

// ─── Redirect de carta deduplicada (S43) ──────────────────────────────────
// Algumas cartas entraram no catalogo DUAS vezes: a versao boa (ex: `sv8-57`) e
// uma copia criada pelo scan quando ele nao casou o codigo do fornecedor com o
// set do catalogo (ex: `liga-SSP-Pikachu-ex--057-191-`). As copias foram
// removidas, mas as URLs delas ja estavam indexadas no Google e circulando em
// links compartilhados. Sem isso aqui elas virariam 404 e a gente jogaria fora
// o historico de busca. `dedup_liga_map` guarda de->para de cada remocao.
async function destinoDeCartaRemovida(id: string): Promise<string | null> {
  const sb = getServiceSupabase()
  if (!sb) return null
  const { data } = await sb
    .from('dedup_liga_map')
    .select('cat_id')
    .eq('liga_id', id)
    .maybeSingle()
  return data?.cat_id ?? null
}

// ─── Page Component (server, renderiza Schema.org + CardClient) ───────────

export default async function CartaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = await fetchCardData(id)

  if (!card) {
    // Carta removida por deduplicacao? Manda 301 pra versao boa em vez de 404.
    const destino = await destinoDeCartaRemovida(id)
    if (destino) permanentRedirect(`/carta/${destino}`)
    notFound()
  }

  // URL antiga (id) -> 301 pra URL nova (slug). O id continua valendo pra
  // sempre: ele esta no indice do Google e em link que gente ja compartilhou.
  // O 301 preserva esse historico em vez de jogar fora.
  if (card.slug && card.slug !== id) {
    permanentRedirect(`/carta/${card.slug}`)
  }

  // ─── Schema.org Product (Rich Snippet no Google: mostra R$ na busca) ─
  const productSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: card.name,
    image: card.imageLarge || card.imageSmall,
    // ★ SLUG, nao o id. O id de ~49 mil cartas comeca com o nome do
    // fornecedor de preco (`liga-XXX-...`), e o `sku` do JSON-LD e dado
    // ESTRUTURADO -- o campo que o Google le e guarda. Era o unico ponto do
    // HTML em que esse nome saia como conteudo, e nao como URL de asset.
    // O slug ja e limpo por construcao (montar_card_slug omite o segmento de
    // set nesses casos) e identifica a carta igual: e o que esta na URL.
    // ★ Renomear o id resolveria na raiz, mas ele e FK em 7 tabelas e ja tem
    // 2.225 cartas de usuarios e 62 anuncios apontando pra ele -- migracao de
    // chave em cascata, risco desproporcional pro que se ganha aqui.
    sku: card.slug || card.id,
    description: `${card.name}${card.setName ? ` de ${card.setName}` : ''} — Pokémon TCG`,
    brand: {
      '@type': 'Brand',
      name: 'Pokémon TCG',
    },
    category: 'Trading Card Game',
  }

  // AggregateOffer só com preço (evita lowPrice undefined). O GATE passou a
  // ser o precoMin junto com a regra: com o gate no médio, uma carta que tem
  // mínimo mas não tem médio sairia do rich snippet sem oferta nenhuma.
  if (card.precoMin && !card.precoSuspeito) {
    productSchema.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'BRL',
      lowPrice: card.precoMin,
      highPrice: card.precoMax ?? card.precoMin,
      offerCount: 1,
      availability: 'https://schema.org/InStock',
      priceValidUntil: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10),
      url: `https://bynx.gg/carta/${card.slug || card.id}`,
    }
  }

  // BreadcrumbList: ajuda navegação no Google + UX
  // Trilha (breadcrumb): Inicio > Pokedex > [Set] > Carta
  const breadcrumbItems: { name: string; href: string }[] = [
    { name: 'Início', href: '/' },
    { name: 'Sets', href: '/set' },
  ]
  if (card.setName && card.setId) {
    breadcrumbItems.push({ name: card.setName, href: `/set/${card.setId}` })
  }
  breadcrumbItems.push({ name: card.name, href: `/carta/${card.slug || card.id}` })

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `https://bynx.gg${it.href}`,
    })),
  }

  // a RPC casa por id de carta, nao por slug — passa o id resolvido
  const related = await fetchRelatedCards(card.id)

  // Link de afiliado do Mercado Livre (acessorios; cai no 'default' se nao houver)
  const mlLink = await getMlAfiliadoLink('acessorios')
  const mlProdutos = await getMlAfiliadoProdutos('acessorios')

  return (
    <>
      {/* JSON-LD invisível pro user, lido pelo Googlebot */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* UI interativa (client) — recebe data pré-fetched, sem loading state */}
      {/* CardClient renderiza ad + relacionadas via children: tema dark, acima do rodape */}
      <CardClient card={card} breadcrumb={breadcrumbItems}>
        {/* Cartas relacionadas (SEO / link building) - links crawlaveis, server-rendered */}
        {related.pokemon_name && (
  <div style={{ margin: '4px 0 22px' }}>
    <Link
      href={`/pokemon/${slugifyName(related.pokemon_name)}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
        color: '#f59e0b', fontWeight: 700, fontSize: 14,
        padding: '12px 20px', borderRadius: 12, textDecoration: 'none',
      }}
    >
      Ver todas as cartas de {related.pokemon_name} &rarr;
    </Link>
  </div>
)}
        <CartasRelacionadas
          sameSet={related.same_set}
          samePokemon={related.same_pokemon}
          setName={card.setName}
          pokemonName={related.pokemon_name}
        />

        {mlLink && (
          <MercadoLivre
            variante="card"
            layout="grid"
            gridMax={6}
            url={mlLink.url}
            titulo={mlLink.titulo}
            subtitulo={mlLink.subtitulo}
            produtos={mlProdutos}
          />
        )}
      </CardClient>
    </>
  )
}
