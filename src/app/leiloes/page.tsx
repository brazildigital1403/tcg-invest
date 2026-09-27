import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppLayout from '@/components/ui/AppLayout'
import CardItem from '@/components/ui/CardItem'
import SeloTempo from '@/components/leilao/SeloTempo'
import { cardDoLote } from '@/components/leilao/cardDoLote'
import { IconClock } from '@/components/ui/Icons'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { formatarBRL } from '@/lib/leilao'
import { listarLotesVitrine, ordemValida, ORDENS_VITRINE } from './_dados'

/**
 * /leiloes — vitrine publica dos lotes abertos e agendados.
 *
 * Sem login. Os filtros sao links (?ordem=...), nao estado de cliente: a
 * vitrine funciona sem JS e o link filtrado pode ser compartilhado.
 */

// DECISAO DO DU: cache. Provisorio: sem cache nenhum enquanto a superficie de
// cache/ISR do leilao nao for decidida. A vitrine muda a cada lance e a cada
// lote que abre; ISR aqui serviria lote encerrado como aberto.
export const dynamic = 'force-dynamic'

// DECISAO DO DU: cache. maxDuration provisorio, mesmo teto do /anuncio: request
// travado nao segura lambda e conexao do Postgres ate os 300s da Vercel.
export const maxDuration = 20

export const metadata: Metadata = {
  title: 'Leilões ao vivo',
  description:
    'Lotes de cartas Pokémon em leilão ao vivo, com lance em reais e pagamento protegido pela Bynx.',
  alternates: { canonical: '/leiloes' },
}

export default async function LeiloesPage({
  searchParams,
}: {
  searchParams: Promise<{ ordem?: string }>
}) {
  if (!LEILAO_ATIVO) notFound()

  const { ordem: ordemParam } = await searchParams
  const ordem = ordemValida(ordemParam)
  const lotes = await listarLotesVitrine(ordem)
  const renderizadoEm = new Date().toISOString()

  return (
    <AppLayout>
      <style>{`
        .lv-chip { transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
        .lv-chip:hover { background: var(--bx-surface-2); border-color: var(--bx-border-2); }
        .lv-lote { display: block; text-decoration: none; color: inherit; border-radius: 18px; transition: transform 0.15s ease; }
        .lv-lote:hover { transform: translateY(-2px); }
        .lv-lote:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
        .lv-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        @media (min-width: 640px) { .lv-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; } }
        @media (prefers-reduced-motion: reduce) { .lv-lote, .lv-lote:hover { transition: none; transform: none; } }
      `}</style>

      <div style={S.wrap}>
        <header style={S.header}>
          <h1 style={S.h1}>Leilões</h1>
          <p style={S.sub}>
            Lotes ao vivo das lojas parceiras. O lance é em reais e o pagamento é protegido pela Bynx.
          </p>
        </header>

        <nav aria-label="Ordenar lotes" style={S.chips}>
          {ORDENS_VITRINE.map(o => {
            const ativo = o.chave === ordem
            return (
              <Link
                key={o.chave}
                href={o.chave === 'terminando' ? '/leiloes' : `/leiloes?ordem=${o.chave}`}
                className="lv-chip"
                aria-current={ativo ? 'page' : undefined}
                prefetch={false}
                style={{ ...S.chip, ...(ativo ? S.chipAtivo : null) }}
              >
                {o.rotulo}
              </Link>
            )
          })}
        </nav>

        {lotes.length === 0 ? (
          <div style={S.vazio}>
            <span style={S.vazioIcone}><IconClock size={22} /></span>
            <p style={S.vazioTitulo}>
              {ordem === 'sem_lance' ? 'Todos os lotes abertos já têm lance' : 'Nenhum leilão aberto agora'}
            </p>
            <p style={S.vazioTexto}>
              Quando uma loja abrir uma rodada ao vivo, os lotes aparecem aqui. Enquanto isso, as cartas
              à venda com preço fixo estão no Mercado.
            </p>
            <Link href="/marketplace" prefetch={false} style={S.vazioCta}>Ir para o Mercado</Link>
          </div>
        ) : (
          <div className="lv-grid">
            {lotes.map(l => {
              const preco = l.nLances > 0 && l.precoAtualCents != null ? l.precoAtualCents : l.lanceInicialCents
              return (
                <Link key={l.id} href={`/leiloes/${l.slug}`} prefetch={false} className="lv-lote">
                  <CardItem
                    card={cardDoLote(l)}
                    mode="readonly"
                    hidePriceTable
                    ocultarSemPreco
                    badge={<span style={S.badgePreco}>{formatarBRL(preco)}</span>}
                    footerSlot={
                      <div style={S.rodape}>
                        <SeloTempo lote={l} renderizadoEm={renderizadoEm} />
                        <span style={S.lances}>
                          {l.nLances === 0 ? 'Sem lance' : l.nLances === 1 ? '1 lance' : `${l.nLances} lances`}
                        </span>
                      </div>
                    }
                  />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

const S: Record<string, CSSProperties> = {
  wrap: { maxWidth: 1200, margin: '0 auto' },
  header: { marginBottom: 16 },
  h1: { fontSize: 24, fontWeight: 700, color: 'var(--bx-text)', margin: 0 },
  sub: { fontSize: 14, color: 'var(--bx-text-2)', margin: '6px 0 0', lineHeight: 1.5 },
  chips: { display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 2 },
  chip: {
    display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 16px', whiteSpace: 'nowrap',
    borderRadius: 999, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--bx-border)', background: 'var(--bx-surface)',
    color: 'var(--bx-text-2)', fontSize: 13, fontWeight: 600, textDecoration: 'none',
  },
  chipAtivo: {
    background: 'rgba(var(--ac-1-rgb), 0.12)', borderColor: 'var(--ac-1)', color: 'var(--ac-1)',
  },
  badgePreco: {
    background: 'var(--bx-bg-elev)', border: '1px solid var(--bx-border-2)', borderRadius: 8,
    padding: '4px 8px', fontSize: 12, fontWeight: 800, color: 'var(--bx-text)',
    fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
  },
  rodape: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' },
  lances: { fontSize: 11, color: 'var(--bx-text-3)', fontWeight: 600, whiteSpace: 'nowrap' },
  vazio: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8,
    padding: '40px 16px', borderRadius: 16, border: '1px solid var(--bx-border)', background: 'var(--bx-surface)',
  },
  vazioIcone: {
    width: 48, height: 48, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(var(--ac-1-rgb), 0.12)', color: 'var(--ac-1)',
  },
  vazioTitulo: { fontSize: 16, fontWeight: 700, color: 'var(--bx-text)', margin: 0 },
  vazioTexto: { fontSize: 14, color: 'var(--bx-text-2)', margin: 0, maxWidth: 420, lineHeight: 1.5 },
  vazioCta: {
    marginTop: 8, display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 18px', borderRadius: 10,
    background: 'var(--bx-brand)', color: 'var(--bx-brand-ink)', fontWeight: 700, fontSize: 14, textDecoration: 'none',
  },
}
