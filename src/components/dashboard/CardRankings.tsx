'use client'

const formatCurrency = (value: number) => {
  if (!value) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

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

interface Card {
  id: string
  card_name: string
  preco_medio?: number
  price?: number
  variation: number
}

interface Transaction {
  id: string
  card_name: string
  price: number
}

interface Props {
  rankingWithVariation: Card[]
  transactions: Transaction[]
}

export default function CardRankings({ rankingWithVariation, transactions }: Props) {
  return (
    <>
      {/* Histórico de transações */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 text-white">Histórico</h2>
        {transactions.length === 0 && (
          <p className="text-gray-400 text-sm">Nenhuma transação ainda</p>
        )}
        {transactions.map((t) => (
          <div key={t.id} className="p-4 mb-3 rounded-2xl bg-gray-900 shadow-sm border border-gray-800 flex justify-between items-center">
            <p className="font-medium text-white">{t.card_name}</p>
            <p className="text-sm text-gray-400">{formatCurrency(Number(t.price))}</p>
          </div>
        ))}
      </div>

      {/* Alertas */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 text-white">🔔 Alertas</h2>
        {rankingWithVariation
          .filter((r) => {
            const price = Number(r.preco_medio || r.price || 0)
            const medio = Number(r.preco_medio || price)
            return price && medio && price > medio * 1.3
          })
          .map((r) => (
            <div key={r.id} className="p-3 mb-2 rounded-xl bg-yellow-50 border border-yellow-200 flex justify-between items-center">
              <p className="font-medium">{r.card_name}</p>
              <p className="text-xs text-yellow-600 font-semibold">acima do preço médio</p>
            </div>
          ))}
      </div>

      {/* Oportunidades */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 text-white">🔥 Oportunidades</h2>
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
              <div key={r.id} className="p-4 mb-3 rounded-2xl bg-green-50 border border-green-200 flex justify-between items-center">
                <div>
                  <p className="font-medium">{r.card_name}</p>
                  <p className="text-xs text-green-600 font-semibold">{discount.toFixed(0)}% abaixo do mercado</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-700">{formatCurrency(price)}</p>
                  <p className="text-xs text-gray-400">médio: {formatCurrency(medio)}</p>
                </div>
              </div>
            )
          })}
      </div>

      {/* Mais valorizadas */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 text-white">📈 Mais valorizadas</h2>
        {rankingWithVariation
          .filter((r) => r.variation > 0)
          .sort((a, b) => b.variation - a.variation)
          .slice(0, 3)
          .map((r) => (
            <div key={r.id} className="p-4 mb-3 rounded-2xl bg-blue-50 border border-blue-200 flex justify-between items-center">
              <p className="font-medium">{r.card_name}</p>
              <div className="text-right">
                <p className="font-bold text-blue-700">{formatCurrency(Number(r.preco_medio || r.price || 0))}</p>
                <p className="text-xs text-blue-500">+{r.variation.toFixed(1)}%</p>
              </div>
            </div>
          ))}
      </div>

      {/* Em queda */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 text-white">📉 Em queda</h2>
        {rankingWithVariation
          .filter((r) => r.variation < 0)
          .sort((a, b) => a.variation - b.variation)
          .slice(0, 3)
          .map((r) => (
            <div key={r.id} className="p-4 mb-3 rounded-2xl bg-red-50 border border-red-200 flex justify-between items-center">
              <p className="font-medium">{r.card_name}</p>
              <div className="text-right">
                <p className="font-bold text-red-700">{formatCurrency(Number(r.preco_medio || r.price || 0))}</p>
                <p className="text-xs text-red-500">{r.variation.toFixed(1)}%</p>
              </div>
            </div>
          ))}
      </div>

      {/* Ranking */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3 text-white">Cartas mais caras</h2>
        {rankingWithVariation.length === 0 && (
          <p className="text-gray-400 text-sm">Sem dados suficientes para ranking</p>
        )}
        {rankingWithVariation.map((r) => {
          const price = Number(r.preco_medio || r.price || 0)
          const medio = Number(r.preco_medio || price)
          const score = getInvestmentScore(price, medio)
          return (
            <div key={r.id} className="p-4 mb-3 rounded-2xl bg-gray-900 shadow-sm border border-gray-800 flex justify-between items-center">
              <p className="font-medium text-white">{r.card_name}</p>
              <div className="text-right">
                {price && medio && price < medio * 0.8 && (
                  <p className="text-[10px] text-green-500 font-bold">OPORTUNIDADE</p>
                )}
                <p className="font-bold text-white">{formatCurrency(price)}</p>
                <p className={`text-xs ${r.variation >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {r.variation >= 0 ? '+' : ''}{r.variation.toFixed(1)}%
                </p>
                <p className={`text-xs font-semibold ${getScoreColor(score)}`}>{score.toUpperCase()}</p>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
} 