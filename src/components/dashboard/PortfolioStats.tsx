'use client'

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

interface Props {
  stats: { totalCompras: number; totalVendas: number; quantidade: number; valorColecao: number }
  saldo: number
  variation: number
  portfolioScore: number
}

export default function PortfolioStats({ stats, saldo, variation, portfolioScore }: Props) {
  const positivo = saldo >= 0
  const varPositiva = variation >= 0

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Hero — Patrimônio total */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.06))',
        border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: 20,
        padding: '28px 32px',
        marginBottom: 20,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, background: 'radial-gradient(circle, rgba(245,158,11,0.08), transparent 70%)', pointerEvents: 'none' }} />
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          Patrimônio total da coleção
        </p>
        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 20 }}>
          {fmt(stats.valorColecao)}
        </h1>
        <div style={{ display: 'flex', gap: 32 }}>
          <div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Saldo</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: positivo ? '#22c55e' : '#ef4444' }}>
              {positivo ? '+' : ''}{fmt(saldo)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Performance</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: varPositiva ? '#22c55e' : '#ef4444' }}>
              {varPositiva ? '+' : ''}{variation.toFixed(2)}%
            </p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Score</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: portfolioScore > 1 ? '#22c55e' : portfolioScore < 0 ? '#ef4444' : 'rgba(255,255,255,0.6)' }}>
              {portfolioScore.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* 4 métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Cartas', value: String(stats.quantidade), color: '#f0f0f0' },
          { label: 'Total compras', value: fmt(stats.totalCompras), color: '#ef4444' },
          { label: 'Total vendas', value: fmt(stats.totalVendas), color: '#22c55e' },
          { label: 'Saldo', value: fmt(saldo), color: positivo ? '#22c55e' : '#ef4444' },
        ].map(m => (
          <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{m.label}</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Resultado financeiro */}
      <div style={{
        background: positivo ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
        border: `1px solid ${positivo ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: positivo ? '#22c55e' : '#ef4444', background: positivo ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '3px 10px', borderRadius: 100, display: 'inline-block', marginBottom: 8 }}>
            {positivo ? '▲ Lucro' : '▼ Prejuízo'}
          </span>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Resultado das suas negociações</p>
        </div>
        <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', color: positivo ? '#22c55e' : '#ef4444' }}>
          {positivo ? '+' : ''}{fmt(saldo)}
        </p>
      </div>

      {/* Score da carteira */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Score da Carteira</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              {portfolioScore > 1 ? 'Boas oportunidades de compra' : portfolioScore < 0 ? 'Ativos acima do preço' : 'Carteira equilibrada'}
            </p>
          </div>
          <p style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.04em', color: portfolioScore > 1 ? '#22c55e' : portfolioScore < 0 ? '#ef4444' : 'rgba(255,255,255,0.5)' }}>
            {portfolioScore.toFixed(2)}
          </p>
        </div>
      </div>

    </div>
  )
}