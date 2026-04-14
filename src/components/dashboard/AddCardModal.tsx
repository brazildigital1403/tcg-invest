'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { authFetch } from '@/lib/authFetch'

interface Props {
  userId: string | null
  onClose: () => void
  onAdded: () => void
}

export default function AddCardModal({ userId, onClose, onAdded }: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedCards, setSelectedCards] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedPreview, setSelectedPreview] = useState<any | null>(null)
  const [priceDataPreview, setPriceDataPreview] = useState<any | null>(null)
  const [typeFilterModal, setTypeFilterModal] = useState<string>('')
  const [rarityFilterModal, setRarityFilterModal] = useState<string>('')
  const [sortModal, setSortModal] = useState('name')
  const [previewTab, setPreviewTab] = useState<'card' | 'info' | 'price'>('card')
  const searchTimeout = useRef<any>(null)

  async function handleSearchCards(value: string) {
    setSearchTerm(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      if (!value) { setSearchResults([]); setIsSearching(false); return }
      setIsSearching(true)
      try {
        const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(value)}`)
        const data = await res.json()
        setSearchResults(data?.data?.slice(0, 50) || [])
      } catch { setSearchResults([]) }
      setIsSearching(false)
    }, 400)
  }

  async function matchPokemonApiId(cardName: string, cardNumber?: string) {
    try {
      const cleanName = cardName.split('(')[0].trim().toLowerCase()
      const number = cardNumber || ''
      const queryExact = `https://api.pokemontcg.io/v2/cards?q=name:"${cleanName}"${number ? ` number:${number}` : ''}`
      const resExact = await fetch(queryExact)
      const dataExact = await resExact.json()
      if (dataExact?.data?.length > 0) return { id: dataExact.data[0].id, score: 1 }
      const queryName = `https://api.pokemontcg.io/v2/cards?q=name:"${cleanName}"`
      const resName = await fetch(queryName)
      const dataName = await resName.json()
      if (!dataName?.data?.length) return { id: null, score: 0 }
      let bestMatch = null, bestScore = 0
      for (const card of dataName.data) {
        const apiName = card.name.toLowerCase()
        let score = 0
        if (apiName === cleanName) score += 0.7
        if (apiName.includes(cleanName)) score += 0.2
        if (number && card.number === number) score += 0.1
        if (score > bestScore) { bestScore = score; bestMatch = card }
      }
      return { id: bestMatch?.id || null, score: bestScore }
    } catch { return { id: null, score: 0 } }
  }

  const filteredResults = searchResults
    .filter((c) => !typeFilterModal || (c.types || []).includes(typeFilterModal))
    .filter((c) => !rarityFilterModal || c.rarity === rarityFilterModal)
    .sort((a, b) => {
      if (sortModal === 'name') return a.name.localeCompare(b.name)
      if (sortModal === 'number') return Number(a.number) - Number(b.number)
      return 0
    })

  return (
<div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
        <div className="w-full max-w-6xl bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl flex flex-col max-h-[90vh]">

          {/* HEADER */}
          <div className="flex items-center justify-between p-5 border-b border-gray-800">
            <h2 className="text-xl font-semibold text-white">Adicionar Cartas</h2>
            <button
              onClick={() => onClose()}
              className="text-gray-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>

          {/* SEARCH + CONTROLS */}
          <div className="p-5 border-b border-gray-800 space-y-4">
            <input
              value={searchTerm}
              onChange={(e) => handleSearchCards(e.target.value)}
              placeholder="Buscar cartas..."
              className="w-full p-3 rounded-xl bg-gray-800 border border-gray-700 text-white"
            />

            <div className="flex gap-2 flex-wrap">
              {selectedCards.map((c) => (
                <span
                  key={c.id}
                  className="px-3 py-1 bg-yellow-500 text-black text-xs rounded-full"
                >
                  {c.name}
                </span>
              ))}
            </div>

            {/* Filters, sorting */}
            <div className="flex gap-2 flex-wrap">
              <select
                value={typeFilterModal}
                onChange={(e) => setTypeFilterModal(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
              >
                <option value="">Tipo</option>
                <option value="Fire">Fire</option>
                <option value="Water">Water</option>
                <option value="Grass">Grass</option>
                <option value="Lightning">Lightning</option>
              </select>

              <select
                value={rarityFilterModal}
                onChange={(e) => setRarityFilterModal(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
              >
                <option value="">Raridade</option>
                <option value="Common">Common</option>
                <option value="Uncommon">Uncommon</option>
                <option value="Rare">Rare</option>
              </select>

              <select
                value={sortModal}
                onChange={(e) => setSortModal(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
              >
                <option value="name">Nome</option>
                <option value="number">Número</option>
              </select>
            </div>
          </div>

          {/* CONTENT */}
          <div className="flex flex-1 overflow-hidden">

            {/* GRID */}
            <div className="w-2/3 overflow-y-auto p-5">
              {isSearching && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-48 bg-gray-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              )}

              {!isSearching && searchResults.length === 0 && (
                <div className="text-center text-gray-400 py-10">
                  Digite para buscar cartas
                </div>
              )}

              {!isSearching && (() => {
                const filteredResults = searchResults
                  .filter((c) => {
                    if (!typeFilterModal) return true
                    return (c.types || []).includes(typeFilterModal)
                  })
                  .filter((c) => {
                    if (!rarityFilterModal) return true
                    return c.rarity === rarityFilterModal
                  })
                  .sort((a, b) => {
                    if (sortModal === 'name') return a.name.localeCompare(b.name)
                    if (sortModal === 'number') return Number(a.number) - Number(b.number)
                    return 0
                  })
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {filteredResults.map((card) => {
                      const isSelected = selectedCards.find((c) => c.id === card.id)

                      return (
                        <div
                          key={card.id}
                          onClick={() => {
                            setSelectedPreview(card)
                            // carregar preço do Supabase
                            ;(async () => {
                              const { data } = await supabase
                                .from('card_prices')
                                .select('*')
                                .eq('pokemon_api_id', card.id)
                                .maybeSingle()

                              setPriceDataPreview(data || null)
                            })()
                            if (isSelected) {
                              setSelectedCards((prev) => prev.filter((c) => c.id !== card.id))
                            } else {
                              setSelectedCards((prev) => [...prev, card])
                            }
                          }}
                          className={`relative bg-gray-800 rounded-xl p-3 cursor-pointer transition hover:scale-105 ${
                            isSelected ? 'ring-2 ring-yellow-500' : ''
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full">
                              ✓
                            </div>
                          )}

                          <img
                            src={card.images?.small}
                            alt={card.name}
                            className="w-full rounded mb-2"
                          />

                          <p className="text-sm text-white font-medium">{card.name}</p>
                          <p className="text-xs text-gray-400">#{card.number}</p>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            {/* PREVIEW */}
            <div className="w-1/3 border-l border-gray-800 p-5">
              {selectedPreview ? (
                <div>
                  {/* TABS */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setPreviewTab('card')}
                      className={`px-3 py-1 text-xs rounded-full ${
                        previewTab === 'card'
                          ? 'bg-yellow-500 text-black'
                          : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      Card
                    </button>

                    <button
                      onClick={() => setPreviewTab('info')}
                      className={`px-3 py-1 text-xs rounded-full ${
                        previewTab === 'info'
                          ? 'bg-yellow-500 text-black'
                          : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      Info
                    </button>

                    <button
                      onClick={() => setPreviewTab('price')}
                      className={`px-3 py-1 text-xs rounded-full ${
                        previewTab === 'price'
                          ? 'bg-yellow-500 text-black'
                          : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      Price
                    </button>
                  </div>

                  {/* TAB CONTENT */}
                  {previewTab === 'card' && (
                    <img
                      src={selectedPreview.images?.large}
                      className="w-full rounded-xl mb-4"
                    />
                  )}

                  {previewTab === 'info' && (
                    <div className="space-y-2 text-sm">
                      <p className="text-white font-bold">{selectedPreview.name}</p>
                      <p className="text-gray-400">#{selectedPreview.number}</p>
                      <p className="text-gray-400">{selectedPreview.rarity || 'Sem raridade'}</p>
                      <p className="text-gray-500 text-xs">
                        {(selectedPreview.types || []).join(', ')}
                      </p>
                    </div>
                  )}

                  {previewTab === 'price' && (
                    <div className="space-y-3">
                      {priceDataPreview ? (
                        <div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-xs text-gray-400">Min</p>
                              <p className="text-green-500 font-bold">
                                R$ {Number(priceDataPreview.preco_min || 0).toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Médio</p>
                              <p className="text-white font-bold">
                                R$ {Number(priceDataPreview.preco_medio || 0).toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Max</p>
                              <p className="text-red-500 font-bold">
                                R$ {Number(priceDataPreview.preco_max || 0).toFixed(2)}
                              </p>
                            </div>
                          </div>
                          {/* Match Score UI */}
                          {priceDataPreview?.matched_score !== undefined && (
                            <div className="mt-3 text-center">
                              <p className="text-xs text-gray-400">Confiança do match</p>
                              <p className={`text-sm font-semibold ${
                                priceDataPreview.matched_score >= 0.8
                                  ? 'text-green-500'
                                  : priceDataPreview.matched_score >= 0.5
                                  ? 'text-yellow-500'
                                  : 'text-red-500'
                              }`}>
                                {(priceDataPreview.matched_score * 100).toFixed(0)}%
                              </p>
                              {priceDataPreview.matched_score < 0.5 && (
                                <p className="text-[11px] text-red-400 mt-1">
                                  Baixa confiança. Verifique se a carta está correta.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <p className="text-gray-500 text-sm">Sem preço salvo</p>
                          {/* Match Score UI even when no price? (not needed, only on priceDataPreview) */}
                        </>
                      )}

                      <button
                        onClick={async () => {
                          const url = prompt('Cole o link da LigaPokemon dessa carta:')
                          if (!url) return

                          const res = await authFetch(`/api/preco-puppeteer?url=${encodeURIComponent(url)}`)
                          const data = await res.json()

                          if (!data?.card_name) return alert('Erro ao importar')

                          const match = selectedPreview
                            ? { id: selectedPreview.id, score: 1 }
                            : await matchPokemonApiId(data.card_name)

                          const matchedId = match.id

                          await supabase.from('card_prices').upsert({
                            pokemon_api_id: matchedId,
                            card_name: data.card_name,
                            preco_min: data.preco_min || 0,
                            preco_medio: data.preco_medio || 0,
                            preco_max: data.preco_max || 0,
                            preco_normal: data.preco_normal || 0,
                            preco_foil: data.preco_foil || 0,
                            updated_at: new Date().toISOString(),
                            matched_score: match.score,
                          }, { onConflict: 'pokemon_api_id' })

                          setPriceDataPreview({ ...data, matched_score: match.score })
                        }}
                        className="w-full bg-blue-600 text-white py-2 rounded-xl text-sm font-semibold hover:opacity-90"
                      >
                        Importar preço da LigaPokemon
                      </button>
                    </div>
                  )}

                </div>
              ) : (
                <p className="text-gray-500 text-sm">Selecione uma carta</p>
              )}
            </div>

          </div>

          {/* FOOTER */}
          <div className="p-5 border-t border-gray-800 flex justify-between items-center">
            <p className="text-sm text-gray-400">
              {selectedCards.length} selecionadas
            </p>

            <button
              onClick={async () => {
                if (!userId || selectedCards.length === 0) return

                const { data: authData } = await supabase.auth.getUser()
                if (!authData?.user?.id) return alert('Usuário não autenticado')

                for (const card of selectedCards) {
                  const number = card.number || ''
                  const total = card.set?.printedTotal || ''
                  const cardName = number && total
                    ? `${card.name} (${number}/${total})`
                    : card.name
                  const cardImage = card.images?.large || card.images?.small || null

                  // Pede link da LigaPokemon (opcional)
                  const ligaUrl = prompt(
                    `Cole o link da LigaPokemon para "${card.name}" (opcional — deixe em branco para pular):`
                  )

                  let cardLink: string | null = null

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

                        // ✅ gravar no histórico de preços
                        await supabase.from('card_price_history').insert({
                          card_name: cardName,
                          preco_min: priceData.preco_min || null,
                          preco_medio: priceData.preco_medio || null,
                          preco_max: priceData.preco_max || null,
                          preco_normal: priceData.preco_normal || null,
                          preco_foil: priceData.preco_foil || null,
                          recorded_at: new Date().toISOString(),
                        })
                      }
                    } catch {
                      // link inválido ou erro no scraping — continua sem preço
                    }
                  }

                  await supabase.from('user_cards').insert({
                    user_id: authData.user.id,
                    pokemon_api_id: card.id,
                    card_name: cardName,
                    card_id: card.id,
                    card_image: cardImage,
                    card_link: cardLink,
                    rarity: card.rarity || null,
                  })
                }

                onClose()
                onAdded()
              }}
              className="px-5 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:opacity-90"
            >
              Adicionar ({selectedCards.length})
            </button>
          </div>

        </div>
      </div>
  )
}