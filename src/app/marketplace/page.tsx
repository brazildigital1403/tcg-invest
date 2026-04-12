'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/ui/AppLayout'

export default function Marketplace() {
  const [cards, setCards] = useState<any[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [myCards, setMyCards] = useState<any[]>([])
  const [otherCards, setOtherCards] = useState<any[]>([])

  async function handleClearMyListings() {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      alert('Usuário não logado')
      return
    }

    const confirmDelete = confirm('Tem certeza que deseja remover TODOS os seus anúncios?')
    if (!confirmDelete) return

    const { error } = await supabase
      .from('marketplace')
      .delete()
      .eq('user_id', userData.user.id)

    if (error) {
      console.log(error)
      alert('Erro ao remover anúncios')
      return
    }

    alert('Todos os seus anúncios foram removidos!')
    window.location.reload()
  }

async function handleBuy(card: any) {
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) {
    alert('Você precisa estar logado')
    return
  }

  const userId = userData.user.id

  // Impedir comprar a própria carta
  if (card.user_id === userId) {
    alert('Você não pode comprar sua própria carta')
    return
  }

  // 1. Adicionar na coleção do comprador
  const { error: insertError } = await supabase.from('user_cards').insert([
    {
      user_id: userId,
      card_id: card.card_id,
      card_name: card.card_name,
      card_image: card.card_image,
    },
  ])

  if (insertError) {
    alert('Erro ao comprar')
    console.log(insertError)
    return
  }

  // Registrar transação
    await supabase.from('transactions').insert([
    {
        buyer_id: userId,
        seller_id: card.user_id,
        card_name: card.card_name,
        price: card.price,
    },
    ])

  // 2. Remover do marketplace
  const { error: deleteError } = await supabase
    .from('marketplace')
    .delete()
    .eq('id', card.id)

  if (deleteError) {
    alert('Erro ao remover do marketplace')
    console.log(deleteError)
    return
  }

  alert('Compra realizada com sucesso!')

  // 3. Atualizar tela
  window.location.reload()
}

  useEffect(() => {
    async function loadMarket() {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        setUserId(userData.user.id)
      }

      const { data: usersData } = await supabase
        .from('users')
        .select('id')

      const validUserIds = (usersData || []).map((u) => u.id)

      const { data } = await supabase
        .from('marketplace')
        .select('*')
        .order('created_at', { ascending: false })

      const filteredData = (data || []).filter((card) =>
        validUserIds.includes(card.user_id)
      )

      const uid = userData.user?.id

      const sortedCards = filteredData.sort((a, b) => {
        if (a.user_id === uid && b.user_id !== uid) return -1
        if (a.user_id !== uid && b.user_id === uid) return 1
        return 0
      })

      setCards(sortedCards)

      const mine = sortedCards.filter((card) => card.user_id === uid)
      const others = sortedCards.filter((card) => card.user_id !== uid)

      setMyCards(mine)
      setOtherCards(others)
    }

    loadMarket()
  }, [])

  return (
    <AppLayout total={0}>
      <div className="p-6">
      <h1 className="text-2xl font-bold mb-5">Marketplace</h1>
      <button
        onClick={handleClearMyListings}
        className="mb-4 bg-red-600 text-white px-4 py-2 rounded hover:opacity-90"
      >
        Limpar meus anúncios
      </button>

      {myCards.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mb-2">Seus anúncios</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {myCards.map((card) => (
              <div
                key={card.id}
                className={`p-3 rounded-xl shadow-lg bg-gray-900 border ${
                  card.user_id === userId
                    ? 'border-yellow-400 bg-yellow-900/20'
                    : 'border-gray-800'
                }`}
              >
                <img src={card.card_image} />
                <p className="font-bold mt-2">{card.card_name}</p>
                <p className="text-green-400 font-bold">
                  R$ {card.price}
                </p>
                <p className="mt-2 text-center text-sm font-semibold text-yellow-600">
                  Seu Anúncio
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="text-xl font-semibold mb-2">Outros anúncios</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {otherCards.map((card) => (
          <div
            key={card.id}
            className={`p-3 rounded-xl shadow-lg bg-gray-900 border ${
              card.user_id === userId
                ? 'border-yellow-400 bg-yellow-900/20'
                : 'border-gray-800'
            }`}
          >
            <img src={card.card_image} />
            <p className="font-bold mt-2">{card.card_name}</p>
            <p className="text-green-400 font-bold">
              R$ {card.price}
            </p>

            <button
              onClick={() => handleBuy(card)}
              className="mt-2 bg-purple-600 text-white w-full p-1 rounded"
            >
              Comprar
            </button>
          </div>
        ))}
      </div>
    </div>
  </AppLayout>
  )
}