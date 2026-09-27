import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound, permanentRedirect } from 'next/navigation'
import AppLayout from '@/components/ui/AppLayout'
import Breadcrumb from '@/components/ui/Breadcrumb'
import GaleriaProduto from '@/components/lojas/GaleriaProduto'
import BotaoCompartilhar from '@/components/ui/BotaoCompartilhar'
import SeloVerificado from '@/components/ui/SeloVerificado'
import LanceAoVivo from '@/components/leilao/LanceAoVivo'
import { rotuloGraduacao } from '@/components/leilao/cardDoLote'
import { IconChevronRight } from '@/components/ui/Icons'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { codigoDoSlug, dataBrasiliaISO, formatarBRL, type LotePublico } from '@/lib/leilao'
import { tituloRodada, urlRodada } from '@/lib/leilao-rodada'
import { buscarLojaDoLote, buscarLotePorCodigo, buscarReferenciaMercadoCents, buscarRodadaPorId } from '../_dados'

/**
 * /leiloes/[slug] — pagina publica de um lote.
 *
 * O slug e `{carta}-{graduacao?}-{codigo}`; so os 6 ultimos caracteres (o
 * codigo) resolvem o lote. Slug diferente do canonico -> 308 (na PAGINA, nao
 * no generateMetadata: la o redirect nao vira header HTTP).
 *
 * O server entrega o estado no momento da visita; a ilha LanceAoVivo assume
 * dali (relogio, polling, lance).
 */

// DECISAO DO DU: cache. Provisorio: sem cache enquanto a superficie de cache
// do leilao nao for decidida. O preco muda a cada lance; ISR serviria lote
// encerrado como aberto no link que a loja manda na live.
export const dynamic = 'force-dynamic'

// DECISAO DO DU: cache. maxDuration provisorio, mesmo teto do /anuncio: request
// travado nao segura lambda e conexao do Postgres ate os 300s da Vercel.
export const maxDuration = 20

type Params = { params: Promise<{ slug: string }> }

function urlDoLote(l: Pick<LotePublico, 'slug'>) {
  return `/leiloes/${l.slug}`
}

function nomeCompleto(l: LotePublico): string {
  const grad = rotuloGraduacao(l)
  return [l.cardName, l.cardNumero, grad].filter(Boolean).join(' ')
}

function precoVitrine(l: LotePublico): number {
  return l.nLances > 0 && l.precoAtualCents != null ? l.precoAtualCents : l.lanceInicialCents
}

function resumo(l: LotePublico): string {
  if (l.descricao) return l.descricao.slice(0, 180)
  const preco = formatarBRL(precoVitrine(l))
  const lance = l.nLances > 0 ? `Lance atual ${preco}` : `Lance inicial ${preco}`
  return `${nomeCompleto(l)} em leilão na Bynx. ${lance}. Pagamento protegido, no cartão.`
}

/** schema.org: aberto = InStock, arrematado = SoldOut, sem lances/cancelado = OutOfStock. */
function disponibilidade(l: LotePublico): 'InStock' | 'SoldOut' | 'OutOfStock' {
  switch (l.status) {
    case 'ativo':
    case 'agendado':
      return 'InStock'
    case 'aguardando_pagamento':
    case 'vendido':
    case 'calote':
      return 'SoldOut'
    default:
      return 'OutOfStock'
  }
}

/** Lote que ja nao volta a ter lance nao deve ficar no indice. */
function deveIndexar(l: LotePublico): boolean {
  return l.status !== 'sem_lances' && l.status !== 'cancelado'
}

async function carregar(slug: string): Promise<LotePublico | null> {
  const codigo = codigoDoSlug(slug)
  if (!codigo) return null
  return buscarLotePorCodigo(codigo)
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  if (!LEILAO_ATIVO) return { robots: { index: false, follow: false } }
  const { slug } = await params
  const l = await carregar(slug)
  if (!l) {
    return {
      title: 'Lote não encontrado',
      description: 'Este lote não existe ou saiu do ar.',
      robots: { index: false, follow: false },
    }
  }
  const titulo = `${nomeCompleto(l)} — leilão ${l.nLances > 0 ? 'com lance de' : 'a partir de'} ${formatarBRL(precoVitrine(l))}`
  const imagem = l.fotos[0] || l.cardImage
  return {
    title: titulo,
    description: resumo(l),
    alternates: { canonical: urlDoLote(l) },
    robots: deveIndexar(l) ? undefined : { index: false, follow: true },
    openGraph: {
      title: titulo,
      description: resumo(l),
      url: `https://bynx.gg${urlDoLote(l)}`,
      type: 'website',
      images: imagem ? [{ url: imagem }] : undefined,
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

/** JSON dentro de <script>: `<` escapado para nenhum texto do vendedor fechar a tag. */
function jsonLd(obj: unknown) {
  return JSON.stringify(obj).replace(/</g, '\\u003c')
}

export default async function LotePage({ params }: Params) {
  if (!LEILAO_ATIVO) notFound()

  const { slug } = await params
  const l = await carregar(slug)
  if (!l) notFound()
  if (l.slug && l.slug !== slug) permanentRedirect(urlDoLote(l))

  const [loja, referenciaMercadoCents, rodada] = await Promise.all([
    buscarLojaDoLote(l.lojaId),
    buscarReferenciaMercadoCents(l.cardId, l.graduadora),
    buscarRodadaPorId(l.rodadaId),
  ])
  const serverNow = new Date().toISOString()

  const nome = nomeCompleto(l)
  const fotos = l.fotos.length ? l.fotos : l.cardImage ? [l.cardImage] : []
  const url = urlDoLote(l)
  const trilha = [
    { name: 'Início', href: '/' },
    { name: 'Leilões', href: '/leiloes' },
    { name: nome, href: url },
  ]

  const validoAte = l.terminaEm ? dataBrasiliaISO(l.terminaEm) : ''
  const produtoSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: nome,
    description: resumo(l),
    ...(fotos.length ? { image: fotos } : {}),
    ...(l.setNome ? { category: l.setNome } : {}),
    offers: {
      '@type': 'Offer',
      url: `https://bynx.gg${url}`,
      price: (precoVitrine(l) / 100).toFixed(2),
      priceCurrency: 'BRL',
      ...(validoAte ? { priceValidUntil: validoAte } : {}),
      availability: `https://schema.org/${disponibilidade(l)}`,
      ...(loja ? { seller: { '@type': 'Store', name: loja.nome ?? loja.slug, url: `https://bynx.gg/lojas/${loja.slug}` } } : {}),
    },
  }
  const trilhaSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trilha.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: `https://bynx.gg${it.href}`,
    })),
  }

  const ficha: Array<[string, string | null]> = [
    ['Coleção', l.setNome],
    ['Número', l.cardNumero],
    ['Condição', l.condicao],
    ['Idioma', l.idioma ? l.idioma.toUpperCase() : null],
    ['Graduação', rotuloGraduacao(l) || null],
  ]

  return (
    <AppLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(produtoSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(trilhaSchema) }} />
      <style>{`
        .lt-cols { display: grid; gap: 20px; grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 900px) { .lt-cols { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; } }
        .lt-ghost { transition: background 0.15s ease, border-color 0.15s ease; }
        .lt-ghost:hover { background: var(--bx-surface-2); border-color: var(--bx-border-2); }
        /* CTA de lance fixo no celular: folga no fim da pagina para ele nao cobrir o ultimo bloco. */
        @media (max-width: 768px) { .lt-wrap { padding-bottom: 80px; } }
      `}</style>

      <div className="lt-wrap" style={S.wrap}>
        <Breadcrumb items={trilha} />

        <div className="lt-cols">
          <div style={{ minWidth: 0 }}>
            {fotos.length > 0 ? (
              <GaleriaProduto fotos={fotos} nome={nome} />
            ) : (
              <div style={S.semFoto}>Sem foto</div>
            )}
            {l.fotos.length === 0 && l.cardImage && (
              <p style={S.avisoFoto}>Imagem do catálogo. O vendedor ainda não subiu fotos da carta.</p>
            )}
          </div>

          <div style={S.colInfo}>
            <h1 style={S.h1}>{nome}</h1>

            <LanceAoVivo
              loteInicial={l}
              serverNow={serverNow}
              referenciaMercadoCents={referenciaMercadoCents}
              urlLote={url}
            />

            <div style={S.acoes}>
              {l.cardSlug && (
                <Link href={`/carta/${l.cardSlug}`} prefetch={false} className="lt-ghost" style={S.ghost}>
                  Ver no catálogo
                </Link>
              )}
              <BotaoCompartilhar compacto url={url} titulo={`${nome} — leilão na Bynx`} texto={resumo(l)} />
            </div>

            {loja && (
              <Link href={`/lojas/${loja.slug}`} prefetch={false} className="lt-ghost" style={S.loja}>
                {loja.logoUrl ? (
                  <Image src={loja.logoUrl} alt={loja.nome ?? loja.slug} width={42} height={42} sizes="42px" style={S.lojaLogo} />
                ) : (
                  <span style={{ ...S.lojaLogo, ...S.lojaLogoVazia }}>{(loja.nome ?? loja.slug).charAt(0)}</span>
                )}
                <span style={{ minWidth: 0 }}>
                  <span style={S.lojaRotulo}>Leilão da loja</span>
                  <span style={S.lojaNome}>
                    {loja.nome ?? loja.slug}
                    {loja.verificada && <SeloVerificado />}
                  </span>
                </span>
              </Link>
            )}

            {rodada && (
              <Link href={urlRodada(rodada.numero)} prefetch={false} className="lt-ghost" style={S.rodada}>
                <span style={S.rodadaTexto}>
                  Este lote faz parte da rodada <strong style={S.rodadaForte}>{tituloRodada(rodada)}</strong>
                  {loja ? <> da loja <strong style={S.rodadaForte}>{loja.nome ?? loja.slug}</strong></> : null}.
                </span>
                <span style={S.rodadaCta}>
                  {rodada.status === 'ao_vivo' ? 'Acompanhar a rodada ao vivo' : 'Ver a rodada'}
                  <IconChevronRight size={16} />
                </span>
              </Link>
            )}

            <div style={S.card}>
              {ficha.filter(([, v]) => !!v).map(([k, v]) => <Ficha key={k} k={k} v={v as string} />)}
            </div>

            {l.descricao && (
              <div style={S.card}>
                <p style={S.descTitulo}>Descrição do vendedor</p>
                <p style={S.desc}>{l.descricao}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

const S: Record<string, CSSProperties> = {
  wrap: { maxWidth: 1100, margin: '0 auto' },
  colInfo: { display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 },
  h1: { fontSize: 22, fontWeight: 700, color: 'var(--bx-text)', margin: 0, lineHeight: 1.3 },
  semFoto: {
    aspectRatio: '245 / 342', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16,
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', color: 'var(--bx-text-3)', fontSize: 13,
  },
  avisoFoto: { fontSize: 12, color: 'var(--bx-text-3)', margin: '8px 0 0' },
  acoes: { display: 'flex', gap: 8, alignItems: 'stretch' },
  ghost: {
    flex: 1, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10,
    border: '1px solid var(--bx-border)', background: 'var(--bx-surface)', color: 'var(--bx-text)',
    fontSize: 14, fontWeight: 600, textDecoration: 'none',
  },
  loja: {
    display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, textDecoration: 'none',
    border: '1px solid var(--bx-border)', background: 'var(--bx-surface)', color: 'inherit',
  },
  lojaLogo: { width: 42, height: 42, borderRadius: 10, objectFit: 'cover', flexShrink: 0 },
  lojaLogoVazia: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bx-surface-3)',
    color: 'var(--bx-text-2)', fontWeight: 700, fontSize: 18,
  },
  lojaRotulo: { display: 'block', fontSize: 11, color: 'var(--bx-text-3)', fontWeight: 600 },
  lojaNome: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 700, color: 'var(--bx-text)' },
  rodada: {
    display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderRadius: 12, textDecoration: 'none',
    border: '1px solid var(--bx-border)', background: 'var(--bx-surface)', color: 'inherit', minHeight: 44,
  },
  rodadaTexto: { fontSize: 14, color: 'var(--bx-text-2)', lineHeight: 1.5, overflowWrap: 'anywhere' },
  rodadaForte: { color: 'var(--bx-text)', fontWeight: 700 },
  rodadaCta: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: 'var(--ac-1)' },
  card: {
    display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 12,
    border: '1px solid var(--bx-border)', background: 'var(--bx-surface)',
  },
  fi: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 },
  fk: { color: 'var(--bx-text-3)' },
  fv: { color: 'var(--bx-text)', fontWeight: 600, textAlign: 'right' },
  descTitulo: { fontSize: 12, color: 'var(--bx-text-3)', fontWeight: 600, margin: 0 },
  desc: { fontSize: 14, color: 'var(--bx-text-2)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' },
}
