import { CSSProperties, cache } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { notFound, permanentRedirect } from 'next/navigation'
import { Metadata } from 'next'
import { supabase } from '@/lib/supabaseClient'
import { getServiceSupabase } from '@/lib/supabaseServer'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import Breadcrumb from '@/components/ui/Breadcrumb'
import GaleriaProduto from '@/components/lojas/GaleriaProduto'
import BotaoCarrinho from '@/components/lojas/BotaoCarrinho'
import BotaoCompartilhar from '@/components/ui/BotaoCompartilhar'
import SeloVerificado from '@/components/ui/SeloVerificado'
import { fmtBRL } from '@/lib/comissao'
import { IconBox, IconPlush, IconFigure, IconCollection, IconTag, IconTruck, IconLocation, IconCarrinho, IconShield } from '@/components/ui/Icons'

/**
 * /produto/[id] — a pagina que faltava.
 *
 * Ate aqui o unico endereco de um produto era /checkout/[id]?tipo=produto: pra
 * VER o item o comprador precisava entrar no fluxo de pagamento, e as fotos 2..N
 * e a descricao nao eram lidas por tela nenhuma. Esta rota e o alvo do
 * `cancel_url` da Stripe, do link compartilhavel e do JSON-LD de Product.
 *
 * ★ ESGOTADO CONTINUA SENDO PAGINA, NAO 404. A RLS
 * (`loja_produtos_select_publico`: ativo = true AND estoque > 0) esconderia do
 * anon todo item que vendeu, e a URL de um produto esgotado morreria — pessimo
 * pra SEO e pra qualquer link ja compartilhado. Como esta pagina e server-side,
 * a leitura usa a service role e filtra `ativo` na propria query: o esgotado
 * aparece com o estado certo e o inativo continua invisivel. Isso resolve sem
 * tocar na policy (schema nao entra sem decisao do Du). Se a env da service key
 * faltar, cai no cliente anon — a pagina degrada pro comportamento antigo em vez
 * de quebrar.
 */

export const dynamic = 'force-dynamic'

const TIPO_LABEL: Record<string, string> = {
  selado: 'Selado', pelucia: 'Pelúcia', funko: 'Funko', fichario: 'Fichário', acessorio: 'Acessório',
}
const TIPO_ICONE: Record<string, React.ComponentType<{ size?: number; color?: string; style?: CSSProperties }>> = {
  selado: IconBox, pelucia: IconPlush, funko: IconFigure, fichario: IconCollection, acessorio: IconTag,
}

interface Produto {
  id: string
  slug: string | null
  tipo: string
  nome: string
  descricao: string | null
  preco_cents: number
  estoque: number
  peso_g: number | null
  vendidos: number | null
  fotos: string[] | null
  loja_id: string
}

interface LojaDoProduto {
  id: string
  slug: string
  nome: string | null
  logo_url: string | null
  verificada: boolean | null
  cidade: string | null
  estado: string | null
  connect_charges_enabled: boolean | null
}

/**
 * ★ `cache()`: rodava duas vezes por visita (generateMetadata + pagina), e sao
 * DUAS consultas por vez (`loja_produtos` e `lojas`) — quatro no total. A rota
 * e `force-dynamic`, entao isso era por request, nao por revalidacao.
 */
const buscar = cache(async function buscar(id: string): Promise<{ produto: Produto; loja: LojaDoProduto | null } | null> {
  // Service role pra enxergar o esgotado (a RLS do anon exige estoque > 0);
  // `ativo` volta como filtro explicito, senao a service role mostraria produto
  // que o lojista despublicou.
  const db = getServiceSupabase() ?? supabase

  // A rota aceita SLUG ou UUID. O UUID continua valendo pra nao quebrar link ja
  // compartilhado (o `cancel_url` da Stripe e a versao que ficou dias no ar),
  // mas a page redireciona 301 pro slug — mesma politica da /carta.
  const ehUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  const q = db
    .from('loja_produtos')
    .select('id, slug, tipo, nome, descricao, preco_cents, estoque, peso_g, vendidos, fotos, loja_id')
    .eq('ativo', true)
    .limit(1)

  const { data } = await (ehUuid ? q.eq('id', id) : q.eq('slug', id))
  const produto = (data?.[0] as Produto) || null
  if (!produto) return null

  const { data: ls } = await db
    .from('lojas')
    .select('id, slug, nome, logo_url, verificada, cidade, estado, connect_charges_enabled')
    .eq('id', produto.loja_id)
    .eq('status', 'ativa')
    .limit(1)

  return { produto, loja: (ls?.[0] as LojaDoProduto) || null }
})

/** O endereco publico do produto: slug quando existe, id como ultimo recurso. */
function urlDoProduto(p: { id: string; slug: string | null }): string {
  return `/produto/${p.slug || p.id}`
}

/** Primeira frase util da descricao, pra meta description (limite ~160). */
function resumo(desc: string | null, nome: string, loja: string): string {
  const limpo = (desc || '').replace(/\s+/g, ' ').trim()
  if (!limpo) return `${nome} à venda na ${loja}, pela Bynx.`
  return limpo.length > 158 ? `${limpo.slice(0, 155).trimEnd()}...` : limpo
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const r = await buscar(id)
  if (!r || !r.loja) return { title: 'Produto não encontrado' }

  const { produto, loja } = r

  const nomeLoja = loja.nome || 'Loja'
  const titulo = `${produto.nome} — ${nomeLoja}`
  const desc = resumo(produto.descricao, produto.nome, nomeLoja)
  const foto = produto.fotos?.[0]

  return {
    title: titulo,
    description: desc,
    alternates: { canonical: urlDoProduto(produto) },
    openGraph: {
      title: titulo,
      description: desc,
      url: `https://bynx.gg${urlDoProduto(produto)}`,
      type: 'website',
      images: foto ? [{ url: foto }] : undefined,
    },
  }
}

export default async function ProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await buscar(id)
  if (!r || !r.loja) notFound()

  const { produto, loja } = r

  // ★ 301 do UUID pro slug — ANTES de qualquer render. Tem que viver na PAGE:
  // em `generateMetadata` o redirect nao vira header HTTP, e o crawler receberia
  // a pagina duplicada em duas URLs (foi exatamente o que aconteceu no 1o try).
  if (produto.slug && id !== produto.slug) {
    permanentRedirect(urlDoProduto(produto))
  }

  const nomeLoja = loja.nome || 'Loja'
  const fotos = Array.isArray(produto.fotos) ? produto.fotos.filter(Boolean) : []
  const Icone = TIPO_ICONE[produto.tipo]
  const rotulo = TIPO_LABEL[produto.tipo] || produto.tipo
  const podeVender = !!loja.connect_charges_enabled
  const esgotado = produto.estoque <= 0
  const local = [loja.cidade, loja.estado].filter(Boolean).join(', ')

  const trilha = [
    { name: 'Guia de Lojas', href: '/lojas' },
    { name: nomeLoja, href: `/lojas/${loja.slug}` },
    { name: produto.nome, href: urlDoProduto(produto) },
  ]

  const produtoSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: produto.nome,
    description: resumo(produto.descricao, produto.nome, nomeLoja),
    image: fotos,
    category: rotulo,
    ...(produto.peso_g ? { weight: { '@type': 'QuantitativeValue', value: produto.peso_g, unitCode: 'GRM' } } : {}),
    offers: {
      '@type': 'Offer',
      url: `https://bynx.gg${urlDoProduto(produto)}`,
      price: (produto.preco_cents / 100).toFixed(2),
      priceCurrency: 'BRL',
      availability: produto.estoque > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Store', name: nomeLoja, url: `https://bynx.gg/lojas/${loja.slug}` },
    },
  }
  const trilhaSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trilha.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: `https://bynx.gg${it.href}`,
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(produtoSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(trilhaSchema) }} />

      <div style={S.page}>
        <style>{`
          @media (prefers-reduced-motion: reduce){
          }
        `}</style>

        <PublicHeader />

        <main className="bx-gutter" style={S.main}>
          <Breadcrumb items={trilha} />

          <div className="bx-detalhe-cols">
            <div>
              <GaleriaProduto fotos={fotos} nome={produto.nome} />
            </div>

            <div>
              <span style={S.tipo}>
                {Icone && <Icone size={12} color="var(--ac-1)" />}
                {rotulo}
              </span>

              <h1 style={S.h1}>{produto.nome}</h1>
              <p style={S.preco}>{fmtBRL(produto.preco_cents)}</p>

              <p style={esgotado ? S.estoqueOff : S.estoque}>
                <span style={esgotado ? S.dotOff : S.dot} />
                {esgotado
                  ? 'Esgotado no momento'
                  : produto.estoque > 1 ? `${produto.estoque} em estoque` : 'Última unidade'}
              </p>

              {esgotado ? (
                <p style={S.aviso}>
                  Este produto está sem estoque. A loja pode repor — vale conferir o que mais ela tem à venda.
                </p>
              ) : podeVender ? (
                <Link href={`/checkout/${produto.id}?tipo=produto`} className="bx-ctx-comprador bx-detalhe-cta" style={S.cta}>
                  <IconCarrinho size={18} />
                  Comprar agora
                </Link>
              ) : (
                <p style={S.aviso}>
                  Esta loja ainda não finaliza vendas pela Bynx. Fale com ela pelos canais na página da loja.
                </p>
              )}

              {!esgotado && podeVender && (
                <BotaoCarrinho id={produto.id} tipo="produto" lojaId={loja.id} estoque={produto.estoque} />
              )}

              <div style={S.acoesLinha}>
                <Link href={`/lojas/${loja.slug}`} className="bx-detalhe-ghost" style={{ ...S.ghost, flex: 1 }}>
                  Ver mais desta loja
                </Link>
                <BotaoCompartilhar
                  url={urlDoProduto(produto)}
                  titulo={produto.nome}
                  texto={`${produto.nome} por ${fmtBRL(produto.preco_cents)} na ${nomeLoja}`}
                  compacto
                />
              </div>

              {podeVender && !esgotado && (
                <p style={S.frete}>
                  <IconTruck size={14} color="var(--bx-text-3)" />
                  Frete calculado no checkout, pelo seu CEP
                </p>
              )}

              <div style={S.card}>
                <Link href={`/lojas/${loja.slug}`} style={S.lojaLinha}>
                  {loja.logo_url ? (
                    <Image src={loja.logo_url} alt={nomeLoja} width={42} height={42} sizes="42px" style={S.lojaLogo} />
                  ) : (
                    <span style={{ ...S.lojaLogo, ...S.lojaLogoVazia }}>{nomeLoja.charAt(0)}</span>
                  )}
                  <span style={{ minWidth: 0 }}>
                    <span style={S.lojaNome}>
                      {nomeLoja}
                      {loja.verificada && <SeloVerificado />}
                    </span>
                    {local && (
                      <span style={S.lojaLocal}>
                        <IconLocation size={11} color="var(--bx-text-3)" /> {local}
                      </span>
                    )}
                  </span>
                </Link>
              </div>

              <div style={S.ficha}>
                <Ficha k="Tipo" v={rotulo} />
                {produto.peso_g ? <Ficha k="Peso" v={`${produto.peso_g} g`} /> : null}
                <Ficha k="Estoque" v={`${produto.estoque} ${produto.estoque > 1 ? 'unidades' : 'unidade'}`} />
                {typeof produto.vendidos === 'number' && produto.vendidos > 0
                  ? <Ficha k="Vendidos" v={String(produto.vendidos)} />
                  : null}
              </div>
            </div>
          </div>

          {/* ★ DESCRICAO SAIU DA COLUNA DA FOTO (07/09/2026).
              Ela era o ultimo bloco da PRIMEIRA coluna do grid. No desktop
              passava despercebido; no mobile, ao colapsar pra uma coluna,
              tudo isso entrava ANTES do bloco de compra: medido em 375px, o
              CTA ficava em y=1536 num viewport de 812 -- quase duas telas de
              rolagem pra achar o botao de comprar. A /anuncio nao tinha o
              problema porque ali a descricao ja vive junto do preco.
              Em largura total tambem le melhor no desktop: texto longo numa
              coluna de 380px vira uma tira estreita e comprida. */}
          <section style={S.blocoDesc}>
            <h2 style={S.secao}>Como funciona</h2>
            <p style={S.comoItem}><IconShield size={14} style={S.comoIcone} /> Pagamento processado pela Stripe. A Bynx nunca guarda os dados do cartão.</p>
            <p style={S.comoItem}><IconTruck size={14} style={S.comoIcone} /> A loja despacha com rastreio, e você acompanha dentro da Bynx.</p>
          </section>

          {produto.descricao && (
            <section style={S.blocoDesc}>
              <h2 style={S.secao}>Descrição</h2>
              <p style={S.desc}>{produto.descricao}</p>
            </section>
          )}
        </main>

        <PublicFooter />
      </div>
    </>
  )
}

function Ficha({ k, v }: { k: string; v: string }) {
  return (
    <div style={S.fi}>
      <span style={S.fk}>{k}</span>
      <span style={S.fv}>{v}</span>
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--bx-bg)',
    color: 'var(--bx-text)',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    display: 'flex',
    flexDirection: 'column',
  },
  main: { maxWidth: 1200, width: '100%', margin: '0 auto', padding: '16px 0 48px', flex: 1 },

  tipo: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 11, fontWeight: 700, color: 'var(--ac-1)',
    background: 'rgba(var(--ac-1-rgb),0.12)', border: '1px solid rgba(var(--ac-1-rgb),0.3)',
    padding: '5px 10px', borderRadius: 100, marginBottom: 9,
  },
  // ★ Escala unica com a /anuncio (07/09/2026): as duas paginas sao o mesmo
  // objeto em papeis diferentes, e tinham h1 21 vs 24, preco 29 vs 30, CTA
  // 50/r11/14.5/700 vs 48/r12/15/800. Dois blocos de estilo escritos
  // separados, sem escala comum.
  h1: { fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 12px', lineHeight: 1.2 },
  // Preco herda `--bx-text`. Com `var(--ac-1)` FORA do escopo
  // `.bx-ctx-comprador` ele resolvia pro ambar do app, brigando na mesma tela
  // com o CTA roxo-rosa do fluxo de compra -- dois acentos concorrendo.
  preco: { fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px' },
  estoque: {
    fontSize: 12.5, color: 'var(--bx-green)', fontWeight: 700,
    display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 16px',
  },
  dot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--bx-green)', flex: 'none' },

  cta: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 48, borderRadius: 12, background: 'var(--ac-grad)',
    color: 'var(--bx-brand-ink)', fontWeight: 800, fontSize: 15,
    textDecoration: 'none', marginBottom: 9,
  },
  acoesLinha: { display: 'flex', gap: 8, alignItems: 'stretch', marginTop: 9 },
  ghost: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 46, borderRadius: 11, background: 'var(--bx-surface-2)',
    border: '1px solid var(--bx-border-2)', color: 'var(--bx-text-2)',
    fontWeight: 600, fontSize: 13.5, textDecoration: 'none',
  },
  estoqueOff: {
    fontSize: 12.5, color: 'var(--bx-text-3)', fontWeight: 700,
    display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 16px',
  },
  dotOff: { width: 6, height: 6, borderRadius: '50%', background: 'var(--bx-text-faint)', flex: 'none' },
  aviso: {
    fontSize: 12.5, color: 'var(--bx-text-3)', lineHeight: 1.55,
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)',
    borderRadius: 10, padding: '11px 13px', margin: '0 0 9px',
  },
  frete: {
    fontSize: 11.5, color: 'var(--bx-text-3)', textAlign: 'center',
    marginTop: 10, lineHeight: 1.5,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },

  card: {
    background: 'var(--bx-bg-elev)', border: '1px solid var(--bx-border)',
    borderRadius: 12, padding: 14, marginTop: 18,
  },
  lojaLinha: { display: 'flex', alignItems: 'center', gap: 11, minHeight: 44, textDecoration: 'none', color: 'inherit' },
  lojaLogo: { width: 42, height: 42, borderRadius: 10, objectFit: 'cover', flex: 'none', background: 'var(--bx-surface-2)' },
  lojaLogoVazia: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 17, color: 'var(--bx-text-3)',
  },
  lojaNome: { fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 },
  selo: {
    width: 14, height: 14, borderRadius: '50%', background: '#1877F2',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 9, color: '#fff', fontWeight: 800, flex: 'none',
  },
  lojaLocal: { fontSize: 11.5, color: 'var(--bx-text-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 },

  secao: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--bx-text-3)', margin: '24px 0 10px',
  },
  desc: { fontSize: 13.5, lineHeight: 1.72, color: 'var(--bx-text-2)', whiteSpace: 'pre-wrap', margin: 0 },

  // Divisor + ritmo iguais aos das secoes da /anuncio.
  comoItem: { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.6, color: 'var(--bx-text-2)', margin: '0 0 8px' },
  comoIcone: { flexShrink: 0, marginTop: 2, opacity: 0.8 },
  blocoDesc: { marginTop: 30, paddingTop: 22, borderTop: '1px solid var(--bx-border)', maxWidth: 760 },
  ficha: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 9, marginTop: 14 },
  fi: {
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)',
    borderRadius: 9, padding: '10px 11px', display: 'flex', flexDirection: 'column',
  },
  fk: { fontSize: 10.5, color: 'var(--bx-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  fv: { fontSize: 13, fontWeight: 700, marginTop: 3 },
}
