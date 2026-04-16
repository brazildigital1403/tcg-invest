'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { checkCardLimit, LIMITE_FREE } from '@/lib/checkCardLimit'
import { getUserPlan } from '@/lib/isPro'
import { useAppModal } from '@/components/ui/useAppModal'
import AppLayout from '@/components/ui/AppLayout'

// ─── Tipos por cor ────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  Fire: '#ef4444', Water: '#60a5fa', Grass: '#22c55e',
  Lightning: '#f59e0b', Psychic: '#a855f7', Fighting: '#f97316',
  Darkness: '#6b7280', Metal: '#94a3b8', Dragon: '#10b981',
  Colorless: '#d1d5db', Fairy: '#f472b6',
}

const GEN_RANGES: Record<string, [number, number]> = {
  Kanto: [1, 151], Johto: [152, 251], Hoenn: [252, 386],
  Sinnoh: [387, 493], Unova: [494, 649], Kalos: [650, 721],
  Alola: [722, 809], Galar: [810, 905], Paldea: [906, 1025],
}

function getGeneration(num: number) {
  for (const [gen, [min, max]] of Object.entries(GEN_RANGES)) {
    if (num >= min && num <= max) return gen
  }
  return 'Outro'
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Pokedex() {
  const [cards, setCards]               = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [hasMore, setHasMore]           = useState(true)
  const [page, setPage]                 = useState(1)

  const [search, setSearch]             = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [genFilter, setGenFilter]       = useState('')
  const [typeFilter, setTypeFilter]     = useState('')
  const [rarityFilter, setRarityFilter] = useState('')
  const [setFilter, setSetFilter]       = useState('')
  const [soMinha, setSoMinha]           = useState(false)
  const [sortBy, setSortBy]             = useState('num-asc')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching]   = useState(false)

  const [ownedIds, setOwnedIds]         = useState<Set<string>>(new Set())
  const [prices, setPrices]             = useState<Record<string, any>>({})

  const [selected, setSelected]         = useState<any | null>(null)
  const [selectedPrice, setSelectedPrice] = useState<any | null>(null)
  const [variations, setVariations]     = useState<any[]>([])
  const [loadingVariations, setLoadingVariations] = useState(false)
  const [addingCard, setAddingCard]     = useState(false)
  const [addedFeedback, setAddedFeedback] = useState(false)

  const [showTop, setShowTop]           = useState(false)
  const { showAlert } = useAppModal()
  const panelRef                        = useRef<HTMLDivElement>(null)

  // ── Debounce search — se tem texto, busca na API direto ──────────────────────

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      if (search.trim().length >= 2) {
        searchAPI(search.trim())
      } else {
        setSearchResults([])
        setIsSearching(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  async function searchAPI(term: string) {
    setIsSearching(true)
    try {
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(term)}*&pageSize=100&orderBy=name`
      )
      const data = await res.json()
      setSearchResults(data?.data || [])
    } catch {
      setSearchResults([])
    }
    setIsSearching(false)
  }

  // ── Scroll top button ────────────────────────────────────────────────────────

  useEffect(() => {
    const fn = () => setShowTop(window.scrollY > 400)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  // ── Scroll infinito ──────────────────────────────────────────────────────────

  useEffect(() => {
    function onScroll() {
      if (!hasMore || loadingMore) return
      const { scrollY, innerHeight } = window
      const docH = document.documentElement.scrollHeight
      if (scrollY + innerHeight >= docH - 300) {
        const next = page + 1
        setPage(next)
        fetchCards(next)
      }
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [page, hasMore, loadingMore])

  // ── Fetch cartas ──────────────────────────────────────────────────────────────

  async function fetchCards(pageNum = 1) {
    if (pageNum === 1) {
      const cache = localStorage.getItem('pokedex-v2')
      const ts    = localStorage.getItem('pokedex-v2-ts')
      if (cache && ts && Date.now() - Number(ts) < 7 * 24 * 60 * 60 * 1000) {
        setCards(JSON.parse(cache))
        setLoading(false)
        return
      }
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    try {
      const res  = await fetch(`https://api.pokemontcg.io/v2/cards?page=${pageNum}&pageSize=100`)
      const data = await res.json()
      const batch: any[] = data.data || []

      setCards(prev => {
        const merged = pageNum === 1 ? batch : [...prev, ...batch]
        const sorted = merged.sort((a, b) =>
          Number(a.nationalPokedexNumbers?.[0] || 9999) -
          Number(b.nationalPokedexNumbers?.[0] || 9999)
        )
        if (pageNum === 1) {
          localStorage.setItem('pokedex-v2', JSON.stringify(sorted))
          localStorage.setItem('pokedex-v2-ts', String(Date.now()))
        }
        return sorted
      })

      if (batch.length < 100) setHasMore(false)
    } catch {}

    setLoading(false)
    setLoadingMore(false)
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchCards(1)

    async function loadOwned() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return

      const { data: userCards } = await supabase
        .from('user_cards').select('card_id').eq('user_id', authData.user.id)
      setOwnedIds(new Set(userCards?.map((c: any) => c.card_id) || []))

      const { data: priceData } = await supabase
        .from('card_prices').select('pokemon_api_id,preco_min,preco_medio,preco_max')
      const map: Record<string, any> = {}
      priceData?.forEach((p: any) => { map[p.pokemon_api_id] = p })
      setPrices(map)
    }

    loadOwned()
  }, [])

  // ── Selecionar carta ──────────────────────────────────────────────────────────

  async function handleSelect(card: any) {
    setSelected(card)
    setAddedFeedback(false)
    setSelectedPrice(prices[card.id] || null)
    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })

    setLoadingVariations(true)
    try {
      const res  = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(card.name)}"&pageSize=12`)
      const data = await res.json()
      setVariations((data.data || []).filter((v: any) => v.id !== card.id))
    } catch {}
    setLoadingVariations(false)
  }

  // ── Adicionar à coleção ────────────────────────────────────────────────────

  async function handleAdd() {
    if (!selected) return
    setAddingCard(true)
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) { setAddingCard(false); return }

    // Carrega plano se ainda não carregou
    const { isPro: pro } = await getUserPlan(authData.user.id)
    setIsPro(pro)

    if (!pro) {
      const { bloqueado } = await checkCardLimit(authData.user.id)
      if (bloqueado) {
        showAlert(`Você atingiu o limite de ${LIMITE_FREE} cartas do plano gratuito. Faça upgrade para o plano Pro por R$ 19,90/mês ou R$ 179/ano (2 meses grátis)! 🚀`, 'warning')
        setAddingCard(false)
        return
      }
    }

    const number = selected.number || ''
    const total  = selected.set?.printedTotal || ''
    const cardName = number && total ? `${selected.name} (${number}/${total})` : selected.name

    await supabase.from('user_cards').insert({
      user_id: authData.user.id,
      card_id: selected.id,
      pokemon_api_id: selected.id,
      card_name: cardName,
      card_image: selected.images?.large || selected.images?.small,
      rarity: selected.rarity || null,
    })

    setOwnedIds(prev => new Set([...prev, selected.id]))
    setAddingCard(false)
    setAddedFeedback(true)
  }

  // ── Filtros ──────────────────────────────────────────────────────────────────

  const allTypes    = [...new Set(cards.flatMap(c => c.types || []))] as string[]
  const allRarities = [...new Set(cards.map(c => c.rarity).filter(Boolean))] as string[]
  const allSets     = [...new Set(cards.map(c => c.set?.name).filter(Boolean))].sort() as string[]

  const isSearchMode = debouncedSearch.trim().length >= 2

  function applyFilters(list: any[]) {
    return list
      .filter(c => !genFilter    || getGeneration(Number(c.nationalPokedexNumbers?.[0] || 9999)) === genFilter)
      .filter(c => !typeFilter   || (c.types || []).includes(typeFilter))
      .filter(c => !rarityFilter || c.rarity === rarityFilter)
      .filter(c => !setFilter    || c.set?.name === setFilter)
      .filter(c => !soMinha      || ownedIds.has(c.id))
      .sort((a, b) => {
        if (sortBy === 'num-asc')  return Number(a.nationalPokedexNumbers?.[0] || 9999) - Number(b.nationalPokedexNumbers?.[0] || 9999)
        if (sortBy === 'num-desc') return Number(b.nationalPokedexNumbers?.[0] || 9999) - Number(a.nationalPokedexNumbers?.[0] || 9999)
        if (sortBy === 'name-asc') return a.name.localeCompare(b.name)
        if (sortBy === 'hp-desc')  return Number(b.hp || 0) - Number(a.hp || 0)
        return 0
      })
  }

  const filtered = applyFilters(isSearchMode ? searchResults : cards)

  const activeFiltersCount = [genFilter, typeFilter, rarityFilter, setFilter, soMinha ? '1' : ''].filter(Boolean).length

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <style>{`
        .pokedex-root { height: calc(100vh - 64px); overflow: hidden; }
        .pokedex-col-main { overflow-y: auto; }
        @media (max-width: 768px) {
          .pokedex-root { height: auto !important; overflow: visible !important; }
          .pokedex-col-main { overflow-y: visible !important; height: auto !important; }
        }
      `}</style>
      <div className="pokedex-root" style={{ fontFamily: "'DM Sans', system-ui, sans-serif", display: 'flex', gap: 0 }}>

        {/* ── COLUNA PRINCIPAL ── */}
        <div className="pokedex-col-main" style={{ flex: 1, overflowY: 'auto', padding: '24px 16px 100px' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 2 }}>Pokédex</h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
              {isSearchMode
                ? isSearching
                  ? 'Buscando na API...'
                  : `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''} para "${debouncedSearch}"`
                : `${filtered.length.toLocaleString()} cartas · ${ownedIds.size} na sua coleção`}
            </p>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar carta..."
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 12px 9px 32px', color: '#f0f0f0', fontSize: 13, outline: 'none', width: 180, fontFamily: 'inherit' }}
                onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            {/* Geração */}
            <select value={genFilter} onChange={e => setGenFilter(e.target.value)}
              style={{ background: genFilter ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${genFilter ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, padding: '9px 12px', color: genFilter ? '#f59e0b' : 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', outline: 'none' }}>
              <option value="">Geração</option>
              {Object.keys(GEN_RANGES).map(g => <option key={g} value={g} style={{ background: '#0d0f14' }}>{g}</option>)}
            </select>

            {/* Tipo */}
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              style={{ background: typeFilter ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${typeFilter ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, padding: '9px 12px', color: typeFilter ? '#f59e0b' : 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', outline: 'none' }}>
              <option value="">Tipo</option>
              {allTypes.map(t => <option key={t} value={t} style={{ background: '#0d0f14' }}>{t}</option>)}
            </select>

            {/* Raridade */}
            <select value={rarityFilter} onChange={e => setRarityFilter(e.target.value)}
              style={{ background: rarityFilter ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${rarityFilter ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, padding: '9px 12px', color: rarityFilter ? '#f59e0b' : 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', outline: 'none' }}>
              <option value="">Raridade</option>
              {allRarities.map(r => <option key={r} value={r} style={{ background: '#0d0f14' }}>{r}</option>)}
            </select>

            {/* Set */}
            <select value={setFilter} onChange={e => setSetFilter(e.target.value)}
              style={{ background: setFilter ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${setFilter ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, padding: '9px 12px', color: setFilter ? '#f59e0b' : 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', outline: 'none', maxWidth: 160 }}>
              <option value="">Set</option>
              {allSets.map(s => <option key={s} value={s} style={{ background: '#0d0f14' }}>{s}</option>)}
            </select>

            {/* Ordenação */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 12px', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', outline: 'none' }}>
              <option value="num-asc" style={{ background: '#0d0f14' }}>Nº ↑</option>
              <option value="num-desc" style={{ background: '#0d0f14' }}>Nº ↓</option>
              <option value="name-asc" style={{ background: '#0d0f14' }}>Nome A→Z</option>
              <option value="hp-desc" style={{ background: '#0d0f14' }}>Maior HP</option>
            </select>

            {/* Toggle: só minha coleção */}
            <button
              onClick={() => setSoMinha(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 10, border: `1px solid ${soMinha ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.1)'}`, background: soMinha ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)', color: soMinha ? '#22c55e' : 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: soMinha ? 700 : 400 }}
            >
              <span>✓</span> Minha coleção
            </button>

            {/* Contador + Limpar */}
            {(activeFiltersCount > 0 || search) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {activeFiltersCount > 0 && (
                  <span style={{ fontSize: 11, background: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '3px 8px', borderRadius: 100, fontWeight: 700 }}>
                    {activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''}
                  </span>
                )}
                <button onClick={() => { setGenFilter(''); setTypeFilter(''); setRarityFilter(''); setSetFilter(''); setSoMinha(false); setSearch(''); setSearchResults([]) }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                  Limpar
                </button>
              </div>
            )}
          </div>

          {/* Grid */}
          {loading || (isSearchMode && isSearching) ? (
            <div className="tcg-pokedex-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingBottom: '145%', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : (
            <div className="tcg-pokedex-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              {filtered.map(card => {
                const isOwned    = ownedIds.has(card.id)
                const isSelected = selected?.id === card.id
                const num        = card.nationalPokedexNumbers?.[0]
                const cardType   = card.types?.[0]
                const typeColor  = TYPE_COLOR[cardType] || '#6b7280'

                return (
                  <div
                    key={card.id}
                    onClick={() => handleSelect(card)}
                    style={{
                      background: isSelected ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
                      border: isSelected ? '1.5px solid rgba(245,158,11,0.5)' : isOwned ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 12, cursor: 'pointer', overflow: 'hidden',
                      transition: 'all 0.15s', position: 'relative',
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.2)' }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = isOwned ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.07)' }}
                  >
                    {/* Badge "tenho" */}
                    {isOwned && (
                      <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 2, width: 20, height: 20, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#000' }}>✓</div>
                    )}

                    {/* Número */}
                    {num && (
                      <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 2, background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '2px 6px', fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                        #{num}
                      </div>
                    )}

                    {/* Imagem */}
                    <img src={card.images?.small} alt={card.name} style={{ width: '100%', display: 'block' }} loading="lazy" />

                    {/* Info */}
                    <div style={{ padding: '8px 10px' }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#f0f0f0', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>
                        {card.number && card.set?.printedTotal ? `${card.number}/${card.set.printedTotal}` : card.number ? `#${card.number}` : ''}
                        {card.set?.name ? ` · ${card.set.name}` : ''}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {cardType ? (
                          <span style={{ fontSize: 10, color: typeColor, fontWeight: 700 }}>{cardType}</span>
                        ) : <span />}
                        {prices[card.id]?.preco_medio > 0 && (
                          <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700 }}>{fmt(prices[card.id].preco_medio)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!isSearchMode && loadingMore && (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 24 }}>Carregando mais cartas...</p>
          )}
          {isSearchMode && !isSearching && filtered.length === 0 && debouncedSearch.length >= 2 && (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.3)' }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>🔍</p>
              <p style={{ fontSize: 14 }}>Nenhuma carta encontrada para "{debouncedSearch}"</p>
            </div>
          )}
        </div>

        {/* ── PAINEL LATERAL DE DETALHES ── */}
        <div
          ref={panelRef}
          className={`tcg-pokedex-panel${selected ? ' panel-open' : ''}`}
          style={{
            width: selected ? 300 : 0,
            minWidth: selected ? 300 : 0,
            flexShrink: 0,
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            overflowY: 'auto',
            overflowX: 'hidden',
            transition: 'width 0.25s ease, min-width 0.25s ease',
            background: '#0d0f14',
          }}
        >
          {selected && (
            <div style={{ padding: 20, width: '100%', maxWidth: 480, margin: '0 auto' }}>
              {/* Close */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={() => setSelected(null)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: 28, height: 28, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ✕
                </button>
              </div>

              {/* Imagem */}
              <img
                src={selected.images?.large || selected.images?.small}
                alt={selected.name}
                style={{ width: '100%', borderRadius: 12, marginBottom: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
              />

              {/* Nome + Set */}
              <p style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 2 }}>{selected.name}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {selected.number && selected.set?.printedTotal
                  ? <span style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 6, padding: '2px 8px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{selected.number}/{selected.set.printedTotal}</span>
                  : selected.number
                  ? <span style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>#{selected.number}</span>
                  : null}
                <span>{selected.set?.name}</span>
                {selected.set?.releaseDate && <span style={{ color: 'rgba(255,255,255,0.25)' }}>{selected.set.releaseDate.slice(0, 4)}</span>}
              </p>

              {/* Badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {(selected.types || []).map((t: string) => (
                  <span key={t} style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: (TYPE_COLOR[t] || '#6b7280') + '22', color: TYPE_COLOR[t] || '#6b7280' }}>{t}</span>
                ))}
                {selected.rarity && (
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 100, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>{selected.rarity}</span>
                )}
                {selected.hp && (
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 100, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>HP {selected.hp}</span>
                )}
              </div>

              {/* Preço */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Preço na LigaPokemon</p>
                {selectedPrice ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', textAlign: 'center', gap: 4 }}>
                    <div><p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Mín</p><p style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{fmt(selectedPrice.preco_min)}</p></div>
                    <div><p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Médio</p><p style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>{fmt(selectedPrice.preco_medio)}</p></div>
                    <div><p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Máx</p><p style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>{fmt(selectedPrice.preco_max)}</p></div>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Sem preço — importe via Minha Carteira</p>
                )}
              </div>

              {/* Botão adicionar */}
              {ownedIds.has(selected.id) || addedFeedback ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, fontSize: 13, color: '#22c55e', fontWeight: 600 }}>
                  ✓ Na sua coleção
                </div>
              ) : (
                <button
                  onClick={handleAdd}
                  disabled={addingCard}
                  style={{ width: '100%', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '11px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: addingCard ? 'not-allowed' : 'pointer', opacity: addingCard ? 0.7 : 1 }}
                >
                  {addingCard ? 'Adicionando...' : '+ Adicionar à coleção'}
                </button>
              )}

              {/* Botão compartilhar */}
              <button
                onClick={() => {
                  const url = `${window.location.origin}/carta/${selected?.id}`
                  navigator.clipboard?.writeText(url).then(() => {
                    showAlert('🔗 Link copiado! Compartilhe com quem quiser.', 'success')
                  })
                }}
                style={{ width: '100%', marginTop: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', padding: '10px', borderRadius: 10, fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}
              >
                🔗 Compartilhar esta carta
              </button>

              {/* Variantes */}
              {(loadingVariations || variations.length > 0) && (
                <div style={{ marginTop: 20 }}>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                    Outras versões
                  </p>
                  {loadingVariations ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                      {[1,2,3].map(i => <div key={i} style={{ paddingBottom: '140%', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }} />)}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                      {variations.slice(0, 9).map(v => (
                        <img
                          key={v.id}
                          src={v.images?.small}
                          alt={v.name}
                          onClick={() => handleSelect(v)}
                          style={{ width: '100%', borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', transition: 'border-color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Artista */}
              {selected.artist && (
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 16 }}>
                  Ilustrado por {selected.artist}
                </p>
              )}

            </div>
          )}
        </div>

      </div>

      {/* Scroll to top */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ position: 'fixed', bottom: 24, right: 24, width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', fontSize: 18, cursor: 'pointer', boxShadow: '0 4px 16px rgba(245,158,11,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
        >
          ↑
        </button>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }
        @media (max-width: 768px) {
          .tcg-pokedex-panel {
            display: none !important;
          }
          .tcg-pokedex-panel.panel-open {
            display: block !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100% !important;
            min-width: 100% !important;
            z-index: 500 !important;
            background: #0d0f14 !important;
            border-left: none !important;
            overflow-y: auto !important;
          }
          .tcg-pokedex-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)) !important; }
        }
      `}</style>
    </AppLayout>
  )
}