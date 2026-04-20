'use client'

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

interface Card { id: string; card_name: string; preco_medio?: number; price?: number; variation: number }
interface Transaction { id: string; card_name: string; price: number }
interface Props { rankingWithVariation: Card[]; transactions: Transaction[] }

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 28 }}>
    <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{title}</p>
    {children}
  </div>
)

const Row = ({ name, value, badge, badgeColor, sub, subColor }: any) => (
  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <p style={{ fontSize: 14, fontWeight: 500, color: '#f0f0f0', marginBottom: badge ? 4 : 0 }}>{name}</p>
      {badge && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: badgeColor + '18', color: badgeColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{badge}</span>}
    </div>
    <div style={{ textAlign: 'right' }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: value.startsWith('-') ? '#ef4444' : '#f0f0f0' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: subColor || 'rgba(255,255,255,0.35)', marginTop: 2 }}>{sub}</p>}
    </div>
  </div>
)

export default function CardRankings({ rankingWithVariation, transactions }: Props) {
  const alertas = rankingWithVariation.filter(r => {
    const p = Number(r.preco_medio || r.price || 0)
    return p && p > p * 1.3
  })

  const oportunidades = rankingWithVariation.filter(r => {
    const p = Number(r.preco_medio || r.price || 0)
    const m = Number(r.preco_medio || p)
    return p && m && p < m * 0.8
  })

  const valorizadas = rankingWithVariation.filter(r => r.variation > 0).sort((a, b) => b.variation - a.variation).slice(0, 5)
  const emQueda = rankingWithVariation.filter(r => r.variation < 0).sort((a, b) => a.variation - b.variation).slice(0, 5)

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Histórico */}
      <Section title="Histórico de transações">
        {transactions.length === 0 ? (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Nenhuma transação ainda</p>
        ) : (
          transactions.slice(0, 5).map(t => (
            <Row key={t.id} name={t.card_name} value={fmt(Number(t.price))} />
          ))
        )}
      </Section>

      {/* Alertas */}
      {alertas.length > 0 && (
        <Section title="Alertas de preço">
          {alertas.map(r => (
            <Row key={r.id} name={r.card_name} value={fmt(Number(r.preco_medio || r.price || 0))} badge="Acima do mercado" badgeColor="#f59e0b" />
          ))}
        </Section>
      )}

      {/* Oportunidades */}
      <Section title="Oportunidades">
        {oportunidades.length === 0 ? (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Nenhuma oportunidade no momento</p>
        ) : (
          oportunidades.map(r => {
            const p = Number(r.preco_medio || r.price || 0)
            const m = Number(r.preco_medio || p)
            const disc = ((m - p) / m * 100).toFixed(0)
            return <Row key={r.id} name={r.card_name} value={fmt(p)} badge={`${disc}% abaixo`} badgeColor="#22c55e" sub={`Médio: ${fmt(m)}`} />
          })
        )}
      </Section>

      {/* Mais valorizadas */}
      <Section title="Mais valorizadas">
        {valorizadas.length === 0 ? (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Sem dados de valorização</p>
        ) : (
          valorizadas.map(r => (
            <Row key={r.id} name={r.card_name} value={fmt(Number(r.preco_medio || r.price || 0))} sub={`+${r.variation.toFixed(1)}%`} subColor="#22c55e" />
          ))
        )}
      </Section>

      {/* Em queda */}
      {emQueda.length > 0 && (
        <Section title="Em queda">
          {emQueda.map(r => (
            <Row key={r.id} name={r.card_name} value={fmt(Number(r.preco_medio || r.price || 0))} sub={`${r.variation.toFixed(1)}%`} subColor="#ef4444" />
          ))}
        </Section>
      )}

      {/* Ranking */}
      <Section title="🏆 Cartas mais valiosas">
        {rankingWithVariation.length === 0 ? (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Sem cartas na coleção</p>
        ) : (
          rankingWithVariation.slice(0, 10).map((r, i) => {
            const p = Number(r.preco_medio || r.price || 0)
            const isOpp = p && p < p * 0.8
            return (
              <div key={r.id} style={{ background: 'rgba(255,255,255,0.03)', border: i === 0 ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: i === 0 ? '#f59e0b' : 'rgba(255,255,255,0.2)', minWidth: 20 }}>#{i + 1}</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: '#f0f0f0' }}>{r.card_name}</p>
                    {isOpp && <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e' }}>OPORTUNIDADE</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0' }}>{fmt(p)}</p>
                  <p style={{ fontSize: 11, color: r.variation >= 0 ? '#22c55e' : '#ef4444', marginTop: 2 }}>
                    {r.variation >= 0 ? '+' : ''}{r.variation.toFixed(1)}%
                  </p>
                </div>
              </div>
            )
          })
        )}
      </Section>

    </div>
  )
}