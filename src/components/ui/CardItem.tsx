'use client'

/**
 * CardItem — Componente padrão de exibição de carta Pokémon
 * Usado em: Minha Coleção, Anunciar, Marketplace, Pokédex
 */

import { ReactNode } from 'react'
import { GRADUADORA_MAP, isNotaTop, notaCurta } from '@/lib/graduadoras'

// Rotulo de set para exibicao: troca o prefixo "Liga BR" por "Set"
// "Liga BR — MEP" -> "Set MEP" ; "Liga BR" -> "Set" ; demais nomes inalterados
function setLabel(s?: string | null): string {
  if (!s) return ''
  return s.replace(/^Liga BR\s*[—-]\s*/i, 'Set ').replace(/^Liga BR\b/i, 'Set')
}

export interface CardPrice {
  preco_normal?: any
  preco_min?: any
  preco_medio?: any
  preco_max?: any
  preco_foil?: any
  preco_foil_min?: any
  preco_foil_medio?: any
  preco_foil_max?: any
  preco_promo?: any
  preco_promo_min?: any
  preco_promo_medio?: any
  preco_promo_max?: any
  preco_reverse?: any
  preco_reverse_min?: any
  preco_reverse_medio?: any
  preco_reverse_max?: any
  preco_pokeball?: any
  preco_pokeball_min?: any
  preco_pokeball_medio?: any
  preco_pokeball_max?: any
  price_usd_normal?: any
  price_usd_holofoil?: any
  price_usd_reverse?: any
  price_eur_normal?: any
  price_eur_holofoil?: any
}

export interface CardItemData {
  id: string
  card_name?: string
  name?: string // pokemon_cards format
  card_id?: string
  number?: string // pokemon_cards format
  card_image?: string
  image_small?: string // pokemon_cards format
  image_large?: string
  rarity?: string
  set_name?: string
  set_total?: number | string
  quantity?: number
  variante?: string
  condicoes?: Record<string, number> | null
  price?: CardPrice // joined price data
}

interface CardItemProps {
  card: CardItemData
  // Modo de exibição
  mode?: 'collection' | 'select' | 'readonly'
  // Variante atual
  variante?: string
  onVarianteChange?: (variante: string) => void
  // Quantidade
  onQuantityChange?: (delta: number) => void
  // Seleção (modo select)
  selected?: boolean
  onSelect?: () => void
  // Remoção
  onRemove?: () => void
  // Extra badge ou ação
  badge?: ReactNode
  // Slot extra no rodapé do card (ex: editor de condição)
  footerSlot?: ReactNode
  // Câmbio para estimativas USD/EUR
  exchangeRate?: { usd: number; eur: number }
}

// ── Utilitários ──────────────────────────────────────────────────────────────

const n = (v: any): number | null => {
  const f = parseFloat(String(v))
  return isNaN(f) || f <= 0 ? null : f
}

const fmt = (v: any): string | null => {
  const num = n(v)
  if (!num) return null
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

// Valor compacto sem simbolo (mini-tabela de precos, evita encavalar valores expressivos)
const fmtC = (v: any): string | null => {
  const num = n(v)
  if (!num) return null
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)
}

const rarityColor = (r: string) => {
  if (!r) return null
  if (r.includes('Secret') || r.includes('Special') || r.includes('Hyper')) return '#f59e0b'
  if (r.includes('Holo') || r.includes('Ultra') || r.includes('Rainbow') || r.includes('Full Art')) return '#a855f7'
  if (r.includes('Rare')) return '#60a5fa'
  return null
}

const VARIANTS = [
  { key: 'normal', label: 'Normal', color: 'var(--bx-text)',
    priceKey: (p: CardPrice) => ({ min: n(p.preco_min), med: n(p.preco_medio), max: n(p.preco_max) }) },
  { key: 'foil', label: 'Foil', color: '#f59e0b',
    priceKey: (p: CardPrice) => ({ min: n(p.preco_foil_min), med: n(p.preco_foil_medio), max: n(p.preco_foil_max) }) },
  { key: 'promo', label: 'Promo', color: '#a855f7',
    priceKey: (p: CardPrice) => ({ min: n(p.preco_promo_min), med: n(p.preco_promo_medio), max: n(p.preco_promo_max) }) },
  { key: 'reverse', label: 'Reverse', color: '#60a5fa',
    priceKey: (p: CardPrice) => ({ min: n(p.preco_reverse_min), med: n(p.preco_reverse_medio), max: n(p.preco_reverse_max) }) },
  { key: 'pokeball', label: 'Pokeball', color: '#22c55e',
    priceKey: (p: CardPrice) => ({ min: n(p.preco_pokeball_min), med: n(p.preco_pokeball_medio), max: n(p.preco_pokeball_max) }) },
]

// ── Componente ───────────────────────────────────────────────────────────────

export default function CardItem({
  card,
  mode = 'collection',
  variante: varianteProp,
  onVarianteChange,
  onQuantityChange,
  selected,
  onSelect,
  onRemove,
  badge,
  footerSlot,
  exchangeRate = { usd: 6.0, eur: 6.5 },
}: CardItemProps) {
  const variante = varianteProp || card.variante || 'normal'
  const image = card.card_image || card.image_large || card.image_small
  const name = card.card_name?.replace(/\s*\([^)]*\)\s*$/, '') || card.name || '—'
  const setName = setLabel(card.set_name)
  // Numero impresso: "(NNN/TTT)" do nome original (cartas Liga) tem prioridade;
  // senao monta de number + total. Nunca exibe o id interno "liga-...".
  const _printed = String(card.card_name || card.name || '').match(/\((\d+)\/(\d+)\)/)
  const rawNum = card.number || card.card_id?.split('/')?.[0]
  const total = card.price?.set_total || card.set_total
  const number = _printed
    ? `${_printed[1]}/${_printed[2]}`
    : (rawNum && !String(rawNum).toLowerCase().startsWith('liga'))
      ? (total ? `${String(rawNum).padStart(String(total).length, '0')}/${total}` : String(rawNum))
      : ''
  const rColor = rarityColor(card.rarity || '')
  const imgAlt = name + (number ? ' ' + number : '') + (setName ? ' — ' + setName : '')
  const price = card.price

  // Variantes com preço disponível
  const availableVariants = price
    ? VARIANTS.filter(v => {
        const { min, med, max } = v.priceKey(price)
        return min || med || max
      })
    : []

  // Melhor preço estimado (USD/EUR)
  const getBestEstimate = (): { valor: number; tipo: string } | null => {
    if (!price) return null
    const variantPrice = VARIANTS.find(v => v.key === variante)?.priceKey(price)
    const brl = variantPrice?.med
    if (brl) return null // tem BRL, não precisa de estimativa

    const usdFoil = n(price.price_usd_holofoil)
    const usdNorm = n(price.price_usd_normal)
    const usdRev = n(price.price_usd_reverse)
    let usdVal = 0
    if (variante === 'foil' && usdFoil) usdVal = usdFoil
    else if (variante === 'reverse' && usdRev) usdVal = usdRev
    else usdVal = Math.max(usdNorm || 0, usdFoil || 0)
    if (usdVal > 0) return { valor: usdVal * exchangeRate.usd, tipo: 'USD' }

    const eurVal = Math.max(n(price.price_eur_normal) || 0, n(price.price_eur_holofoil) || 0)
    if (eurVal > 0) return { valor: eurVal * exchangeRate.eur, tipo: 'EUR' }

    return null
  }

  const estimate = getBestEstimate()
  const curVariant = VARIANTS.find(v => v.key === variante)
  const curPrices = curVariant && price ? curVariant.priceKey(price) : { min: null, med: null, max: null }
  const isValuable = (curPrices.med || estimate?.valor || 0) > 100
  const qty = card.quantity || 1
  const grad = card.graduada && card.graduadora ? GRADUADORA_MAP[card.graduadora] : null
  const gradCor = grad?.cor || '#f59e0b'
  const gradTop = grad ? isNotaTop(card.nota, card.black_label) : false

  return (
    <div
      onClick={mode === 'select' ? onSelect : undefined}
      style={{
        background: selected ? 'rgba(245,158,11,0.06)' : isValuable ? 'rgba(245,158,11,0.03)' : 'rgba(255,255,255,0.02)',
        border: selected
          ? '1.5px solid rgba(245,158,11,0.5)'
          : isValuable ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        cursor: mode === 'select' ? 'pointer' : 'default',
        boxShadow: grad
          ? (gradTop
            ? `inset 0 0 0 2px ${gradCor}, inset 0 0 0 5px rgba(255,255,255,0.06), 0 0 22px -2px ${gradCor}`
            : `inset 0 0 0 2px ${gradCor}, inset 0 0 0 5px rgba(255,255,255,0.06)`)
          : undefined,
        transition: 'all 0.15s', fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* ── IMAGEM ── */}
      <div
        onClick={mode === 'collection' ? onSelect : undefined}
        style={{ position: 'relative', cursor: mode === 'collection' && onSelect ? 'pointer' : 'default' }}
      >
        {grad && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 9px', background: card.black_label ? '#0a0a0a' : gradCor }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: card.black_label ? '#e8c878' : '#fff', letterSpacing: '0.03em' }}>{grad.curto}</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: card.black_label ? '#e8c878' : '#fff' }}>{notaCurta(card.nota, card.black_label)}</span>
          </div>
        )}
        {image ? (
          <img
            src={image}
            alt={imgAlt}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', display: 'block', borderRadius: '18px 18px 0 0' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div style={{ width: '100%', paddingBottom: '140%', position: 'relative', background: 'var(--bx-surface)', borderRadius: '18px 18px 0 0' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <svg width="40" height="40" viewBox="0 0 100 100" fill="none" style={{ opacity: 0.15, color: '#fff' }}>
                <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="4"/>
                <path d="M2 50h96" stroke="currentColor" strokeWidth="4"/>
                <circle cx="50" cy="50" r="14" fill="currentColor" stroke="rgba(15,17,20,1)" strokeWidth="4"/>
              </svg>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', fontWeight: 600 }}>Set</p>
            </div>
          </div>
        )}

        {/* Badge de preço flutuante (preço a direita pra nao tampar o numero da carta) */}
        <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
          {qty > 1 && (
            <div style={{ background: 'rgba(245,158,11,0.9)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '4px 7px', fontSize: 11, fontWeight: 800, color: '#000' }}>
              ×{qty}
            </div>
          )}
          {badge}
          {grad ? (
            card.valor_graduada ? (
              <div style={{ background: gradCor, backdropFilter: 'blur(8px)', borderRadius: 8, padding: '4px 8px', fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                {fmt(card.valor_graduada)}
              </div>
            ) : null
          ) : (curPrices.med || estimate) ? (
            <div style={{ background: estimate && !curPrices.med ? 'rgba(96,165,250,0.9)' : 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '4px 8px', fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
              {estimate && !curPrices.med ? '~' : ''}{fmt(curPrices.med || estimate?.valor)}
            </div>
          ) : null}
        </div>

        {/* Check de seleção */}
        {selected && (
          <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: 'var(--bx-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
              <path d="M4 10l4.5 4.5L16 6" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}

        {/* Dot de raridade (escondido em slab graduado pra nao colidir com a barra) */}
        {rColor && !grad && (
          <div style={{ position: 'absolute', top: 8, left: selected ? 36 : 8, width: 8, height: 8, borderRadius: '50%', background: rColor, boxShadow: `0 0 6px ${rColor}` }} />
        )}
      </div>

      {/* ── INFO ── */}
      <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Nome + número */}
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--bx-text)', lineHeight: 1.3, marginBottom: 1 }}>{name}</p>
          {(number || setName) && (
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
              {number ? number : ''}{number && setName ? ' · ' : ''}{setName}
            </p>
          )}
        </div>

        {/* Condição (slot) — logo abaixo do número/coleção */}
        {footerSlot && (
          <div>{footerSlot}</div>
        )}

        {/* Seletor de variante com preços — só em modo collection */}
        {mode !== 'readonly' && availableVariants.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px 56px 56px', minWidth: 242, padding: '4px 8px', borderBottom: '1px solid var(--bx-surface-2)' }}>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tipo</span>
              {['Mín','Méd','Máx'].map(l => (
                <span key={l} style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</span>
              ))}
            </div>
            {availableVariants.map(v => {
              const { min, med, max } = v.priceKey(price!)
              const isActive = variante === v.key
              return (
                <button
                  key={v.key}
                  onClick={(e) => { e.stopPropagation(); onVarianteChange?.(v.key) }}
                  style={{
                    width: '100%', minWidth: 242, display: 'grid', gridTemplateColumns: '1fr 56px 56px 56px',
                    padding: '7px 6px', cursor: 'pointer',
                    background: isActive ? `${v.color}15` : 'transparent',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.15s', alignItems: 'center', fontFamily: 'inherit',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: isActive ? v.color : 'rgba(255,255,255,0.1)', boxShadow: isActive ? `0 0 6px ${v.color}` : 'none', transition: 'all 0.15s' }} />
                    <span style={{ fontSize: 10, color: isActive ? v.color : 'rgba(255,255,255,0.4)', fontWeight: isActive ? 700 : 500 }}>{v.label}</span>
                  </span>
                  <span style={{ fontSize: 10, color: isActive ? '#22c55e' : 'rgba(255,255,255,0.25)', fontWeight: isActive ? 700 : 400, textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtC(min) || '—'}</span>
                  <span style={{ fontSize: 10, color: isActive ? v.color : 'rgba(255,255,255,0.3)', fontWeight: isActive ? 800 : 400, textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtC(med) || '—'}</span>
                  <span style={{ fontSize: 10, color: isActive ? '#f59e0b' : 'rgba(255,255,255,0.25)', fontWeight: isActive ? 700 : 400, textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtC(max) || '—'}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Estimativa USD/EUR — quando não tem BRL */}
        {availableVariants.length === 0 && estimate && (
          <div style={{ textAlign: 'center', fontSize: 10, padding: '4px 0', color: 'rgba(96,165,250,0.7)', fontWeight: 600 }}>
            ~{fmt(estimate.valor)} <span style={{ fontSize: 9, color: 'rgba(96,165,250,0.4)' }}>({estimate.tipo})</span>
          </div>
        )}

        {/* Sem preço */}
        {availableVariants.length === 0 && !estimate && (
          <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.15)', padding: '4px 0' }}>
            Sem preço disponível
          </div>
        )}

        {/* Qtd + Remover — só em modo collection */}
        {mode === 'collection' && (onQuantityChange || onRemove) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            {onQuantityChange && (
              <>
                <button onClick={(e) => { e.stopPropagation(); onQuantityChange(-1) }} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--bx-text)', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                <span style={{ fontSize: 12, color: 'var(--bx-text)', fontWeight: 600, flex: 1, textAlign: 'center' }}>{qty}×</span>
                <button onClick={(e) => { e.stopPropagation(); onQuantityChange(1) }} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--bx-text)', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
              </>
            )}
            {onRemove && (
              <button onClick={(e) => { e.stopPropagation(); onRemove() }} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
