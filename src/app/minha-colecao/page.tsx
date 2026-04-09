'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function MinhaColecao() {
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

async function handleSell(card: any) {
  const price = prompt('Digite o preço da carta:')

  if (!price) return

  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    alert('Usuário não logado')
    return
  }

  const { error } = await supabase.from('marketplace').insert([
    {
      user_id: userData.user.id,
      card_id: card.card_id,
      card_name: card.card_name,
      card_image: card.card_image,
      price: Number(price),
    },
  ])

  if (error) {
    alert('Erro ao colocar à venda')
    console.log(error)
  } else {
    alert('Carta colocada à venda!')
  }
}

  useEffect(() => {
    async function loadCards() {
      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) {
        window.location.href = '/login'
        return
      }

      const { data } = await supabase
        .from('user_cards')
        .select('*')
        .eq('user_id', userData.user.id)

      setCards(data || [])
      setLoading(false)
    }

    loadCards()
  }, [])

  async function handleRemove(id: string) {
    await supabase.from('user_cards').delete().eq('id', id)

    setCards((prev) => prev.filter((card) => card.id !== id))
  }

  if (loading) {
    return <div className="p-10">Carregando coleção...</div>
  }

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-5">Minha Coleção</h1>

      {cards.length === 0 && <p>Você ainda não adicionou cartas.</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.id}
            className="border rounded p-2 shadow"
          >
            <img src={card.card_image} alt={card.card_name} />
            <p className="mt-2 font-bold">{card.card_name}</p>

            <button
              onClick={() => handleRemove(card.id)}
              className="mt-2 bg-red-600 text-white w-full p-1 rounded"
            >
              Remover
            </button>
            <button
            onClick={() => handleSell(card)}
            className="mt-2 bg-green-600 text-white w-full p-1 rounded"
            >
            Vender
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}