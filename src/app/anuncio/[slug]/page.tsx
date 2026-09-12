import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import Breadcrumb from '@/components/ui/Breadcrumb'
import GaleriaProduto from '@/components/lojas/GaleriaProduto'
import BotaoCompartilhar from '@/components/ui/BotaoCompartilhar'
import BotaoCarrinho from '@/components/lojas/BotaoCarrinho'
import SeloVerificado from '@/components/ui/SeloVerificado'
import BotaoInteresse from './BotaoInteresse'
import CronometroLiberacao from '@/components/marketplace/CronometroLiberacao'
import ChatDock from '@/components/marketplace/ChatDock'
import { IconShield, IconLocation, IconCarrinho, IconTruck } from '@/components/ui/Icons'
import { buscarAnuncioPublico, CARTA_PESO_G, CARTA_DIMENSOES, type AnuncioPublico } from '@/lib/anuncioPublico'
import SelosPagamento from '@/components/ui/SelosPagamento'

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
  // ★ Travado NAO e "vendido" (08/09/2026): ele volta em ate 72h, e um link
  // mandado no WhatsApp dizendo "vendido" mata uma carta que ainda vai voltar.
  const titulo = a.disponivel
    ? `${a.nome} — ${fmtBRL(a.preco)}`
    : a.travado
      ? `${a.nome} — em negociação`
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

function Ficha({ k, v }: { k: string; v: string }) {
  return (
    <div style={S.fi}>
      <span style={S.fk}>{k}</span>
      <span style={S.fv}>{v}</span>
    </div>
  )
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

        <div className="bx-compra-cols">
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

            {/* ★ LOJA COMPRA, COLECIONADOR NEGOCIA (decisao do Du, 07/09).
                Sem loja nao ha Connect, frete nem rastreio -- "Comprar agora"
                ali prometia o que quebra no fim. A diferenca ficar VISIVEL e
                o que da motivo pro vendedor abrir a loja dele.
                `lojaPodeVender` exige o Connect liberado: loja cadastrada mas
                sem recebimento ativo tambem nao fecha venda. */}
            {/* ★ TRAVADO NAO E VENDIDO (08/09/2026). Ate hoje os dois liam a
                mesma frase seca -- "nao esta mais disponivel" -- e quem chegava
                por link compartilhado ia embora achando que a carta acabou.
                Uma volta em ate 72h; a outra nao volta. */}
            {a.travado && a.liberaEm ? (
              <CronometroLiberacao liberaEm={a.liberaEm} variante="painel" />
            ) : !a.disponivel ? (
              <div style={S.esgotado}>Este anúncio não está mais disponível.</div>
            ) : a.lojaPodeVender ? (
              <Link href={`/checkout/${a.id}`} className="bx-ctx-comprador bx-compra-cta" style={S.cta}>
                <IconCarrinho size={18} /> Comprar agora
              </Link>
            ) : (
              <div className="bx-ctx-comprador">
                <BotaoInteresse anuncioId={a.id} nomeCarta={a.nome} preco={fmtBRL(a.preco)} />
                <p style={S.avisoInteresse}>
                  Este vendedor ainda não tem loja na Bynx. Você conversa com ele por aqui
                  e combinam o pagamento e o envio.
                </p>
              </div>
            )}

            {/* Carrinho SO em carta de loja. O carrinho da Bynx e organizado
                POR LOJA (a API rejeita item cujo dono nao seja o lojista), e 47
                dos 57 anuncios sao de colecionador sem loja -- pra esses o
                carrinho nao existe como conceito, a compra e individual. */}
            {a.disponivel && a.lojaPodeVender && (
              <div style={S.carrinhoLinha}>
                <BotaoCarrinho id={a.id} tipo="carta" lojaId={a.lojaId ?? ''} />
              </div>
            )}

            {/* Acoes secundarias na mesma linha, no padrao ghost da /produto --
                antes eram links de texto soltos, que nao pareciam clicaveis. */}
            <div style={S.acoesLinha}>
              {a.lojaSlug
                ? <Link href={`/lojas/${a.lojaSlug}`} className="bx-compra-ghost" style={{ ...S.ghost, flex: 1 }}>Ver a loja</Link>
                : a.vendedorUsername
                  ? <Link href={`/perfil/${a.vendedorUsername}`} className="bx-compra-ghost" style={{ ...S.ghost, flex: 1 }}>Ver o perfil</Link>
                  : null}
              {a.cartaSlug && (
                <Link href={`/carta/${a.cartaSlug}`} className="bx-compra-ghost" style={{ ...S.ghost, flex: 1 }}>Ver no catálogo</Link>
              )}
              {/* `url` RELATIVA: o BotaoCompartilhar monta
                  `window.location.origin + url`. Absoluta gerava
                  `https://bynx.gghttps://bynx.gg/...`, um link morto. */}
              <BotaoCompartilhar
                compacto
                url={urlDoAnuncio(a)}
                titulo={`${a.nome} — ${fmtBRL(a.preco)} na Bynx`}
                texto={resumo(a)}
              />
            </div>

            {a.disponivel && (
              <p style={S.frete}>
                <IconTruck size={14} color="var(--bx-text-3)" />
                Frete calculado no checkout, pelo seu CEP
              </p>
            )}

            {/* Card da loja/vendedor, no mesmo desenho da /produto. */}
            <div style={S.card}>
              {a.lojaSlug ? (
                <Link href={`/lojas/${a.lojaSlug}`} style={S.lojaLinha}>
                  {a.lojaLogoUrl
                    ? <Image src={a.lojaLogoUrl} alt={a.vendedorNome} width={42} height={42} sizes="42px" style={S.lojaLogo} />
                    : <span style={{ ...S.lojaLogo, ...S.lojaLogoVazia }}>{a.vendedorNome.charAt(0)}</span>}
                  <span style={{ minWidth: 0 }}>
                    <span style={S.lojaNome}>
                      {a.vendedorNome}
                      {a.lojaVerificada && <SeloVerificado />}
                    </span>
                    {(a.lojaCidade || a.vendedorCidade) && (
                      <span style={S.lojaLocal}>
                        <IconLocation size={11} color="var(--bx-text-3)" />
                        {a.lojaCidade ? `${a.lojaCidade}${a.lojaEstado ? `, ${a.lojaEstado}` : ''}` : a.vendedorCidade}
                      </span>
                    )}
                  </span>
                </Link>
              ) : (
                <div style={S.lojaLinha}>
                  <span style={{ ...S.lojaLogo, ...S.lojaLogoVazia }}>{a.vendedorNome.charAt(0)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={S.lojaNome}>{a.vendedorNome}</span>
                    {a.vendedorCidade && (
                      <span style={S.lojaLocal}>
                        <IconLocation size={11} color="var(--bx-text-3)" /> {a.vendedorCidade}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Ficha tecnica. O PESO estava so no codigo (`pacoteDeCarta`): a
                cotacao sempre usou 80 g, e nem comprador nem vendedor tinham
                como saber. */}
            <div style={S.ficha}>
              <Ficha k="Tipo" v="Carta" />
              <Ficha k="Condição" v={a.badges.slice(1).join(' · ') || 'Normal'} />
              <Ficha k="Peso do envio" v={`${CARTA_PESO_G} g`} />
              <Ficha k="Embalagem" v={CARTA_DIMENSOES} />
            </div>

            {a.descricao && (
              <section style={S.bloco}>
                <h2 style={S.h2}>Descrição do vendedor</h2>
                <p style={S.desc}>{a.descricao}</p>
              </section>
            )}

            <section style={S.bloco}>
              <h2 style={S.h2}>Como funciona</h2>
              <p style={S.comoItem}><IconShield size={14} style={S.comoIcone} /> Pagamento processado pela Stripe. A Bynx nunca guarda os dados do cartão.</p>
              <p style={S.comoItem}><IconTruck size={14} style={S.comoIcone} /> O vendedor despacha com rastreio, e você acompanha dentro da Bynx.</p>
              {/* Mesma posicao da /produto: as duas paginas sao a MESMA ficha
                  por decisao do Du (07/09), e divergir aqui recriaria
                  exatamente o que aquele trabalho eliminou. */}
              <SelosPagamento compacto style={{ marginTop: 14 }} />
            </section>
          </div>
        </div>
      </main>
      <PublicFooter />
      {/* A conversa abre NESTA tela: o BotaoInteresse poe `?conversa=ID` na
          URL atual e o ChatDock (que le a query) assume. Sem isto a pessoa
          seria mandada pro /marketplace e perderia o anuncio de vista. */}
      <Suspense fallback={null}><ChatDock /></Suspense>
    </>
  )
}

const S: Record<string, React.CSSProperties> = {
  // ★ `width: 100%` e `flex: 1` NAO sao decoracao (07/09/2026). O `body` e
  // flex, e sem eles o <main> nao estica: vira `width: auto`, encolhe ao
  // TAMANHO DO CONTEUDO e o `margin: 0 auto` centraliza a sobra. Medido em
  // viewport de 1080px: o main ficava com 690px e 195px de margem de cada
  // lado. Pior que estreito, ficava NAO-DETERMINISTICO -- como a largura
  // passava a depender de como o conteudo se acomoda, o mesmo link abria em
  // duas colunas no Chrome e em uma no Brave, so por diferenca de zoom.
  // A /produto ja fazia certo; eu que nao copiei o padrao inteiro.
  main: { maxWidth: 1200, width: '100%', flex: 1, margin: '0 auto', paddingTop: 16, paddingBottom: 48 },
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
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', fontWeight: 800, fontSize: 15,
    borderRadius: 12, textDecoration: 'none',
  },
  avisoInteresse: { fontSize: 11.5, color: 'var(--bx-text-3)', lineHeight: 1.55, margin: '9px 0 0', textAlign: 'center' },
  esgotado: {
    padding: '12px 16px', borderRadius: 12, background: 'var(--bx-surface-2)',
    border: '1px solid var(--bx-border)', color: 'var(--bx-text-2)', fontSize: 13.5, textAlign: 'center',
  },
  carrinhoLinha: { marginTop: 9 },
  acoesLinha: { display: 'flex', gap: 8, alignItems: 'stretch', marginTop: 9 },
  ghost: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 46, borderRadius: 11, background: 'var(--bx-surface-2)',
    border: '1px solid var(--bx-border-2)', color: 'var(--bx-text-2)',
    fontWeight: 600, fontSize: 13.5, textDecoration: 'none',
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
  lojaLocal: { fontSize: 11.5, color: 'var(--bx-text-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 },
  ficha: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 9, marginTop: 14 },
  fi: {
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)',
    borderRadius: 9, padding: '10px 11px', display: 'flex', flexDirection: 'column',
  },
  fk: { fontSize: 10.5, color: 'var(--bx-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  fv: { fontSize: 13, fontWeight: 700, marginTop: 3 },
  bloco: { marginTop: 26, paddingTop: 20, borderTop: '1px solid var(--bx-border)' },
  h2: { fontSize: 12.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--bx-text-3)', margin: '0 0 10px' },
  desc: { fontSize: 14, lineHeight: 1.65, color: 'var(--bx-text-2)', margin: 0, whiteSpace: 'pre-wrap' },
  comoItem: { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.6, color: 'var(--bx-text-2)', margin: '0 0 8px' },
  comoIcone: { flexShrink: 0, marginTop: 2, opacity: 0.8 },
}
