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

import { useState } from 'react'
import Link from 'next/link'
import PublicFooter from '@/components/ui/PublicFooter'

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
    precoMin: number | null
    precoMedio: number | null
    precoMax: number | null
  }
}

export default function CardClient({ card }: CardProps) {
  const [copied, setCopied] = useState(false)

  const color = TYPE_COLORS[card.types[0]] || '#f59e0b'

  function handleCopy() {
    navigator.clipboard?.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasPrice = card.precoMin || card.precoMedio || card.precoMax

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#080a0f',
        color: '#f0f0f0',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '14px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(8,10,15,0.95)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Link href="/" style={{ textDecoration: 'none' }}>
          <img
            src="/logo_BYNX.png"
            alt="Bynx"
            style={{ height: 30, width: 'auto', objectFit: 'contain' }}
          />
        </Link>
        <Link
          href="/"
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            color: '#000',
            padding: '8px 18px',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Abrir no app
        </Link>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px' }}>
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
            <img
              src={card.imageLarge || card.imageSmall || '/og-image.jpg'}
              alt={card.name}
              style={{
                width: 260,
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
              {hasPrice ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                  }}
                >
                  {[
                    { label: 'Mínimo', value: card.precoMin, color: '#22c55e' },
                    { label: 'Médio', value: card.precoMedio, color: '#60a5fa' },
                    { label: 'Máximo', value: card.precoMax, color: '#f59e0b' },
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
              ) : (
                <div>
                  <p
                    style={{
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.3)',
                      marginBottom: 8,
                    }}
                  >
                    Preço ainda não cadastrado.
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
                      style={{ color: '#f59e0b', textDecoration: 'none' }}
                    >
                      Entre no Bynx
                    </Link>{' '}
                    e adicione essa carta na sua coleção pra acompanhar a evolução
                    do preço.
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
            Criar conta grátis no Bynx →
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
