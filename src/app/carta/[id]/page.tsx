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
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { notFound, permanentRedirect } from 'next/navigation'
import CardClient from './CardClient'
import OfertasDaCarta from '@/components/cards/OfertasDaCarta'
import { buscarOfertasDaCarta, ofertasParaDivulgacao } from '@/lib/ofertasDaCarta'

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
import CarrosselCartas, { type CartaCarrossel } from '@/components/cards/CarrosselCartas'
import ConviteBynx from '@/components/cards/ConviteBynx'
import { fetchStatsConvite } from '@/lib/conviteStats'
import { MIN_CARTAS_COM_PRECO, slugIlustrador } from '@/lib/ilustrador'
import type { PontoHistorico } from '@/lib/historicoCarta'
import MercadoLivre from '@/components/ui/MercadoLivre'
import { getMlAfiliadoLink } from '@/lib/mlAfiliado'
import BlogDaCarta from '@/components/cards/BlogDaCarta'
import { postsParaCarta } from '@/lib/blogCartaIndex'
import { raridadePt, subtipoPt, tipoTcgPt, idiomaPt } from '@/lib/pokedexTextos'

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

// ─── ISR: revalida cada 7 dias ────────────────────────────────────────────
// ★ 10/09/2026: era 86400 (24h). Subiu pra 7 dias por CUSTO, e a conta e
// direta: nenhuma das 68.916 paginas e prerenderizada no build, entao a
// entrada de cache so nasce quando alguem visita. Com 24h, cada varredura
// diaria de crawler REESCREVIA tudo que tocava — medido em 09/09: 49.599
// requests em /carta/[id] num dia, espalhados por 31.073 caminhos distintos.
// Isso e ~1,9M de write/mes sem uma linha de preco ter mudado, e foi o que
// levou o ISR Writes da conta da Vercel a 5,79M (US$23/mes, de uma fatura
// que era US$29 e virou US$73).
//
// 7 dias e teto de seguranca, NAO a estrategia. A estrategia e o on-demand
// abaixo. O que este numero faz e garantir que um slug que o scan deixe de
// avisar se cure sozinho em uma semana — com `revalidate = false` ele ficaria
// velho PARA SEMPRE, e um bug no chamador viraria preco errado permanente na
// pagina que o Google indexa com o preco no snippet.
//
// Preço dinâmico mas estável; quem manda no frescor e a invalidacao por slug.
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
export const revalidate = 604800

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
  attacks: Array<{ name: string; text?: string; damage?: string; cost?: string[] }> | null
  // Preço (apenas Bynx tem)
  /** Guard de preco: true = valor nao serve pra divulgacao (ver card_preco_baseline). */
  precoSuspeito: boolean
  /** Mediana historica da propria carta (card_preco_baseline). So e usada quando precoSuspeito. */
  precoMediana: number | null
  /** Quantos levantamentos formaram a mediana. */
  precoNSnaps: number | null
  precoMin: number | null
  precoMedio: number | null
  precoMax: number | null
  /** Idioma da impressao (pt, en, jp...). Vai junto quando a carta entra na colecao pela pagina publica. */
  idioma: string | null
  // ─── Ficha da carta (Fase 2 do #490). Tudo vem da mesma linha; vazio = a
  // carta nao tem o dado (68,8% do catalogo e da fonte brasileira, sem dado de
  // jogo), e a UI simplesmente nao mostra a linha. ───────────────────────────
  /** Nome do set em portugues (pokemon_sets.name_pt), quando existe. */
  setNamePt: string | null
  artist: string | null
  subtypes: string[]
  weaknesses: Array<{ type: string; value: string }>
  resistances: Array<{ type: string; value: string }>
  retreatCost: string[]
  legalities: Record<string, string> | null
  regiao: string | null
  setSeries: string | null
  flavorText: string | null
  /** Ultima venda registrada no Mercado Brasileiro (preco que alguem PAGOU). */
  ultimaVenda: { cents: number; variante: string | null; condicao: string | null; em: string | null } | null
  /** Vendas nos ultimos 3 meses (rotulo de quantidade + media). */
  vendas3m: { label: string | null; medioCents: number | null; em: string | null } | null
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

// ─── Helpers da ficha: fraqueza/resistencia e legalidade chegam como jsonb,
// mas em parte do catalogo o jsonb e uma STRING com JSON dentro (dupla
// serializacao da importacao). Os dois formatos viram o mesmo objeto. ─────────
function parseJsonb(raw: unknown): unknown {
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return raw
}

function parseTipoValor(raw: unknown): Array<{ type: string; value: string }> {
  const v = parseJsonb(raw)
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is { type: string; value: string } => !!x && typeof x === 'object' && typeof (x as { type?: unknown }).type === 'string')
    .map(x => ({ type: x.type, value: typeof x.value === 'string' ? x.value : '' }))
}

function parseLegalidades(raw: unknown): Record<string, string> | null {
  const v = parseJsonb(raw)
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) if (typeof val === 'string') out[k] = val
  return Object.keys(out).length ? out : null
}

// ─── Helper: normaliza attacks (pode vir como array da API TCG, ou como
// string JSON serializada vinda do Supabase/Bynx). Garante sempre array|null. ─
function normalizeAttacks(
  raw: unknown,
): Array<{ name: string; text?: string; damage?: string; cost?: string[] }> | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    return raw as Array<{ name: string; text?: string; damage?: string; cost?: string[] }>
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

/**
 * Guard de preco: o preco de agora esta absurdamente acima da mediana
 * historica da propria carta?
 *
 * ★ A EXIGENCIA DE HISTORICO CAI CONFORME O FATOR SOBE (06/09/2026).
 *
 * A primeira versao usava um piso unico de liquidez 2 -- o criterio das 117
 * cartas que o guard marcou em agosto. Ele deixava passar 31 cartas, e o caso
 * que denunciou o problema foi o **Plusle: R$ 319,90 contra mediana de
 * R$ 1,00, com 5 snapshots e liquidez 1**. Ficava de fora por UM ponto de
 * liquidez, anunciando 320x no titulo do Google.
 *
 * O racional do escalonamento: liquidez baixa torna a mediana menos confiavel,
 * mas a chance de um salto de 50x ser valorizacao REAL e muito menor que a de
 * um salto de 8x. Quanto mais extremo o fator, menos historico e preciso pra
 * desconfiar dele.
 *
 * Os degraus foram escolhidos olhando os 31 casos, nao no chute: pegam o
 * Plusle (320x) e o Altaria (55x, liquidez ZERO), e deixam de fora o Pikachu
 * de R$ 2.499,99 a 13x -- que numa carta desse porte pode ser valorizacao de
 * verdade. Na duvida, o guard NAO age: errar escondendo o preco de uma carta
 * que valorizou e pior que mostrar.
 *
 * Custo de um falso positivo e baixo de proposito: o preco continua na
 * PAGINA, com o aviso que ja existe. Sai so do <title> e do JSON-LD.
 */
const MIN_SNAPS = 4

/** [fator minimo, liquidez minima exigida] -- do mais extremo pro mais brando. */
const DEGRAUS: Array<[number, number]> = [
  [50, 0],  // extremo: os 4 snapshots ja bastam
  [20, 1],  // forte: 1 snapshot com liquidez
  [5, 2],   // o criterio original do guard, preservado
]

function precoForaDaMediana(preco: number, mediana: number, nSnaps: number, nLiquidez: number): boolean {
  if (!(preco > 0) || !(mediana > 0) || nSnaps < MIN_SNAPS) return false
  const fator = preco / mediana
  return DEGRAUS.some(([minFator, minLiq]) => fator >= minFator && nLiquidez >= minLiq)
}

// ─── Fetch de dados (server-side, com cache ISR) ──────────────────────────

/**
 * ★ `cache()` PORQUE ISTO RODAVA DUAS VEZES POR REQUEST (04/09/2026).
 *
 * `generateMetadata` e o componente da pagina sao dois passes da MESMA
 * request, e os dois precisam da carta — entao esta funcao era invocada duas
 * vezes, com o mesmo argumento, medido em log. Cada invocacao faz ate tres
 * consultas ao Supabase (`pokemon_cards`, `card_preco_baseline`,
 * `pokemon_sets`); o `fetch` da API externa ja escapava porque o Next dedupa
 * fetch identico sozinho, mas query do Supabase nao e fetch pra ele.
 *
 * Sao ~3 consultas desperdicadas por revalidacao, em 66.897 paginas de carta.
 * Nao era bug visivel — so trabalho dobrado no banco, e conexao do Postgres
 * segurada pelo dobro do tempo. Numa rota que ja derrubou o site por
 * esgotamento de pool (29/07), isso nao e detalhe.
 *
 * `cache()` vale por request: duas requests continuam buscando de novo, que e
 * o certo — quem cuida do intervalo e o ISR de 24h.
 */
/**
 * ★ printed_total do set no Data Cache (14/09/2026). Muda quando um set e
 * cadastrado, nao a cada visita -- e era uma ida ao Supabase por render de
 * carta. O Data Cache sobrevive a deploy: a rajada de robo que vem logo depois
 * de um deploy (que zera o ISR das ~66 mil cartas) nao repete esta leitura.
 * Falha lanca (regra da casa: vazio dentro de unstable_cache fica servido);
 * quem vira null e o chamador, fora do cache.
 */
// ★ 09/10/2026 (Fase 2 do #490): o mesmo select passou a trazer `name_pt` --
// o nome do set em portugues entra no title, no H1, na description e no
// breadcrumb ("Raio Negro (Black Bolt)"). O brasileiro busca "zekrom ex raio
// negro" e a pagina so dizia "Black Bolt". Chave -v2 porque a forma mudou.
type InfoSet = { printed_total: number | null; name_pt: string | null }
const infoDoSet = unstable_cache(
  async (setId: string): Promise<InfoSet> => {
    const sb = getServiceSupabase()
    if (!sb) throw new Error('[carta] sem cliente Supabase')
    const { data, error } = await sb.from('pokemon_sets').select('printed_total, name_pt').eq('id', setId).maybeSingle()
    if (error) throw new Error(`[carta] info do set: ${error.message}`)
    return { printed_total: data?.printed_total ?? null, name_pt: data?.name_pt ?? null }
  },
  ['carta-set-info-v2'],
  { revalidate: 86400 },
)

/** "Raio Negro (Black Bolt)" quando ha nome em portugues; senao o nome como veio. */
function rotuloDoSet(c: { setName: string | null; setNamePt: string | null }): string | null {
  if (!c.setName) return c.setNamePt
  if (c.setNamePt && c.setNamePt !== c.setName) return `${c.setNamePt} (${c.setName})`
  return c.setName
}

/**
 * Teto de tempo que vale MESMO. O `AbortSignal.timeout` do fetch da API
 * oficial nao garantiu o corte: em 13/09 duas paginas do Arceus (que chamam a
 * API em todo render) estouraram os 20s com o banco respondendo em menos de
 * 600ms. A corrida abaixo solta a pagina no prazo, responda a API ou nao.
 */
function comTeto<T>(promessa: Promise<T>, ms: number, seEstourar: T): Promise<T> {
  return new Promise(resolve => {
    const t = setTimeout(() => resolve(seEstourar), ms)
    promessa.then(
      v => { clearTimeout(t); resolve(v) },
      () => { clearTimeout(t); resolve(seEstourar) },
    )
  })
}

const fetchCardData = cache(async function fetchCardData(idOrSlug: string): Promise<NormalizedCard | null> {
  // A rota aceita a URL nova (slug) e a antiga (id, ainda circulando em links
  // compartilhados e no indice do Google). Resolvemos no banco ANTES de chamar
  // a API oficial, porque ela so entende o id — mandar um slug pra la seria
  // uma chamada desperdicada em toda visita.
  let bynx: any = null
  let printedTotal: number | null = null
  let precoSuspeito = false
  let precoMediana: number | null = null
  let precoNSnaps: number | null = null
  const sb = getServiceSupabase()
  if (sb) {
    const COLS =
      'id, slug, name, number, set_id, set_name, set_release_date, set_total, supertype, ' +
      'rarity, hp, types, image_small, image_large, attacks, idioma, ' +
      // ★ Ficha da carta (Fase 2 do #490, 09/10/2026): colunas que ja
      // existiam na linha e nunca entravam no select. Zero consulta nova.
      'artist, subtypes, weaknesses, resistances, retreat_cost, legalities, regiao, set_series, flavor_text, ' +
      'ultima_venda_cents, ultima_venda_variante, ultima_venda_condicao, ultima_venda_atualizado_em, ' +
      'vendas_3m_qtd_label, vendas_3m_medio_cents, vendas_3m_capturado_em, ' +
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
          .select('suspeito, mediana, n_snaps, n_liquidez')
          .eq('card_id', bynx.id)
          .maybeSingle()
        const m = marca as { suspeito?: boolean; mediana?: number; n_snaps?: number; n_liquidez?: number } | null

        // ★ O GUARD PASSOU A SER VIVO (06/09/2026).
        //
        // `suspeito` e uma MARCA GRAVADA, e ela esta congelada desde 31/08: o
        // comentario em /api/cards/lookup afirma que "o cron diario desmarca
        // sozinho quando a mediana alcanca", e esse cron NUNCA EXISTIU --
        // conferido no vercel.json (5 crons, nenhum e esse) e no codigo (a
        // unica rota que toca a tabela so le). Resultado medido em producao:
        // 319 paginas anunciando no <title> do Google um preco que ninguem
        // paga. Applin a R$ 49,90 com mediana de R$ 0,08 (624x), Charizard a
        // R$ 700 com mediana de R$ 2 (350x), Plusle a R$ 319,90 contra R$ 1.
        //
        // A marca continua valendo (se o guard marcou, respeita). O que muda e
        // que agora tambem se CALCULA na hora, com o preco de agora contra a
        // mediana historica da propria carta. Custa zero consulta nova: este
        // select ja rodava, so pedia menos colunas.
        //
        // Efeito colateral bom: carta que normalizar volta a mostrar preco
        // sozinha, sem depender de ninguem desmarcar.
        //
        // NAO cobre o catalogo todo -- so as ~14,3 mil cartas que tem mediana
        // historica. As outras ~52 mil nao tem como ser avaliadas aqui;
        // recalcular a baseline e trabalho do repo do scan.
        precoSuspeito = !!m?.suspeito || precoForaDaMediana(
          bynx.preco_min ? Number(bynx.preco_min) : 0,
          Number(m?.mediana) || 0,
          Number(m?.n_snaps) || 0,
          Number(m?.n_liquidez) || 0,
        )
        // ★ 08/10/2026: a mediana segue pro cliente. Em carta marcada, a UI
        // passa a mostrar ELA como referencia e esconde a oferta inflada atras
        // de um toque -- assim o numero errado sai do HTML que o servidor
        // entrega, que e o que o Google e os modelos de IA leem. Mesmo select,
        // zero consulta nova.
        if (precoSuspeito && Number(m?.mediana) > 0) {
          precoMediana = Number(m?.mediana)
          precoNSnaps = Number(m?.n_snaps) || null
        }
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
  // ★ Trainer e Energy NUNCA tem hp nem tipo (14/09/2026). Com a regra antiga
  // eles contavam como "sem dados de jogo" pra sempre: das 3.310 cartas que
  // chamavam a API em todo render, 3.175 eram Trainer/Energy -- e a API nao
  // tinha nada a acrescentar (hoje responde 500 pra pl4-91, por exemplo).
  // Supertype nulo continua chamando: nao da pra saber o que a carta e.
  const podeTerDadosDeJogo = bynx?.supertype == null || bynx.supertype === 'Pokémon'
  const vaiChamarApi = !idEhNosso && !temDadosDeJogo && podeTerDadosDeJogo

  // printed_total = o numero impresso NA carta (23/132), nao o total com
  // secretas (23/188). E o que o colecionador digita na busca.
  //
  // Roda em paralelo com a API: as duas so dependem do `bynx`, nao uma da
  // outra. Em serie eram dois RTTs empilhados.
  const [infoSet, tcgRes] = await Promise.all([
    bynx?.set_id
      ? infoDoSet(bynx.set_id).catch(() => null)
      : Promise.resolve(null),
    vaiChamarApi
      ? comTeto(fetch(`https://api.pokemontcg.io/v2/cards/${idReal}`, {
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
        }), 5000, null)
      : Promise.resolve(null),
  ])

  printedTotal = infoSet?.printed_total ?? null

  // O corpo tambem entra no teto: resposta que chega mas trava no stream
  // seguraria a pagina do mesmo jeito.
  const tcgJson: any = tcgRes?.ok ? await comTeto(tcgRes.json().catch(() => null), 3000, null) : null
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
    precoMediana,
    precoNSnaps,
    precoMin: bynx?.preco_min ? Number(bynx.preco_min) : null,
    precoMedio: bynx?.preco_medio ? Number(bynx.preco_medio) : null,
    precoMax: bynx?.preco_max ? Number(bynx.preco_max) : null,
    idioma: bynx?.idioma ?? null,
    setNamePt: infoSet?.name_pt ?? null,
    artist: bynx?.artist || tcg?.artist || null,
    subtypes: Array.isArray(bynx?.subtypes) ? bynx.subtypes : Array.isArray(tcg?.subtypes) ? tcg.subtypes : [],
    weaknesses: parseTipoValor(bynx?.weaknesses ?? tcg?.weaknesses),
    resistances: parseTipoValor(bynx?.resistances ?? tcg?.resistances),
    retreatCost: Array.isArray(bynx?.retreat_cost) ? bynx.retreat_cost : Array.isArray(tcg?.retreatCost) ? tcg.retreatCost : [],
    legalities: parseLegalidades(bynx?.legalities ?? tcg?.legalities),
    regiao: bynx?.regiao ?? null,
    setSeries: bynx?.set_series || tcg?.set?.series || null,
    flavorText: bynx?.flavor_text || tcg?.flavorText || null,
    ultimaVenda:
      bynx?.ultima_venda_cents != null && Number(bynx.ultima_venda_cents) > 0
        ? {
            cents: Number(bynx.ultima_venda_cents),
            variante: bynx.ultima_venda_variante ?? null,
            condicao: bynx.ultima_venda_condicao ?? null,
            em: bynx.ultima_venda_atualizado_em ?? null,
          }
        : null,
    vendas3m:
      bynx?.vendas_3m_qtd_label || (bynx?.vendas_3m_medio_cents != null && Number(bynx.vendas_3m_medio_cents) > 0)
        ? {
            label: bynx.vendas_3m_qtd_label ?? null,
            medioCents: bynx.vendas_3m_medio_cents != null ? Number(bynx.vendas_3m_medio_cents) : null,
            em: bynx.vendas_3m_capturado_em ?? null,
          }
        : null,
    variantes: buildVariantesCarta(bynx),
    // ATENCAO ao `!= null`: aqui 0 e um valor CARREGADO DE SENTIDO ("a
    // varredura passou e ninguem esta vendendo"), diferente de null ("a
    // varredura nunca passou"). O `? :` usado nos precos acima achataria os
    // dois em null e mataria justamente a distincao que essa coluna existe
    // pra fazer.
    ligaRangeMin: bynx?.liga_range_min != null ? Number(bynx.liga_range_min) : null,
    ligaRangeMax: bynx?.liga_range_max != null ? Number(bynx.liga_range_max) : null,
  }
})

// --- Cartas relacionadas (link building / SEO) ---
type MiniCard = CartaCarrossel
type RelatedCards = {
  pokemon_name: string | null
  artist: string | null
  same_set: MiniCard[]
}

const COLS_MINI = 'id, slug, name, number, image_small, set_name, rarity, idioma, preco_min, preco_medio, preco_max'

function miniCard(l: any): MiniCard {
  return {
    id: String(l.id),
    slug: l.slug ?? null,
    name: String(l.name ?? ''),
    number: l.number ?? null,
    image_small: l.image_small ?? null,
    set_name: l.set_name ?? null,
    rarity: l.rarity ?? null,
    idioma: l.idioma ?? null,
    preco_min: precoNum(l.preco_min),
    preco_medio: precoNum(l.preco_medio),
    preco_max: precoNum(l.preco_max),
  }
}

/**
 * ★ Relacionadas em TRES caches, cada um pela sua chave natural (Fase 3 do
 * #490, 09/10/2026). Medido com explain (analyze, buffers): a lista do Pokemon
 * custa 630 blocos no Pikachu e a do ilustrador 1.479 no 5ban Graphics. Com
 * cache POR CARTA (como era na v1), as 660 paginas de Pikachu repetiam a mesma
 * varredura, uma por dia cada. Agora:
 *  - `get_related_cards_v2` (por carta): nome do Pokemon, ilustrador e as 8
 *    vizinhas do set, ja com preco -- 88 blocos no pior caso medido;
 *  - mais valiosas do Pokemon, em cache pelo NOME do Pokemon (`@>` usa o GIN);
 *  - do mesmo ilustrador, em cache pelo nome do ILUSTRADOR (btree em artist).
 * As duas ultimas rodam uma vez por dia para todas as cartas que compartilham
 * a chave. Falha lanca dentro do cache; o chamador converte em vazio fora.
 * A v1 continua no banco ate esta versao estar provada em producao.
 */
const relacionadasEmCache = unstable_cache(
  async (id: string): Promise<RelatedCards> => {
    const sb = getServiceSupabase()
    if (!sb) throw new Error('[carta] sem cliente Supabase')
    const { data, error } = await sb.rpc('get_related_cards_v2', { p_id: id, p_limit: 8 })
    if (error) throw new Error(`[carta] get_related_cards_v2: ${error.message}`)
    const d = (data || {}) as { pokemon_name?: string | null; artist?: string | null; same_set?: any[] }
    return {
      pokemon_name: d.pokemon_name ?? null,
      artist: d.artist ?? null,
      same_set: Array.isArray(d.same_set) ? d.same_set.map(miniCard) : [],
    }
  },
  ['carta-relacionadas-v3'],
  { revalidate: 86400 },
)

async function fetchRelatedCards(id: string): Promise<RelatedCards> {
  try {
    return await relacionadasEmCache(id)
  } catch {
    return { pokemon_name: null, artist: null, same_set: [] }
  }
}

/** As 7 cartas mais caras do Pokemon (7 porque a carta atual pode estar entre elas). */
const valiosasDoPokemonEmCache = unstable_cache(
  async (nome: string): Promise<MiniCard[]> => {
    const sb = getServiceSupabase()
    if (!sb) throw new Error('[carta] sem cliente Supabase')
    const { data, error } = await sb
      .from('pokemon_cards')
      .select(COLS_MINI)
      .contains('base_pokemon_names', [nome])
      .not('image_small', 'is', null)
      .gt('preco_min', 0)
      .order('preco_min', { ascending: false })
      .limit(7)
    if (error) throw new Error(`[carta] valiosas do Pokemon: ${error.message}`)
    return (data || []).map(miniCard)
  },
  ['carta-pokemon-valiosas-v1'],
  { revalidate: 86400 },
)

/** As 7 cartas mais caras do mesmo ilustrador. */
const doIlustradorEmCache = unstable_cache(
  async (artista: string): Promise<MiniCard[]> => {
    const sb = getServiceSupabase()
    if (!sb) throw new Error('[carta] sem cliente Supabase')
    const { data, error } = await sb
      .from('pokemon_cards')
      .select(COLS_MINI)
      .eq('artist', artista)
      .not('image_small', 'is', null)
      .gt('preco_min', 0)
      .order('preco_min', { ascending: false })
      .limit(7)
    if (error) throw new Error(`[carta] cartas do ilustrador: ${error.message}`)
    return (data || []).map(miniCard)
  },
  ['carta-ilustrador-v1'],
  { revalidate: 86400 },
)

async function fetchValiosasDoPokemon(nome: string | null): Promise<MiniCard[]> {
  if (!nome) return []
  try {
    return await valiosasDoPokemonEmCache(nome)
  } catch (err) {
    console.error('[carta] valiosas do Pokemon:', (err as Error)?.message)
    return []
  }
}

async function fetchDoIlustrador(artista: string | null): Promise<MiniCard[]> {
  if (!artista) return []
  try {
    return await doIlustradorEmCache(artista)
  } catch (err) {
    console.error('[carta] cartas do ilustrador:', (err as Error)?.message)
    return []
  }
}

/**
 * ★ Historico de preco no SERVIDOR (Fase 2b do #490, 09/10/2026). Ate aqui o
 * grafico nascia num useEffect: o HTML que o Google e os modelos de IA leem
 * nao tinha historico nenhum. `get_card_price_history` e lookup por PK em
 * price_snapshots (medido: 7 buffers, 0,2 ms). Um dia de Data Cache, como as
 * relacionadas. Lista vazia e resultado VALIDO (carta sem levantamento);
 * falha lanca, e o chamador devolve null fora do cache -- ai o cliente busca
 * sozinho, como sempre fez.
 */
const historicoEmCache = unstable_cache(
  async (id: string): Promise<PontoHistorico[]> => {
    const sb = getServiceSupabase()
    if (!sb) throw new Error('[carta] sem cliente Supabase')
    const { data, error } = await sb.rpc('get_card_price_history', { p_id: id, p_days: 365 })
    if (error) throw new Error(`[carta] get_card_price_history: ${error.message}`)
    return ((data || []) as any[]).map(p => ({
      snapshot_date: String(p.snapshot_date).slice(0, 10),
      preco_min: p.preco_min != null ? Number(p.preco_min) : null,
      preco_medio: p.preco_medio != null ? Number(p.preco_medio) : null,
      preco_max: p.preco_max != null ? Number(p.preco_max) : null,
    }))
  },
  ['carta-historico-v1'],
  { revalidate: 86400 },
)

async function fetchHistorico(id: string): Promise<PontoHistorico[] | null> {
  try {
    return await historicoEmCache(id)
  } catch (err) {
    console.error('[carta] historico:', (err as Error)?.message)
    return null
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
  // No title entra SO o nome em portugues quando existe (cabe no limite de
  // 50 chars); na description entra o par "Raio Negro (Black Bolt)".
  const setTitulo = card.setNamePt || card.setName
  const setDesc = rotuloDoSet(card)
  const setStr = setTitulo ? ` — ${setTitulo}` : ''
  // ★ O preco que representa a carta no Google e o MENOR (25/08/2026).
  // Quem compra leva pelo menor, entao e esse que o SERP deve anunciar --
  // prometer a media e prometer um numero que ninguem paga.
  // Carta marcada pelo guard nao leva preco pro SERP: um numero errado no
  // titulo do Google e pior que titulo sem numero -- ele atrai o clique e
  // quebra a confianca na chegada.
  // ★ A OFERTA REAL ENTRA NA CONTA DO MENOR (04/09/2026). A regra de 25/08 ja
  // dizia que o preco que representa a carta no SERP e o MENOR -- so que ate
  // agora "menor" era so o minimo de MERCADO. Medido em 04/09: 11 das 60
  // ofertas cruas estao ABAIXO do preco de mercado da propria carta (o Mew-V
  // a R$ 34,26 contra R$ 44,67 de referencia). Ou seja, o Google anunciava um
  // preco PIOR do que o que a Bynx tinha a venda na mesma pagina.
  // Graduada e travada ficam fora: slab e outro produto, e anuncio em
  // negociacao nao pode virar preco no Google. Ver `ofertasParaDivulgacao`.
  const ofertasMeta = ofertasParaDivulgacao(await buscarOfertasDaCarta(card.id))
  const menorOferta = ofertasMeta.length ? Math.min(...ofertasMeta.map(o => o.preco)) : null
  const menorReal = card.precoSuspeito
    ? menorOferta
    : [card.precoMin, menorOferta].filter((v): v is number => typeof v === 'number' && v > 0).sort((x, y) => x - y)[0] ?? null
  const precoStr = formatBRL(menorReal)

  // Title com preco em R$ no SERP (diferencial Bynx). Guarda de tamanho:
  // nome+numero+preco sempre; set so entra se couber (~50 chars antes de " | Bynx.gg").
  let title: string
  if (precoStr) {
    const baseComPreco = `${card.name}${numStr} — ${precoStr}`
    const restante = 50 - baseComPreco.length
    const sufixoSet = setTitulo ? ` | ${setTitulo}` : ''
    title = sufixoSet && sufixoSet.length <= restante ? baseComPreco + sufixoSet : baseComPreco
  } else {
    title = `${card.name}${numStr}${setStr}`
  }
  const description = precoStr
    ? `Quanto vale ${card.name}${numStr} de ${setDesc || 'Pokémon TCG'}? A partir de ${precoStr}, atualizado em reais na Bynx. Veja a faixa (mín–máx), as variantes e acompanhe na sua coleção.`
    : `Quanto vale ${card.name}${numStr}${setDesc ? ` de ${setDesc}` : ''}? Veja o preço em reais, variantes, raridade e ataques, e acompanhe na sua coleção Pokémon TCG na Bynx.`

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

  // Ofertas reais da Bynx. Depois do redirect de proposito: se a URL vai
  // mudar, nao vale gastar a consulta.
  const ofertas = await buscarOfertasDaCarta(card.id)

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
    description: `${card.name}${rotuloDoSet(card) ? ` de ${rotuloDoSet(card)}` : ''} — Pokémon TCG`,
    brand: {
      '@type': 'Brand',
      name: 'Pokémon TCG',
    },
    category: 'Trading Card Game',
  }

  // ★ Dado estruturado da ficha (Fase 2 do #490): o que um modelo de IA le sem
  // interpretar prosa. So entra o que existe; nada de campo vazio.
  const propriedades: Array<{ '@type': 'PropertyValue'; name: string; value: string }> = []
  const prop = (name: string, value: string | null | undefined) => {
    if (value) propriedades.push({ '@type': 'PropertyValue', name, value })
  }
  prop('Número', card.number && card.setTotal ? `${card.number}/${card.setTotal}` : card.number)
  prop('Set', rotuloDoSet(card))
  prop('Raridade', raridadePt(card.rarity))
  prop('Estágio', card.subtypes.map(subtipoPt).join(', ') || null)
  prop('Tipo', card.types.map(tipoTcgPt).join(', ') || null)
  prop('HP', card.hp ? String(card.hp) : null)
  prop('Ilustrador', card.artist)
  prop('Idioma', idiomaPt(card.idioma))
  prop('Ano', card.setReleaseYear)
  if (propriedades.length) productSchema.additionalProperty = propriedades

  // ★ O JSON-LD PASSOU A DECLARAR AS OFERTAS REAIS (04/09/2026), com DUAS
  // exclusoes deliberadas: graduada e travada. Ver `ofertasParaDivulgacao` --
  // slab e outro produto (no Clefairy a diferenca e de 6,6x), e anuncio em
  // negociacao nao pode virar preco no Google: ele nao esta a venda agora.
  //
  // A faixa cobre o que a PAGINA mostra: o preco de mercado (que continua no
  // topo, e e a referencia) e as ofertas compraveis. Nao trocar um pelo outro
  // e o que impede o rich snippet de contradizer o corpo da pagina. O
  // `offerCount` conta so o que da pra comprar, que e o que o campo significa.
  //
  // O `title` usa o MESMO menor numero (ver generateMetadata): o SERP anuncia
  // um preco e a pagina entrega esse preco.
  // Uma leitura de relogio so, usada pelos dois ramos abaixo. Duas chamadas
  // de `Date.now()` no render viram dois avisos de pureza; o valor e o mesmo.
  const agora = Date.now()
  const validoAte = (dias: number) => new Date(agora + dias * 864e5).toISOString().slice(0, 10)

  const cruas = ofertasParaDivulgacao(ofertas)
  if (cruas.length > 0) {
    const precosOferta = cruas.map(o => o.preco)
    const candLow = [card.precoSuspeito ? null : card.precoMin, ...precosOferta]
      .filter((v): v is number => typeof v === 'number' && v > 0)
    const candHigh = [card.precoSuspeito ? null : (card.precoMax ?? card.precoMin), ...precosOferta]
      .filter((v): v is number => typeof v === 'number' && v > 0)
    productSchema.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'BRL',
      lowPrice: Math.min(...candLow),
      highPrice: Math.max(...candHigh),
      offerCount: cruas.length,
      availability: 'https://schema.org/InStock',
      // 30 dias, nao 1 ano como no ramo do preco de mercado: aqui e anuncio
      // de verdade, que sai do ar quando vende. Data no passado o Google le
      // como oferta expirada, entao tem que ser maior que o ISR de 24h --
      // 30 dias e folga sem prometer um preco que nao existe mais.
      priceValidUntil: validoAte(30),
      url: `https://bynx.gg/carta/${card.slug || card.id}`,
      offers: cruas.map(o => ({
        '@type': 'Offer',
        price: o.preco,
        priceCurrency: 'BRL',
        availability: 'https://schema.org/InStock',
        url: `https://bynx.gg${o.href}`,
        seller: { '@type': 'Organization', name: o.vendedor },
      })),
    }
  } else if (card.precoMin && !card.precoSuspeito) {
    // Sem oferta crua (ou so slab): segue o preco de mercado, como sempre foi.
    // O GATE e o precoMin junto com a regra: com o gate no medio, uma carta
    // que tem minimo mas nao tem medio sairia do snippet sem oferta nenhuma.
    productSchema.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'BRL',
      lowPrice: card.precoMin,
      highPrice: card.precoMax ?? card.precoMin,
      offerCount: 1,
      availability: 'https://schema.org/InStock',
      priceValidUntil: validoAte(365),
      url: `https://bynx.gg/carta/${card.slug || card.id}`,
    }
  }

  // a RPC casa por id de carta, nao por slug — passa o id resolvido.
  // (Vem antes do breadcrumb desde 09/10: a trilha passou a incluir o hub do
  // Pokemon, e o nome dele sai daqui. E Data Cache de 24h, a ordem nao custa.)
  const related = await fetchRelatedCards(card.id)
  const [valiosas, doIlustrador, historico, statsConvite] = await Promise.all([
    fetchValiosasDoPokemon(related.pokemon_name),
    fetchDoIlustrador(related.artist),
    fetchHistorico(card.id),
    fetchStatsConvite(),
  ])

  // BreadcrumbList: ajuda navegação no Google + UX
  // ★ Trilha nova (Fase 2 do #490): Inicio > Pokemon > {Pokemon} > {Set em PT} > Carta.
  // Antes era Inicio > Sets > {Set} > Carta: o hub do Pokemon, que e a pagina
  // mais rica do site, so aparecia como botao solto, e o set saia em ingles.
  const breadcrumbItems: { name: string; href: string }[] = [
    { name: 'Início', href: '/' },
    { name: 'Pokémon', href: '/pokedex-pokemon-tcg' },
  ]
  if (related.pokemon_name) {
    breadcrumbItems.push({ name: related.pokemon_name, href: `/pokemon/${slugifyName(related.pokemon_name)}` })
  }
  if (card.setName && card.setId) {
    breadcrumbItems.push({ name: card.setNamePt || card.setName, href: `/set/${card.setId}` })
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

  // Outras cartas do mesmo Pokemon como produtos relacionados no JSON-LD
  // (ja estao em memoria, vindas da RPC cacheada).
  const similares = valiosas.filter(c => c.id !== card.id).slice(0, 6)
  if (similares.length) {
    productSchema.isSimilarTo = similares.map(c => ({
      '@type': 'Product',
      name: c.name,
      url: `https://bynx.gg/carta/${c.slug || c.id}`,
    }))
  }

  // Posts do blog que casam com a carta (indice global em cache de 1h, casamento
  // em memoria: zero consulta por carta).
  const postsDaCarta = await postsParaCarta({
    cardId: card.id,
    cardSlug: card.slug,
    pokemonName: related.pokemon_name,
    setNames: [card.setName, card.setNamePt],
  })

  // ★ Os tres carrosseis (Fase 2b + Fase 3 do #490): as 6 mais valiosas do
  // Pokemon (agora de verdade: ordenadas no banco entre TODAS as cartas dele),
  // as 6 vizinhas do set e as 6 mais caras do mesmo ilustrador. Nenhuma carta
  // se repete entre eles, e a propria carta fica de fora.
  // Total impresso: do mesmo set, e o da propria carta (printed_total, "86");
  // de outro set nao se sabe aqui, e o set_total do catalogo conta as secretas
  // ("166/172" numa pagina que diz "172/86") -- sai so o numero.
  const jaMostradas = new Set<string>([card.id])
  const pegar = (lista: MiniCard[], setTotal: number | null) => {
    const out: MiniCard[] = []
    for (const c of lista) {
      if (out.length >= 6 || jaMostradas.has(c.id)) continue
      jaMostradas.add(c.id)
      out.push({ ...c, set_total: setTotal })
    }
    return out
  }
  const maisDoPokemon = pegar(valiosas, null)
  const maisDoSet = pegar(related.same_set, card.setTotal)
  const maisDoIlustrador = pegar(doIlustrador, null)
  const slugDaPagina = `/carta/${card.slug || card.id}`

  // ★ Mercado Livre POR SET (Fase 2 do #490): booster e ETB do set da carta em
  // vez dos mesmos acessorios genericos em 66 mil paginas. A lib ja cai em
  // 'acessorios'/'default' quando o set nao tem link cadastrado. Uma faixa so.
  const mlLink = await getMlAfiliadoLink(card.setId || 'acessorios')

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
      <CardClient
        card={card}
        breadcrumb={breadcrumbItems}
        // Resumo das ofertas compraveis para a acao da primeira dobra:
        // "Comprar na Bynx a partir de R$ X" aponta pro anuncio mais barato.
        ofertas={
          cruas.length
            ? {
                n: cruas.length,
                menor: Math.min(...cruas.map(o => o.preco)),
                href: [...cruas].sort((a, b) => a.preco - b.preco)[0].href,
              }
            : { n: 0, menor: null, href: null }
        }
        historico={historico}
      >
        {/* ★ Ordem abaixo da ficha (Fase 2b do #490, mockup aprovado em 09/10):
            mais cartas do Pokemon -> convite -> a venda na Bynx -> blog -> mais
            do set -> Mercado Livre. O convite vem DEPOIS de a pessoa ter lido o
            que a pagina sabe da carta, e o anuncio nunca antes do convite. */}
        {related.pokemon_name && (
          <CarrosselCartas
            idTitulo="mais-do-pokemon"
            titulo={`Mais valiosas de ${related.pokemon_name}`}
            cartas={maisDoPokemon}
            verTodas={{ href: `/pokemon/${slugifyName(related.pokemon_name)}`, label: `Ver todas as cartas de ${related.pokemon_name}` }}
          />
        )}

        <ConviteBynx stats={statsConvite} next={slugDaPagina} />

        {/* Ofertas reais da Bynx (estado vazio convida a anunciar). */}
        <OfertasDaCarta ofertas={ofertas} nomeCarta={card.name} />

        <BlogDaCarta posts={postsDaCarta} />

        {(card.setNamePt || card.setName) && (
          <CarrosselCartas
            idTitulo="mais-do-set"
            titulo={`Mais de ${card.setNamePt || card.setName}`}
            cartas={maisDoSet}
            verTodas={card.setId ? { href: `/set/${card.setId}`, label: 'Ver o set completo' } : undefined}
          />
        )}

        {/* Do mesmo ilustrador (Fase 3), com link pro hub /ilustrador/[slug]. */}
        {related.artist && (
          <CarrosselCartas
            idTitulo="mais-do-ilustrador"
            titulo={`Ilustradas por ${related.artist}`}
            cartas={maisDoIlustrador}
            // O hub so existe com 3+ cartas com preco (abaixo disso e 404);
            // a lista de 7 ja cacheada e o mesmo criterio.
            verTodas={doIlustrador.length >= MIN_CARTAS_COM_PRECO ? { href: `/ilustrador/${slugIlustrador(related.artist)}`, label: `Ver todas as cartas de ${related.artist}` } : undefined}
          />
        )}

        {/* Uma faixa, abaixo do conteudo: anuncio nao traz SEO (sponsored
            nofollow) e a grade de 6 produtos ocupava 635 px antes do convite
            de cadastro no celular. */}
        {mlLink && (
          <MercadoLivre
            variante="strip"
            url={mlLink.url}
            titulo={mlLink.titulo}
            subtitulo={mlLink.subtitulo}
            produtos={[]}
          />
        )}
      </CardClient>
    </>
  )
}
