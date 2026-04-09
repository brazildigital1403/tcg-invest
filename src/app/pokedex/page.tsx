'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Pokedex() {
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    async function fetchCards() {
      try {
        const res = await fetch('https://api.pokemontcg.io/v2/cards?pageSize=20')
        const data = await res.json()
        setCards(data.data)
      } catch (error) {
        console.log(error)
      } finally {
        setLoading(false)
      }
    }

    fetchCards()
  }, [])

  if (loading) {
    return <div className="p-10">Carregando cartas...</div>
  }

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-5">Pokédex</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
  key={card.id}
  className="border rounded p-2 shadow hover:scale-105 transition"
>
  <img src={card.images.small} alt={card.name} />
  <p className="mt-2 font-bold">{card.name}</p>
  <p className="text-sm text-gray-500">{card.rarity}</p>

  <button
    onClick={() => handleAddCard(card)}
    className="mt-2 bg-blue-600 text-white w-full p-1 rounded"
  >
    Adicionar
  </button>
</div>
        ))}
      </div>
    </div>
  )
}