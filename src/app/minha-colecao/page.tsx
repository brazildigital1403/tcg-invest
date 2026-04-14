'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { authFetch } from '@/lib/authFetch'
import AppLayout from '@/components/ui/AppLayout'

export default function MinhaColecao() {
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
    const names = cardsData.map((c) => c.card_name?.trim())
    let priceMap: any = {}

    if (names.length > 0) {
      const { data: prices } = await supabase
        .from('card_prices')
        .select('*')
        .in('card_name', names)

      priceMap = (prices || []).reduce((acc: any, p: any) => {
        const key = p.card_name?.trim()
        acc[key] = p
        return acc
      }, {})
    }

    const merged = cardsData.map((c) => {
      const key = c.card_name?.trim()
      return { ...c, price: priceMap[key] || null }
    })

    setCards(merged)
    setLoading(false)
  }

  async function handleAddByLink() {
    const url = prompt('Cole o link da LigaPokemon:')
    if (!url) return

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      alert('Usuário não logado')
      return
    }

    try {
      const res = await authFetch(`/api/preco-puppeteer?url=${encodeURIComponent(url)}`)
      const data = await res.json()

      if (!data?.card_name) {
        alert('Não foi possível identificar a carta. Tente novamente.')
        return
      }

      // verificar se já existe
      let existing = null
      if (data.card_number) {
        const { data: list } = await supabase
          .from('user_cards')
          .select('*')
          .eq('user_id', userData.user.id)
          .eq('card_id', data.card_number)
        existing = list && list.length > 0 ? list[0] : null
      } else {
        const { data: list } = await supabase
          .from('user_cards')
          .select('*')
          .eq('user_id', userData.user.id)
          .ilike('card_name', data.card_name)
        existing = list && list.length > 0 ? list[0] : null
      }

      let insertError = null

      if (existing) {
        const newQty = (existing.quantity || 1) + 1
        const { error } = await supabase
          .from('user_cards')
          .update({ quantity: newQty })
          .eq('id', existing.id)
        insertError = error
        setCards((prev) =>
          prev.map((c) => c.id === existing.id ? { ...c, quantity: newQty } : c)
        )
      } else {
        const { error } = await supabase.from('user_cards').insert({
          user_id: userData.user.id,
          pokemon_api_id: null,
          card_name: data.card_name,
          card_id: data.card_number,
          card_image: data.card_image,
          card_link: data.link,
          rarity: data.rarity || null,
          quantity: 1,
        })
        insertError = error
      }

      if (insertError) {
        console.error('Erro ao salvar:', insertError)
        alert('Erro ao salvar carta')
        return
      }

      // salvar preço atual
      await supabase.from('card_prices').upsert({
        card_name: data.card_name,
        preco_min: data.preco_min || 0,
        preco_medio: data.preco_medio || 0,
        preco_max: data.preco_max || 0,
        preco_normal: data.preco_normal || 0,
        preco_foil: data.preco_foil || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'card_name' })

      // ✅ gravar no histórico de preços
      await supabase.from('card_price_history').insert({
        card_name: data.card_name,
        preco_min: data.preco_min || null,
        preco_medio: data.preco_medio || null,
        preco_max: data.preco_max || null,
        preco_normal: data.preco_normal || null,
        preco_foil: data.preco_foil || null,
        recorded_at: new Date().toISOString(),
      })

      alert('Carta adicionada com sucesso!')
      window.location.reload()
    } catch (err) {
      console.log(err)
      alert('Erro ao importar carta')
    }
  }

  async function handleSell(card: any) {
    const qty = prompt(`Você tem ${card.quantity || 1}. Quantas deseja vender?`)
    if (!qty) return

    const quantityToSell = Number(qty)
    if (quantityToSell <= 0 || quantityToSell > (card.quantity || 1)) {
      alert('Quantidade inválida')
      return
    }

    const price = prompt('Digite o preço UNITÁRIO da carta:')
    if (!price) return

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      alert('Usuário não logado')
      return
    }

    const items = Array.from({ length: quantityToSell }).map(() => ({
      user_id: userData.user.id,
      card_id: card.card_id,
      card_name: card.card_name,
      card_image: card.card_image,
      price: Number(price),
    }))

    const { error } = await supabase.from('marketplace').insert(items)
    if (error) {
      alert('Erro ao colocar à venda')
      console.log(error)
      return
    }

    const newQty = (card.quantity || 1) - quantityToSell
    if (newQty <= 0) {
      await handleRemove(card.id)
    } else {
      const { error: updateError } = await supabase
        .from('user_cards')
        .update({ quantity: newQty })
        .eq('id', card.id)

      if (updateError) {
        alert('Erro ao atualizar quantidade')
        return
      }

      setCards((prev) =>
        prev.map((c) => c.id === card.id ? { ...c, quantity: newQty } : c)
      )
    }

    alert('Venda realizada com sucesso!')
  }

  async function handleUpdateQuantity(card: any, delta: number) {
    const newQty = (card.quantity || 1) + delta
    if (newQty <= 0) {
      await handleRemove(card.id)
      return
    }

    const { error } = await supabase
      .from('user_cards')
      .update({ quantity: newQty })
      .eq('id', card.id)

    if (error) {
      alert('Erro ao atualizar quantidade')
      return
    }

    setCards((prev) =>
      prev.map((c) => c.id === card.id ? { ...c, quantity: newQty } : c)
    )
  }

  async function handleRemove(id: string) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { data, error } = await supabase
      .from('user_cards')
      .delete()
      .eq('id', id)
      .eq('user_id', userData.user.id)
      .select()

    if (error) {
      alert('Erro ao remover carta')
      return
    }

    if (!data || data.length === 0) {
      alert('Nada foi deletado → verifique as políticas RLS no Supabase')
      return
    }

    setCards((prev) => prev.filter((card) => card.id !== id))
  }

  useEffect(() => {
    loadCards()
  }, [])

  useEffect(() => {
    const handleFocus = () => { loadCards() }
    window.addEventListener('focus', handleFocus)
    return () => { window.removeEventListener('focus', handleFocus) }
  }, [])

  if (loading) {
    return (
      <AppLayout total={0}>
        <div className="p-6">Carregando coleção...</div>
      </AppLayout>
    )
  }

  const totalCarteira = cards.reduce((acc, c) => {
    return acc + (c.price?.preco_medio || 0) * (c.quantity || 1)
  }, 0)

  return (
    <AppLayout total={totalCarteira}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">📊 Minha Carteira</h1>
          <div className="text-right">
            <p className="text-sm text-gray-400">Valor total</p>
            <p className="text-xl font-bold text-green-600">
              R$ {totalCarteira.toFixed(2)}
            </p>
          </div>
          <button
            onClick={handleAddByLink}
            className="ml-4 bg-purple-600 hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm"
          >
            + Importar por link
          </button>
        </div>

        {cards.length === 0 && <p>Você ainda não adicionou cartas.</p>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map((c) => (
            <div
              key={c.id}
              className={`rounded-2xl p-4 shadow-md bg-gray-900 hover:shadow-lg transition border ${
                (c.price?.preco_medio || 0) > 100 ? 'border-green-500' : 'border-gray-800'
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
                <a href={c.card_link} target="_blank" className="font-semibold text-sm text-blue-400 hover:underline">
                  {c.card_name}
                </a>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <button
                    onClick={() => handleUpdateQuantity(c, -1)}
                    className="bg-gray-200 px-2 rounded hover:bg-gray-300"
                  >
                    -
                  </button>
                  <span>Qtd: {c.quantity || 1}</span>
                  <button
                    onClick={() => handleUpdateQuantity(c, 1)}
                    className="bg-gray-200 px-2 rounded hover:bg-gray-300"
                  >
                    +
                  </button>
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  <p>Raridade: {c.rarity || '-'}</p>
                  <div className="mt-2">
                    <p>Preço mínimo: R$ {c.price?.preco_min ?? '-'}</p>
                    <p>Preço médio: R$ {c.price?.preco_medio ?? '-'}</p>
                    <p>Preço máximo: R$ {c.price?.preco_max ?? '-'}</p>
                  </div>
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
    </AppLayout>
  )
}