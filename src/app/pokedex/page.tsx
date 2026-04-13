'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/ui/AppLayout'

export default function Pokedex() {
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState<any>(null)
  const [variations, setVariations] = useState<any[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [rarityFilter, setRarityFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [genFilter, setGenFilter] = useState('')
  const [sort, setSort] = useState('num-asc')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [rarities, setRarities] = useState<string[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [ownedIds, setOwnedIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [showTop, setShowTop] = useState(false)

  async function handleAddCard(card: any) {
  const { data } = await supabase.auth.getUser()

  if (!data.user) {
    alert('Você precisa estar logado')
    return
  }

  const { error } = await supabase.from('user_cards').insert([
    {
      user_id: data.user.id,
      card_id: card.id,
      card_name: card.name,
      card_image: card.images.small,
    },
  ])

  if (error) {
    alert('Erro ao salvar carta')
    console.log(error)
  } else {
    alert('Carta adicionada!')
  }
}

  async function openModal(card: any) {
  setSelectedCard(card)
  setActiveId(card.id)

  try {
    const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:\"${card.name}\"`)
    const data = await res.json()

    // limitar a 10
    setVariations((data.data || []).slice(0, 10))
  } catch (e) {
    console.log(e)
    setVariations([])
  }
}

  // Carrega cartas em blocos contínuos (100 por página)
  // Scroll infinito vai acumulando (1000, 2000, 3000...)
  async function fetchCards(pageNumber = 1) {
    if (pageNumber === 1) {
      const cache = localStorage.getItem('pokedex-cache')
      const cacheTime = localStorage.getItem('pokedex-cache-time')

      if (cache && cacheTime) {
        const isValid = Date.now() - Number(cacheTime) < 30 * 24 * 60 * 60 * 1000

        if (isValid) {
          setCards(JSON.parse(cache))
          setLoading(false)
          return
        }
      }
    }
    try {
      if (pageNumber === 1) setLoading(true)
      else setLoadingMore(true)

      const res = await fetch(`https://api.pokemontcg.io/v2/cards?page=${pageNumber}&pageSize=100`)
      const data = await res.json()

      const batch = data.data || []

      // gerar filtros com base em TODAS as cartas carregadas
      setCards((prev) => {
        const merged = [...prev, ...batch]

        const raritiesSet = new Set(merged.map((c: any) => c.rarity).filter(Boolean))
        setRarities(Array.from(raritiesSet))

        const typesSet = new Set(merged.flatMap((c: any) => c.types || []))
        setTypes(Array.from(typesSet))

        return merged.sort((a, b) =>
          Number(a.nationalPokedexNumbers?.[0] || 9999) -
          Number(b.nationalPokedexNumbers?.[0] || 9999)
        )
      })

      if (pageNumber === 1) {
        localStorage.setItem('pokedex-cache', JSON.stringify(batch))
        localStorage.setItem('pokedex-cache-time', String(Date.now()))
      }

      if (batch.length < 100) {
        setHasMore(false)
      }

    } catch (error) {
      console.log(error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchCards(1)

    async function fetchOwned() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) return

      const { data: cards } = await supabase
        .from('user_cards')
        .select('card_id')
        .eq('user_id', data.user.id)

      setOwnedIds(cards?.map((c) => c.card_id) || [])
    }

    fetchOwned()
  }, [])

  useEffect(() => {
    function handleScroll() {
      if (!hasMore || loadingMore) return

      const scrollTop = window.scrollY
      const windowHeight = window.innerHeight
      const docHeight = document.documentElement.scrollHeight

      if (scrollTop + windowHeight >= docHeight - 200) {
        const nextPage = page + 1
        setPage(nextPage)
        fetchCards(nextPage)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [page, hasMore, loadingMore])

  useEffect(() => {
    const saved = sessionStorage.getItem('pokedex-scroll')
    if (saved) {
      window.scrollTo(0, Number(saved))
    }

    const saveScroll = () => {
      sessionStorage.setItem('pokedex-scroll', String(window.scrollY))
    }

    window.addEventListener('scroll', saveScroll)
    return () => window.removeEventListener('scroll', saveScroll)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)

    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
  function handleScrollTop() {
    setShowTop(window.scrollY > 400)
  }

  window.addEventListener('scroll', handleScrollTop)
  return () => window.removeEventListener('scroll', handleScrollTop)
}, [])

  function toggleRarity(value: string) {
    const normalized = value.toLowerCase()
    setRarityFilter((prev) =>
      prev.includes(normalized)
        ? prev.filter((v) => v !== normalized)
        : [...prev, normalized]
    )
  }

  function toggleType(value: string) {
    const normalized = value.toLowerCase()
    setTypeFilter((prev) =>
      prev.includes(normalized)
        ? prev.filter((v) => v !== normalized)
        : [...prev, normalized]
    )
  }

  const filteredCards = cards
  .filter((c) =>
    c.name.toLowerCase().includes(debouncedSearch.toLowerCase())
  )
  .filter((c) => {
    if (rarityFilter.length === 0) return true
    return rarityFilter.some(r => (c.rarity || '').toLowerCase() === r.toLowerCase())
  })
  .filter((c) => {
    if (typeFilter.length === 0) return true
    return (c.types || []).some((t: string) =>
      typeFilter.some(f => f.toLowerCase() === t.toLowerCase())
    )
  })
  .filter((c) => {
    if (!genFilter) return true
    const num = Number(c.nationalPokedexNumbers?.[0] || 9999)
    return getGeneration(num) === genFilter
  })
  .sort((a, b) => {
    if (sort === 'num-asc') return Number(a.nationalPokedexNumbers?.[0] || 9999) - Number(b.nationalPokedexNumbers?.[0] || 9999)
    if (sort === 'num-desc') return Number(b.nationalPokedexNumbers?.[0] || 9999) - Number(a.nationalPokedexNumbers?.[0] || 9999)
    return 0
  })

  const groupedCards = filteredCards.reduce((acc: any, card: any) => {
    const num = Number(card.nationalPokedexNumbers?.[0] || 9999)
    const gen = getGeneration(num)

    if (!acc[gen]) acc[gen] = []
    acc[gen].push(card)

    return acc
  }, {})

  function getProgress(cards: any[]) {
    const total = cards.length
    const owned = cards.filter((c) => ownedIds.includes(c.id)).length

    return { total, owned }
  }

  if (loading) {
    return (
      <AppLayout total={0}>
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse bg-gray-800 rounded-xl h-40"
            />
          ))}
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout total={0}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-5">Pokédex</h1>

        <div className="flex flex-col gap-4 mb-6">

          {/* ROW 1 */}
          <div className="flex flex-wrap gap-3 items-center">
            <input
              placeholder="Buscar carta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            />

            <select
              value={genFilter}
              onChange={(e) => setGenFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            >
              <option value="">Geração</option>
              <option value="Kanto">Kanto</option>
              <option value="Johto">Johto</option>
              <option value="Hoenn">Hoenn</option>
              <option value="Sinnoh">Sinnoh</option>
              <option value="Unova">Unova</option>
              <option value="Kalos">Kalos</option>
              <option value="Alola">Alola</option>
              <option value="Galar">Galar</option>
              <option value="Paldea">Paldea</option>
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            >
              <option value="num-asc"># - Z</option>
              <option value="num-desc">Z - #</option>
            </select>

            <button
              onClick={() => {
                setRarityFilter([])
                setTypeFilter([])
                setGenFilter('')
              }}
              className="text-xs text-gray-400 hover:text-white"
            >
              Limpar filtros
            </button>
          </div>

          {/* ROW 2 - RARIDADE */}
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 mb-1">Raridade</span>
            <div className="flex flex-wrap gap-2">
              {rarities.map((r) => {
                const active = rarityFilter.includes(r.toLowerCase())
                return (
                  <button
                    key={r}
                    onClick={() => toggleRarity(r)}
                    className={`px-3 py-1 rounded-full text-xs border transition ${
                      active
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {r}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ROW 3 - TIPO */}
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 mb-1">Tipo</span>
            <div className="flex flex-wrap gap-2">
              {types.map((t) => {
                const active = typeFilter.includes(t.toLowerCase())
                return (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className={`px-3 py-1 rounded-full text-xs border transition ${
                      active
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>

        </div>

        {(rarityFilter.length > 0 || typeFilter.length > 0) && (
          <p className="text-xs text-gray-400 mt-2">
            {rarityFilter.length + typeFilter.length} filtros ativos
          </p>
        )}


        <p className="text-sm text-gray-400 mb-4 mt-4">
          {cards.length} cartas carregadas
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {filteredCards.map((card: any) => {
            const number = card.nationalPokedexNumbers?.[0] || card.number

            return (
              <div
                key={card.id}
                onClick={() => openModal(card)}
                className="relative border border-gray-800 bg-gray-900 rounded-xl p-3 shadow-lg hover:scale-105 transition cursor-pointer"
              >

                {/* BIG NUMBER */}
                <span className="absolute top-2 left-2 text-xs bg-black/70 text-white px-2 py-0.5 rounded">
                  #{number}
                </span>

                <img src={card.images.small} alt={card.name} />

                <p className="mt-2 font-bold">{card.name}</p>

                {ownedIds.includes(card.id) && (
                  <p className="text-xs text-green-400">Já tenho</p>
                )}

                <p className="text-sm text-gray-400">{card.rarity}</p>
                <p className="text-xs text-gray-500">{card.types?.join(', ')}</p>
              </div>
            )
          })}
        </div>

        {loadingMore && (
          <p className="text-center text-gray-400 mt-4">Carregando mais cartas...</p>
        )}
      </div>

      {selectedCard && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-3xl relative">

            <button
              onClick={() => setSelectedCard(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>

            <div className="grid md:grid-cols-2 gap-6">

              {/* IMAGE */}
              <img
                key={selectedCard.id}
                src={selectedCard.images.large}
                className="w-full rounded transition-all duration-300 ease-in-out"
              />

              {/* INFO */}
              <div>
                <h2 className="text-xl font-bold mb-2">{selectedCard.name}</h2>
                <p className="text-gray-400">Número: {selectedCard.number}</p>
                <p className="text-gray-400">Raridade: {selectedCard.rarity}</p>
                <p className="text-gray-400">Tipo: {selectedCard.types?.join(', ')}</p>

                <button
                  onClick={() => handleAddCard(selectedCard)}
                  className="mt-4 bg-purple-600 px-4 py-2 rounded-lg text-sm hover:opacity-90"
                >
                  Adicionar à coleção
                </button>
              </div>

            </div>

            {/* VARIATIONS */}
            <div className="mt-6">
              <p className="text-sm text-gray-400 mb-2">Cartas Relacionadas</p>
              <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory">
                {variations.map((v) => (
                  <img
                    key={v.id}
                    src={v.images.small}
                    onClick={() => {
                      setSelectedCard(v)
                      setActiveId(v.id)
                    }}
                    className={`w-20 rounded border cursor-pointer hover:scale-105 transition snap-center ${
                      activeId === v.id
                        ? 'border-purple-500 scale-105'
                        : 'border-gray-700'
                    }`}
                  />
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 bg-purple-600 p-3 rounded-full shadow-lg hover:opacity-90"
        >
          ↑
        </button>
      )}
    </AppLayout>
  )
}

function getGeneration(num: number) {
  if (num <= 151) return 'Kanto'
  if (num <= 251) return 'Johto'
  if (num <= 386) return 'Hoenn'
  if (num <= 493) return 'Sinnoh'
  if (num <= 649) return 'Unova'
  if (num <= 721) return 'Kalos'
  if (num <= 809) return 'Alola'
  if (num <= 905) return 'Galar'
  return 'Paldea'
}