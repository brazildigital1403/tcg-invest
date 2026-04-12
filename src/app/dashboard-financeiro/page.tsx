'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import PriceChart from '@/components/PriceChart'
import AddCard from '@/components/AddCard'


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
    const res = await fetch(`/api/historico?name=${encodeURIComponent(cardName)}`)
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
  const [userCards, setUserCards] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

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

const uniqueCards = Array.from(new Set((cards || []).map(c => c.card_name)))
setUserCards(uniqueCards)

// Calcular valor da coleção (otimizado)
let valorTotal = 0

const cardNames = (cards || []).map(c => c.card_name)

if (cardNames.length > 0) {
  const { data: prices } = await supabase
    .from('card_prices')
    .select('*')
    .in('card_name', cardNames)

  const priceMap: any = {}

  prices?.forEach(p => {
    priceMap[p.card_name] = p
  })

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

          const res = await fetch(`/api/historico?name=${encodeURIComponent(firstCardName)}`)
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

      const res = await fetch(`/api/historico?name=${encodeURIComponent(selectedCard)}`)
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
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-black via-gray-900 to-gray-800 text-white shadow-lg">
        <p className="text-xs text-gray-300">Patrimônio total</p>
        <h1 className="text-3xl font-bold mt-1">
          {formatCurrency(stats.valorColecao)}
        </h1>
        <div className="flex gap-6 mt-4 text-sm">
          <div>
            <p className="text-gray-400">Saldo</p>
            <p className={saldo >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
              {formatCurrency(saldo)}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Performance</p>
            <p className={variation >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
              {variation >= 0 ? '+' : ''}{variation.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>
      {userId && (
        <AddCard
          userId={userId}
          onAdd={() => window.location.reload()}
        />
      )}

      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
          <p className="text-xs text-gray-400">Patrimônio</p>
          <p className="font-bold">{formatCurrency(stats.valorColecao)}</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
          <p className="text-xs text-gray-400">Saldo</p>
          <p className={`font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(saldo)}
          </p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
          <p className="text-xs text-gray-400">Cartas</p>
          <p className="font-bold">{stats.quantidade}</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
          <p className="text-xs text-gray-400">Performance</p>
          <p className={`font-bold ${variation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {variation >= 0 ? '+' : ''}{variation.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white shadow-sm border border-gray-100">
          <p className="text-gray-500">Total Compras</p>
          <h2 className="text-xl font-bold text-red-600">
            {formatCurrency(stats.totalCompras)}
          </h2>
        </div>
        <div className="p-5 rounded-2xl bg-white shadow-sm border border-gray-100">
          <p className="text-gray-500">Total Vendas</p>
          <h2 className="text-xl font-bold text-green-600">
            {formatCurrency(stats.totalVendas)}
          </h2>
        </div>
        <div className="p-5 rounded-2xl bg-white shadow-sm border border-gray-100">
          <p className="text-gray-500">Cartas na coleção</p>
          <h2 className="text-xl font-bold">
            {stats.quantidade}
          </h2>
        </div>
      </div>

      <div className="mt-6 p-6 rounded-2xl bg-white shadow-sm border border-gray-100">
        <p className={`text-sm ${saldo >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {saldo >= 0 ? '+ lucro' : '- prejuízo'}
        </p>
        <p className="text-gray-500">Saldo</p>
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
      <div className="mt-6 p-5 rounded-2xl bg-white border border-gray-100 shadow-md hover:shadow-lg transition">
        <p className="text-gray-500 text-sm">Score da Carteira</p>
        <h3 className={`text-xl font-bold ${portfolioScore > 1 ? 'text-green-600' : portfolioScore < 0 ? 'text-red-600' : 'text-gray-600'}`}>
          {portfolioScore.toFixed(2)}
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          {portfolioScore > 1 && 'Carteira com boas oportunidades'}
          {portfolioScore <= 1 && portfolioScore >= 0 && 'Carteira equilibrada'}
          {portfolioScore < 0 && 'Carteira com ativos caros'}
        </p>
      </div>
      <div className="mt-6 p-5 rounded-2xl bg-white border border-gray-100 shadow-md hover:shadow-lg transition">
        <p className="text-gray-500 text-sm">Performance</p>
        <h3 className={`text-xl font-bold ${variation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {variation >= 0 ? '+' : ''}{variation.toFixed(2)}% no período
        </h3>
        <p className="text-xs text-gray-400 mt-1">Baseado no histórico da carta selecionada</p>
      </div>

      <div className="mt-6">
        <label className="text-sm text-gray-500">Selecionar carta</label>
        <select
          className="w-full mt-1 p-2 rounded-xl border border-gray-200"
          value={selectedCard || ''}
          onChange={(e) => setSelectedCard(e.target.value)}
        >
          {userCards.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {selectedCard && (
        <div className="mt-6 p-5 rounded-2xl bg-white border border-gray-100 shadow-md hover:shadow-lg transition">

          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              {cardImage ? (
                <img
                  src={cardImage}
                  alt="card"
                  className="w-12 h-16 object-cover rounded shadow"
                />
              ) : (
                <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center text-[10px] text-gray-500">
                  sem imagem
                </div>
              )}
              <h3 className="font-semibold">{selectedCard}</h3>
            </div>

            <a
              href={`https://www.ligapokemon.com.br/?view=cards/search&tipo=1&card=${encodeURIComponent(selectedCard)}`}
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
                const res = await fetch(`/api/preco-puppeteer?name=${encodeURIComponent(selectedCard)}`)
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
                  const historicoRes = await fetch(`/api/historico?name=${encodeURIComponent(selectedCard)}`)
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
        <h2 className="text-lg font-semibold mb-3 text-gray-800">📊 Evolução da Carteira</h2>

        {(chartData.length > 0 || true) ? (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <PriceChart data={
              chartData.length > 0
                ? chartData.map(d => ({
                    date: d.date,
                    normal: d.value,
                    foil: null
                  }))
                : [
                    { date: '01/04', normal: 1000, foil: null },
                    { date: '02/04', normal: 1200, foil: null },
                    { date: '03/04', normal: 1100, foil: null },
                    { date: '04/04', normal: 1500, foil: null },
                  ]
            } />
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
        <h2 className="text-lg font-semibold mb-3 text-gray-800">Histórico de Preço</h2>
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

      {/* Histórico */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">Histórico</h2>
        {transactions.map((t) => (
          <div key={t.id} className="p-4 mb-3 rounded-2xl bg-white shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition">
            <p className="font-medium">{t.card_name}</p>
            <p className="text-sm text-gray-500">
              {formatCurrency(Number(t.price))}
            </p>
          </div>
        ))}
      </div>

      {/* Alertas Inteligentes */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">🔔 Alertas</h2>
        {rankingWithVariation
          .filter((r) => {
            const price = Number(r.preco_medio || r.price || 0)
            const medio = Number(r.preco_medio || price)
            return price && medio && price > medio * 1.3
          })
          .map((r) => (
            <div key={r.id} className="p-3 mb-2 rounded-xl bg-yellow-50 border border-yellow-200 flex justify-between items-center">
              <p className="font-medium">{r.card_name}</p>
              <p className="text-xs text-yellow-600 font-semibold">
                acima do preço médio
              </p>
            </div>
          ))}
      </div>

      {/* Top Oportunidades */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">🔥 Oportunidades</h2>

        {rankingWithVariation.filter((r) => {
          const price = Number(r.preco_medio || r.price || 0)
          const medio = Number(r.preco_medio || price)
          return price && medio && price < medio * 0.8
        }).length === 0 && (
          <p className="text-gray-400 text-sm">Nenhuma oportunidade no momento</p>
        )}

        {rankingWithVariation
          .filter((r) => {
            const price = Number(r.preco_medio || r.price || 0)
            const medio = Number(r.preco_medio || price)
            return price && medio && price < medio * 0.8
          })
          .map((r) => {
            const price = Number(r.preco_medio || r.price || 0)
            const medio = Number(r.preco_medio || price)
            const discount = ((medio - price) / medio) * 100

            return (
              <div key={r.id} className="p-4 mb-3 rounded-2xl bg-green-50 border border-green-200 flex justify-between items-center hover:shadow-md transition">
                <div>
                  <p className="font-medium">{r.card_name}</p>
                  <p className="text-xs text-green-600 font-semibold">
                    {discount.toFixed(0)}% abaixo do mercado
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-green-700">
                    {formatCurrency(price)}
                  </p>
                  <p className="text-xs text-gray-500">
                    médio: {formatCurrency(medio)}
                  </p>
                </div>
              </div>
            )
          })}
      </div>

      {/* Top Valorização */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">📈 Mais valorizadas</h2>

        {rankingWithVariation
          .filter((r) => r.variation > 0)
          .sort((a, b) => b.variation - a.variation)
          .slice(0, 3)
          .map((r) => (
            <div key={r.id} className="p-4 mb-3 rounded-2xl bg-blue-50 border border-blue-200 flex justify-between items-center hover:shadow-md transition">
              <p className="font-medium">{r.card_name}</p>
              <div className="text-right">
                <p className="font-bold text-blue-700">
                  {formatCurrency(Number(r.preco_medio || r.price || 0))}
                </p>
                <p className="text-xs text-blue-500">
                  +{r.variation.toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
      </div>

      {/* Top Queda */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">📉 Em queda</h2>

        {rankingWithVariation
          .filter((r) => r.variation < 0)
          .sort((a, b) => a.variation - b.variation)
          .slice(0, 3)
          .map((r) => (
            <div key={r.id} className="p-4 mb-3 rounded-2xl bg-red-50 border border-red-200 flex justify-between items-center hover:shadow-md transition">
              <p className="font-medium">{r.card_name}</p>
              <div className="text-right">
                <p className="font-bold text-red-700">
                  {formatCurrency(Number(r.preco_medio || r.price || 0))}
                </p>
                <p className="text-xs text-red-500">
                  {r.variation.toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
      </div>

      {/* Ranking */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-800">Cartas mais caras</h2>
        {rankingWithVariation.length === 0 && (
          <p className="text-gray-400 text-sm">Sem dados suficientes para ranking</p>
        )}
        {rankingWithVariation.map((r) => (
          <div key={r.id} className="p-4 mb-3 rounded-2xl bg-white shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition">
            <p className="font-medium">{r.card_name}</p>
            <div className="text-right">
              {(() => {
                const price = Number(r.preco_medio || r.price || 0)
                const medio = Number(r.preco_medio || price)
                const score = getInvestmentScore(price, medio)
                return (
                  <>
                    {/* Opportunity badge */}
                    {price && medio && price < medio * 0.8 && (
                      <p className="text-[10px] text-green-500 font-bold">OPORTUNIDADE</p>
                    )}
                    <p className="font-bold">
                      {formatCurrency(price)}
                    </p>
                    <p className={`text-xs ${r.variation >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {r.variation >= 0 ? '+' : ''}{r.variation.toFixed(1)}%
                    </p>
                    <p className={`text-xs font-semibold ${getScoreColor(score)}`}>
                      {score.toUpperCase()}
                    </p>
                  </>
                )
              })()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}