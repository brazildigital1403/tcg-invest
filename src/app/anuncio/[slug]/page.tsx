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
import { buscarAnuncioPublico, buscarOutrosDoVendedor, CARTA_PESO_G, CARTA_DIMENSOES, type AnuncioPublico, type OutroDoVendedor } from '@/lib/anuncioPublico'
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

  // ★ As outras cartas do mesmo vendedor. Depois do redirect de proposito:
  //   nao vale consultar o banco para uma pagina que vai responder 308.
  const outros = await buscarOutrosDoVendedor(a.vendedorId, a.id)

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

            {/* ★ O CONVITE PARA JUNTAR (02/10/2026). O frete e quase todo
                custo fixo de postagem -- 1 carta de Fortaleza para SP custa
                R$ 17,43 e 10 na mesma remessa custam R$ 17,49, medido na
                cotacao real. So que quem abria a carta de R$ 0,90 via o frete
                de R$ 17,44 e ia embora: nada na tela dizia que a mesma pessoa
                tinha mais 12 cartas e que o envio seria UM so.

                A faixa so aparece quando ha o que juntar E quando a compra
                fecha: oferecer "junte mais" a quem nao recebe pagamento seria
                prometer um carrinho que o checkout recusa no fim.

                O tom muda com a relacao frete/preco. Sem o CEP do visitante
                nao da para dizer o VALOR do frete aqui (a pagina e server-side
                e cotar por render seria uma chamada ao Melhor Envio por
                pageview), entao o texto e qualitativo e o numero aparece no
                checkout, que e onde ele ja e oficial. */}
            {a.disponivel && a.podeComprar && outros.total > 0 && (
              <div style={S.faixa}>
                <div style={S.faixaTopo}>
                  <IconTruck size={15} style={S.faixaIcone} />
                  <p style={S.faixaTitulo}>
                    {a.preco <= 20
                      ? 'O frete pode custar mais que a carta'
                      : 'Um envio só'}
                  </p>
                </div>
                <p style={S.faixaTexto}>
                  Este vendedor tem mais {outros.total}{' '}
                  {outros.total === 1 ? 'carta' : 'cartas'}, e o envio é um só para
                  tudo que você levar junto.
                </p>
                <Link href="#mais-do-vendedor" style={S.faixaLink}>
                  Ver as {outros.total} {outros.total === 1 ? 'carta' : 'cartas'}
                </Link>
              </div>
            )}

            {/* ★ QUEM RECEBE COMPRA, QUEM NAO RECEBE NEGOCIA (24/09/2026).
                A regra era "loja compra, colecionador negocia" -- e isso
                condenava 70 dos 100 anuncios ao "Tenho interesse", porque
                pessoa fisica nao tinha como ter Connect. O corte agora e
                RECEBIMENTO, nao loja: quem ativou recebe, tendo loja ou nao.
                Continua exigindo o Connect liberado, nao so cadastrado. */}
            {/* ★ TRAVADO NAO E VENDIDO (08/09/2026). Ate hoje os dois liam a
                mesma frase seca -- "nao esta mais disponivel" -- e quem chegava
                por link compartilhado ia embora achando que a carta acabou.
                Uma volta em ate 72h; a outra nao volta. */}
            {a.travado && a.liberaEm ? (
              <CronometroLiberacao liberaEm={a.liberaEm} variante="painel" />
            ) : !a.disponivel ? (
              <div style={S.esgotado}>Este anúncio não está mais disponível.</div>
            ) : a.podeComprar ? (
              <Link href={`/checkout/${a.id}`} className="bx-ctx-comprador bx-compra-cta" style={S.cta}>
                <IconCarrinho size={18} /> Comprar agora
              </Link>
            ) : (
              <div className="bx-ctx-comprador">
                <BotaoInteresse anuncioId={a.id} nomeCarta={a.nome} preco={fmtBRL(a.preco)} />
                <p style={S.avisoInteresse}>
                  Este vendedor ainda não recebe pagamento pela Bynx. Você conversa com ele
                  por aqui e combinam o pagamento e o envio.
                </p>
              </div>
            )}

            {/* ★ CARRINHO PARA QUALQUER VENDEDOR (02/10/2026). Ate aqui a
                condicao exigia `a.lojaId`, porque a sacola era por LOJA -- e
                isso tirava do carrinho os 70 anuncios de pessoa fisica do
                mercado. Quem tinha 13 cartas a venda so conseguia vender uma
                por vez, com um frete inteiro em cada: numa carta de R$ 0,90,
                R$ 17,44 de frete por carta.
                Agora a sacola agrupa por VENDEDOR e a condicao e so poder
                comprar. `lojaId` segue indo quando existe, porque produto
                precisa dela. */}
            {a.disponivel && a.podeComprar && (
              <div style={S.carrinhoLinha}>
                <BotaoCarrinho id={a.id} tipo="carta" vendedorId={a.vendedorId} lojaId={a.lojaId} />
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

            {/* ★ A GRADE DO MESMO VENDEDOR. Ancora da faixa la de cima.
                Mais BARATAS primeiro (a ordenacao vem da query): quem chegou
                aqui veio de uma carta e esta decidindo se junta outra para
                diluir o frete -- abrir com a mais cara e desenhar para o caso
                que nao existe.

                Cada card leva ao anuncio da carta, nunca ao checkout: e de la
                que se adiciona ao carrinho, e foi exatamente o atalho para o
                checkout que escondia o carrinho da vitrine (a13c013). */}
            {outros.itens.length > 0 && (
              <section id="mais-do-vendedor" style={S.bloco}>
                <h2 style={S.h2}>Mais deste vendedor</h2>
                <div style={{ ...S.grade, gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))' }}>
                  {outros.itens.map((o: OutroDoVendedor) => (
                    <Link key={o.id} href={`/anuncio/${o.slug || o.id}`} style={S.mini}>
                      <span style={S.miniFoto}>
                        {o.imagem && (
                          <Image
                            src={o.imagem}
                            alt={o.nome}
                            fill
                            sizes="(max-width: 880px) 45vw, 130px"
                            style={{ objectFit: 'cover' }}
                          />
                        )}
                      </span>
                      <span style={S.miniCorpo}>
                        <span style={S.miniNome}>{o.nome}</span>
                        <span style={S.miniPreco}>{fmtBRL(o.precoCents / 100)}</span>
                        {o.condicao && <span style={S.miniCond}>{o.condicao}</span>}
                      </span>
                    </Link>
                  ))}
                </div>
                {outros.total > outros.itens.length && (
                  <Link
                    href={a.vendedorUsername ? `/perfil/${a.vendedorUsername}` : `/perfil/${a.vendedorId}`}
                    style={S.verTodas}
                  >
                    Ver todas as {outros.total}
                  </Link>
                )}
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

  // ── "Mais deste vendedor" ────────────────────────────────────────────
  faixa: {
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)',
    borderRadius: 12, padding: '12px 13px', marginBottom: 13,
  },
  faixaTopo: { display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 },
  faixaIcone: { flexShrink: 0, marginTop: 1, opacity: 0.75 },
  faixaTitulo: { fontSize: 13.5, fontWeight: 700, lineHeight: 1.35, margin: 0 },
  faixaTexto: { fontSize: 12.5, color: 'var(--bx-text-2)', lineHeight: 1.5, margin: '0 0 11px' },
  faixaLink: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 44, borderRadius: 10, textDecoration: 'none',
    background: 'rgba(255,255,255,0.045)', border: '1px solid var(--bx-border-2)',
    color: 'var(--bx-text)', fontSize: 13, fontWeight: 700,
  },
  grade: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(0, 1fr))', gap: 9 },
  mini: {
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)',
    borderRadius: 11, overflow: 'hidden', textDecoration: 'none', display: 'block',
    minWidth: 0,
  },
  // ★ `display: block` nos quatro: sao <span> dentro de um <a>, e span e
  //   INLINE. Sem isto o `aspectRatio` da foto colapsa -- o `fill` do
  //   next/image fica sem altura para preencher e o card sai so com texto --
  //   e o preco gruda na condicao na mesma linha ("R$ 9,90NM").
  miniFoto: { display: 'block', position: 'relative', width: '100%', aspectRatio: '1 / 1.1', background: 'rgba(255,255,255,0.03)' },
  miniCorpo: { display: 'block', padding: '8px 9px 10px' },
  miniNome: {
    fontSize: 11.5, fontWeight: 700, lineHeight: 1.3, color: 'var(--bx-text)',
    margin: '0 0 4px', display: '-webkit-box', WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  miniPreco: { display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--ac-1)', margin: 0, letterSpacing: '-0.02em' },
  miniCond: { display: 'block', fontSize: 10, color: 'var(--bx-text-3)', margin: '3px 0 0' },
  verTodas: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44,
    marginTop: 10, borderRadius: 10, textDecoration: 'none',
    background: 'rgba(255,255,255,0.045)', border: '1px solid var(--bx-border-2)',
    color: 'var(--bx-text)', fontSize: 13, fontWeight: 700,
  },
}
