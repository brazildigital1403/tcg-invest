'use client'

/**
 * src/app/lorcana/carta/[slug]/CardClient.tsx
 *
 * CLIENT COMPONENT da página de carta Lorcana — espelho fiel do
 * src/app/carta/[id]/CardClient.tsx (Pokémon), adaptado:
 * - Sem tipos de energia/HP (intrínsecos de Pokémon) — badges ficam com
 *   raridade e supertype.
 * - Sem grid de preço/variantes/histórico: Lorcana ainda não tem preço (F3).
 *   O MESMO card de "Preço de mercado" fica no lugar, no estado "em breve".
 * - Sem ataques, relacionadas e afiliado — blocos intrínsecos de Pokémon.
 *
 * page.tsx (server) faz fetch + SEO + Schema.org e passa data pré-fetched
 * como prop. Este componente fica responsável apenas pela UI interativa
 * (botão Copiar link). Sem loading state, sem fetch client.
 */

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import Breadcrumb from '@/components/ui/Breadcrumb'

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
    supertype: string | null
    imageSmall: string | null
    imageLarge: string | null
  }
  breadcrumb?: { name: string; href: string }[]
}

export default function CardClient({ card, breadcrumb }: CardProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard?.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const numLabel = card.number ? (card.setTotal ? card.number + '/' + card.setTotal : '#' + card.number) : ''
  const imgAlt = 'Carta ' + card.name + (numLabel ? ' ' + numLabel : '') + (card.setName ? ' do set ' + card.setName : '') + ' — Disney Lorcana | Bynx'

  return (
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
            {/* `unoptimized`: as imagens de Lorcana vêm de cards.lorcast.io,
                host fora do remotePatterns — o otimizador da Vercel recusaria
                a URL. `priority` porque esta é a LCP da página. */}
            <Image
              src={card.imageLarge || card.imageSmall || '/og-image.jpg'}
              alt={imgAlt}
              width={260}
              height={363}
              priority
              unoptimized
              style={{
                width: 260,
                height: 'auto',
                borderRadius: 16,
                boxShadow: '0 0 48px rgba(var(--ac-1-rgb),0.2), 0 24px 64px rgba(0,0,0,0.6)',
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
              {card.supertype && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: 100,
                    background: 'rgba(var(--ac-1-rgb),0.13)',
                    color: 'var(--ac-1)',
                    border: '1px solid rgba(var(--ac-1-rgb),0.27)',
                  }}
                >
                  {card.supertype}
                </span>
              )}
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
            </div>

            {/* Preços — mesmo slot da carta Pokémon, no estado "em breve" (F3) */}
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
              <div>
                <p
                  style={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.3)',
                    marginBottom: 8,
                  }}
                >
                  Preços em reais chegam em breve.
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.35)',
                    marginBottom: 8,
                  }}
                >
                  Fonte: <b style={{ color: 'var(--ac-1)', fontWeight: 700 }}>Mercado Brasileiro</b>
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.2)',
                    lineHeight: 1.5,
                  }}
                >
                  <Link
                    href="/"
                    style={{ color: 'var(--ac-1)', textDecoration: 'none' }}
                  >
                    Entre na Bynx
                  </Link>{' '}
                  e adicione essa carta na sua coleção pra acompanhar quando os
                  preços chegarem.
                </p>
              </div>
            </div>

            {/* Botões */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link
                href="/"
                style={{
                  flex: 1,
                  display: 'block',
                  textAlign: 'center',
                  background: 'var(--ac-grad)',
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
            Gerencie toda sua coleção Disney Lorcana como portfólio financeiro
          </p>
          <Link
            href="/"
            style={{
              background: 'var(--ac-grad)',
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
  )
}
