import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound, permanentRedirect } from 'next/navigation'
import Breadcrumb from '@/components/ui/Breadcrumb'
import BotaoCompartilhar from '@/components/ui/BotaoCompartilhar'
import SeloVerificado from '@/components/ui/SeloVerificado'
import { IconPlay } from '@/components/ui/Icons'
import RodadaAoVivo from '@/components/leilao/RodadaAoVivo'
import { rotuloGraduacao } from '@/components/leilao/cardDoLote'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { horarioBrasilia } from '@/lib/leilao'
import {
  deveIndexarRodada,
  numeroDaRodada,
  rotuloTituloRodada,
  tituloRodada,
  versaoRodada,
  type EstadoRodada,
  type RodadaPublica,
} from '@/lib/leilao-rodada'
import { urlHome, urlLote, urlRodada } from '@/lib/leilao-urls'
import {
  buscarLojaDoLote,
  buscarLotesDaRodada,
  buscarReferenciaMercadoCents,
  buscarRodadaPorNumero,
  type LojaDoLote,
} from '../../_dados'

/**
 * /leiloes/rodada/[numero] — pagina publica de uma rodada ao vivo da loja.
 *
 * IDENTIDADE: `leilao_rodadas.numero` (curto, fixo). Sem slug de titulo: o
 * link que a loja divulga na live nao pode mudar se o titulo mudar.
 * "/leiloes/rodada/042" -> 308 para "/leiloes/rodada/42" (numeroDaRodada
 * aceita zero a esquerda; a pagina compara com o canonico e redireciona).
 *
 * O server entrega a rodada e os lotes no HTML (SEO e primeira pintura); a
 * ilha RodadaAoVivo assume dali (polling da rodada, troca de lote, lance).
 */

// DECISAO DO DU: cache. Provisorio: sem cache enquanto a superficie de cache
// do leilao nao for decidida. A rodada muda a cada lance e a cada lote que
// abre; ISR serviria lote encerrado como no ar no link que a loja manda na live.
export const dynamic = 'force-dynamic'

// DECISAO DO DU: cache. maxDuration provisorio, mesmo teto das outras paginas
// do leilao: request travado nao segura lambda e conexao do Postgres.
export const maxDuration = 20

type Params = { params: Promise<{ numero: string }> }

async function carregar(param: string): Promise<RodadaPublica | null> {
  const numero = numeroDaRodada(param)
  if (!numero) return null
  return buscarRodadaPorNumero(numero)
}

function nomeLoja(loja: LojaDoLote | null): string | null {
  return loja ? loja.nome ?? loja.slug : null
}

function descricaoRodada(r: RodadaPublica, loja: LojaDoLote | null, nLotes: number): string {
  const daLoja = nomeLoja(loja) ? ` da loja ${nomeLoja(loja)}` : ''
  const lotes = nLotes === 1 ? '1 lote' : `${nLotes} lotes`
  const base = 'de cartas Pokémon com lance em reais e pagamento protegido pela Bynx.'
  switch (r.status) {
    case 'agendada':
      return `Rodada de leilão ao vivo${daLoja}${r.iniciaEm ? ` em ${horarioBrasilia(r.iniciaEm)}` : ''}. ${lotes} ${base}`
    case 'ao_vivo':
      return `Rodada de leilão ao vivo${daLoja} acontecendo agora. ${lotes} ${base}`
    case 'cancelada':
      return `Rodada de leilão${daLoja} cancelada.`
    default:
      return `Rodada de leilão ao vivo${daLoja}, já encerrada. Veja o resultado de cada lote.`
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  if (!LEILAO_ATIVO) return { robots: { index: false, follow: false } }
  const { numero } = await params
  const r = await carregar(numero)
  if (!r) {
    return {
      title: 'Rodada não encontrada',
      description: 'Esta rodada de leilão não existe ou saiu do ar.',
      robots: { index: false, follow: false },
    }
  }
  const [loja, lotes] = await Promise.all([buscarLojaDoLote(r.lojaId), buscarLotesDaRodada(r.id)])
  const nLotes = lotes.filter(l => l.status !== 'cancelado').length
  const loja_ = nomeLoja(loja)
  const titulo = `${tituloRodada(r)} — ${rotuloTituloRodada(r.status)}${loja_ ? ` da loja ${loja_}` : ''}`
  const descricao = descricaoRodada(r, loja, nLotes)
  const url = urlRodada(r.numero)
  const imagem = lotes.find(l => l.fotos[0] || l.cardImage)
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: url },
    robots: deveIndexarRodada(r.status) ? undefined : { index: false, follow: true },
    openGraph: {
      title: titulo,
      description: descricao,
      url: `https://bynx.gg${url}`,
      type: 'website',
      images: imagem ? [{ url: imagem.fotos[0] || (imagem.cardImage as string) }] : undefined,
    },
  }
}

/** JSON dentro de <script>: `<` escapado para nenhum texto da loja fechar a tag. */
function jsonLd(obj: unknown) {
  return JSON.stringify(obj).replace(/</g, '\\u003c')
}

export default async function RodadaPage({ params }: Params) {
  if (!LEILAO_ATIVO) notFound()

  const { numero: param } = await params
  const r = await carregar(param)
  if (!r) notFound()
  if (String(r.numero) !== param) permanentRedirect(urlRodada(r.numero))

  const [loja, lotes] = await Promise.all([buscarLojaDoLote(r.lojaId), buscarLotesDaRodada(r.id)])
  const noAr = lotes.find(l => l.status === 'ativo') ?? null
  const referenciaMercadoCents = noAr ? await buscarReferenciaMercadoCents(noAr.cardId, noAr.graduadora) : null
  const serverNow = new Date().toISOString()
  const estadoInicial: EstadoRodada = {
    rodada: r,
    lotes,
    server_now: serverNow,
    versao: versaoRodada(r.status, lotes),
    referenciaMercadoCents,
  }

  const titulo = tituloRodada(r)
  const url = urlRodada(r.numero)
  const lojaNome = nomeLoja(loja)
  const trilha = [
    { name: 'Início', href: '/' },
    { name: 'Leilões', href: urlHome() },
    { name: titulo, href: url },
  ]

  const visiveis = lotes.filter(l => l.status !== 'cancelado')
  const listaSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: titulo,
    numberOfItems: visiveis.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: visiveis.map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://bynx.gg${urlLote(l.slug)}`,
      name: [l.cardName, l.cardNumero, rotuloGraduacao(l)].filter(Boolean).join(' '),
    })),
  }
  const trilhaSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trilha.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: `https://bynx.gg${it.href}`,
    })),
  }

  const mostrarTransmissao = !!r.linkTransmissao && (r.status === 'agendada' || r.status === 'ao_vivo')

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(listaSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(trilhaSchema) }} />
      <style>{`
        .rp-ghost { transition: background 0.15s ease, border-color 0.15s ease; }
        .rp-ghost:hover { background: var(--bx-surface-2); border-color: var(--bx-border-2); }
        .rp-prim { transition: filter 0.15s ease; }
        .rp-prim:hover { filter: brightness(1.08); }
        .rp-ghost:focus-visible, .rp-prim:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
      `}</style>

      <div style={S.wrap}>
        <Breadcrumb items={trilha} />

        <header style={S.header}>
          {loja && (
            <Link href={`/lojas/${loja.slug}`} prefetch={false} className="rp-ghost" style={S.loja}>
              {loja.logoUrl ? (
                <Image src={loja.logoUrl} alt={lojaNome ?? ''} width={36} height={36} sizes="36px" style={S.lojaLogo} />
              ) : (
                <span style={{ ...S.lojaLogo, ...S.lojaLogoVazia }}>{(lojaNome ?? '?').charAt(0)}</span>
              )}
              <span style={{ minWidth: 0 }}>
                <span style={S.lojaRotulo}>Rodada da loja</span>
                <span style={S.lojaNome}>
                  {lojaNome}
                  {loja.verificada && <SeloVerificado />}
                </span>
              </span>
            </Link>
          )}

          <h1 style={S.h1}>{titulo}</h1>
          {r.descricao && <p style={S.desc}>{r.descricao}</p>}

          <div style={S.acoes}>
            {mostrarTransmissao && (
              <a
                href={r.linkTransmissao as string}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="rp-prim"
                style={S.prim}
              >
                <IconPlay size={16} />
                Assistir à transmissão
              </a>
            )}
            <div style={mostrarTransmissao ? S.compartilharCompacto : S.compartilhar}>
              <BotaoCompartilhar
                compacto={mostrarTransmissao}
                url={url}
                titulo={`${titulo} — ${rotuloTituloRodada(r.status)} na Bynx`}
                texto={descricaoRodada(r, loja, visiveis.length)}
              />
            </div>
          </div>
        </header>

        <RodadaAoVivo estadoInicial={estadoInicial} urlRodada={url} />

        <p style={S.nota}>
          Lance exige conta na Bynx. Quem arremata paga pela Bynx, no cartão, com pagamento protegido.
        </p>
      </div>
    </>
  )
}

const S: Record<string, CSSProperties> = {
  wrap: { maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 },
  header: { display: 'flex', flexDirection: 'column', gap: 10 },
  loja: {
    alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px 6px 6px', minHeight: 48,
    borderRadius: 12, textDecoration: 'none', color: 'inherit', border: '1px solid var(--bx-border)', background: 'var(--bx-surface)',
    maxWidth: '100%',
  },
  lojaLogo: { width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 },
  lojaLogoVazia: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bx-surface-3)',
    color: 'var(--bx-text-2)', fontWeight: 700, fontSize: 16,
  },
  lojaRotulo: { display: 'block', fontSize: 11, color: 'var(--bx-text-3)', fontWeight: 600 },
  lojaNome: {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--bx-text)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  h1: { fontSize: 24, fontWeight: 700, color: 'var(--bx-text)', margin: 0, lineHeight: 1.25, overflowWrap: 'anywhere' },
  desc: { fontSize: 14, color: 'var(--bx-text-2)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' },
  acoes: { display: 'flex', gap: 8, alignItems: 'stretch' },
  prim: {
    flex: 1, minHeight: 48, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 10, background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', fontSize: 15, fontWeight: 800,
    textDecoration: 'none',
  },
  compartilhar: { flex: 1 },
  compartilharCompacto: { flexShrink: 0 },
  nota: { fontSize: 12, color: 'var(--bx-text-3)', margin: 0, lineHeight: 1.5 },
}
