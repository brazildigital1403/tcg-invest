'use client'

import { useEffect, useState } from 'react'
import { useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { authFetch } from '@/lib/authFetch'
import PriceChart from '@/components/PriceChart'
import AppLayout from '@/components/ui/AppLayout'
import PortfolioStats from '@/components/dashboard/PortfolioStats'
import CardRankings from '@/components/dashboard/CardRankings'
import AddCardModal from '@/components/dashboard/AddCardModal'


const formatCurrency = (value: number) => {
  if (!value) return 'R$ 0,00'

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const getVariation = (history: any[]) => {
  if (!history || history.length < 2) return 0

  const first = Number(history[0].preco_medio || history[0].normal || 0)
  const last = Number(history[history.length - 1].preco_medio || history[history.length - 1].normal || 0)

  if (!first) return 0

  return ((last - first) / first) * 100
}

const getCardVariation = async (cardName: string) => {
  try {
    const res = await authFetch(`/api/historico?name=${encodeURIComponent(cardName)}`)
    const data = await res.json()

    if (!data.history || data.history.length < 2) return 0

    const first = Number(data.history[0].preco_medio || data.history[0].normal || 0)
    const last = Number(data.history[data.history.length - 1].preco_medio || data.history[data.history.length - 1].normal || 0)

    if (!first) return 0

    return ((last - first) / first) * 100
  } catch {
    return 0
  }
}

// Investment intelligence helpers
const getInvestmentScore = (price: number, medio: number) => {
  if (!price || !medio) return 'neutro'

  const ratio = price / medio

  if (ratio < 0.8) return 'barato'
  if (ratio > 1.2) return 'caro'
  return 'justo'
}

const getScoreColor = (score: string) => {
  if (score === 'barato') return 'text-green-600'
  if (score === 'caro') return 'text-red-600'
  return 'text-gray-500'
}

// Advanced portfolio intelligence: portfolio score helper
const getPortfolioScore = (cards: any[]) => {
  if (!cards.length) return 0

  let score = 0

  cards.forEach((c) => {
    const price = Number(c.preco_medio || c.price || 0)
    const medio = Number(c.preco_medio || price)

    if (!price || !medio) return

    const ratio = price / medio

    if (ratio < 0.8) score += 2
    else if (ratio < 1.1) score += 1
    else score -= 1
  })

  return score / cards.length
}

export default function DashboardFinanceiro() {
  const [stats, setStats] = useState({
  totalCompras: 0,
  totalVendas: 0,
  quantidade: 0,
  valorColecao: 0,
})
  const [transactions, setTransactions] = useState<any[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [ranking, setRanking] = useState<any[]>([])
  const [rankingWithVariation, setRankingWithVariation] = useState<any[]>([])
  const [priceHistory, setPriceHistory] = useState<any[]>([])
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [selectedCardPrice, setSelectedCardPrice] = useState<any>(null)
  const [cardImage, setCardImage] = useState<string | null>(null)
  const [userCards, setUserCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [openAddModal, setOpenAddModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedCards, setSelectedCards] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  // Modal states for enhanced search/filter/sort/preview
  const [selectedPreview, setSelectedPreview] = useState<any | null>(null)
  const [priceDataPreview, setPriceDataPreview] = useState<any | null>(null)
  const [typeFilterModal, setTypeFilterModal] = useState<string>('')
  const [rarityFilterModal, setRarityFilterModal] = useState<string>('')
  const [sortModal, setSortModal] = useState('name')
  const [previewTab, setPreviewTab] = useState<'card' | 'info' | 'price'>('card')
  const searchTimeout = useRef<any>(null)
  async function handleSearchCards(value: string) {
    setSearchTerm(value)

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current)
    }

    searchTimeout.current = setTimeout(async () => {
      if (!value) {
        setSearchResults([])
        setIsSearching(false)
        return
      }

      setIsSearching(true)
      try {
        const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:${value}`)
        const data = await res.json()

        setSearchResults(data.data || [])
        setIsSearching(false)
      } catch {
        setSearchResults([])
        setIsSearching(false)
      }
    }, 400)
  }
  // Helper: Match LigaPokemon card to Pokemon API ID (with fallback + confidence score)
  async function matchPokemonApiId(cardName: string, cardNumber?: string) {
    try {
      const cleanName = cardName.split('(')[0].trim().toLowerCase()
      const number = cardNumber || ''

      // 1. tentativa exata (nome + número)
      const queryExact = `https://api.pokemontcg.io/v2/cards?q=name:"${cleanName}"${number ? ` number:${number}` : ''}`
      const resExact = await fetch(queryExact)
      const dataExact = await resExact.json()

      if (dataExact?.data?.length > 0) {
        return { id: dataExact.data[0].id, score: 1 }
      }

      // 2. fallback por nome
      const queryName = `https://api.pokemontcg.io/v2/cards?q=name:"${cleanName}"`
      const resName = await fetch(queryName)
      const dataName = await resName.json()

      if (!dataName?.data?.length) return { id: null, score: 0 }

      // 3. fuzzy match simples
      let bestMatch = null
      let bestScore = 0

      for (const card of dataName.data) {
        const apiName = card.name.toLowerCase()

        let score = 0

        if (apiName === cleanName) score += 0.7
        if (apiName.includes(cleanName)) score += 0.2
        if (number && card.number === number) score += 0.1

        if (score > bestScore) {
          bestScore = score
          bestMatch = card
        }
      }

      return {
        id: bestMatch?.id || null,
        score: bestScore
      }
    } catch {
      return { id: null, score: 0 }
    }
  }

  // Importar por link handler
  async function handleAddByLink() {
    const input = prompt('Cole UM ou VÁRIOS links da LigaPokemon (um por linha):')
    if (!input) return

    const links = input
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    if (links.length === 0) return

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      alert('Usuário não logado')
      return
    }

    let success = 0
    let fail = 0

    for (const url of links) {
      try {
        const res = await authFetch(`/api/preco-puppeteer?url=${encodeURIComponent(url)}`)
        const data = await res.json()

        if (!data?.card_name) {
          fail++
          continue
        }

        const match = await matchPokemonApiId(data.card_name, data.card_number)
        const matchedId = match.id

        const { error: insertError } = await supabase.from('user_cards').insert({
          user_id: userData.user.id,
          pokemon_api_id: matchedId,
          card_name: data.card_name,
          card_id: data.card_number,
          card_image: data.card_image,
          card_link: data.link,
          rarity: data.rarity || null,
          matched_score: match.score,
        })

        if (insertError) {
          console.error(insertError)
          fail++
          continue
        }

        const { error: priceError } = await supabase.from('card_prices').upsert({
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

        if (priceError) console.error(priceError)

        success++
      } catch (e) {
        console.error(e)
        fail++
      }
    }

    alert(`Importação concluída!\nSucesso: ${success}\nFalhas: ${fail}`)

    window.location.reload()
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        const { data: userData } = await supabase.auth.getUser()

        if (!userData.user) {
          window.location.href = '/login'
          return
        }

        const uid = userData.user.id
        setUserId(uid)

        // Buscar transações
        const { data: transactions } = await supabase
          .from('transactions')
          .select('*')
        setTransactions(transactions || [])

        const compras =
          transactions
            ?.filter((t) => t.buyer_id === uid)
            .reduce((acc, t) => acc + Number(t.price), 0) || 0

        const vendas =
          transactions
            ?.filter((t) => t.seller_id === uid)
            .reduce((acc, t) => acc + Number(t.price), 0) || 0

        const grouped: any = {}

        transactions?.forEach((t) => {
          const date = new Date(t.created_at).toLocaleDateString()
          if (!grouped[date]) grouped[date] = 0
          grouped[date] += Number(t.price || 0)
        })

        const chartArray = Object.entries(grouped).map(([date, value]) => ({
          date,
          value,
        }))

        setChartData(chartArray)

        // Ranking cartas mais caras
        const sorted = [...(transactions || [])]
          .sort((a, b) => b.price - a.price)
          .slice(0, 5)

        setRanking(sorted)

        // 🔥 adicionar variação no ranking
        const enriched = await Promise.all(
          sorted.map(async (item) => {
            const variation = await getCardVariation(item.card_name)
            return { ...item, variation }
          })
        )

        enriched.sort((a, b) => b.variation - a.variation)

        setRankingWithVariation(enriched)

        // Quantidade de cartas
const { data: cards } = await supabase
  .from('user_cards')
  .select('*')
  .eq('user_id', uid)

setUserCards(cards || [])

// Calcular valor da coleção (otimizado)
let valorTotal = 0

const cardNames = (cards || []).map(c => c.card_name)

if (cardNames.length > 0) {
  const apiIds = cards.map(c => c.pokemon_api_id).filter(Boolean)

  const { data: pricesByApi } = await supabase
    .from('card_prices')
    .select('*')
    .in('pokemon_api_id', apiIds)

  const priceMap: any = {}

  pricesByApi?.forEach(p => {
    priceMap[p.card_name] = p
  })

  // 🔥 construir ranking e variação baseado em preços reais
  if (pricesByApi && pricesByApi.length > 0) {
    const enrichedPrices = await Promise.all(
      pricesByApi.map(async (p) => {
        const variation = await getCardVariation(p.card_name)
        return { ...p, variation }
      })
    )

    enrichedPrices.sort((a, b) => (b.preco_medio || 0) - (a.preco_medio || 0))

    setRanking(enrichedPrices.slice(0, 5))
    setRankingWithVariation(enrichedPrices)
  }

  for (const card of cards || []) {
    const priceData = priceMap[card.card_name]

    const price =
      priceData?.preco_medio ||
      priceData?.preco_min ||
      priceData?.preco_normal ||
      0

    valorTotal += Number(price)
  }
}

        setStats({
          totalCompras: compras,
          totalVendas: vendas,
          quantidade: cards?.length || 0,
          valorColecao: valorTotal,
        })

        if (cards && cards.length > 0) {
          const firstCardName = cards[0].card_name

          const res = await authFetch(`/api/historico?name=${encodeURIComponent(firstCardName)}`)
          const historicoData = await res.json()

          setPriceHistory(historicoData.history || [])
          setSelectedCard(firstCardName)
        }
        setLoading(false)
      } catch {
        setError('Erro ao carregar dados')
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    async function loadHistory() {
      if (!selectedCard) return

      const res = await authFetch(`/api/historico?name=${encodeURIComponent(selectedCard)}`)
      const data = await res.json()

      if (data.history && data.history.length > 0) {
        setPriceHistory(data.history)
      } else {
        // 🔥 MOCK DATA para testes de gráfico
        const mock = [
          { date: '01/04', normal: 45, foil: null },
          { date: '02/04', normal: 47, foil: null },
          { date: '03/04', normal: 46, foil: null },
          { date: '04/04', normal: 49, foil: null },
          { date: '05/04', normal: 50, foil: null },
        ]

        setPriceHistory(mock)
      }

      // buscar preço atual da carta
      try {
        const { data: priceData } = await supabase
          .from('card_prices')
          .select('*')
          .eq('card_name', selectedCard)
          .single()

        setSelectedCardPrice(priceData)
      } catch {
        setSelectedCardPrice(null)
      }
    }

    loadHistory()
  }, [selectedCard])

  useEffect(() => {
    async function fetchImage() {
      if (!selectedCard) return

      // 🔎 tentar pegar do banco primeiro
      const { data: dbCard } = await supabase
        .from('card_prices')
        .select('image_url')
        .eq('card_name', selectedCard)
        .single()

      if (dbCard?.image_url) {
        setCardImage(dbCard.image_url)
        return
      }

      try {
        const name = selectedCard.split('(')[0].trim()
        const numberMatch = selectedCard.match(/\(([^)]+)\)/)
        const number = numberMatch ? numberMatch[1].split('/')[0] : ''

        const query = `https://api.pokemontcg.io/v2/cards?q=name:"${name}" number:${number}`

        const res = await fetch(query)
        const data = await res.json()

        const img = data?.data?.[0]?.images?.small || null

        // 🔥 salvar no banco se encontrou imagem
        if (img && selectedCard) {
          await supabase
            .from('card_prices')
            .update({ image_url: img })
            .eq('card_name', selectedCard)
        }

        setCardImage(img)
      } catch {
        setCardImage(null)
      }
    }

    fetchImage()
  }, [selectedCard])

  const saldo = stats.totalVendas - stats.totalCompras
  const variation = getVariation(priceHistory)

  // Portfolio score calculation (after rankingWithVariation is calculated)
  const portfolioScore = getPortfolioScore(rankingWithVariation)

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-400">
        <p>Carregando dashboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        <p>{error}</p>
      </div>
    )
  }

  return (
    <AppLayout total={stats.valorColecao}>
      <div className="p-6 bg-gray-900 min-h-screen">
      <PortfolioStats
        stats={stats}
        saldo={saldo}
        variation={variation}
        portfolioScore={portfolioScore}
      />
      {userId && (
        <button
          onClick={() => setOpenAddModal(true)}
          className="w-full px-4 py-3 bg-yellow-500 text-black rounded-xl font-semibold hover:opacity-90 transition"
        >
          + Adicionar Carta
        </button>
      )}
      {userId && (
        <div className="mt-4 p-4 bg-gray-900 rounded-xl border border-gray-800 shadow-sm">
          <p className="text-sm text-gray-400 mb-2">Importar por link</p>
          <button
            onClick={handleAddByLink}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:opacity-90 transition"
          >
            + Importar por link
          </button>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-gray-900 rounded-2xl border border-gray-800 shadow-sm text-center">
          <p className="text-xs text-gray-400">Patrimônio</p>
          <p className="font-bold text-white">{formatCurrency(stats.valorColecao)}</p>
        </div>
        <div className="p-4 bg-gray-900 rounded-2xl border border-gray-800 shadow-sm text-center">
          <p className="text-xs text-gray-400">Saldo</p>
          <p className={`font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'} text-white`}>
            {formatCurrency(saldo)}
          </p>
        </div>
        <div className="p-4 bg-gray-900 rounded-2xl border border-gray-800 shadow-sm text-center">
          <p className="text-xs text-gray-400">Cartas</p>
          <p className="font-bold text-white">{stats.quantidade}</p>
        </div>
        <div className="p-4 bg-gray-900 rounded-2xl border border-gray-800 shadow-sm text-center">
          <p className="text-xs text-gray-400">Performance</p>
          <p className={`font-bold ${variation >= 0 ? 'text-green-600' : 'text-red-600'} text-white`}>
            {variation >= 0 ? '+' : ''}{variation.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-gray-900 shadow-sm border border-gray-800">
          <p className="text-gray-400">Total Compras</p>
          <h2 className="text-xl font-bold text-red-600">
            {formatCurrency(stats.totalCompras)}
          </h2>
        </div>
        <div className="p-5 rounded-2xl bg-gray-900 shadow-sm border border-gray-800">
          <p className="text-gray-400">Total Vendas</p>
          <h2 className="text-xl font-bold text-green-600">
            {formatCurrency(stats.totalVendas)}
          </h2>
        </div>
        <div className="p-5 rounded-2xl bg-gray-900 shadow-sm border border-gray-800">
          <p className="text-gray-400">Cartas na coleção</p>
          <h2 className="text-xl font-bold text-white">
            {stats.quantidade}
          </h2>
        </div>
      </div>

      <div className="mt-6 p-6 rounded-2xl bg-gray-900 shadow-sm border border-gray-800">
        <p className={`text-sm ${saldo >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {saldo >= 0 ? '+ lucro' : '- prejuízo'}
        </p>
        <p className="text-gray-400">Saldo</p>
        <h2
          className={`text-2xl font-bold ${
            saldo >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {formatCurrency(saldo)}
        </h2>
      </div>

      <div className="mt-6 p-6 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg">
        <p className="text-blue-100">Valor da coleção</p>
        <p className={`text-sm ${variation >= 0 ? 'text-green-200' : 'text-red-200'}`}>
          {variation >= 0 ? '+' : ''}{variation.toFixed(2)}%
        </p>
        <h2 className="text-3xl font-bold text-white">
          {formatCurrency(stats.valorColecao)}
        </h2>
      </div>

      {/* Portfolio Score */}
      <div className="mt-6 p-5 rounded-2xl bg-gray-900 border border-gray-800 shadow-md hover:shadow-lg transition">
        <p className="text-gray-400 text-sm">Score da Carteira</p>
        <h3 className={`text-xl font-bold ${portfolioScore > 1 ? 'text-green-600' : portfolioScore < 0 ? 'text-red-600' : 'text-white'}`}>
          {portfolioScore.toFixed(2)}
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          {portfolioScore > 1 && 'Carteira com boas oportunidades'}
          {portfolioScore <= 1 && portfolioScore >= 0 && 'Carteira equilibrada'}
          {portfolioScore < 0 && 'Carteira com ativos caros'}
        </p>
      </div>
      <div className="mt-6 p-5 rounded-2xl bg-gray-900 border border-gray-800 shadow-md hover:shadow-lg transition">
        <p className="text-gray-400 text-sm">Performance</p>
        <h3 className={`text-xl font-bold ${variation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {variation >= 0 ? '+' : ''}{variation.toFixed(2)}% no período
        </h3>
        <p className="text-xs text-gray-400 mt-1">Baseado no histórico da carta selecionada</p>
      </div>

      <div className="mt-6">
        <label className="text-sm text-gray-400">Selecionar carta</label>
        <select
          className="w-full mt-1 p-2 rounded-xl border border-gray-800 bg-gray-900 text-white"
          value={selectedCard || ''}
          onChange={(e) => setSelectedCard(e.target.value)}
        >
          {userCards.map((c) => (
            <option key={c.id} value={c.card_name}>
              {c.card_name}
            </option>
          ))}
        </select>
      </div>

      {selectedCard && (
        <div className="mt-6 p-5 rounded-2xl bg-gray-900 border border-gray-800 shadow-md hover:shadow-lg transition">

          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              {cardImage ? (
                <img
                  src={cardImage}
                  alt="card"
                  className="w-12 h-16 object-cover rounded shadow"
                />
              ) : (
                <div className="w-12 h-16 bg-gray-800 rounded flex items-center justify-center text-[10px] text-gray-400">
                  sem imagem
                </div>
              )}
              <h3 className="font-semibold text-white">{selectedCard}</h3>
            </div>

            <a
              href={
                (() => {
                  const found = userCards.find(c => c.card_name === selectedCard)
                  return found?.card_link || '#'
                })()
              }
              target="_blank"
              className="text-xs text-blue-600"
            >
              Ver na LigaPokemon
            </a>
          </div>

          {selectedCardPrice ? (
            <div className="grid grid-cols-3 gap-3 text-center">

              <div>
                <p className="text-xs text-gray-400">Mín</p>
                <p className="font-bold text-green-600">
                  {formatCurrency(selectedCardPrice.preco_min || 0)}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400">Médio</p>
                <p className="font-bold">
                  {formatCurrency(selectedCardPrice.preco_medio || 0)}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400">Máx</p>
                <p className="font-bold text-red-600">
                  {formatCurrency(selectedCardPrice.preco_max || 0)}
                </p>
              </div>

            </div>
          ) : (
            <p className="text-gray-400 text-sm">Sem dados de preço</p>
          )}

          <div className="mt-4">
            <button
              onClick={async () => {
                // 1. chama API e pega retorno direto
                const found = userCards.find(c => c.card_name === selectedCard)
                const res = await authFetch(`/api/preco-puppeteer?url=${encodeURIComponent(found?.card_link || '')}`)
                const apiData = await res.json()

                // 2. atualiza UI imediatamente com retorno da API
                if (apiData) {
                  setSelectedCardPrice({
                    preco_min: apiData.preco_min || 0,
                    preco_medio: apiData.preco_medio || 0,
                    preco_max: apiData.preco_max || 0,
                    preco_normal: apiData.preco_normal || 0,
                    preco_foil: apiData.preco_foil || 0,
                  })
                }

                // 🔥 salvar no banco imediatamente
                try {
                  await supabase
                    .from('card_prices')
                    .upsert({
                      card_name: selectedCard,
                      preco_min: apiData.preco_min || 0,
                      preco_medio: apiData.preco_medio || 0,
                      preco_max: apiData.preco_max || 0,
                      preco_normal: apiData.preco_normal || 0,
                      preco_foil: apiData.preco_foil || 0,
                      updated_at: new Date().toISOString()
                    }, { onConflict: 'card_name' })
                } catch (e) {
                  console.error('Erro ao salvar preço:', e)
                }

                // 3. opcional: NÃO sobrescrever com dado vazio do banco
                // vamos apenas tentar atualizar se vier com valores válidos
                try {
                  const { data: updatedPrice } = await supabase
                    .from('card_prices')
                    .select('*')
                    .eq('card_name', selectedCard)
                    .single()

                  if (updatedPrice) {
                    setSelectedCardPrice(updatedPrice)

                    // 🔥 atualização em tempo real correta (remove valor antigo + adiciona novo)
                    setStats((prev) => {
                      const quantidade = prev.quantidade || 1
                      const valorMedioAtual = prev.valorColecao / quantidade

                      const novoValor =
                        prev.valorColecao - valorMedioAtual + Number(updatedPrice.preco_medio || 0)

                      return {
                        ...prev,
                        valorColecao: Number(novoValor || 0),
                      }
                    })
                  }
                } catch {}

                // 4. atualizar histórico
                try {
                  const historicoRes = await authFetch(`/api/historico?name=${encodeURIComponent(selectedCard)}`)
                  const historicoData = await historicoRes.json()
                  setPriceHistory(historicoData.history || [])
                } catch {}
              }}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition"
            >
              Corrigir preço da carta
            </button>
          </div>

        </div>
      )}

      {/* Gráfico da Carteira */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 text-white">📊 Evolução da Carteira</h2>

        {chartData.length > 0 ? (
          <div className="bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-800">
            <PriceChart data={chartData.map(d => ({
              date: d.date,
              normal: d.value,
              foil: null
            }))} />
          </div>
        ) : (
          <div className="text-center text-gray-400 py-10">
            <p>Sem dados suficientes</p>
            <p className="text-xs">Realize transações para visualizar</p>
          </div>
        )}
      </div>

      {/* Gráfico de preço real */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 text-white">Histórico de Preço</h2>
        {priceHistory.length > 0 ? (
          <PriceChart data={priceHistory.map((d) => ({
            date: d.date || d.created_at || '',
            normal: d.preco_medio || d.normal || 0,
            foil: d.preco_foil || d.foil || null
          }))} />
        ) : (
          <div className="text-center text-gray-400 py-10">
            <p>Sem histórico suficiente</p>
            <p className="text-xs">Faça novas buscas para gerar dados</p>
          </div>
        )}
      </div>

      <CardRankings
        rankingWithVariation={rankingWithVariation}
        transactions={transactions}
      />
        {openAddModal && (
      <AddCardModal
        userId={userId}
        onClose={() => setOpenAddModal(false)}
        onAdded={() => window.location.reload()}
      />
    )}
        </div>
  </AppLayout>
)
}