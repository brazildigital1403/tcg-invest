'use client'

import { useState, useRef, useEffect, type UIEvent } from 'react'
import { IconSearch } from '@/components/ui/Icons'
import { supabase } from '@/lib/supabaseClient'
import { checkCardLimit, LIMITE_FREE } from '@/lib/checkCardLimit'
import { trackFirstCardAdded } from '@/lib/analytics'
import { useAppModal } from '@/components/ui/useAppModal'
import CardRequestBox from './CardRequestBox'

interface Props {
  userId: string | null
  onClose: () => void
  onAdded: () => void
}

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const PAGE_SIZE = 60 // resultados por pagina (scroll infinito)

const typeColors: Record<string, string> = {
  Fire: '#ef4444', Water: '#60a5fa', Grass: '#22c55e',
  Lightning: '#f59e0b', Psychic: '#a855f7', Fighting: '#f97316',
  Darkness: '#6b7280', Metal: '#94a3b8', Dragon: '#10b981',
  Colorless: '#d1d5db', Fairy: '#f472b6',
}

const rarityIcon = (r: string) => {
  if (!r) return ''
  if (r.includes('Rare Holo') || r.includes('Rare Secret')) return '✦'
  if (r.includes('Rare')) return '◆'
  if (r.includes('Uncommon')) return '◇'
  return '○'
}

const fmtBRL = (v: number | null | undefined) =>
  v && v > 0
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
    : null

function cardNumberLabel(card: any): string {
  if (!card) return ''
  const m = String(card.name || '').match(/\((\d+)\/(\d+)\)/)
  if (m) return `${m[1]}/${m[2]}`
  if (card.number && card.set_total) {
    const num = String(card.number)
    const tot = String(card.set_total)
    const padded = /^\d+$/.test(num) ? num.padStart(tot.length, '0') : num
    return `${padded}/${tot}`
  }
  if (card.number) return String(card.number)
  return ''
}

function setLabel(s?: string | null): string {
  if (!s) return ''
  return s.replace(/^Liga BR\s*[—-]\s*/i, 'Set ').replace(/^Liga BR\b/i, 'Set')
}

export default function AddCardModal({ userId, onClose, onAdded }: Props) {
  const { showAlert } = useAppModal()

  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedCards, setSelectedCards] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [preview, setPreview] = useState<any | null>(null)
  const [exchangeRate, setExchangeRate] = useState<{ usd: number; eur: number }>({ usd: 6.0, eur: 6.5 })
  const [typeFilter, setTypeFilter] = useState('')
  const [rarityFilter, setRarityFilter] = useState('')
  const [variantMap, setVariantMap] = useState<Record<string, string>>({})
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({})
  const [adding, setAdding] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const searchTimeout = useRef<any>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function checkMobile() { setIsMobile(window.innerWidth <= 768) }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    fetch('/api/exchange-rate')
      .then(r => r.json())
      .then(d => setExchangeRate({ usd: d.usd || 6.0, eur: d.eur || 6.5 }))
      .catch(() => {})
  }, [])

  function getBestPrice(card: any): { valor: number; tipo: 'brl' | 'usd' | 'eur' } | null {
    if (card.preco_normal > 0) return { valor: card.preco_normal, tipo: 'brl' }
    if (card.price_usd_normal > 0) return { valor: card.price_usd_normal * exchangeRate.usd, tipo: 'usd' }
    if (card.price_usd_holofoil > 0) return { valor: card.price_usd_holofoil * exchangeRate.usd, tipo: 'usd' }
    if (card.price_eur_normal > 0) return { valor: card.price_eur_normal * exchangeRate.eur, tipo: 'eur' }
    return null
  }

  async function handleSearch(value: string) {
    setSearchTerm(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!value.trim()) { setSearchResults([]); setOffset(0); setHasMore(false); return }
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const { data, error } = await supabase.rpc('smart_search_cards', {
          q: value,
          limit_n: PAGE_SIZE,
          offset_n: 0,
        })
        if (error) throw error
        const rows = data || []
        setSearchResults(rows)
        setOffset(rows.length)
        setHasMore(rows.length === PAGE_SIZE)
        if (resultsRef.current) resultsRef.current.scrollTop = 0
      } catch { setSearchResults([]); setOffset(0); setHasMore(false) }
      setIsSearching(false)
    }, 350)
  }

  async function loadMore() {
    if (loadingMore || !hasMore || !searchTerm.trim()) return
    setLoadingMore(true)
    try {
      const { data, error } = await supabase.rpc('smart_search_cards', {
        q: searchTerm,
        limit_n: PAGE_SIZE,
        offset_n: offset,
      })
      if (error) throw error
      const rows = data || []
      setSearchResults(prev => {
        const seen = new Set(prev.map((c: any) => c.id))
        const novos = rows.filter((c: any) => !seen.has(c.id))
        return [...prev, ...novos]
      })
      setOffset(prev => prev + rows.length)
      setHasMore(rows.length === PAGE_SIZE)
    } catch { setHasMore(false) }
    setLoadingMore(false)
  }

  function handleResultsScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) loadMore()
  }

  function handleCardClick(card: any) {
    setPreview(card)
    setSelectedCards(prev =>
      prev.find(c => c.id === card.id)
        ? prev.filter(c => c.id !== card.id)
        : [...prev, card]
    )
  }

  async function handleAdd() {
    if (!userId || !selectedCards.length) return
    setAdding(true)

    const { data: authData } = await supabase.auth.getUser()
    if (!authData?.user?.id) { setAdding(false); return }

    for (const card of selectedCards) {
      const { bloqueado } = await checkCardLimit(userId)
      if (bloqueado) {
        await showAlert(`Voce atingiu o limite de ${LIMITE_FREE} cartas. Acesse Minha Conta para fazer upgrade.`, 'warning')
        setAdding(false)
        return
      }

      const number = card.number || ''
      const total = card.set_total ? `/${card.set_total}` : ''
      const numFmt = (number && /^\d+$/.test(String(number)) && card.set_total)
        ? String(number).padStart(String(card.set_total).length, '0')
        : number
      const cardName = number ? `${card.name} (${numFmt}${total})` : card.name
      const variante = variantMap[card.id] || 'normal'
      const quantity = qtyMap[card.id] || 1

      const { error: insertError } = await supabase.from('user_cards').insert({
        user_id: authData.user.id,
        pokemon_api_id: card.id,
        card_name: cardName,
        card_id: card.number || card.id,
        card_image: card.image_large || card.image_small || null,
        card_link: null,
        rarity: card.rarity || null,
        variante,
        quantity,
        set_name: card.set_name || null,
      })

      if (insertError) {
        if (insertError.code === '23505') {
          await showAlert(`"${card.name}" ja esta na sua colecao!`, 'warning')
        } else {
          console.error('[AddCardModal] insert error:', insertError)
          await showAlert(`Erro ao adicionar "${card.name}". Tente novamente.`, 'error')
        }
        setAdding(false)
        return
      }
      trackFirstCardAdded(authData.user.id)
    }

    setAdding(false)
    onClose()
    onAdded()
  }

  const filtered = searchResults
    .filter(c => !typeFilter || (c.types || []).includes(typeFilter))
    .filter(c => !rarityFilter || c.rarity === rarityFilter)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 0 : 24 }}>
      <div style={{ width: '100%', maxWidth: isMobile ? '100%' : 1000, maxHeight: isMobile ? '100dvh' : '90vh', height: isMobile ? '100dvh' : 'auto', background: '#0d0f14', border: isMobile ? 'none' : '1px solid rgba(255,255,255,0.1)', borderRadius: isMobile ? 0 : 24, boxShadow: '0 32px 100px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

        {/* HEADER */}
        <div style={{ padding: isMobile ? '16px 16px' : '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="5.5" stroke="rgba(245,158,11,0.8)" strokeWidth="1.4"/><path d="M13 13l3.5 3.5" stroke="rgba(245,158,11,0.8)" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: '#f0f0f0' }}>Adicionar carta</p>
              <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 1 }}>
                {filtered.length > 0 ? `${filtered.length}${hasMore ? '+' : ''} resultado${filtered.length !== 1 ? 's' : ''}` : 'Busque por nome ou numero'}
                {selectedCards.length > 0 && (
                  <> · <span style={{ color: '#f59e0b', fontWeight: 600 }}>{selectedCards.length} carta{selectedCards.length !== 1 ? 's' : ''} selecionada{selectedCards.length !== 1 ? 's' : ''}</span></>
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: TEXT_MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* SEARCH + FILTERS */}
        <div style={{ padding: isMobile ? '12px 16px' : '16px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <IconSearch size={16} color={TEXT_MUTED} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              autoFocus={!isMobile}
              value={searchTerm}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Ex: Charizard · 051/217 · Pikachu Ascended Heroes · Pikachu 2019..."
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 16px 12px 42px', color: '#f0f0f0', fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
              onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            {isSearching && (
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#f59e0b' }}>Buscando...</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {[
              { value: typeFilter, onChange: setTypeFilter, opts: ['', 'Fire', 'Water', 'Grass', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Dragon', 'Colorless'], labels: ['Tipo', 'Fogo', 'Água', 'Planta', 'Elétrico', 'Psíquico', 'Lutador', 'Trevas', 'Metal', 'Dragão', 'Incolor'] },
              { value: rarityFilter, onChange: setRarityFilter, opts: ['', 'Common', 'Uncommon', 'Rare', 'Rare Holo', 'Rare Ultra', 'Rare Secret'], labels: ['Raridade', 'Comum', 'Incomum', 'Rara', 'Rara Holo', 'Ultra Rara', 'Secreta'] },
            ].map((f, i) => (
              <select key={i} value={f.value} onChange={e => f.onChange(e.target.value)}
                style={{ fontSize: 16, background: f.value ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${f.value ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, padding: '6px 10px', color: f.value ? '#f59e0b' : TEXT_MUTED, cursor: 'pointer' }}>
                {f.opts.map((o, j) => <option key={o} value={o} style={{ background: '#0d0f14', color: '#f0f0f0' }}>{f.labels[j]}</option>)}
              </select>
            ))}

            {selectedCards.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: isMobile ? 0 : 'auto', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch', width: isMobile ? '100%' : 'auto', paddingBottom: isMobile ? 4 : 0, marginTop: isMobile ? 8 : 0 }}>
                {selectedCards.map(c => (
                  <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', padding: '3px 6px 3px 10px', borderRadius: 100, fontWeight: 600, maxWidth: 140, flexShrink: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedCards(prev => prev.filter(s => s.id !== c.id)); if (preview?.id === c.id) setPreview(null) }}
                      style={{ background: 'rgba(245,158,11,0.2)', border: 'none', color: '#f59e0b', cursor: 'pointer', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, flexShrink: 0 }}
                    >
                      <svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CONTENT */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, overflow: 'hidden' }}>

          {/* Grid de resultados */}
          <div ref={resultsRef} onScroll={handleResultsScroll} style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '12px' : '16px 20px' }}>

            {!isSearching && searchResults.length === 0 && !searchTerm.trim() && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 24, paddingBottom: 4, gap: 10, color: TEXT_MUTED }}>
                <svg width="40" height="40" viewBox="0 0 20 20" fill="none" style={{opacity:0.3}}>
                  <rect x="2" y="3" width="11" height="15" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                  <rect x="5" y="1" width="11" height="15" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                </svg>
                <p style={{ fontSize: 13, textAlign: 'center' }}>Busque por nome, numero, set, ano ou multiplos itens</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.8 }}>
                  <strong style={{ color: '#f59e0b' }}>Charizard</strong> · <strong style={{ color: '#f59e0b' }}>051/217</strong> · <strong style={{ color: '#f59e0b' }}>PAF 109</strong><br/>
                  <strong style={{ color: '#f59e0b' }}>Pikachu Ascended Heroes</strong><br/>
                  <strong style={{ color: '#f59e0b' }}>Pikachu 2019</strong> · <strong style={{ color: '#f59e0b' }}>4, 15, 23</strong>
                </p>
              </div>
            )}

            {isSearching && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ paddingBottom: '140%', background: 'rgba(255,255,255,0.04)' }} />
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 6 }} />
                      <div style={{ height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 4, width: '60%' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isSearching && filtered.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
                {filtered.map(card => {
                  const isSelected = !!selectedCards.find(c => c.id === card.id)
                  const isPreviewed = preview?.id === card.id
                  const cardType = card.types?.[0]
                  const typeColor = typeColors[cardType] || '#6b7280'

                  return (
                    <div
                      key={card.id}
                      onClick={() => handleCardClick(card)}
                      style={{
                        background: isSelected ? 'rgba(245,158,11,0.06)' : isPreviewed ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                        border: isSelected ? '1.5px solid rgba(245,158,11,0.5)' : isPreviewed ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 12, cursor: 'pointer', overflow: 'hidden', transition: 'all 0.15s', position: 'relative',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.18)' }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = isPreviewed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)' }}
                    >
                      {isSelected && (
                        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, width: 22, height: 22, borderRadius: '50%', background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M4 10l4.5 4.5L16 6" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}

                      {(() => {
                        const best = getBestPrice(card)
                        if (!best) return null
                        const label = fmtBRL(best.valor)
                        const isEstimated = best.tipo !== 'brl'
                        return (
                          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, background: isEstimated ? 'rgba(96,165,250,0.85)' : 'rgba(0,0,0,0.75)', borderRadius: 6, padding: '2px 6px', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                            {isEstimated ? '~' : ''}{label}
                          </div>
                        )
                      })()}

                      <div style={{ position: 'relative', paddingBottom: '140%', background: 'rgba(255,255,255,0.03)' }}>
                        {card.image_small || card.image_large ? (
                          <img
                            src={card.image_small || card.image_large}
                            alt={card.name}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12 }}>
                            <svg width="36" height="36" viewBox="0 0 100 100" fill="none" style={{opacity:0.25}}>
                              <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="4"/>
                              <path d="M2 50h96M50 2a48 48 0 0 1 0 96" stroke="currentColor" strokeWidth="4"/>
                              <circle cx="50" cy="50" r="14" fill="currentColor" stroke="rgba(15,17,20,1)" strokeWidth="4"/>
                            </svg>
                            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 1.3 }}>Set</p>
                          </div>
                        )}
                      </div>

                      <div style={{ padding: '8px 10px' }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#f0f0f0', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <p style={{ fontSize: 10, color: TEXT_MUTED }}>{(() => { const n = cardNumberLabel(card); return n ? n + ' · ' : '' })()}{setLabel(card.set_name).slice(0, 12)}</p>
                          {cardType && <span style={{ fontSize: 9, color: typeColor, fontWeight: 700 }}>{cardType}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {!isSearching && loadingMore && (
              <div style={{ textAlign: 'center', padding: 16, color: TEXT_MUTED, fontSize: 12 }}>Carregando mais...</div>
            )}
            {!isSearching && !hasMore && !loadingMore && filtered.length > 0 && (
              <div style={{ textAlign: 'center', padding: 12, color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>Fim dos resultados</div>
            )}

            {/* BOX DE REPORTE — sempre visivel no fim da coluna de resultados */}
            <CardRequestBox
              userId={userId}
              termo={searchTerm}
              resultados={filtered}
              isSearching={isSearching}
              cartaSelecionada={preview}
            />
          </div>

          {/* PREVIEW */}
          {!(isMobile && !preview) && (
            <div style={{ width: isMobile ? '100%' : 260, borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.07)', borderTop: isMobile ? '1px solid rgba(255,255,255,0.07)' : 'none', overflowY: 'auto', flexShrink: 0, maxHeight: isMobile ? '50vh' : 'auto' }}>
              {!preview ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 24, textAlign: 'center' }}>
                  <svg width="40" height="40" viewBox="0 0 20 20" fill="none" style={{opacity:0.2}}><path d="M10 2v9M7 5V4a1 1 0 012 0v1M13 6V4a1 1 0 012 0v5l1 2v2a4 4 0 01-4 4H9a4 4 0 01-4-4v-3l1-1V6a1 1 0 012 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <p style={{ fontSize: 13, color: TEXT_MUTED }}>Clique em uma carta para ver detalhes</p>
                </div>
              ) : (
                <div style={{ padding: isMobile ? 12 : 16 }}>

                  {isMobile && (
                    <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
                      <div style={{ width: 80, flexShrink: 0 }}>
                        {preview.image_large || preview.image_small ? (
                          <img
                            src={preview.image_large || preview.image_small}
                            alt={preview.name}
                            style={{ width: '100%', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
                          />
                        ) : (
                          <div style={{ width: '100%', paddingBottom: '140%', position: 'relative', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 1.3 }}>Sem<br/>imagem</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 2, lineHeight: 1.2 }}>{preview.name}</p>
                        <p style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 8, lineHeight: 1.3 }}>
                          {(() => { const n = cardNumberLabel(preview); return n ? n + ' · ' : '' })()}{setLabel(preview.set_name)}
                        </p>
                        {(() => {
                          const hasBRL = preview.preco_normal > 0 || preview.preco_foil > 0
                          const best = getBestPrice(preview)
                          const variant = variantMap[preview.id] || 'normal'
                          const variantPrice = preview[`preco_${variant}`]

                          if (hasBRL && variantPrice > 0) {
                            return (
                              <p style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', margin: 0 }}>
                                💰 {fmtBRL(variantPrice)}
                              </p>
                            )
                          } else if (best) {
                            return (
                              <p style={{ fontSize: 14, fontWeight: 700, color: '#60a5fa', margin: 0 }}>
                                ≈ {fmtBRL(best.valor)}
                              </p>
                            )
                          } else {
                            return (
                              <p style={{ fontSize: 11, color: TEXT_MUTED, margin: 0 }}>
                                Preco indisponivel
                              </p>
                            )
                          }
                        })()}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                          <button onClick={() => setQtyMap(prev => ({ ...prev, [preview.id]: Math.max(1, (prev[preview.id] || 1) - 1) }))}
                            style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f0', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                          <span style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0', minWidth: 22, textAlign: 'center' }}>{qtyMap[preview.id] || 1}</span>
                          <button onClick={() => setQtyMap(prev => ({ ...prev, [preview.id]: (prev[preview.id] || 1) + 1 }))}
                            style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f0', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isMobile && (
                    <>
                      {preview.image_large || preview.image_small ? (
                        <img
                          src={preview.image_large || preview.image_small}
                          alt={preview.name}
                          style={{ width: '100%', borderRadius: 10, marginBottom: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                        />
                      ) : (
                        <div style={{ width: '100%', paddingBottom: '140%', position: 'relative', background: 'rgba(255,255,255,0.03)', borderRadius: 10, marginBottom: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <svg width="48" height="48" viewBox="0 0 100 100" fill="none" style={{opacity:0.2}}>
                              <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="4"/>
                              <path d="M2 50h96M50 2a48 48 0 0 1 0 96" stroke="currentColor" strokeWidth="4"/>
                              <circle cx="50" cy="50" r="14" fill="currentColor" stroke="rgba(15,17,20,1)" strokeWidth="4"/>
                            </svg>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>Set<br/>Sem imagem disponivel</p>
                          </div>
                        </div>
                      )}

                      <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 2 }}>{preview.name}</p>
                      <p style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 12 }}>
                        {(() => { const n = cardNumberLabel(preview); return n ? n + ' · ' : '' })()}{setLabel(preview.set_name)} {preview.set_release_date ? `(${preview.set_release_date.slice(0, 4)})` : ''}
                      </p>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                        {(preview.types || []).map((t: string) => (
                          <span key={t} style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: (typeColors[t] || '#6b7280') + '22', color: typeColors[t] || '#6b7280' }}>{t}</span>
                        ))}
                        {preview.rarity && (
                          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 100, background: 'rgba(255,255,255,0.06)', color: TEXT_MUTED }}>
                            {rarityIcon(preview.rarity)} {preview.rarity}
                          </span>
                        )}
                        {preview.hp && (
                          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 100, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>HP {preview.hp}</span>
                        )}
                      </div>

                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
                        <p style={{ fontSize: 10, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>💰 Preço de mercado</p>
                        {(() => {
                          const hasBRL = preview.preco_normal > 0 || preview.preco_foil > 0
                          const best = getBestPrice(preview)

                          if (hasBRL) {
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {preview.preco_normal > 0 && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, color: TEXT_MUTED }}>Normal</span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0' }}>{fmtBRL(preview.preco_normal)}</span>
                                  </div>
                                )}
                                {preview.preco_foil > 0 && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, color: TEXT_MUTED }}>Foil</span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>{fmtBRL(preview.preco_foil)}</span>
                                  </div>
                                )}
                                {preview.preco_reverse > 0 && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, color: TEXT_MUTED }}>Reverse</span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>{fmtBRL(preview.preco_reverse)}</span>
                                  </div>
                                )}
                                {preview.preco_promo > 0 && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, color: TEXT_MUTED }}>Promo</span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#a855f7' }}>{fmtBRL(preview.preco_promo)}</span>
                                  </div>
                                )}
                              </div>
                            )
                          } else if (best) {
                            const srcLabel = best.tipo === 'usd'
                              ? `USD × R$${exchangeRate.usd.toFixed(2)}`
                              : `EUR × R$${exchangeRate.eur.toFixed(2)}`
                            return (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <span style={{ fontSize: 11, color: TEXT_MUTED }}>Estimativa</span>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>~{fmtBRL(best.valor)}</span>
                                </div>
                                <p style={{ fontSize: 9, color: 'rgba(96,165,250,0.6)', fontStyle: 'italic' }}>
                                  Calculado via {srcLabel} • Preço BR em breve
                                </p>
                              </div>
                            )
                          } else {
                            return (
                              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>
                                Preço ainda não disponível
                              </p>
                            )
                          }
                        })()}
                      </div>
                    </>
                  )}

                  <div style={{ marginBottom: 12, display: 'flex', flexDirection: isMobile ? 'row' : 'column', alignItems: isMobile ? 'center' : 'stretch', gap: isMobile ? 10 : 6 }}>
                    <p style={{ fontSize: 10, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: isMobile ? 0 : 6, flexShrink: 0, minWidth: isMobile ? 64 : 'auto' }}>Variante</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: isMobile ? 1 : 'none' }}>
                      {['normal', 'foil', 'reverse', 'promo'].map(v => {
                        const isActive = (variantMap[preview.id] || 'normal') === v
                        return (
                          <button key={v} onClick={() => setVariantMap(prev => ({ ...prev, [preview.id]: v }))}
                            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: `1px solid ${isActive ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}`, background: isActive ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)', color: isActive ? '#f59e0b' : TEXT_MUTED, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
                            {v}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {!isMobile && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 10, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Quantidade</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => setQtyMap(prev => ({ ...prev, [preview.id]: Math.max(1, (prev[preview.id] || 1) - 1) }))}
                          style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f0', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f0', minWidth: 24, textAlign: 'center' }}>{qtyMap[preview.id] || 1}</span>
                        <button onClick={() => setQtyMap(prev => ({ ...prev, [preview.id]: (prev[preview.id] || 1) + 1 }))}
                          style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f0', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    </div>
                  )}

                  {!isMobile && preview.artist && (
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 10, textAlign: 'center' }}>
                      Ilustrado por {preview.artist}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{ padding: isMobile ? '10px 16px' : '14px 28px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: isMobile ? 'stretch' : 'space-between', alignItems: 'center', flexShrink: 0, background: 'rgba(255,255,255,0.01)', gap: isMobile ? 8 : 12 }}>
          {!isMobile && (
            <p style={{ fontSize: 13, color: selectedCards.length > 0 ? '#f59e0b' : TEXT_MUTED, fontWeight: selectedCards.length > 0 ? 600 : 400 }}>
              {selectedCards.length === 0 ? 'Nenhuma carta selecionada' : `${selectedCards.length} carta${selectedCards.length !== 1 ? 's' : ''} selecionada${selectedCards.length !== 1 ? 's' : ''}`}
            </p>
          )}
          <div style={{ display: 'flex', gap: isMobile ? 8 : 10, flex: isMobile ? 1 : 'none' }}>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: TEXT_MUTED, padding: isMobile ? '11px 14px' : '10px 20px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontWeight: 500, flex: isMobile ? 1 : 'none' }}>
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={selectedCards.length === 0 || adding}
              style={{ background: selectedCards.length > 0 ? BRAND : 'rgba(255,255,255,0.06)', border: 'none', color: selectedCards.length > 0 ? '#000' : TEXT_MUTED, padding: isMobile ? '11px 14px' : '10px 24px', borderRadius: 10, fontSize: 13, cursor: selectedCards.length > 0 ? 'pointer' : 'default', fontWeight: 700, opacity: adding ? 0.7 : 1, transition: 'all 0.2s', boxShadow: selectedCards.length > 0 ? '0 0 20px rgba(245,158,11,0.2)' : 'none', flex: isMobile ? 1.5 : 'none' }}
            >
              {adding ? 'Adicionando...' : `Adicionar ${selectedCards.length > 0 ? `(${selectedCards.length})` : ''} →`}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
