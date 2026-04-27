'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getUserPlan } from '@/lib/isPro'
import { checkCardLimit, LIMITE_FREE } from '@/lib/checkCardLimit'
import { useAppModal } from '@/components/ui/useAppModal'
import AppLayout from '@/components/ui/AppLayout'
import CardItem from '@/components/ui/CardItem'

// ─── Tipos ───────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  Fire:       { bg: 'rgba(239,68,68,0.15)',    text: '#ef4444' },
  Water:      { bg: 'rgba(96,165,250,0.15)',   text: '#60a5fa' },
  Grass:      { bg: 'rgba(34,197,94,0.15)',    text: '#22c55e' },
  Lightning:  { bg: 'rgba(245,158,11,0.15)',   text: '#f59e0b' },
  Psychic:    { bg: 'rgba(168,85,247,0.15)',   text: '#a855f7' },
  Fighting:   { bg: 'rgba(249,115,22,0.15)',   text: '#f97316' },
  Darkness:   { bg: 'rgba(107,114,128,0.15)',  text: '#9ca3af' },
  Metal:      { bg: 'rgba(148,163,184,0.15)',  text: '#94a3b8' },
  Dragon:     { bg: 'rgba(16,185,129,0.15)',   text: '#10b981' },
  Colorless:  { bg: 'rgba(209,213,219,0.1)',   text: '#d1d5db' },
  Fairy:      { bg: 'rgba(244,114,182,0.15)',  text: '#f472b6' },
  Normal:     { bg: 'rgba(209,213,219,0.1)',   text: '#d1d5db' },
}

const GEN_RANGES: [string, number, number][] = [
  ['I',    1,   151],
  ['II',   152, 251],
  ['III',  252, 386],
  ['IV',   387, 493],
  ['V',    494, 649],
  ['VI',   650, 721],
  ['VII',  722, 809],
  ['VIII', 810, 905],
  ['IX',   906, 1025],
]

function getGen(n: number) {
  return GEN_RANGES.find(([, min, max]) => n >= min && n <= max)?.[0] || '?'
}

// Extrai nome base do Pokémon (remove sufixos TCG)
function cleanPokemonName(name: string): string {
  return name
    .replace(/\s+(ex|EX|GX|V|VMAX|VSTAR|VUNION|e|E|SP|GL|C|FB|4|G|δ|☆|δ Delta Species|Star|Prime|Legend|LV\.X|LEGEND|TAG TEAM|&)$/g, '')
    .replace(/\s+(ex|EX|GX|V|VMAX|VSTAR)$/g, '')
    .replace(/^(M|Dark|Team Rocket's|Rocket's|N's|Giovanni's|Brock's|Misty's|Lt\. Surge's|Erika's|Sabrina's|Blaine's|Giovanni's|Koga's|Ancient|Origin Forme|Galarian|Hisuian|Alolan|Paldean|Shadow)\s+/i, '')
    .replace(/\s+(ex|EX|GX|V|VMAX|VSTAR|BREAK|Prime|Legend)$/gi, '')
    .trim()
}

// Sprite do Pokémon por nome (PokémonDB — sempre atualizado, inclui DLC Gen IX)
function getPokemonSprite(name: string, dexId: number): string {
  // Normaliza nome para URL do PokémonDB
  const urlName = name
    .toLowerCase()
    .replace(/['']/g, '')          // Farfetch'd → farfetchd
    .replace(/[♀]/g, '-f')        // Nidoran♀ → nidoran-f
    .replace(/[♂]/g, '-m')        // Nidoran♂ → nidoran-m
    .replace(/[é]/g, 'e')         // Flabébé → flabebe
    .replace(/[.:]/g, '')         // Type: Null → type null → type-null
    .replace(/\s+/g, '-')         // Iron Leaves → iron-leaves
    .replace(/-+/g, '-')          // evita duplo hífen
    .trim()
  return `https://img.pokemondb.net/sprites/home/normal/${urlName}.png`
}

const fmt = (v: any) => v && Number(v) > 0
  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
  : null

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Pokedex() {
  const { showAlert } = useAppModal()

  // Vista: 'grid' = lista de Pokémon | 'cards' = cartas do Pokémon selecionado
  const [view, setView]             = useState<'grid' | 'cards'>('grid')
  const [selectedPokemon, setSelectedPokemon] = useState<any | null>(null)

  // Grid de Pokémon únicos
  const [pokemons, setPokemons]     = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')

  // Cartas do Pokémon selecionado
  const [cards, setCards]           = useState<any[]>([])
  const [loadingCards, setLoadingCards] = useState(false)

  // Filtros do grid
  const [typeFilter, setTypeFilter] = useState('')
  const [genFilter, setGenFilter]   = useState('')

  // Cartas do usuário (para indicar quais ele tem)
  const [ownedNames, setOwnedNames] = useState<Set<string>>(new Set())
  const [isPro, setIsPro]           = useState(false)
  const [userId, setUserId]         = useState<string | null>(null)

  // Exchange rate
  const [exchangeRate, setExchangeRate] = useState({ usd: 6.0, eur: 6.5 })

  // ── Inicialização ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/exchange-rate').then(r => r.json()).then(d => setExchangeRate({ usd: d.usd || 6.0, eur: d.eur || 6.5 })).catch(() => {})

    async function init() {
      const { data: authData } = await supabase.auth.getUser()
      if (authData.user) {
        setUserId(authData.user.id)
        const { isPro: pro, isTrial } = await getUserPlan(authData.user.id)
        setIsPro(pro || isTrial)
        const { data: uc } = await supabase.from('user_cards').select('card_name').eq('user_id', authData.user.id)
        setOwnedNames(new Set((uc || []).map((c: any) => cleanPokemonName(c.card_name))))
      }
      await loadPokemons()
    }
    init()
  }, [])

  // ── Carrega lista única de Pokémon ──────────────────────────────────────────

  async function loadPokemons() {
    setLoading(true)
    try {
      // Busca nomes únicos via API Route (GROUP BY no banco)
      const res = await fetch('/api/pokedex')
      const json = await res.json()
      // Banco já retorna nomes base agrupados — não precisa de limpeza
      const unique: any[] = (json.pokemons || []).map((p: any) => ({
        name: p.name,
        types: p.types,
        card_count: p.card_count,
      }))

      // Busca dex numbers do PokeAPI
      const withDex = await enrichWithDexNumbers(unique)

      // Ordena por número da Pokédex (sem número vai para o fim)
      withDex.sort((a, b) => (a.dexId || 9999) - (b.dexId || 9999))
      setPokemons(withDex)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  // Busca dex numbers do PokeAPI para cada Pokémon
  async function enrichWithDexNumbers(pokemons: any[]) {
    // Busca a lista do Supabase que já tem dex_id correto
    const cache: Record<string, number> = {}
    try {
      const res = await fetch('/api/pokedex/species')
      const data = await res.json()
      ;(data.species || []).forEach((s: any) => {
        cache[s.name_en.toLowerCase()] = s.dex_id
      })
    } catch {
      // Fallback: PokeAPI
      try {
        const res = await fetch('https://pokeapi.co/api/v2/pokemon-species?limit=1025')
        const data = await res.json()
        ;(data.results || []).forEach((p: any, i: number) => {
          cache[p.name.toLowerCase()] = i + 1
        })
      } catch {}
    }

    return pokemons.map(p => {
      const nameLower = p.name.toLowerCase()
      // Tenta match direto, depois variações
      const dexId = cache[nameLower]
        || cache[nameLower.replace(/['']/g, '')]           // Farfetch'd → farfetchd
        || cache[nameLower.replace(/[éèê]/g, 'e')]         // Flabébé → flabebe
        || cache[nameLower.replace(/\s+/g, '-')]           // Mr. Mime → mr.-mime
        || cache[nameLower.replace(/[.\s]+/g, '-').replace(/--+/g, '-')]  // Mr. Mime → mr-mime
        || cache[nameLower.replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')] // Type: Null → type-null
        || 0
      return {
        ...p,
        dexId,
        generation: dexId > 0 ? getGen(dexId) : '?',
        sprite: dexId > 0 ? getPokemonSprite(p.name, dexId) : p.image,
      }
    })
  }

  // ── Seleciona Pokémon → carrega cartas ─────────────────────────────────────

  async function handleSelectPokemon(pokemon: any) {
    setSelectedPokemon(pokemon)
    setView('cards')
    setLoadingCards(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })

    const { data } = await supabase
      .from('pokemon_cards')
      .select(`
        id, name, number, set_id, set_name, set_total, set_release_date, rarity, types, hp, supertype,
        image_small, image_large, liga_link, base_pokemon_names,
        preco_normal, preco_foil, preco_promo, preco_reverse, preco_pokeball,
        preco_min, preco_medio, preco_max,
        preco_foil_min, preco_foil_medio, preco_foil_max,
        preco_promo_min, preco_promo_medio, preco_promo_max,
        preco_reverse_min, preco_reverse_medio, preco_reverse_max,
        price_usd_normal, price_usd_holofoil, price_usd_reverse,
        price_eur_normal, price_eur_holofoil
      `)
      .contains('base_pokemon_names', [pokemon.name])
      .eq('supertype', 'Pokémon')
      .order('set_release_date', { ascending: false })
      .limit(200)

    setCards((data || []).map(c => ({ ...c, price: c })))
    setLoadingCards(false)
  }

  // ── Adicionar à coleção ─────────────────────────────────────────────────────

  async function handleAddCard(card: any) {
    if (!userId) { showAlert('Faça login para adicionar cartas.', 'warning'); return }
    if (!isPro) {
      const { bloqueado } = await checkCardLimit(userId)
      if (bloqueado) { showAlert(`Limite de ${LIMITE_FREE} cartas atingido. Faça upgrade!`, 'warning'); return }
    }
    const { error } = await supabase.from('user_cards').insert({
      user_id: userId, pokemon_api_id: card.id,
      card_name: card.name, card_id: card.number,
      card_image: card.image_small, set_name: card.set_name,
      rarity: card.rarity, variante: 'normal', quantity: 1,
    })
    if (error?.code === '23505') showAlert('Carta já está na sua coleção!', 'warning')
    else if (error) showAlert('Erro ao adicionar carta.', 'error')
    else {
      showAlert(`${card.name} adicionada! ✓`, 'success')
      setOwnedNames(prev => new Set([...prev, cleanPokemonName(card.name)]))
    }
  }

  // ── Filtros ──────────────────────────────────────────────────────────────────

  const filteredPokemons = pokemons.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    const matchType   = !typeFilter || (p.types || []).includes(typeFilter)
    const matchGen    = !genFilter || p.generation === genFilter
    return matchSearch && matchType && matchGen
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div style={{ padding: '24px 0' }}>

        {/* ── Vista 2: Cartas do Pokémon ─────────────────────────────── */}
        {view === 'cards' && selectedPokemon && (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
              <button
                onClick={() => { setView('grid'); setSelectedPokemon(null) }}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f0', padding: '10px 16px', borderRadius: 12, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Pokédex
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {selectedPokemon.sprite && (
                  <img src={selectedPokemon.sprite} alt={selectedPokemon.name} style={{ width: 48, height: 48, objectFit: 'contain', imageRendering: 'auto' }} />
                )}
                <div>
                  <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 2 }}>{selectedPokemon.name}</h1>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedPokemon.dexId > 0 && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>#{String(selectedPokemon.dexId).padStart(4, '0')}</span>
                    )}
                    {(selectedPokemon.types || []).map((t: string) => (
                      <span key={t} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: TYPE_COLOR[t]?.bg || 'rgba(255,255,255,0.1)', color: TYPE_COLOR[t]?.text || '#f0f0f0' }}>{t}</span>
                    ))}
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                      {cards.length} carta{cards.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid de cartas */}
            {loadingCards ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : cards.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 80, color: 'rgba(255,255,255,0.3)' }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>🃏</p>
                <p>Nenhuma carta encontrada para {selectedPokemon.name}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                {cards.map(card => (
                  <div key={card.id} style={{ position: 'relative' }}>
                    <CardItem
                      card={card}
                      mode="select"
                      exchangeRate={exchangeRate}
                      onSelect={() => handleAddCard(card)}
                      badge={
                        <button
                          onClick={e => { e.stopPropagation(); handleAddCard(card) }}
                          style={{ background: 'rgba(245,158,11,0.9)', border: 'none', color: '#000', padding: '4px 8px', borderRadius: 8, fontSize: 10, fontWeight: 800, cursor: 'pointer', backdropFilter: 'blur(8px)' }}
                        >
                          + Coleção
                        </button>
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Vista 1: Grid de Pokémon ───────────────────────────────── */}
        {view === 'grid' && (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 2 }}>Pokédex</h1>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
                  {loading ? 'Carregando...' : `${filteredPokemons.length} Pokémon com cartas TCG`}
                </p>
              </div>
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {/* Busca */}
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}>
                  <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M15 15l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar Pokémon..."
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 12px 9px 34px', color: '#f0f0f0', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              {/* Geração */}
              <select value={genFilter} onChange={e => setGenFilter(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 12px', color: genFilter ? '#f0f0f0' : 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                <option value="">Geração</option>
                {['I','II','III','IV','V','VI','VII','VIII','IX'].map(g => <option key={g} value={g}>Gen {g}</option>)}
              </select>

              {/* Tipo */}
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 12px', color: typeFilter ? '#f0f0f0' : 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                <option value="">Tipo</option>
                {['Fire','Water','Grass','Lightning','Psychic','Fighting','Darkness','Metal','Dragon','Colorless','Fairy'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {/* Limpa filtros */}
              {(search || typeFilter || genFilter) && (
                <button onClick={() => { setSearch(''); setTypeFilter(''); setGenFilter('') }}
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '9px 14px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Limpar
                </button>
              )}
            </div>

            {/* Grid de Pokémon */}
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                {filteredPokemons.map(pokemon => {
                  const owned = ownedNames.has(pokemon.name)
                  const typeColor = TYPE_COLOR[pokemon.types?.[0]] || { bg: 'rgba(255,255,255,0.03)', text: 'rgba(255,255,255,0.4)' }
                  return (
                    <button
                      key={pokemon.name}
                      onClick={() => handleSelectPokemon(pokemon)}
                      style={{
                        background: owned ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                        border: owned ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 14, padding: '12px 8px 10px', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        transition: 'all 0.15s', fontFamily: 'inherit', position: 'relative',
                      }}
                    >
                      {/* Badge "tenho" */}
                      {owned && (
                        <div style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="9" height="9" viewBox="0 0 20 20" fill="none"><path d="M4 10l4.5 4.5L16 6" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}

                      {/* Sprite */}
                      <div style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {pokemon.sprite ? (
                          <img
                            src={pokemon.sprite}
                            alt={pokemon.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            onError={(e) => {
                              const img = e.target as HTMLImageElement
                              // Fallback 1: PokeAPI artwork
                              if (!img.src.includes('pokemontcg') && !img.src.includes('pokeapi') && pokemon.dexId > 0) {
                                img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.dexId}.png`
                              } else {
                                // Fallback 2: imagem da carta
                                img.src = pokemon.image || ''
                              }
                            }}
                          />
                        ) : (
                          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎴</div>
                        )}
                      </div>

                      {/* Número */}
                      {pokemon.dexId > 0 && (
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.05em' }}>
                          #{String(pokemon.dexId).padStart(4, '0')}
                        </p>
                      )}

                      {/* Nome */}
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#f0f0f0', textAlign: 'center', lineHeight: 1.2, wordBreak: 'break-word' }}>
                        {pokemon.name}
                      </p>

                      {/* Tipo */}
                      {pokemon.types?.[0] && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 100, background: typeColor.bg, color: typeColor.text }}>
                          {pokemon.types[0]}
                        </span>
                      )}

                      {/* Gen badge + contagem */}
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {pokemon.generation && pokemon.generation !== '?' && (
                          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>
                            Gen {pokemon.generation}
                          </span>
                        )}
                        {pokemon.card_count > 0 && (
                          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>
                            · {pokemon.card_count}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select option { background: #1a1d24; color: #f0f0f0; }
      `}</style>
    </AppLayout>
  )
}
