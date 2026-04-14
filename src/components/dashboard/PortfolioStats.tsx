'use client'

const formatCurrency = (value: number) => {
  if (!value) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

interface Stats {
  totalCompras: number
  totalVendas: number
  quantidade: number
  valorColecao: number
}

interface Props {
  stats: Stats
  saldo: number
  variation: number
  portfolioScore: number
}

export default function PortfolioStats({ stats, saldo, variation, portfolioScore }: Props) {
  return (
    <>
      {/* Banner principal */}
      <div className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-black via-gray-900 to-gray-800 text-white shadow-lg">
        <p className="text-xs text-gray-300">Patrimônio total</p>
        <h1 className="text-3xl font-bold mt-1">{formatCurrency(stats.valorColecao)}</h1>
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

      {/* Grid de métricas */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-gray-900 rounded-2xl border border-gray-800 shadow-sm text-center">
          <p className="text-xs text-gray-400">Patrimônio</p>
          <p className="font-bold text-white">{formatCurrency(stats.valorColecao)}</p>
        </div>
        <div className="p-4 bg-gray-900 rounded-2xl border border-gray-800 shadow-sm text-center">
          <p className="text-xs text-gray-400">Saldo</p>
          <p className={`font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(saldo)}
          </p>
        </div>
        <div className="p-4 bg-gray-900 rounded-2xl border border-gray-800 shadow-sm text-center">
          <p className="text-xs text-gray-400">Cartas</p>
          <p className="font-bold text-white">{stats.quantidade}</p>
        </div>
        <div className="p-4 bg-gray-900 rounded-2xl border border-gray-800 shadow-sm text-center">
          <p className="text-xs text-gray-400">Performance</p>
          <p className={`font-bold ${variation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {variation >= 0 ? '+' : ''}{variation.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-gray-900 shadow-sm border border-gray-800">
          <p className="text-gray-400">Total Compras</p>
          <h2 className="text-xl font-bold text-red-600">{formatCurrency(stats.totalCompras)}</h2>
        </div>
        <div className="p-5 rounded-2xl bg-gray-900 shadow-sm border border-gray-800">
          <p className="text-gray-400">Total Vendas</p>
          <h2 className="text-xl font-bold text-green-600">{formatCurrency(stats.totalVendas)}</h2>
        </div>
        <div className="p-5 rounded-2xl bg-gray-900 shadow-sm border border-gray-800">
          <p className="text-gray-400">Cartas na coleção</p>
          <h2 className="text-xl font-bold text-white">{stats.quantidade}</h2>
        </div>
      </div>

      {/* Saldo */}
      <div className="mt-6 p-6 rounded-2xl bg-gray-900 shadow-sm border border-gray-800">
        <p className={`text-sm ${saldo >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {saldo >= 0 ? '+ lucro' : '- prejuízo'}
        </p>
        <p className="text-gray-400">Saldo</p>
        <h2 className={`text-2xl font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(saldo)}
        </h2>
      </div>

      {/* Valor da coleção */}
      <div className="mt-6 p-6 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg">
        <p className="text-blue-100">Valor da coleção</p>
        <p className={`text-sm ${variation >= 0 ? 'text-green-200' : 'text-red-200'}`}>
          {variation >= 0 ? '+' : ''}{variation.toFixed(2)}%
        </p>
        <h2 className="text-3xl font-bold text-white">{formatCurrency(stats.valorColecao)}</h2>
      </div>

      {/* Score da Carteira */}
      <div className="mt-6 p-5 rounded-2xl bg-gray-900 border border-gray-800 shadow-md">
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

      {/* Performance */}
      <div className="mt-6 p-5 rounded-2xl bg-gray-900 border border-gray-800 shadow-md">
        <p className="text-gray-400 text-sm">Performance</p>
        <h3 className={`text-xl font-bold ${variation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {variation >= 0 ? '+' : ''}{variation.toFixed(2)}% no período
        </h3>
        <p className="text-xs text-gray-400 mt-1">Baseado no histórico da carta selecionada</p>
      </div>
    </>
  )
}