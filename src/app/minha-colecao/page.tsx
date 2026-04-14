'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { authFetch } from '@/lib/authFetch'
import AppLayout from '@/components/ui/AppLayout'

const fmt = (v: number | null | undefined) => {
  if (!v) return 'R$ -'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

// Retorna os preços da variante selecionada pelo usuário
function getVariantePrices(price: any, variante: string) {
  if (!price) return { min: null, medio: null, max: null }
  switch (variante) {
    case 'foil':
      return { min: price.preco_foil_min, medio: price.preco_foil_medio, max: price.preco_foil_max }
    case 'promo':
      return { min: price.preco_promo_min, medio: price.preco_promo_medio, max: price.preco_promo_max }
    case 'reverse':
      return { min: price.preco_reverse_min, medio: price.preco_reverse_medio, max: price.preco_reverse_max }
    case 'pokeball':
      return { min: price.preco_pokeball_min, medio: price.preco_pokeball_medio, max: price.preco_pokeball_max }
    default:
      return { min: price.preco_min, medio: price.preco_medio, max: price.preco_max }
  }
}

// Variantes disponíveis para uma carta com base nos preços que existem
function getVariantesDisponiveis(price: any) {
  if (!price) return [{ key: 'normal', label: 'Normal' }]
  const opts = [{ key: 'normal', label: 'Normal' }]
  if (price.preco_foil_medio) opts.push({ key: 'foil', label: 'Foil' })
  if (price.preco_promo_medio) opts.push({ key: 'promo', label: 'Promo' })
  if (price.preco_reverse_medio) opts.push({ key: 'reverse', label: 'Reverse Foil' })
  if (price.preco_pokeball_medio) opts.push({ key: 'pokeball', label: 'Pokeball Foil' })
  return opts
}

export default function MinhaColecao() {
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function loadCards() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { window.location.href = '/login'; return }

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
        acc[p.card_name?.trim()] = p
        return acc
      }, {})
    }

    const merged = cardsData.map((c) => ({
      ...c,
      price: priceMap[c.card_name?.trim()] || null,
    }))

    setCards(merged)
    setLoading(false)
  }

  async function handleVarianteChange(card: any, novaVariante: string) {
    const { error } = await supabase
      .from('user_cards')
      .update({ variante: novaVariante })
      .eq('id', card.id)

    if (!error) {
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, variante: novaVariante } : c))
    }
  }

  async function handleAddByLink() {
    const url = prompt('Cole o link da LigaPokemon:')
    if (!url) return

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { alert('Usuário não logado'); return }

    try {
      const res = await authFetch(`/api/preco-puppeteer?url=${encodeURIComponent(url)}`)
      const data = await res.json()

      if (!data?.card_name) {
        alert('Não foi possível identificar a carta. Tente novamente.')
        return
      }

      let existing = null
      if (data.card_number) {
        const { data: list } = await supabase.from('user_cards').select('*')
          .eq('user_id', userData.user.id).eq('card_id', data.card_number)
        existing = list && list.length > 0 ? list[0] : null
      } else {
        const { data: list } = await supabase.from('user_cards').select('*')
          .eq('user_id', userData.user.id).ilike('card_name', data.card_name)
        existing = list && list.length > 0 ? list[0] : null
      }

      let insertError = null
      if (existing) {
        const { error } = await supabase.from('user_cards')
          .update({ quantity: (existing.quantity || 1) + 1 }).eq('id', existing.id)
        insertError = error
      } else {
        const { error } = await supabase.from('user_cards').insert({
          user_id: userData.user.id,
          card_name: data.card_name,
          card_id: data.card_number,
          card_image: data.card_image,
          card_link: data.link,
          rarity: data.rarity || null,
          quantity: 1,
          variante: 'normal',
        })
        insertError = error
      }

      if (insertError) { alert('Erro ao salvar carta'); return }

      await supabase.from('card_prices').upsert({
        card_name: data.card_name,
        preco_min: data.preco_min || 0,
        preco_medio: data.preco_medio || 0,
        preco_max: data.preco_max || 0,
        preco_normal: data.preco_normal || 0,
        preco_foil: data.preco_foil || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'card_name' })

      await supabase.from('card_price_history').insert({
        card_name: data.card_name,
        preco_min: data.preco_min || null,
        preco_medio: data.preco_medio || null,
        preco_max: data.preco_max || null,
        recorded_at: new Date().toISOString(),
      })

      alert('Carta adicionada com sucesso!')
      window.location.reload()
    } catch (err) {
      alert('Erro ao importar carta')
    }
  }

  async function handleSell(card: any) {
    const qty = prompt(`Você tem ${card.quantity || 1}. Quantas deseja vender?`)
    if (!qty) return
    const quantityToSell = Number(qty)
    if (quantityToSell <= 0 || quantityToSell > (card.quantity || 1)) { alert('Quantidade inválida'); return }
    const price = prompt('Digite o preço UNITÁRIO da carta:')
    if (!price) return

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { alert('Usuário não logado'); return }

    const items = Array.from({ length: quantityToSell }).map(() => ({
      user_id: userData.user.id,
      card_id: card.card_id,
      card_name: card.card_name,
      card_image: card.card_image,
      price: Number(price),
    }))

    const { error } = await supabase.from('marketplace').insert(items)
    if (error) { alert('Erro ao colocar à venda'); return }

    const newQty = (card.quantity || 1) - quantityToSell
    if (newQty <= 0) {
      await handleRemove(card.id)
    } else {
      await supabase.from('user_cards').update({ quantity: newQty }).eq('id', card.id)
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, quantity: newQty } : c))
    }
    alert('Venda realizada com sucesso!')
  }

  async function handleUpdateQuantity(card: any, delta: number) {
    const newQty = (card.quantity || 1) + delta
    if (newQty <= 0) { await handleRemove(card.id); return }
    const { error } = await supabase.from('user_cards').update({ quantity: newQty }).eq('id', card.id)
    if (error) { alert('Erro ao atualizar quantidade'); return }
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, quantity: newQty } : c))
  }

  async function handleRemove(id: string) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { data, error } = await supabase.from('user_cards').delete()
      .eq('id', id).eq('user_id', userData.user.id).select()
    if (error) { alert('Erro ao remover carta'); return }
    if (!data || data.length === 0) { alert('Nada foi deletado → verifique as políticas RLS'); return }
    setCards(prev => prev.filter(c => c.id !== id))
  }

  useEffect(() => { loadCards() }, [])
  useEffect(() => {
    const fn = () => loadCards()
    window.addEventListener('focus', fn)
    return () => window.removeEventListener('focus', fn)
  }, [])

  if (loading) {
    return <AppLayout total={0}><div className="p-6">Carregando coleção...</div></AppLayout>
  }

  // ✅ Totais da carteira baseados na VARIANTE selecionada de cada carta
  const totais = cards.reduce((acc, c) => {
    const variante = c.variante || 'normal'
    const p = getVariantePrices(c.price, variante)
    const qty = c.quantity || 1
    return {
      min: acc.min + (p.min || 0) * qty,
      medio: acc.medio + (p.medio || 0) * qty,
      max: acc.max + (p.max || 0) * qty,
    }
  }, { min: 0, medio: 0, max: 0 })

  return (
    <AppLayout total={totais.medio}>
      <div className="p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">📊 Minha Carteira</h1>
          <button
            onClick={handleAddByLink}
            className="bg-purple-600 hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm"
          >
            + Importar por link
          </button>
        </div>

        {/* ✅ Resumo financeiro da carteira */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-green-900/40 border border-green-700 rounded-2xl p-4 text-center">
            <p className="text-xs text-green-400 mb-1">Mínimo da Carteira</p>
            <p className="text-xl font-bold text-green-400">{fmt(totais.min)}</p>
            <p className="text-xs text-gray-500 mt-1">Pior cenário de venda</p>
          </div>
          <div className="bg-blue-900/40 border border-blue-700 rounded-2xl p-4 text-center">
            <p className="text-xs text-blue-400 mb-1">Valor Médio da Carteira</p>
            <p className="text-xl font-bold text-blue-400">{fmt(totais.medio)}</p>
            <p className="text-xs text-gray-500 mt-1">Preço médio de mercado</p>
          </div>
          <div className="bg-yellow-900/40 border border-yellow-700 rounded-2xl p-4 text-center">
            <p className="text-xs text-yellow-400 mb-1">Máximo da Carteira</p>
            <p className="text-xl font-bold text-yellow-400">{fmt(totais.max)}</p>
            <p className="text-xs text-gray-500 mt-1">Melhor cenário de venda</p>
          </div>
        </div>

        {cards.length === 0 && <p className="text-gray-400">Você ainda não adicionou cartas.</p>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map((c) => {
            const variante = c.variante || 'normal'
            const variantesDisponiveis = getVariantesDisponiveis(c.price)
            const precos = getVariantePrices(c.price, variante)

            return (
              <div
                key={c.id}
                className={`rounded-2xl p-4 shadow-md bg-gray-900 hover:shadow-lg transition border ${
                  (precos.medio || 0) > 100 ? 'border-green-500' : 'border-gray-800'
                }`}
              >
                <img
                  src={c.card_image || '/placeholder-card.png'}
                  alt={c.card_name}
                  onError={(e) => {
                    if (!e.currentTarget.src.includes('placeholder-card.png'))
                      e.currentTarget.src = '/placeholder-card.png'
                  }}
                  className="w-full h-auto object-cover rounded"
                />

                <div className="mt-3">
                  <a href={c.card_link} target="_blank" className="font-semibold text-sm text-blue-400 hover:underline">
                    {c.card_name}
                  </a>

                  {/* Quantidade */}
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    <button onClick={() => handleUpdateQuantity(c, -1)} className="bg-gray-700 px-2 rounded hover:bg-gray-600">-</button>
                    <span>Qtd: {c.quantity || 1}</span>
                    <button onClick={() => handleUpdateQuantity(c, 1)} className="bg-gray-700 px-2 rounded hover:bg-gray-600">+</button>
                  </div>

                  {/* ✅ Seletor de variante */}
                  {variantesDisponiveis.length > 1 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1">Tipo da carta:</p>
                      <select
                        value={variante}
                        onChange={(e) => handleVarianteChange(c, e.target.value)}
                        className="w-full text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white"
                      >
                        {variantesDisponiveis.map(v => (
                          <option key={v.key} value={v.key}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* ✅ Preços da variante selecionada */}
                  <div className="mt-2 text-xs text-gray-400 space-y-1">
                    <p className="text-gray-500">Raridade: {c.rarity || '-'}</p>
                    <div className="mt-1 bg-gray-800 rounded-lg p-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Mínimo</span>
                        <span className="text-green-400 font-semibold">{fmt(precos.min)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Médio</span>
                        <span className="text-blue-400 font-semibold">{fmt(precos.medio)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Máximo</span>
                        <span className="text-yellow-400 font-semibold">{fmt(precos.max)}</span>
                      </div>
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
            )
          })}
        </div>
      </div>
    </AppLayout>
  )
}