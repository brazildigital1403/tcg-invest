/**
 * src/app/ilustrador/[slug]/page.tsx
 *
 * Hub de ilustrador (Fase 3 do epico #490, 09/10/2026).
 *
 * A pagina da carta ja mostra "Ilustradas por X"; isto e o "ver todas". Uma
 * pagina por ilustrador com 3+ cartas com preco (318 dos 394), as 24 mais
 * valiosas no CardItem padrao, com preco em reais. Server component: tudo
 * sai no HTML.
 *
 * Custo, medido antes de existir (explain analyze, buffers):
 *  - lista de ilustradores: `get_ilustradores` (loose index scan, ~100
 *    paginas de indice + 312 heap fetches), cache GLOBAL de 1 dia;
 *  - cartas do ilustrador: indice btree em artist, 700-1.500 blocos no pior
 *    caso (5ban Graphics), cache POR ILUSTRADOR de 1 dia -- a mesma chave
 *    natural que a pagina da carta usa.
 * Nada aqui varre a tabela.
 *
 * Fora do sitemap por decisao do Du (superficie de crawl); o Google chega
 * pelos links das paginas de carta.
 */

import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getServiceSupabase } from '@/lib/supabaseServer'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import Breadcrumb from '@/components/ui/Breadcrumb'
import CardItem from '@/components/ui/CardItem'
import ConviteBynx from '@/components/cards/ConviteBynx'
import { fetchStatsConvite } from '@/lib/conviteStats'
import { MIN_CARTAS_COM_PRECO, slugIlustrador } from '@/lib/ilustrador'

// Mesmo ISR do hub de Pokemon (6 h). Rota com generateStaticParams vazio +
// dynamicParams: gera na primeira visita e fica em cache; prerenderizar 318
// hubs no build custaria leitura da tabela.
export const revalidate = 21600
export async function generateStaticParams() {
  return []
}
export const dynamicParams = true
export const maxDuration = 20

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

// ─── Lista global: slug -> nomes. Colisao ("K. Hoshiba" e "K Hoshiba") vira o
// mesmo hub: a consulta usa `in`. Falha lanca: lista vazia em cache seria 404
// em todos os hubs por um dia. ──────────────────────────────────────────────
const mapaIlustradores = unstable_cache(
  async (): Promise<Record<string, string[]>> => {
    const sb = getServiceSupabase()
    if (!sb) throw new Error('[ilustrador] sem cliente Supabase')
    const { data, error } = await sb.rpc('get_ilustradores')
    if (error) throw new Error(`[ilustrador] get_ilustradores: ${error.message}`)
    const mapa: Record<string, string[]> = {}
    for (const r of (data || []) as Array<{ artist: string }>) {
      const s = slugIlustrador(String(r.artist || ''))
      if (!s) continue
      ;(mapa[s] ||= []).push(r.artist)
    }
    if (!Object.keys(mapa).length) throw new Error('[ilustrador] lista vazia')
    return mapa
  },
  ['ilustradores-mapa-v1'],
  { revalidate: 86400 },
)

type CartaHub = {
  id: string
  slug: string | null
  name: string
  number: string | null
  image_small: string | null
  set_name: string | null
  rarity: string | null
  idioma: string | null
  preco_min: number | null
  preco_medio: number | null
  preco_max: number | null
}

type HubIlustrador = {
  nome: string
  totalCartas: number
  comPreco: number
  cartas: CartaHub[]
}

const COLS = 'id, slug, name, number, image_small, set_name, rarity, idioma, preco_min, preco_medio, preco_max'
const num = (v: unknown) => {
  const f = Number(v)
  return f > 0 ? f : null
}

const hubEmCache = unstable_cache(
  async (nomes: string[]): Promise<HubIlustrador> => {
    const sb = getServiceSupabase()
    if (!sb) throw new Error('[ilustrador] sem cliente Supabase')
    const [top, total] = await Promise.all([
      sb
        .from('pokemon_cards')
        .select(COLS, { count: 'exact' })
        .in('artist', nomes)
        .not('image_small', 'is', null)
        .gt('preco_min', 0)
        .order('preco_min', { ascending: false })
        .limit(24),
      sb.from('pokemon_cards').select('id', { count: 'exact', head: true }).in('artist', nomes),
    ])
    if (top.error) throw new Error(`[ilustrador] cartas: ${top.error.message}`)
    if (total.error) throw new Error(`[ilustrador] contagem: ${total.error.message}`)
    return {
      nome: nomes[0],
      totalCartas: total.count ?? 0,
      comPreco: top.count ?? 0,
      cartas: ((top.data || []) as any[]).map(l => ({
        id: String(l.id),
        slug: l.slug ?? null,
        name: String(l.name ?? ''),
        number: l.number ?? null,
        image_small: l.image_small ?? null,
        set_name: l.set_name ?? null,
        rarity: l.rarity ?? null,
        idioma: l.idioma ?? null,
        preco_min: num(l.preco_min),
        preco_medio: num(l.preco_medio),
        preco_max: num(l.preco_max),
      })),
    }
  },
  ['ilustrador-hub-v1'],
  { revalidate: 86400 },
)

async function carregarHub(slug: string): Promise<HubIlustrador | null> {
  const mapa = await mapaIlustradores()
  const nomes = mapa[slug]
  if (!nomes?.length) return null
  const hub = await hubEmCache(nomes)
  if (hub.comPreco < MIN_CARTAS_COM_PRECO) return null
  return hub
}

// ─── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const hub = await carregarHub(slug)
  if (!hub) {
    return { title: 'Ilustrador não encontrado', robots: { index: false, follow: false } }
  }
  const top = hub.cartas[0]
  const title = `${hub.nome} — ${hub.totalCartas} cartas Pokémon TCG ilustradas e preços em reais`
  const description =
    `Todas as cartas de Pokémon TCG ilustradas por ${hub.nome} na Bynx: ${hub.totalCartas} cartas, ${hub.comPreco} com preço no Mercado Brasileiro.` +
    (top?.preco_min ? ` A mais valiosa é ${top.name}${top.number ? ` ${top.number}` : ''}, a partir de ${brl(top.preco_min)}.` : '')
  const url = `https://bynx.gg/ilustrador/${slug}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | Bynx.gg`, description, url, type: 'website', siteName: 'Bynx', locale: 'pt_BR', images: top?.image_small ? [{ url: top.image_small, alt: top.name }] : undefined },
    twitter: { card: 'summary_large_image', title: `${title} | Bynx.gg`, description, images: top?.image_small ? [top.image_small] : undefined },
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function IlustradorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const hub = await carregarHub(slug)
  if (!hub) notFound()

  const stats = await fetchStatsConvite()
  const top = hub.cartas[0]
  const url = `/ilustrador/${slug}`

  const breadcrumbItems = [
    { name: 'Início', href: '/' },
    { name: hub.nome, href: url },
  ]
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `https://bynx.gg${it.href}` })),
  }
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Cartas ilustradas por ${hub.nome}`,
    description: `${hub.totalCartas} cartas de Pokémon TCG ilustradas por ${hub.nome}, com preços em reais.`,
    url: `https://bynx.gg${url}`,
    inLanguage: 'pt-BR',
    about: { '@type': 'Person', name: hub.nome, jobTitle: 'Ilustrador de Pokémon TCG' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: hub.comPreco,
      itemListElement: hub.cartas.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: `https://bynx.gg/carta/${c.slug || c.id}`, name: c.name })),
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />

      <div style={{ minHeight: '100vh', background: 'var(--bx-bg)', color: 'var(--bx-text)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <PublicHeader />
        <main className="bx-gutter" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 80px' }}>
          <Breadcrumb items={breadcrumbItems} />

          <section style={{ margin: '8px 0 26px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ac-1)', marginBottom: 6 }}>
              Ilustrador
            </p>
            <h1 style={{ fontSize: 'clamp(30px, 7vw, 46px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 14, overflowWrap: 'anywhere' }}>
              {hub.nome}
            </h1>

            <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>{hub.totalCartas}</div>
                <div style={{ fontSize: 11, color: 'var(--bx-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>cartas</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>{hub.comPreco}</div>
                <div style={{ fontSize: 11, color: 'var(--bx-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>com preço</div>
              </div>
              {top?.preco_min && (
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--bx-green)' }}>{brl(top.preco_min)}</div>
                  <div style={{ fontSize: 11, color: 'var(--bx-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>a mais valiosa</div>
                </div>
              )}
            </div>

            <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--bx-text-2)', maxWidth: 640, margin: 0 }}>
              <b style={{ color: 'var(--bx-text)', fontWeight: 700 }}>{hub.nome}</b> assina {hub.totalCartas} cartas no catálogo da Bynx,{' '}
              {hub.comPreco} delas com preço no Mercado Brasileiro.
              {top?.preco_min ? (
                <>
                  {' '}A mais valiosa hoje é{' '}
                  <Link href={`/carta/${top.slug || top.id}`} style={{ color: 'var(--ac-1)', fontWeight: 600, textDecoration: 'none' }}>
                    {top.name}{top.number ? ` ${top.number}` : ''}
                  </Link>
                  , a partir de {brl(top.preco_min)}.
                </>
              ) : null}
            </p>
          </section>

          <section aria-labelledby="mais-valiosas-ilustrador" style={{ marginBottom: 28 }}>
            <h2
              id="mais-valiosas-ilustrador"
              style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--bx-text-3)', margin: '0 0 12px' }}
            >
              As {hub.cartas.length} mais valiosas
            </h2>
            {/* minmax(0, ...): com `1fr` puro a coluna herda min-width:auto e o
                conteudo estica a grade (ja mordeu tres vezes na casa). */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))', gap: 10 }}>
              {hub.cartas.map(c => (
                <Link key={c.id} href={`/carta/${c.slug || c.id}`} style={{ minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                  <CardItem
                    mode="readonly"
                    hidePriceTable
                    ocultarIdioma={!c.idioma}
                    card={{
                      id: c.id,
                      name: c.name,
                      number: c.number || undefined,
                      set_name: c.set_name || undefined,
                      image_small: c.image_small || undefined,
                      rarity: c.rarity || undefined,
                      idioma: c.idioma || undefined,
                      price: { preco_min: c.preco_min, preco_medio: c.preco_medio, preco_max: c.preco_max },
                    }}
                  />
                </Link>
              ))}
            </div>
          </section>

          <ConviteBynx stats={stats} next={url} cta="ilustrador:convite" />
        </main>
        <PublicFooter />
      </div>
    </>
  )
}
