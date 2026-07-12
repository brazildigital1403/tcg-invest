'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

const BRAND = '#f59e0b'

const VARIANTE_LABEL: Record<string, string> = {
  normal: 'Normal',
  foil: 'Foil',
  promo: 'Promo',
  reverse: 'Reverse',
  pokeball: 'Pokeball',
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)

type Anuncio = {
  id: string
  card_name: string | null
  card_image: string | null
  price: number | null
  variante: string | null
  condicao: string | null
}

const S = {
  card: { background: '#0d0f14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 } as React.CSSProperties,
  sectionTitle: { fontSize: 13, fontWeight: 700 as const, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', margin: '0 0 14px' } as React.CSSProperties,
  surface: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' } as React.CSSProperties,
}

export default function AnunciosLoja({ ownerUserId }: { ownerUserId: string | null }) {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([])
  const [carregou, setCarregou] = useState(false)

  useEffect(() => {
    if (!ownerUserId) { setCarregou(true); return }
    let ativo = true
    ;(async () => {
      const { data } = await supabase
        .from('marketplace')
        .select('id, card_name, card_image, price, variante, condicao')
        .eq('user_id', ownerUserId)
        .eq('status', 'disponivel')
        .order('created_at', { ascending: false })
      if (!ativo) return
      setAnuncios((data as Anuncio[]) || [])
      setCarregou(true)
    })()
    return () => { ativo = false }
  }, [ownerUserId])

  // esconde a secao inteira se nao ha anuncios (evita bloco vazio)
  if (!carregou || anuncios.length === 0) return null

  return (
    <section style={S.card}>
      <h2 style={S.sectionTitle}>Anúncios disponíveis ({anuncios.length})</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
        {anuncios.map((card) => (
          <div key={card.id} style={S.surface}>
            {card.card_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.card_image} alt={card.card_name || ''} style={{ width: '100%', display: 'block' }} />
            ) : (
              <div style={{ paddingBottom: '140%', background: 'rgba(255,255,255,0.04)' }} />
            )}
            <div style={{ padding: '12px 14px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>{card.card_name}</p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 100, color: 'rgba(255,255,255,0.5)' }}>
                  {VARIANTE_LABEL[card.variante || 'normal'] || 'Normal'}
                </span>
                <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 100, color: 'rgba(255,255,255,0.5)' }}>
                  {card.condicao || 'NM'}
                </span>
              </div>
              <p style={{ fontSize: 18, fontWeight: 800, color: BRAND, letterSpacing: '-0.02em', marginBottom: 10 }}>{fmt(Number(card.price))}</p>
              <Link
                href="/"
                style={{ display: 'block', textAlign: 'center', background: BRAND, color: '#000', padding: '9px', borderRadius: 10, fontWeight: 700, fontSize: 12, textDecoration: 'none' }}
                onClick={(e) => {
                  e.preventDefault()
                  try { localStorage.setItem('interesse-card-id', card.id) } catch {}
                  window.location.href = '/?login=1&redirect=marketplace'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ verticalAlign: 'middle', marginRight: 5 }}>
                  <path d="M3 7l4 3 3-2 3 2 4-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <path d="M3 13l4-3 3 2 3-2 4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Tenho interesse
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
