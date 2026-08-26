'use client'

/**
 * src/app/carta/[id]/CardClient.tsx
 *
 * CLIENT COMPONENT da página de carta (S38: SEO Fase 1).
 *
 * Antes (S33-S37): era o `page.tsx` inteiro com 'use client', fazia fetch
 * via useEffect no browser. Sem SSR = sem SEO.
 *
 * Agora (S38): page.tsx (server) faz fetch + SEO + Schema.org e passa data
 * pré-fetched como prop. Este componente fica responsável apenas pela UI
 * interativa (botão Copiar link). Sem loading state, sem fetch client.
 */

import { useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import SinalCartaVista from '@/components/cards/SinalCartaVista'
import PromoBanner from '@/components/ui/PromoBanner'
import Breadcrumb from '@/components/ui/Breadcrumb'
import PriceHistory from '@/components/ui/PriceHistory'
import WatchButton from '@/components/ui/WatchButton'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(v || 0)

const TYPE_COLORS: Record<string, string> = {
  Grass: '#22c55e',
  Fire: '#ef4444',
  Water: '#60a5fa',
  Lightning: '#f59e0b',
  Psychic: '#a855f7',
  Fighting: '#f97316',
  Darkness: '#6b7280',
  Metal: '#94a3b8',
  Dragon: '#8b5cf6',
  Colorless: '#d1d5db',
  Fairy: '#ec4899',
}

// Shape espelhado de NormalizedCard em page.tsx (mantenha sincronizado).
type CardProps = {
  card: {
    id: string
    name: string
    number: string | null
    setName: string | null
    setTotal: number | null
    setReleaseYear: string | null
    rarity: string | null
    hp: number | null
    types: string[]
    imageSmall: string | null
    imageLarge: string | null
    attacks: Array<{ name: string; text?: string; damage?: string }> | null
    /** Guard de preco: valor nao serve como referencia (card_preco_baseline). */
    precoSuspeito?: boolean
    precoMin: number | null
    precoMedio: number | null
    precoMax: number | null
    variantes?: Array<{ key: string; label: string; min: number | null; med: number | null; max: number | null }>
    // Range da varredura de listagem. Tri-estado, e os tres significam coisas
    // diferentes: null = nunca varrida · 0 = varrida e sem oferta · >0 = tem
    // oferta. NAO usar como preco (cruza variante) — so no estado vazio.
    ligaRangeMin?: number | null
    ligaRangeMax?: number | null
  }
  breadcrumb?: { name: string; href: string }[]
  children?: ReactNode
}

export default function CardClient({ card, children, breadcrumb }: CardProps) {
  const [copied, setCopied] = useState(false)
  const variantes = card.variantes && card.variantes.length ? card.variantes : []
  const [varSel, setVarSel] = useState<string>(variantes[0]?.key || 'normal')
  const vAtual = variantes.find((v) => v.key === varSel) || variantes[0] || null

  // ─── Estado vazio: por que a carta nao tem preco? (BRIEF-LIGA-ZENROWS 10.8)
  //
  // Ate 21/08/2026 toda carta sem preco dizia "Preco ainda nao cadastrado" —
  // texto que poe a culpa na Bynx quando, na maioria das 11.792 cartas nessa
  // situacao, a verdade e outra: ninguem esta vendendo. A varredura de
  // listagem sabe diferenciar, e "ninguem esta vendendo" e INFORMACAO pra quem
  // coleciona, nao ausencia de dado.
  //
  // O range NAO vira "Minimo"/"Maximo" aqui: ele cruza variante (o min pode
  // ser do normal e o max do reverse), e o grid logo acima e por variante.
  // Duas coisas com o mesmo nome e escopo diferente, lado a lado, e como o
  // leitor confunde uma com a outra. Por isso so entra como "a partir de".
  const rangeMin = card.ligaRangeMin
  const semOferta = rangeMin != null && rangeMin <= 0
  const temOfertaSemDetalhe = rangeMin != null && rangeMin > 0
  const vazioTitulo = semOferta
    ? 'Sem oferta no Mercado Brasileiro no momento'
    : temOfertaSemDetalhe
      ? `Ofertas a partir de ${fmt(rangeMin)}`
      : 'Preço ainda não cadastrado.'

  const color = TYPE_COLORS[card.types[0]] || '#f59e0b'

  function handleCopy() {
    navigator.clipboard?.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const numLabel = card.number ? (card.setTotal ? card.number + '/' + card.setTotal : '#' + card.number) : ''
  const imgAlt = 'Carta ' + card.name + (numLabel ? ' ' + numLabel : '') + (card.setName ? ' do set ' + card.setName : '') + ' — Pokémon TCG | Bynx'

  return (
    <>
    {/* Sinal "carta acessada". card.id (ja resolvido pelo servidor), NUNCA o
        param da rota: a rota aceita id legado E slug, e contar pelo param
        contaria a mesma carta duas vezes. */}
    <SinalCartaVista cardId={card.id} tipo="view_pub" />
    <div
      style={{
        minHeight: '100vh',
        background: '#080a0f',
        color: '#f0f0f0',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <PublicHeader />

      <main className="bx-gutter" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px' }}>
        <Breadcrumb items={breadcrumb || []} />
        {/* Card hero */}
        <div
          style={{
            display: 'flex',
            gap: 32,
            marginBottom: 32,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}
        >
          {/* Imagem */}
          <div style={{ flex: '0 0 auto' }}>
            {/* next/image em vez de <img>: a fonte e um PNG de 1.606 KB exibido
                a 260px. O otimizador entrega o mesmo quadro em ~29 KB de WebP
                (medido 28/07/2026), 98% menos, com qualidade melhor do que
                apontar pra imageSmall. `priority` porque esta e a LCP da pagina.
                Continua lendo imageLarge: quem reduz e o otimizador, e partir do
                arquivo grande preserva nitidez em tela retina. */}
            <Image
              src={card.imageLarge || card.imageSmall || '/og-image.jpg'}
              alt={imgAlt}
              width={260}
              height={363}
              priority
              style={{
                width: 260,
                height: 'auto',
                borderRadius: 16,
                boxShadow: `0 0 48px ${color}33, 0 24px 64px rgba(0,0,0,0.6)`,
                display: 'block',
              }}
            />
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 200 }}>
            {/* Nome */}
            <h1
              style={{
                fontSize: 32,
                fontWeight: 900,
                letterSpacing: '-0.04em',
                marginBottom: 6,
              }}
            >
              {card.name}
            </h1>

            {/* Set + número */}
            <p
              style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.45)',
                marginBottom: 16,
              }}
            >
              {card.number && card.setTotal
                ? `${card.number}/${card.setTotal}`
                : card.number
                  ? `#${card.number}`
                  : ''}
              {card.setName ? ` · ${card.setName}` : ''}
              {card.setReleaseYear ? ` · ${card.setReleaseYear}` : ''}
            </p>

            {/* Badges */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 24,
              }}
            >
              {card.types.map((t: string) => (
                <span
                  key={t}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: 100,
                    background: (TYPE_COLORS[t] || '#f59e0b') + '22',
                    color: TYPE_COLORS[t] || '#f59e0b',
                    border: `1px solid ${(TYPE_COLORS[t] || '#f59e0b')}44`,
                  }}
                >
                  {t}
                </span>
              ))}
              {card.rarity && (
                <span
                  style={{
                    fontSize: 12,
                    padding: '4px 12px',
                    borderRadius: 100,
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {card.rarity}
                </span>
              )}
              {card.hp && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: 100,
                    background: 'rgba(239,68,68,0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.2)',
                  }}
                >
                  HP {card.hp}
                </span>
              )}
            </div>

            {/* Preços */}
            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
                padding: '16px 20px',
                marginBottom: 20,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 12,
                }}
              >
                Preço de mercado
              </p>
              {variantes.length > 0 && vAtual ? (
                <>
                  {variantes.length > 1 && (
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
                      {variantes.map((v) => {
                        const on = v.key === varSel
                        return (
                          <button
                            key={v.key}
                            onClick={() => setVarSel(v.key)}
                            style={{
                              fontSize: 12,
                              padding: '6px 13px',
                              borderRadius: 8,
                              fontFamily: 'inherit',
                              cursor: 'pointer',
                              border: `1px solid ${on ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}`,
                              background: on ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                              color: on ? '#f59e0b' : 'rgba(255,255,255,0.5)',
                            }}
                          >
                            {v.label}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* ★ Guard de preco: a carta esta marcada como nao-confiavel.
                      A faixa CONTINUA visivel (opcao A, decisao do Du) -- o
                      numero e o que a fonte diz de fato, e esconder o dado
                      bruto seria esconder informacao. O que muda e que ele
                      para de ser afirmado como referencia: entra apagado,
                      atras de um aviso que explica por que nao serve. */}
                  {card.precoSuspeito && (
                    <div
                      style={{
                        background: 'rgba(245,158,11,0.08)',
                        border: '1px solid rgba(245,158,11,0.28)',
                        borderRadius: 8,
                        padding: '11px 13px',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        marginBottom: 14,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flex: 'none', marginTop: 1 }}>
                        <path d="M10 3.5 2.5 16.5h15L10 3.5z" stroke="var(--ac-1, #f59e0b)" strokeWidth="1.4" strokeLinejoin="round" />
                        <path d="M10 8.5v3.2M10 14.2v.1" stroke="var(--ac-1, #f59e0b)" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <div>
                        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--ac-1, #f59e0b)' }}>
                          Preço sob revisão
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.64)' }}>
                          Só existe uma oferta desta carta hoje, e ela está muito acima do histórico. Não usamos esse valor como referência.
                        </p>
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 12,
                      // Marcada pelo guard: a faixa continua legivel, mas
                      // recuada -- o aviso acima e que manda na leitura.
                      opacity: card.precoSuspeito ? 0.45 : 1,
                    }}
                  >
                    {[
                      { label: 'Mínimo', value: vAtual.min, color: '#22c55e' },
                      { label: 'Médio', value: vAtual.med, color: '#60a5fa' },
                      { label: 'Máximo', value: vAtual.max, color: '#f59e0b' },
                    ].map((p) => (
                      <div key={p.label} style={{ textAlign: 'center' }}>
                        <p
                          style={{
                            fontSize: 10,
                            color: 'rgba(255,255,255,0.35)',
                            marginBottom: 4,
                          }}
                        >
                          {p.label}
                        </p>
                        <p
                          style={{
                            fontSize: 17,
                            fontWeight: 800,
                            color: p.color,
                            letterSpacing: '-0.02em',
                          }}
                        >
                          {fmt(p.value || 0)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      marginTop: 14,
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.4)',
                    }}
                  >
                    Fonte: <b style={{ color: '#f59e0b', fontWeight: 700 }}>Mercado Brasileiro</b>
                  </p>
                </>
              ) : (
                <div>
                  <p
                    style={{
                      fontSize: 13,
                      color: semOferta ? 'var(--bx-text-2)' : 'rgba(255,255,255,0.3)',
                      marginBottom: 8,
                    }}
                  >
                    {vazioTitulo}
                  </p>
                  {temOfertaSemDetalhe && (
                    <p
                      style={{
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.35)',
                        marginBottom: 8,
                      }}
                    >
                      Fonte: <b style={{ color: 'var(--ac-1)', fontWeight: 700 }}>Mercado Brasileiro</b>
                    </p>
                  )}
                  <p
                    style={{
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.2)',
                      lineHeight: 1.5,
                    }}
                  >
                    <Link
                      href="/"
                      style={{ color: '#f59e0b', textDecoration: 'none' }}
                    >
                      Entre na Bynx
                    </Link>{' '}
                    {semOferta
                      ? 'e acompanhe essa carta pra ser avisado quando alguém anunciar.'
                      : 'e adicione essa carta na sua coleção pra acompanhar a evolução do preço.'}
                  </p>
                </div>
              )}
            </div>

            {/* Botões */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link
                href="/"
                style={{
                  flex: 1,
                  display: 'block',
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  color: '#000',
                  padding: '13px',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: 'none',
                  minWidth: 140,
                }}
              >
                Tenho interesse
              </Link>
              <button
                onClick={handleCopy}
                style={{
                  padding: '13px 16px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: copied ? '#22c55e' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.2s',
                }}
              >
                {copied ? 'Copiado!' : 'Copiar link'}
              </button>
            </div>
          </div>
        </div>

        <WatchButton cardId={card.id} full />

        <PriceHistory cardId={card.id} />

      {/* Ataques */}
        {card.attacks && card.attacks.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 12,
              }}
            >
              Ataques
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {card.attacks.map((atk, i: number) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                      {atk.name}
                    </p>
                    {atk.text && (
                      <p
                        style={{
                          fontSize: 12,
                          color: 'rgba(255,255,255,0.45)',
                          lineHeight: 1.5,
                        }}
                      >
                        {atk.text}
                      </p>
                    )}
                  </div>
                  {atk.damage && (
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 900,
                        color: '#f59e0b',
                        flexShrink: 0,
                      }}
                    >
                      {atk.damage}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Banner promocional Bynx (copy rotativa a cada F5) - logo apos os ATAQUES */}
        <PromoBanner />

        {children}

        {/* Footer CTA */}
        <div
          style={{
            textAlign: 'center',
            paddingTop: 32,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.3)',
              marginBottom: 14,
            }}
          >
            Gerencie toda sua coleção Pokémon como portfólio financeiro
          </p>
          <Link
            href="/"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              color: '#000',
              padding: '12px 28px',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Criar conta grátis na Bynx →
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
    </>
  )
}
