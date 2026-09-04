import Link from 'next/link'
import Image from 'next/image'
import { IconShield, IconLocation, IconCamera, IconCarrinho } from '@/components/ui/Icons'
import type { OfertaCarta } from '@/lib/ofertasDaCarta'

/**
 * "A venda na Bynx" — as ofertas REAIS de uma carta, dentro da pagina publica
 * dela.
 *
 * ★ POR QUE ISTO EXISTE (04/09/2026): a pagina de carta mostrava o preco de
 * MERCADO e nao dizia que a propria Bynx tinha aquela carta a venda. Quem
 * chegava pelo Google via "vale R$ 34" e ia embora sem saber que dava pra
 * comprar ali; quem anunciava so aparecia em /marketplace.
 *
 * SERVER COMPONENT de proposito: sem `'use client'`, os links de compra saem
 * no HTML e o crawler os enxerga. Nada aqui e interativo alem de navegar.
 *
 * ★ O CTA usa `.bx-ctx-comprador`. A pagina da carta e ambar (acento do app),
 * mas comprar e fluxo de COMPRADOR — mesmo caso do botao "Comprar agora" na
 * /produto/[id], que e roxo-rosa dentro de uma pagina ambar. A classe faz o
 * `var(--ac-*)` de dentro dela resolver pro acento certo, sem hex cravado.
 */

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)

export default function OfertasDaCarta({
  ofertas,
  nomeCarta,
}: {
  ofertas: OfertaCarta[]
  nomeCarta: string
}) {
  if (!ofertas.length) return null

  const menor = Math.min(...ofertas.map(o => o.preco))

  return (
    <section
      aria-labelledby="ofertas-bynx"
      style={{
        background: 'var(--bx-surface)',
        border: '1px solid var(--bx-border)',
        borderRadius: 12,
        padding: 16,
        margin: '4px 0 22px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <h2
          id="ofertas-bynx"
          style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--bx-text-3)', margin: 0 }}
        >
          À venda na Bynx
        </h2>
        <span style={{ fontSize: 12.5, color: 'var(--bx-text-3)' }}>
          {ofertas.length === 1 ? '1 anúncio' : `${ofertas.length} anúncios`} · a partir de{' '}
          <strong style={{ color: 'var(--bx-green)' }}>{fmtBRL(menor)}</strong>
        </span>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--bx-text-3)', margin: '0 0 14px', lineHeight: 1.5 }}>
        Cartas de {nomeCarta} anunciadas por vendedores da Bynx. Pagamento pela plataforma, com
        rastreio até a entrega.
      </p>

      {/* `minmax(0, 1fr)`: com `1fr` puro a coluna herda `min-width: auto` e o
          conteudo de largura intrinseca a estica. Ja mordeu tres vezes aqui. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 10 }}>
        {ofertas.map(o => (
          <Link
            key={o.id}
            href={o.href}
            className="bx-oferta"
            style={{
              display: 'flex', gap: 12, alignItems: 'center', minWidth: 0,
              background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)',
              borderRadius: 10, padding: 10, textDecoration: 'none', color: 'inherit',
              transition: 'transform 0.15s ease, border-color 0.15s ease, background 0.15s ease',
            }}
          >
            <div
              style={{
                position: 'relative', width: 52, flexShrink: 0, aspectRatio: '300 / 418',
                borderRadius: 8, overflow: 'hidden', background: 'var(--bx-surface-3)',
              }}
            >
              {o.imagem && (
                <Image
                  src={o.imagem}
                  alt=""
                  width={128}
                  height={178}
                  sizes="52px"
                  style={{ width: '100%', height: 'auto', aspectRatio: '300 / 418', objectFit: 'cover', display: 'block' }}
                />
              )}
              {o.fotoPropria && o.nFotos > 1 && (
                <span style={{
                  position: 'absolute', right: 3, bottom: 3, display: 'inline-flex', alignItems: 'center', gap: 2,
                  fontSize: 9.5, fontWeight: 700, lineHeight: 1, padding: '3px 5px', borderRadius: 100,
                  background: 'rgba(0,0,0,0.66)', color: 'var(--bx-text)',
                }}>
                  <IconCamera size={9} /> {o.nFotos}
                </span>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>{fmtBRL(o.preco)}</div>

              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '5px 0 6px' }}>
                {o.badges.map(b => (
                  <span
                    key={b}
                    style={{
                      fontSize: 10.5, padding: '2px 6px', borderRadius: 6,
                      background: 'var(--bx-surface-3)', color: 'var(--bx-text-2)', lineHeight: 1.4,
                    }}
                  >
                    {b}
                  </span>
                ))}
              </div>

              {/* `wrap`: com nome longo ("Adriano da Silveira Magnabosco") a
                  cidade era espremida a "Bitu..." na mesma linha. Deixando
                  quebrar, o nome usa a linha inteira e a cidade desce. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, rowGap: 2, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--bx-text-3)', minWidth: 0 }}>
                {o.lojaNome && o.lojaVerificada && (
                  <IconShield size={11} color="var(--bx-green)" style={{ flexShrink: 0 }} />
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                  {o.vendedor}
                </span>
                {o.vendedorCidade && (
                  <>
                    <IconLocation size={10} style={{ flexShrink: 0, opacity: 0.7 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {o.vendedorCidade}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Acento do COMPRADOR: a pagina e ambar, comprar e roxo-rosa. */}
            <span
              className="bx-ctx-comprador"
              aria-hidden="true"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 44, height: 44, flexShrink: 0, borderRadius: 10,
                background: 'rgba(var(--ac-1-rgb), 0.14)', color: 'var(--ac-1)',
              }}
            >
              <IconCarrinho size={18} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
