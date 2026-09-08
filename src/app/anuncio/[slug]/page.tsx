import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import Breadcrumb from '@/components/ui/Breadcrumb'
import GaleriaProduto from '@/components/lojas/GaleriaProduto'
import BotaoCompartilhar from '@/components/ui/BotaoCompartilhar'
import { IconShield, IconLocation, IconCarrinho, IconTruck } from '@/components/ui/Icons'
import { buscarAnuncioPublico, type AnuncioPublico } from '@/lib/anuncioPublico'

/**
 * Pagina publica de um anuncio do marketplace.
 *
 * ★ POR QUE ELA EXISTE (07/09/2026): nao havia URL de anuncio. O /marketplace
 * abre por `onClick`, e quem copiava a URL do checkout mandava pro WhatsApp o
 * banner GENERICO da Bynx. Um vendedor nao tinha como dizer "olha minha carta
 * a venda" -- que e o gesto que traz comprador de fora.
 *
 * O CHECKOUT NAO SERVIA PRO PAPEL. Ele e "finalizar compra": o link parece que
 * ja vai cobrar, e ele nao tem metadata propria (e `'use client'` puro). Esta
 * pagina e a vitrine do anuncio; comprar continua sendo no checkout.
 *
 * ★ NASCE `noindex` (decisao do Du). Anuncio some quando vende, e pagina morta
 * indexada vira soft 404 -- foi o que acabamos de limpar no /perfil/. Abrir o
 * noindex depois e barato; desindexar e caro. E isso NAO atrapalha o
 * compartilhamento: `og:` e `robots` sao independentes, o WhatsApp le o
 * preview normalmente. `follow: true` de proposito, pros links internos
 * (a carta, a loja) continuarem contando.
 */

// Estado do anuncio muda quando vende, e a pergunta que a pagina responde e
// "da pra comprar AGORA?". Cache aqui serviria informacao velha no exato
// momento em que ela mais importa. O volume e de quem clica em link recebido,
// nao de crawler -- e crawler nem entra, porque a pagina e noindex.
export const dynamic = 'force-dynamic'

// Responde em ~1s. Sem isto herda o teto de 300s da Vercel, e request travado
// segura lambda e conexao do Postgres -- foi assim que o pool esgotou em 29/07.
export const maxDuration = 20

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)

function urlDoAnuncio(a: AnuncioPublico) {
  return `/anuncio/${a.slug || a.id}`
}

/** Descricao do OG: a do vendedor quando existe, senao uma montada. */
function resumo(a: AnuncioPublico): string {
  if (a.descricao) return a.descricao.slice(0, 180)
  const cond = a.badges.join(' · ')
  const onde = a.lojaNome ? ` na ${a.lojaNome}` : ''
  return `${a.nome} por ${fmtBRL(a.preco)}${onde}. ${cond}. Pagamento pela Bynx, com rastreio ate a entrega.`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const a = await buscarAnuncioPublico(slug)

  if (!a) {
    return {
      title: 'Anúncio não encontrado — Bynx',
      description: 'Este anúncio não existe ou saiu do ar.',
      robots: { index: false, follow: false },
    }
  }

  // ★ O TITULO CARREGA O PRECO. Isto e o produto inteiro desta pagina: e o que
  // aparece no card do WhatsApp quando o vendedor manda o link.
  const titulo = a.disponivel
    ? `${a.nome} — ${fmtBRL(a.preco)}`
    : `${a.nome} — vendido`

  return {
    title: titulo,
    description: resumo(a),
    alternates: { canonical: urlDoAnuncio(a) },
    robots: { index: false, follow: true },
    openGraph: {
      title: titulo,
      description: resumo(a),
      url: `https://bynx.gg${urlDoAnuncio(a)}`,
      type: 'website',
      // A foto REAL do vendedor quando existe. E a diferenca entre o
      // comprador ver a carta que vai receber e ver a arte generica.
      images: a.fotos[0] ? [{ url: a.fotos[0] }] : undefined,
    },
  }
}

export default async function AnuncioPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const a = await buscarAnuncioPublico(slug)
  if (!a) notFound()

  // UUID -> slug, 308. O redirect vive AQUI e nao no generateMetadata: la ele
  // nao vira header HTTP e o crawler receberia a mesma pagina em duas URLs.
  if (a.slug && a.slug !== slug) permanentRedirect(`/anuncio/${a.slug}`)

  const trilha = [
    { name: 'Início', href: '/' },
    { name: 'Mercado', href: '/marketplace' },
    { name: a.nome, href: urlDoAnuncio(a) },
  ]

  return (
    <>
      <PublicHeader />
      <main className="bx-gutter" style={S.main}>
        <Breadcrumb items={trilha} />

        <div style={S.cols}>
          <div style={S.colFoto}>
            <GaleriaProduto fotos={a.fotos} nome={a.nome} />
            {!a.fotoPropria && (
              <p style={S.avisoFoto}>
                Imagem do catálogo. Este vendedor ainda não subiu fotos da carta.
              </p>
            )}
          </div>

          <div style={S.colInfo}>
            <h1 style={S.h1}>{a.nome}</h1>

            <div style={S.chips}>
              {a.badges.map(b => <span key={b} style={S.chip}>{b}</span>)}
            </div>

            <div style={S.preco}>{fmtBRL(a.preco)}</div>

            {a.disponivel ? (
              <Link href={`/checkout/${a.id}`} className="bx-ctx-comprador" style={S.cta}>
                <IconCarrinho size={18} /> Comprar agora
              </Link>
            ) : (
              <div style={S.esgotado}>Este anúncio não está mais disponível.</div>
            )}

            <div style={S.compartilhar}>
              <BotaoCompartilhar
                url={`https://bynx.gg${urlDoAnuncio(a)}`}
                titulo={`${a.nome} — ${fmtBRL(a.preco)} na Bynx`}
                texto={resumo(a)}
              />
            </div>

            {a.descricao && (
              <section style={S.bloco}>
                <h2 style={S.h2}>Descrição do vendedor</h2>
                <p style={S.desc}>{a.descricao}</p>
              </section>
            )}

            <section style={S.bloco}>
              <h2 style={S.h2}>{a.lojaNome ? 'Vendido pela loja' : 'Vendido por'}</h2>
              <div style={S.vendedor}>
                <span style={S.vendNome}>
                  {a.lojaVerificada && <IconShield size={13} color="var(--bx-green)" style={{ flexShrink: 0 }} />}
                  {a.vendedorNome}
                </span>
                {(a.lojaCidade || a.vendedorCidade) && (
                  <span style={S.vendLocal}>
                    <IconLocation size={11} style={{ opacity: 0.7 }} />
                    {a.lojaCidade ? `${a.lojaCidade}${a.lojaEstado ? `, ${a.lojaEstado}` : ''}` : a.vendedorCidade}
                  </span>
                )}
              </div>
              <div style={S.linksVend}>
                {a.lojaSlug && <Link href={`/lojas/${a.lojaSlug}`} style={S.link}>Ver a loja</Link>}
                {!a.lojaSlug && a.vendedorUsername && (
                  <Link href={`/perfil/${a.vendedorUsername}`} style={S.link}>Ver o perfil</Link>
                )}
                {a.cartaSlug && <Link href={`/carta/${a.cartaSlug}`} style={S.link}>Ver a carta no catálogo</Link>}
              </div>
            </section>

            <section style={S.bloco}>
              <h2 style={S.h2}>Como funciona</h2>
              <p style={S.comoItem}><IconShield size={14} style={S.comoIcone} /> Pagamento processado pela Stripe. A Bynx nunca guarda os dados do cartão.</p>
              <p style={S.comoItem}><IconTruck size={14} style={S.comoIcone} /> O vendedor despacha com rastreio, e você acompanha dentro da Bynx.</p>
            </section>
          </div>
        </div>
      </main>
      <PublicFooter />
    </>
  )
}

const S: Record<string, React.CSSProperties> = {
  main: { maxWidth: 1040, margin: '0 auto', paddingTop: 16, paddingBottom: 48 },
  cols: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 28, marginTop: 12, alignItems: 'start' },
  colFoto: { minWidth: 0 },
  colInfo: { minWidth: 0 },
  avisoFoto: { fontSize: 11.5, color: 'var(--bx-text-3)', marginTop: 8, lineHeight: 1.5 },
  h1: { fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, margin: '0 0 10px' },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 },
  chip: { fontSize: 11.5, padding: '3px 9px', borderRadius: 7, background: 'var(--bx-surface-2)', color: 'var(--bx-text-2)' },
  preco: { fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16 },
  cta: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', minHeight: 48, boxSizing: 'border-box', padding: '12px 20px',
    background: 'var(--ac-grad)', color: '#fff', fontWeight: 800, fontSize: 15,
    borderRadius: 12, textDecoration: 'none', transition: 'transform 0.15s ease',
  },
  esgotado: {
    padding: '12px 16px', borderRadius: 12, background: 'var(--bx-surface-2)',
    border: '1px solid var(--bx-border)', color: 'var(--bx-text-2)', fontSize: 13.5, textAlign: 'center',
  },
  compartilhar: { marginTop: 12 },
  bloco: { marginTop: 26, paddingTop: 20, borderTop: '1px solid var(--bx-border)' },
  h2: { fontSize: 12.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--bx-text-3)', margin: '0 0 10px' },
  desc: { fontSize: 14, lineHeight: 1.65, color: 'var(--bx-text-2)', margin: 0, whiteSpace: 'pre-wrap' },
  vendedor: { display: 'flex', flexDirection: 'column', gap: 4 },
  vendNome: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 700 },
  vendLocal: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--bx-text-3)' },
  linksVend: { display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10 },
  link: { fontSize: 13, color: 'var(--ac-1)', textDecoration: 'none', fontWeight: 600, minHeight: 44, display: 'inline-flex', alignItems: 'center' },
  comoItem: { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.6, color: 'var(--bx-text-2)', margin: '0 0 8px' },
  comoIcone: { flexShrink: 0, marginTop: 2, opacity: 0.8 },
}
