'use client'

import { useState, useRef } from 'react'
import { IconSearch, IconClose } from '@/components/ui/Icons'
import { supabase } from '@/lib/supabaseClient'
import { checkCardLimit, LIMITE_FREE } from '@/lib/checkCardLimit'
import { authFetch } from '@/lib/authFetch'

interface Props {
  userId: string | null
  onClose: () => void
  onAdded: () => void
}

// ─── Tokens ──────────────────────────────────────────────────────────────────

const BRAND   = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const SURFACE = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }
const TEXT_MUTED = 'rgba(255,255,255,0.4)'

// ─── Raridade → emoji ────────────────────────────────────────────────────────

const rarityIcon = (r: string) => {
  if (!r) return ''
  if (r.includes('Rare Holo') || r.includes('Rare Secret')) return '✦'
  if (r.includes('Rare')) return '◆'
  if (r.includes('Uncommon')) return '◇'
  return '○'
}

const typeColors: Record<string, string> = {
  Fire: '#ef4444', Water: '#60a5fa', Grass: '#22c55e',
  Lightning: '#f59e0b', Psychic: '#a855f7', Fighting: '#f97316',
  Darkness: '#6b7280', Metal: '#94a3b8', Dragon: '#10b981',
  Colorless: '#d1d5db', Fairy: '#f472b6',
}

export default function AddCardModal({ userId, onClose, onAdded }: Props) {
  const [searchTerm, setSearchTerm]     = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedCards, setSelectedCards] = useState<any[]>([])
  const [isSearching, setIsSearching]   = useState(false)
  const [preview, setPreview]           = useState<any | null>(null)
  const [priceData, setPriceData]       = useState<any | null>(null)
  const [typeFilter, setTypeFilter]     = useState('')
  const [rarityFilter, setRarityFilter] = useState('')
  const [adding, setAdding]             = useState(false)
  const [ligaLinks, setLigaLinks]       = useState<Record<string, string>>({})
  const searchTimeout = useRef<any>(null)

  // ── Busca ──────────────────────────────────────────────────────────────────

  async function handleSearch(value: string) {
    setSearchTerm(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      if (!value.trim()) { setSearchResults([]); setIsSearching(false); return }
      setIsSearching(true)
      try {
        const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(value)}&pageSize=50`)
        const data = await res.json()
        setSearchResults(data?.data || [])
      } catch { setSearchResults([]) }
      setIsSearching(false)
    }, 400)
  }

  // ── Selecionar carta ────────────────────────────────────────────────────────

  async function handleCardClick(card: any) {
    setPreview(card)
    // carrega preço do banco se existir
    const { data } = await supabase.from('card_prices').select('*').eq('pokemon_api_id', card.id).maybeSingle()
    setPriceData(data || null)
    // toggle seleção
    setSelectedCards(prev =>
      prev.find(c => c.id === card.id)
        ? prev.filter(c => c.id !== card.id)
        : [...prev, card]
    )
  }

  // ── Adicionar cartas selecionadas ───────────────────────────────────────────

  async function handleAdd() {
    if (!userId || !selectedCards.length) return
    setAdding(true)
    const { data: authData } = await supabase.auth.getUser()
    if (!authData?.user?.id) { setAdding(false); return }

    for (const card of selectedCards) {
      const number    = card.number || ''
      const total     = card.set?.printedTotal || ''
      const cardName  = number && total ? `${card.name} (${number}/${total})` : card.name
      const cardImage = card.images?.large || card.images?.small || null
      const ligaUrl   = ligaLinks[card.id] || null

      let cardLink: string | null = null

      // Se o usuário informou link da LigaPokemon, busca preço
      if (ligaUrl) {
        try {
          const res = await authFetch(`/api/preco-puppeteer?url=${encodeURIComponent(ligaUrl)}`)
          const priceData = await res.json()
          if (priceData?.card_name) {
            cardLink = priceData.link || ligaUrl
            await supabase.from('card_prices').upsert({
              card_name: cardName,
              preco_min: priceData.preco_min || 0,
              preco_medio: priceData.preco_medio || 0,
              preco_max: priceData.preco_max || 0,
              preco_normal: priceData.preco_normal || 0,
              preco_foil: priceData.preco_foil || 0,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'card_name' })
          }
        } catch { /* continua sem preço */ }
      }

      const { bloqueado } = await checkCardLimit(userId)
      if (bloqueado) { alert(`Você atingiu o limite de ${LIMITE_FREE} cartas do plano gratuito. Acesse Minha Conta para fazer upgrade! 🚀`); setAdding(false); return }

      await supabase.from('user_cards').insert({
        user_id: authData.user.id,
        pokemon_api_id: card.id,
        card_name: cardName,
        card_id: card.number || card.id,
        card_image: cardImage,
        card_link: cardLink,
        rarity: card.rarity || null,
        variante: 'normal',
        quantity: 1,
        set_name: card.set?.name || null,
      })
    }

    setAdding(false)
    onClose()
    onAdded()
  }

  // ── Resultados filtrados ────────────────────────────────────────────────────

  const filtered = searchResults
    .filter(c => !typeFilter    || (c.types || []).includes(typeFilter))
    .filter(c => !rarityFilter  || c.rarity === rarityFilter)

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 1000, maxHeight: '90vh', background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, boxShadow: '0 32px 100px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

        {/* ── HEADER ── */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="5.5" stroke="rgba(245,158,11,0.8)" strokeWidth="1.4"/><path d="M13 13l3.5 3.5" stroke="rgba(245,158,11,0.8)" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: '#f0f0f0' }}>Buscar cartas</p>
              <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 1 }}>Base oficial do Pokémon TCG · {filtered.length > 0 ? `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}` : 'Digite para buscar'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: TEXT_MUTED, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>

        {/* ── SEARCH + FILTERS ── */}
        <div style={{ padding: '16px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {/* Input de busca */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <IconSearch size={16} color={TEXT_MUTED} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              autoFocus
              value={searchTerm}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Nome da carta... ex: Charizard, Pikachu ex, Mewtwo V"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 16px 12px 42px', color: '#f0f0f0', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
              onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            {isSearching && (
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#f59e0b' }}>Buscando...</span>
            )}
          </div>

          {/* Filtros + cartas selecionadas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Filtros */}
            {[
              { value: typeFilter, onChange: setTypeFilter, opts: ['', 'Fire', 'Water', 'Grass', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Dragon', 'Colorless'], labels: ['Tipo', 'Fogo', 'Água', 'Planta', 'Elétrico', 'Psíquico', 'Lutador', 'Trevas', 'Metal', 'Dragão', 'Incolor'] },
              { value: rarityFilter, onChange: setRarityFilter, opts: ['', 'Common', 'Uncommon', 'Rare', 'Rare Holo', 'Rare Ultra', 'Rare Secret'], labels: ['Raridade', 'Comum', 'Incomum', 'Rara', 'Rara Holo', 'Ultra Rara', 'Secreta'] },
            ].map((f, i) => (
              <select key={i} value={f.value} onChange={e => f.onChange(e.target.value)}
                style={{ fontSize: 12, background: f.value ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${f.value ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, padding: '6px 10px', color: f.value ? '#f59e0b' : TEXT_MUTED, cursor: 'pointer' }}>
                {f.opts.map((o, j) => <option key={o} value={o} style={{ background: '#0d0f14', color: '#f0f0f0' }}>{f.labels[j]}</option>)}
              </select>
            ))}

            {/* Cartas selecionadas */}
            {selectedCards.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
                {selectedCards.map(c => (
                  <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', padding: '3px 6px 3px 10px', borderRadius: 100, fontWeight: 600, maxWidth: 140 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedCards(prev => prev.filter(s => s.id !== c.id)); if (preview?.id === c.id) setPreview(null) }}
                      style={{ background: 'rgba(245,158,11,0.2)', border: 'none', color: '#f59e0b', cursor: 'pointer', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, flexShrink: 0, lineHeight: 1 }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Grid de resultados */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

            {/* Estado vazio inicial */}
            {!isSearching && searchResults.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: TEXT_MUTED }}>
                <div style={{ fontSize: 48, opacity: 0.3 }}>🃏</div>
                <p style={{ fontSize: 14 }}>Digite o nome de uma carta para buscar</p>
                <p style={{ fontSize: 12, opacity: 0.6 }}>Ex: Charizard, Pikachu, Mewtwo, Blastoise...</p>
              </div>
            )}

            {/* Skeleton loading */}
            {isSearching && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ paddingBottom: '140%', background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s infinite' }} />
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 6 }} />
                      <div style={{ height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 4, width: '60%' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Resultados */}
            {!isSearching && filtered.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
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
                      {/* Checkmark */}
                      {isSelected && (
                        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#000', fontWeight: 700 }}>
                          ✓
                        </div>
                      )}

                      {/* Imagem */}
                      <div style={{ position: 'relative', paddingBottom: '140%' }}>
                        <img src={card.images?.small} alt={card.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>

                      {/* Info */}
                      <div style={{ padding: '8px 10px' }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#f0f0f0', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <p style={{ fontSize: 10, color: TEXT_MUTED }}>#{card.number} · {card.set?.name?.slice(0, 12)}</p>
                          {cardType && <span style={{ fontSize: 9, color: typeColor, fontWeight: 700 }}>{cardType}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

          </div>

          {/* ── PREVIEW ── */}
          <div style={{ width: 260, borderLeft: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto', flexShrink: 0 }}>
            {!preview ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 40, opacity: 0.2 }}>👆</div>
                <p style={{ fontSize: 13, color: TEXT_MUTED }}>Clique em uma carta para ver detalhes</p>
              </div>
            ) : (
              <div style={{ padding: 16 }}>
                {/* Imagem grande */}
                <img src={preview.images?.large || preview.images?.small} alt={preview.name} style={{ width: '100%', borderRadius: 10, marginBottom: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }} />

                {/* Nome + número */}
                <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 2 }}>{preview.name}</p>
                <p style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 12 }}>#{preview.number} · {preview.set?.name} ({preview.set?.releaseDate?.slice(0, 4)})</p>

                {/* Badges */}
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

                {/* Preço no banco */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 10, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Preço na LigaPokemon</p>
                  {priceData ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, textAlign: 'center' }}>
                      <div><p style={{ fontSize: 9, color: TEXT_MUTED }}>Mín</p><p style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>{fmt(priceData.preco_min)}</p></div>
                      <div><p style={{ fontSize: 9, color: TEXT_MUTED }}>Méd</p><p style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>{fmt(priceData.preco_medio)}</p></div>
                      <div><p style={{ fontSize: 9, color: TEXT_MUTED }}>Máx</p><p style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{fmt(priceData.preco_max)}</p></div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Sem dados — adicione via link na Minha Carteira</p>
                  )}
                </div>

                {/* Link LigaPokemon */}
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 10, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Link da LigaPokemon</p>
                  <input
                    value={ligaLinks[preview.id] || ''}
                    onChange={e => setLigaLinks(prev => ({ ...prev, [preview.id]: e.target.value }))}
                    placeholder="https://www.ligapokemon.com.br/..."
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${ligaLinks[preview.id] ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, padding: '8px 10px', color: '#f0f0f0', fontSize: 11, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.5)'}
                    onBlur={e => e.target.style.borderColor = ligaLinks[preview.id] ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}
                  />
                  {ligaLinks[preview.id] && (
                    <p style={{ fontSize: 10, color: '#22c55e', marginTop: 4 }}>✓ Preço será importado ao adicionar</p>
                  )}
                </div>

                {/* Artista */}
                {preview.artist && (
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 10, textAlign: 'center' }}>
                    Ilustrado por {preview.artist}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ padding: '14px 28px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'rgba(255,255,255,0.01)' }}>
          <p style={{ fontSize: 13, color: selectedCards.length > 0 ? '#f59e0b' : TEXT_MUTED, fontWeight: selectedCards.length > 0 ? 600 : 400 }}>
            {selectedCards.length === 0 ? 'Nenhuma carta selecionada' : `${selectedCards.length} carta${selectedCards.length !== 1 ? 's' : ''} selecionada${selectedCards.length !== 1 ? 's' : ''}`}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: TEXT_MUTED, padding: '10px 20px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={selectedCards.length === 0 || adding}
              style={{ background: selectedCards.length > 0 ? BRAND : 'rgba(255,255,255,0.06)', border: 'none', color: selectedCards.length > 0 ? '#000' : TEXT_MUTED, padding: '10px 24px', borderRadius: 10, fontSize: 13, cursor: selectedCards.length > 0 ? 'pointer' : 'default', fontWeight: 700, opacity: adding ? 0.7 : 1, transition: 'all 0.2s', boxShadow: selectedCards.length > 0 ? '0 0 20px rgba(245,158,11,0.2)' : 'none' }}
            >
              {adding ? 'Adicionando...' : `Adicionar ${selectedCards.length > 0 ? `(${selectedCards.length})` : ''} →`}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
