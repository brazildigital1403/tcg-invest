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
    const controller = new AbortController()

    const delay = setTimeout(async () => {
      if (!name || name.length < 2) {
        setResults([])
        setShowDropdown(false)
        return
      }

      try {
        const res = await fetch(
          `https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(name)}`,
          { signal: controller.signal }
        )
        const data = await res.json()

        setResults(data?.data?.slice(0, 50) || [])
        setShowDropdown(true)
      } catch (e) {
        if ((e as any).name !== 'AbortError') {
          console.log('erro autocomplete')
        }
      }
    }, 300)

    return () => {
      controller.abort()
      clearTimeout(delay)
    }
  }, [name])

  const handleAdd = async () => {
    if (!name) return

    if (!userId) {
      alert('Usuário não identificado (userId vazio)')
      return
    }

    setLoading(true)

    try {
      let cardData = selected

      // fallback se não selecionou
      if (!cardData) {
        const res = await fetch(
          `https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(name)}`
        )
        const data = await res.json()
        cardData = data?.data?.[0]
      }

      if (!cardData) {
        alert('Carta não encontrada')
        setLoading(false)
        return
      }

      const number = cardData.number || ''
      const total = cardData.set?.printedTotal || ''

      const finalName = number && total
        ? `${cardData.name} (${number}/${total})`
        : cardData.name

      const image = cardData.images?.large || cardData.images?.small || null

      console.log('USER ID DEBUG:', userId)

      // 🔥 sempre usa usuário autenticado do Supabase
      let validUserId = ''
      const { data: authData } = await supabase.auth.getUser()

      if (!authData?.user?.id) {
        alert('Erro: usuário não autenticado')
        setLoading(false)
        return
      }

      validUserId = authData.user.id

      const payload = {
        user_id: validUserId,
        card_name: finalName,
        card_image: image,
        card_id: cardData.id, // 🔥 ESSENCIAL
      }

      console.log('INSERT USER CARD:', payload)

      const { error } = await supabase
        .from('user_cards')
        .insert(payload, { returning: 'minimal' })

      setLoading(false)

      if (error) {
        console.error('SUPABASE INSERT ERROR FULL:', JSON.stringify(error, null, 2))
      }

      if (error) {
        alert(`Erro Supabase: ${error.message || 'sem mensagem'} | code: ${error.code || 'N/A'}`)
      }

      if (!error) {
        setName('')
        setSelected(null)
        onAdd()
      } else {
        alert('Erro ao adicionar carta (ver console)')
      }
    } catch (err) {
      console.log(err)
      alert('Erro ao buscar carta')
      setLoading(false)
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
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true)
          }}
          onBlur={() => {
            setTimeout(() => setShowDropdown(false), 150)
          }}
          placeholder="Ex: Charizard ou Charizard (25/185)"
          className="flex-1 p-2 border rounded-lg"
        />
        {showDropdown && results.length > 0 && (
          <div className="absolute top-10 left-0 w-full bg-white border rounded-lg shadow z-10 max-h-80 overflow-y-auto">
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
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:opacity-90 transition"
        >
          {loading ? '...' : 'Adicionar'}
        </button>
      </div>
    </div>
  )
}