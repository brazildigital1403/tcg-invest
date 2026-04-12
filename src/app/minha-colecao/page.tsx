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
        .order('created_at', { ascending: false })

      const cardsData = data || []

      const names = cardsData.map((c) => c.card_name)

      let priceMap: any = {}

      if (names.length > 0) {
        const { data: prices } = await supabase
          .from('card_prices')
          .select('*')
          .in('card_name', names)

        priceMap = (prices || []).reduce((acc: any, p: any) => {
          acc[p.card_name] = p
          return acc
        }, {})
      }

      const merged = cardsData.map((c) => ({
        ...c,
        price: priceMap[c.card_name] || null,
      }))

      setCards(merged)
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

  const totalCarteira = cards.reduce((acc, c) => acc + (c.price?.preco_medio || 0), 0)

  return (
    <div className="p-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">📊 Minha Carteira</h1>
        <div className="text-right">
          <p className="text-sm text-gray-500">Valor total</p>
          <p className="text-xl font-bold text-green-600">
            R$ {totalCarteira.toFixed(2)}
          </p>
        </div>
      </div>

      {cards.length === 0 && <p>Você ainda não adicionou cartas.</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.id}
            className={`rounded-2xl p-4 shadow-md bg-white hover:shadow-lg transition border ${
              (c.price?.preco_medio || 0) > 100 ? 'border-green-500' : 'border-gray-200'
            }`}
          >
            <img
              src={c.card_image || '/placeholder-card.png'}
              alt={c.card_name}
              onError={(e) => {
                if (!e.currentTarget.src.includes('placeholder-card.png')) {
                  e.currentTarget.src = '/placeholder-card.png'
                }
              }}
              className="w-full h-auto object-cover rounded"
            />
            <div className="mt-3">
              <p className="font-semibold text-sm">{c.card_name}</p>

              <div className="mt-2 text-xs text-gray-500">
                <p>Preço mínimo: R$ {c.price?.preco_min ?? '-'}</p>
                <p>Preço médio: R$ {c.price?.preco_medio ?? '-'}</p>
                <p>Preço máximo: R$ {c.price?.preco_max ?? '-'}</p>
              </div>
            </div>

            <button
              onClick={() => handleRemove(c.id)}
              className="mt-3 bg-red-500 hover:bg-red-600 text-white w-full p-2 rounded-lg text-sm"
            >
              Remover
            </button>
            <button
            onClick={() => handleSell(c)}
            className="mt-2 bg-green-500 hover:bg-green-600 text-white w-full p-2 rounded-lg text-sm"
            >
            Vender
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}