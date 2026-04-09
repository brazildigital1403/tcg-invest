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

// Calcular valor da coleção
let valorTotal = 0

for (const card of cards || []) {
  const { data: priceData } = await supabase
    .from('card_prices')
    .select('*')
    .eq('card_name', card.card_name)
    .single()

  const price =
    priceData?.preco_medio ||
    priceData?.preco_min ||
    priceData?.preco_normal ||
    0

  valorTotal += Number(price)
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

      setPriceHistory(data.history || [])
    }

    loadHistory()
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard Financeiro</h1>
        <p className="text-gray-500 text-sm">Visão geral do seu patrimônio</p>
      </div>
      {userId && (
        <AddCard
          userId={userId}
          onAdd={() => window.location.reload()}
        />
      )}

      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded-xl border text-center">
          <p className="text-xs text-gray-400">Patrimônio</p>
          <p className="font-bold">{formatCurrency(stats.valorColecao)}</p>
        </div>
        <div className="p-3 bg-white rounded-xl border text-center">
          <p className="text-xs text-gray-400">Saldo</p>
          <p className={`font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(saldo)}
          </p>
        </div>
        <div className="p-3 bg-white rounded-xl border text-center">
          <p className="text-xs text-gray-400">Cartas</p>
          <p className="font-bold">{stats.quantidade}</p>
        </div>
        <div className="p-3 bg-white rounded-xl border text-center">
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
      <div className="mt-6 p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
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

      <div className="mt-6 p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
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

      {/* Gráfico da Carteira */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-700">📊 Evolução da Carteira</h2>

        {chartData.length > 0 ? (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <PriceChart data={chartData.map(d => ({
              date: d.date,
              preco_medio: d.value
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
        <h2 className="text-lg font-semibold mb-3 text-gray-700">Histórico de Preço</h2>
        {priceHistory.length > 0 ? (
          <PriceChart data={priceHistory} />
        ) : (
          <div className="text-center text-gray-400 py-10">
            <p>Sem histórico suficiente</p>
            <p className="text-xs">Faça novas buscas para gerar dados</p>
          </div>
        )}
      </div>

      {/* Histórico */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-700">Histórico</h2>
        {transactions.map((t) => (
          <div key={t.id} className="p-3 mb-2 rounded-xl bg-white shadow-sm border border-gray-100 flex justify-between items-center">
            <p className="font-medium">{t.card_name}</p>
            <p className="text-sm text-gray-500">
              {formatCurrency(Number(t.price))}
            </p>
          </div>
        ))}
      </div>

      {/* Alertas Inteligentes */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-700">🔔 Alertas</h2>
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
        <h2 className="text-lg font-semibold mb-3 text-gray-700">🔥 Oportunidades</h2>

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
              <div key={r.id} className="p-3 mb-2 rounded-xl bg-green-50 border border-green-200 flex justify-between items-center">
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
        <h2 className="text-lg font-semibold mb-3 text-gray-700">📈 Mais valorizadas</h2>

        {rankingWithVariation
          .filter((r) => r.variation > 0)
          .sort((a, b) => b.variation - a.variation)
          .slice(0, 3)
          .map((r) => (
            <div key={r.id} className="p-3 mb-2 rounded-xl bg-blue-50 border border-blue-200 flex justify-between items-center">
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
        <h2 className="text-lg font-semibold mb-3 text-gray-700">📉 Em queda</h2>

        {rankingWithVariation
          .filter((r) => r.variation < 0)
          .sort((a, b) => a.variation - b.variation)
          .slice(0, 3)
          .map((r) => (
            <div key={r.id} className="p-3 mb-2 rounded-xl bg-red-50 border border-red-200 flex justify-between items-center">
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
        <h2 className="text-lg font-semibold mb-3 text-gray-700">Cartas mais caras</h2>
        {rankingWithVariation.length === 0 && (
          <p className="text-gray-400 text-sm">Sem dados suficientes para ranking</p>
        )}
        {rankingWithVariation.map((r) => (
          <div key={r.id} className="p-3 mb-2 rounded-xl bg-white shadow-sm border border-gray-100 flex justify-between items-center">
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