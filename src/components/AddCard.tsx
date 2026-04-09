'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AddCard({ userId, onAdd }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selected, setSelected] = useState<any | null>(null)

  useEffect(() => {
    const delay = setTimeout(async () => {
      if (!name || name.length < 2) {
        setResults([])
        setShowDropdown(false)
        return
      }

      try {
        const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(name)}`)
        const data = await res.json()

        setResults(data?.data?.slice(0, 15) || [])
        setShowDropdown(true)
      } catch (e) {
        console.log('erro autocomplete')
      }
    }, 400)

    return () => clearTimeout(delay)
  }, [name])

  const handleAdd = async () => {
    if (!name) return

    setLoading(true)

    let finalName = name

    if (selected) {
      const number = (selected.number && selected.set?.printedTotal)
        ? ` (${selected.number}/${selected.set.printedTotal})`
        : ''
      finalName = `${selected.name}${number}`
    } else {
      try {
        const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(name)}`)
        const data = await res.json()

        if (data?.data?.length > 0) {
          const card = data.data[0]
          const number = (card.number && card.set?.printedTotal)
            ? ` (${card.number}/${card.set.printedTotal})`
            : ''
          finalName = `${card.name}${number}`
        }
      } catch (e) {
        console.log('erro ao buscar fallback')
      }
    }

    const { error } = await supabase.from('user_cards').insert([
      {
        user_id: userId,
        card_name: finalName,
      },
    ])

    setLoading(false)

    if (!error) {
      setName('')
      onAdd()
    } else {
      alert('Erro ao adicionar carta')
    }
  }

  return (
    <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm mb-4">
      <p className="text-sm text-gray-500 mb-2">Adicionar carta</p>

      <div className="flex gap-2 relative">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setSelected(null)
          }}
          placeholder="Ex: Charizard (ou nome completo)"
          className="flex-1 p-2 border rounded-lg"
        />
        {showDropdown && results.length > 0 && (
          <div className="absolute top-10 left-0 w-full bg-white border rounded-lg shadow z-10 max-h-60 overflow-auto">
            {results.map((card) => (
              <div
                key={card.id}
                onClick={() => {
                  const number = (card.number && card.set?.printedTotal)
                    ? ` (${card.number}/${card.set.printedTotal})`
                    : ''
                  setSelected(card)
                  setName(`${card.name}${number}`)
                  setShowDropdown(false)
                }}
                className="flex items-center gap-3 p-2 hover:bg-gray-100 cursor-pointer"
              >
                <img
                  src={card.images?.small}
                  alt={card.name}
                  className="w-10 h-14 object-cover rounded"
                />

                <div className="flex flex-col">
                  <span className="text-sm font-semibold">
                    {card.name} {card.number && card.set?.printedTotal && `(${card.number}/${card.set.printedTotal})`}
                  </span>
                  <span className="text-xs text-gray-500">
                    {card.set?.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          {loading ? '...' : 'Adicionar'}
        </button>
      </div>
    </div>
  )
}