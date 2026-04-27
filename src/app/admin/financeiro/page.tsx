'use client'

import { useEffect, useState } from 'react'
import { useAppModal } from '@/components/ui/useAppModal'

// ─── Tipos ────────────────────────────────────────────────────────────────

type Cards = {
  faturamento:    { valor: number; trend: number }
  despesas_pagas: { valor: number; trend: number }
  resultado:      { valor: number; trend: number }
  a_pagar:        { valor: number; count: number }
}

type DashboardData = {
  cards: Cards
  mei: { faturamento_ano: number; limite: number; percentual: number }
  vencimentos_proximos: { id: string; nome: string; valor: number; dias: number; dia_vencimento: number }[]
  chart_linha: { mes: string; receita: number; despesa: number }[]
  chart_pizza: { categoria: string; valor: number }[]
}

type DespesaRecorrente = {
  id: string
  nome: string
  categoria: string
  valor_mensal: number
  dia_vencimento: number
  ativa: boolean
  observacao: string | null
}

type Lancamento = {
  id: string
  tipo: 'despesa' | 'receita'
  valor_bruto: number
  taxa: number
  valor_liquido: number
  descricao: string
  categoria: string
  data_competencia: string
  data_liquidacao: string | null
  pago: boolean
  recebido: boolean
  fonte: 'manual' | 'stripe' | 'outro'
  observacao: string | null
}

const CATEGORIAS_DESPESA = ['infra','marketing','dominio','pagamentos','impostos','outros']
const CATEGORIAS_RECEITA = ['assinatura','outros']

const CAT_LABELS: Record<string, string> = {
  infra:       'Infraestrutura',
  marketing:   'Marketing',
  dominio:     'Domínio',
  pagamentos:  'Pagamentos',
  impostos:    'Impostos',
  assinatura:  'Assinatura',
  outros:      'Outros',
}

const CAT_COLORS: Record<string, string> = {
  infra:       '#60a5fa',
  marketing:   '#a78bfa',
  dominio:     '#22d3ee',
  pagamentos:  '#f59e0b',
  impostos:    '#ef4444',
  assinatura:  '#22c55e',
  outros:      'rgba(255,255,255,0.4)',
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const fmtData = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
const fmtMes  = (ym: string) => {
  const [y, m] = ym.split('-')
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  return `${meses[Number(m)-1]}/${y.slice(2)}`
}

function trendColor(t: number, invertido = false) {
  if (t === 0) return 'rgba(255,255,255,0.4)'
  const subiu = t > 0
  if (invertido) return subiu ? '#ef4444' : '#22c55e'
  return subiu ? '#22c55e' : '#ef4444'
}

// ─── Página ──────────────────────────────────────────────────────────────

export default function AdminFinanceiroPage() {
  const { showAlert, showConfirm } = useAppModal()

  const [data,    setData]    = useState<DashboardData | null>(null)
  const [recs,    setRecs]    = useState<DespesaRecorrente[]>([])
  const [recsTot, setRecsTot] = useState(0)
  const [lanc,    setLanc]    = useState<Lancamento[]>([])
  const [loadingDash, setLoadingDash] = useState(true)
  const [busy,    setBusy]    = useState(false)

  // Modais
  const [showModalRec, setShowModalRec]   = useState(false)
  const [editingRec,   setEditingRec]     = useState<DespesaRecorrente | null>(null)
  const [showModalLanc, setShowModalLanc] = useState(false)

  // Filtros lançamentos
  const [filtroTipo,      setFiltroTipo]      = useState<string>('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('')
  const [filtroStatus,    setFiltroStatus]    = useState<string>('')

  async function loadDashboard() {
    setLoadingDash(true)
    const r = await fetch('/api/admin/financeiro/dashboard')
    setLoadingDash(false)
    if (!r.ok) return
    setData(await r.json())
  }
  async function loadRecs() {
    const r = await fetch('/api/admin/financeiro/despesas-recorrentes')
    if (!r.ok) return
    const d = await r.json()
    setRecs(d.despesas || [])
    setRecsTot(d.total_mensal || 0)
  }
  async function loadLanc() {
    const params = new URLSearchParams()
    if (filtroTipo)      params.set('tipo', filtroTipo)
    if (filtroCategoria) params.set('categoria', filtroCategoria)
    if (filtroStatus)    params.set('status', filtroStatus)
    params.set('perPage', '50')
    const r = await fetch(`/api/admin/financeiro/lancamentos?${params}`)
    if (!r.ok) return
    const d = await r.json()
    setLanc(d.lancamentos || [])
  }

  useEffect(() => {
    loadDashboard()
    loadRecs()
    loadLanc()
    // eslint-disable-next-line
  }, [])
  useEffect(() => { loadLanc() /* eslint-disable-next-line */ }, [filtroTipo, filtroCategoria, filtroStatus])

  async function refreshAll() {
    await Promise.all([loadDashboard(), loadRecs(), loadLanc()])
  }

  // ─── Ações lançamentos ─────────────────────────────────────────────

  async function marcarPago(l: Lancamento) {
    setBusy(true)
    const isReceita = l.tipo === 'receita'
    const body = isReceita ? { recebido: !l.recebido } : { pago: !l.pago }
    const r = await fetch(`/api/admin/financeiro/lancamentos/${l.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      return showAlert(e.error || 'Erro', 'error')
    }
    await refreshAll()
  }

  async function deletarLanc(l: Lancamento) {
    const ok = await showConfirm({
      message: `Excluir lançamento "${l.descricao}" (${fmtBRL(l.valor_bruto)})?`,
      danger: true, confirmLabel: 'Excluir',
    })
    if (!ok) return
    setBusy(true)
    const r = await fetch(`/api/admin/financeiro/lancamentos/${l.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      return showAlert(e.error || 'Erro', 'error')
    }
    await refreshAll()
  }

  async function deletarRec(d: DespesaRecorrente) {
    const ok = await showConfirm({
      message: `Excluir a despesa recorrente "${d.nome}"? Lançamentos antigos não são afetados.`,
      danger: true, confirmLabel: 'Excluir',
    })
    if (!ok) return
    setBusy(true)
    const r = await fetch(`/api/admin/financeiro/despesas-recorrentes/${d.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      return showAlert(e.error || 'Erro', 'error')
    }
    await refreshAll()
  }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1300, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px', color: '#f0f0f0' }}>
            💰 Financeiro
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            Controle de gastos, recebimentos e resultado do Bynx
          </p>
        </div>
        <button onClick={() => setShowModalLanc(true)} style={{
          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
          border: 'none', color: '#000',
          padding: '10px 18px', borderRadius: 10,
          fontSize: 13, fontWeight: 800,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          + Novo lançamento
        </button>
      </div>

      {loadingDash ? (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Carregando...</p>
      ) : !data ? (
        <p style={{ color: '#ef4444', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Erro ao carregar.</p>
      ) : (
        <>
          {/* ── Aviso de vencimentos próximos ── */}
          {data.vencimentos_proximos.length > 0 && (
            <div style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 12, padding: '14px 18px',
              marginBottom: 18,
            }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
                ⚠️ {data.vencimentos_proximos.length} {data.vencimentos_proximos.length === 1 ? 'conta vencendo' : 'contas vencendo'} nos próximos 3 dias
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {data.vencimentos_proximos.map(v => (
                  <span key={v.id} style={{
                    fontSize: 12, color: 'rgba(255,255,255,0.85)',
                    padding: '4px 10px', borderRadius: 100,
                    background: 'rgba(245,158,11,0.12)',
                    border: '1px solid rgba(245,158,11,0.25)',
                  }}>
                    {v.nome}: <strong>{fmtBRL(v.valor)}</strong> {v.dias === 0 ? '(hoje)' : v.dias === 1 ? '(amanhã)' : `(em ${v.dias}d)`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Aviso MEI ── */}
          {data.mei.percentual >= 70 && (
            <div style={{
              background: data.mei.percentual >= 90 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)',
              border: `1px solid ${data.mei.percentual >= 90 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.25)'}`,
              borderRadius: 12, padding: '12px 18px',
              marginBottom: 18,
            }}>
              <p style={{ fontSize: 12, color: data.mei.percentual >= 90 ? '#ef4444' : '#f59e0b', margin: 0, fontWeight: 700 }}>
                {data.mei.percentual >= 90 ? '🚨' : '⚠️'} Limite MEI: {data.mei.percentual}% do teto anual usado ({fmtBRL(data.mei.faturamento_ano)} de {fmtBRL(data.mei.limite)})
              </p>
            </div>
          )}

          {/* ── 4 Cards macro ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 22 }}>
            <Card label="Faturamento bruto" valor={data.cards.faturamento.valor}    trend={data.cards.faturamento.trend}    color="#22c55e" />
            <Card label="Despesas pagas"    valor={data.cards.despesas_pagas.valor} trend={data.cards.despesas_pagas.trend} color="#ef4444" trendInvertido />
            <Card label="Resultado"         valor={data.cards.resultado.valor}      trend={data.cards.resultado.trend}      color={data.cards.resultado.valor >= 0 ? '#22c55e' : '#ef4444'} />
            <Card label="A pagar"           valor={data.cards.a_pagar.valor}        trend={null} color="#f59e0b" subtitle={`${data.cards.a_pagar.count} ${data.cards.a_pagar.count === 1 ? 'conta' : 'contas'} pendente${data.cards.a_pagar.count === 1 ? '' : 's'}`} />
          </div>

          {/* ── Gráficos ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 14, marginBottom: 22 }} className="fin-charts">
            <ChartLinha rows={data.chart_linha} />
            <ChartPizza rows={data.chart_pizza} />
          </div>
        </>
      )}

      {/* ── Despesas recorrentes ── */}
      <div style={surface}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={sectionTitle}>Despesas recorrentes</h3>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
              Total mensal ativo: <strong style={{ color: '#f59e0b' }}>{fmtBRL(recsTot)}</strong>
            </p>
          </div>
          <button onClick={() => { setEditingRec(null); setShowModalRec(true) }} style={btnPrimary}>
            + Adicionar
          </button>
        </div>

        {recs.length === 0 ? (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', padding: '24px 0', textAlign: 'center' }}>
            Nenhuma despesa recorrente cadastrada.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th style={th}>Nome</th>
                  <th style={th}>Categoria</th>
                  <th style={{ ...th, textAlign: 'right' }}>Valor mensal</th>
                  <th style={{ ...th, textAlign: 'center' }}>Vencimento</th>
                  <th style={{ ...th, textAlign: 'center' }}>Status</th>
                  <th style={{ ...th, textAlign: 'right', width: 140 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {recs.map(d => (
                  <tr key={d.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', opacity: d.ativa ? 1 : 0.5 }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{d.nome}</div>
                      {d.observacao && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{d.observacao}</div>}
                    </td>
                    <td style={td}>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        padding: '3px 8px', borderRadius: 100,
                        color: CAT_COLORS[d.categoria], background: `${CAT_COLORS[d.categoria]}14`,
                        border: `1px solid ${CAT_COLORS[d.categoria]}33`,
                      }}>
                        {CAT_LABELS[d.categoria]}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: '#f0f0f0' }}>
                      {fmtBRL(Number(d.valor_mensal))}
                    </td>
                    <td style={{ ...td, textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
                      Dia {d.dia_vencimento}
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                        padding: '3px 8px', borderRadius: 100,
                        color: d.ativa ? '#22c55e' : 'rgba(255,255,255,0.4)',
                        background: d.ativa ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${d.ativa ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.1)'}`,
                      }}>
                        {d.ativa ? 'Ativa' : 'Pausada'}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => { setEditingRec(d); setShowModalRec(true) }} style={btnIcon('rgba(255,255,255,0.7)')}>Editar</button>
                      <button onClick={() => deletarRec(d)} disabled={busy} style={btnIcon('#ef4444')}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Histórico de lançamentos ── */}
      <div style={{ ...surface, marginTop: 16 }}>
        <h3 style={sectionTitle}>Histórico de lançamentos</h3>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={selectStyle}>
            <option value="">Todos os tipos</option>
            <option value="despesa">Despesas</option>
            <option value="receita">Receitas</option>
          </select>
          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={selectStyle}>
            <option value="">Todas categorias</option>
            {Object.entries(CAT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={selectStyle}>
            <option value="">Todos</option>
            <option value="pago">Pagos / Recebidos</option>
            <option value="pendente">Pendentes</option>
          </select>
        </div>

        {lanc.length === 0 ? (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', padding: '24px 0', textAlign: 'center' }}>
            Nenhum lançamento encontrado.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th style={th}>Data</th>
                  <th style={th}>Descrição</th>
                  <th style={th}>Categoria</th>
                  <th style={{ ...th, textAlign: 'right' }}>Valor</th>
                  <th style={{ ...th, textAlign: 'center' }}>Status</th>
                  <th style={{ ...th, textAlign: 'right', width: 160 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lanc.map(l => {
                  const isReceita = l.tipo === 'receita'
                  const ok = isReceita ? l.recebido : l.pago
                  return (
                    <tr key={l.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ ...td, color: 'rgba(255,255,255,0.6)', fontVariantNumeric: 'tabular-nums' }}>{fmtData(l.data_competencia)}</td>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{l.descricao}</div>
                        {l.observacao && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{l.observacao}</div>}
                      </td>
                      <td style={td}>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          padding: '3px 8px', borderRadius: 100,
                          color: CAT_COLORS[l.categoria], background: `${CAT_COLORS[l.categoria]}14`,
                          border: `1px solid ${CAT_COLORS[l.categoria]}33`,
                        }}>
                          {CAT_LABELS[l.categoria]}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: isReceita ? '#22c55e' : '#ef4444' }}>
                        {isReceita ? '+' : '−'} {fmtBRL(Number(l.valor_bruto))}
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                          padding: '3px 8px', borderRadius: 100,
                          color: ok ? '#22c55e' : '#f59e0b',
                          background: ok ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                          border: `1px solid ${ok ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.3)'}`,
                        }}>
                          {ok ? (isReceita ? 'Recebido' : 'Pago') : 'Pendente'}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <button onClick={() => marcarPago(l)} disabled={busy} style={btnIcon(ok ? 'rgba(255,255,255,0.5)' : '#22c55e')}>
                          {ok ? 'Reverter' : isReceita ? 'Receber' : 'Pagar'}
                        </button>
                        <button onClick={() => deletarLanc(l)} disabled={busy} style={btnIcon('#ef4444')}>Excluir</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: nova/editar despesa recorrente ── */}
      {showModalRec && (
        <ModalDespesaRec
          editing={editingRec}
          onClose={() => { setShowModalRec(false); setEditingRec(null) }}
          onSaved={async () => { setShowModalRec(false); setEditingRec(null); await refreshAll() }}
          showAlert={showAlert}
        />
      )}

      {/* ── Modal: novo lançamento ── */}
      {showModalLanc && (
        <ModalLancamento
          onClose={() => setShowModalLanc(false)}
          onSaved={async () => { setShowModalLanc(false); await refreshAll() }}
          showAlert={showAlert}
        />
      )}

      <style>{`
        @media (max-width: 900px) {
          .fin-charts {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

// ─── Componentes ──────────────────────────────────────────────────────

function Card({ label, valor, trend, color, trendInvertido, subtitle }: {
  label: string
  valor: number
  trend: number | null
  color: string
  trendInvertido?: boolean
  subtitle?: string
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: '18px 20px',
    }}>
      <p style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.09em', margin: '0 0 10px' }}>
        {label}
      </p>
      <p style={{ fontSize: 24, fontWeight: 800, color, margin: '0 0 6px', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
        {fmtBRL(valor)}
      </p>
      {subtitle ? (
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0 }}>{subtitle}</p>
      ) : trend !== null ? (
        <p style={{ fontSize: 11, color: trendColor(trend, trendInvertido), margin: 0, fontWeight: 600 }}>
          {trend > 0 ? '↑' : trend < 0 ? '↓' : '·'} {Math.abs(trend)}% vs mês anterior
        </p>
      ) : null}
    </div>
  )
}

function ChartLinha({ rows }: { rows: { mes: string; receita: number; despesa: number }[] }) {
  const max = Math.max(1, ...rows.map(r => Math.max(r.receita, r.despesa)))
  const W = 600, H = 200, padX = 40, padY = 30
  const innerW = W - padX * 2
  const innerH = H - padY * 2
  const stepX = rows.length > 1 ? innerW / (rows.length - 1) : 0

  const pathReceita = rows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${padX + i * stepX} ${padY + innerH - (r.receita / max) * innerH}`).join(' ')
  const pathDespesa = rows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${padX + i * stepX} ${padY + innerH - (r.despesa / max) * innerH}`).join(' ')

  return (
    <div style={surface}>
      <h3 style={sectionTitle}>Receita vs Despesa (6 meses)</h3>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>● Receita</span>
        <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>● Despesa</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {/* Grid horizontal */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const y = padY + innerH * p
          return <line key={p} x1={padX} x2={W - padX} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        })}
        {/* Eixo Y label */}
        <text x={4} y={padY + 4} fill="rgba(255,255,255,0.3)" fontSize="10">{fmtBRL(max)}</text>
        <text x={4} y={H - padY + 4} fill="rgba(255,255,255,0.3)" fontSize="10">R$ 0</text>
        {/* Linhas */}
        <path d={pathReceita} fill="none" stroke="#22c55e" strokeWidth="2" />
        <path d={pathDespesa} fill="none" stroke="#ef4444" strokeWidth="2" />
        {/* Pontos */}
        {rows.map((r, i) => (
          <g key={i}>
            <circle cx={padX + i * stepX} cy={padY + innerH - (r.receita / max) * innerH} r="3" fill="#22c55e" />
            <circle cx={padX + i * stepX} cy={padY + innerH - (r.despesa / max) * innerH} r="3" fill="#ef4444" />
            <text x={padX + i * stepX} y={H - 8} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="11">{fmtMes(r.mes)}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function ChartPizza({ rows }: { rows: { categoria: string; valor: number }[] }) {
  const total = rows.reduce((s, r) => s + r.valor, 0)
  const cx = 100, cy = 100, R = 80
  let acc = 0
  const slices = rows.map(r => {
    const frac = total > 0 ? r.valor / total : 0
    const start = acc * 2 * Math.PI
    const end = (acc + frac) * 2 * Math.PI
    acc += frac
    const large = end - start > Math.PI ? 1 : 0
    const x1 = cx + R * Math.sin(start)
    const y1 = cy - R * Math.cos(start)
    const x2 = cx + R * Math.sin(end)
    const y2 = cy - R * Math.cos(end)
    return {
      ...r,
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`,
      color: CAT_COLORS[r.categoria] || 'rgba(255,255,255,0.4)',
    }
  })

  return (
    <div style={surface}>
      <h3 style={sectionTitle}>Despesas por categoria (mês atual)</h3>
      {total === 0 ? (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: '40px 0', textAlign: 'center' }}>
          Sem despesas no mês ainda.
        </p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <svg viewBox="0 0 200 200" style={{ width: 160, height: 160, flexShrink: 0 }}>
            {slices.map((s, i) => (
              <path key={i} d={s.d} fill={s.color} stroke="#080a0f" strokeWidth="1" />
            ))}
          </svg>
          <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {slices.map(s => (
              <div key={s.categoria} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'rgba(255,255,255,0.7)' }}>{CAT_LABELS[s.categoria]}</span>
                <span style={{ color: '#f0f0f0', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(s.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Modais ───────────────────────────────────────────────────────────

function ModalDespesaRec({ editing, onClose, onSaved, showAlert }: {
  editing: DespesaRecorrente | null
  onClose: () => void
  onSaved: () => Promise<void>
  showAlert: (m: string, t?: any) => void
}) {
  const [nome,        setNome]      = useState(editing?.nome || '')
  const [categoria,   setCategoria] = useState(editing?.categoria || 'infra')
  const [valor,       setValor]     = useState(editing ? String(editing.valor_mensal) : '')
  const [dia,         setDia]       = useState(editing ? String(editing.dia_vencimento) : '1')
  const [observacao,  setObs]       = useState(editing?.observacao || '')
  const [ativa,       setAtiva]     = useState(editing ? editing.ativa : true)
  const [saving,      setSaving]    = useState(false)

  async function salvar() {
    if (!nome.trim()) return showAlert('Nome obrigatório', 'warning')
    const v = parseFloat(valor.replace(',', '.'))
    if (!Number.isFinite(v) || v < 0) return showAlert('Valor inválido', 'warning')
    const d = parseInt(dia)
    if (!d || d < 1 || d > 31) return showAlert('Dia entre 1 e 31', 'warning')

    setSaving(true)
    const url = editing
      ? `/api/admin/financeiro/despesas-recorrentes/${editing.id}`
      : '/api/admin/financeiro/despesas-recorrentes'
    const r = await fetch(url, {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, categoria, valor_mensal: v, dia_vencimento: d, observacao, ativa }),
    })
    setSaving(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      return showAlert(e.error || 'Erro', 'error')
    }
    await onSaved()
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 18px', color: '#f0f0f0' }}>
          {editing ? 'Editar despesa recorrente' : 'Nova despesa recorrente'}
        </h3>

        <Field label="Nome">
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: ZenRows Startup" style={inputStyle} />
        </Field>
        <Field label="Categoria">
          <select value={categoria} onChange={e => setCategoria(e.target.value)} style={inputStyle}>
            {CATEGORIAS_DESPESA.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
          </select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Valor mensal (R$)">
            <input value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" style={inputStyle} />
          </Field>
          <Field label="Dia do vencimento">
            <input value={dia} onChange={e => setDia(e.target.value)} placeholder="1-31" inputMode="numeric" style={inputStyle} />
          </Field>
        </div>
        <Field label="Observação (opcional)">
          <input value={observacao} onChange={e => setObs(e.target.value)} placeholder="Renova em 26/05..." style={inputStyle} />
        </Field>
        {editing && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>
            <input type="checkbox" checked={ativa} onChange={e => setAtiva(e.target.checked)} />
            Despesa ativa
          </label>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={salvar} disabled={saving} style={btnPrimary}>
            {saving ? 'Salvando...' : editing ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalLancamento({ onClose, onSaved, showAlert }: {
  onClose: () => void
  onSaved: () => Promise<void>
  showAlert: (m: string, t?: any) => void
}) {
  const [tipo,      setTipo]      = useState<'despesa'|'receita'>('despesa')
  const [valor,     setValor]     = useState('')
  const [taxa,      setTaxa]      = useState('')
  const [descricao, setDesc]      = useState('')
  const [categoria, setCategoria] = useState('infra')
  const [dataComp,  setDataComp]  = useState(new Date().toISOString().slice(0,10))
  const [pago,      setPago]      = useState(true)
  const [observacao,setObs]       = useState('')
  const [saving,    setSaving]    = useState(false)

  const cats = tipo === 'despesa' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA

  // Reset categoria quando muda tipo
  useEffect(() => {
    setCategoria(tipo === 'despesa' ? 'infra' : 'assinatura')
  }, [tipo])

  async function salvar() {
    const v = parseFloat(valor.replace(',', '.'))
    if (!Number.isFinite(v) || v < 0) return showAlert('Valor inválido', 'warning')
    const t = taxa ? parseFloat(taxa.replace(',', '.')) : 0
    if (!Number.isFinite(t) || t < 0) return showAlert('Taxa inválida', 'warning')
    if (!descricao.trim()) return showAlert('Descrição obrigatória', 'warning')

    setSaving(true)
    const r = await fetch('/api/admin/financeiro/lancamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo, valor_bruto: v, taxa: t, descricao, categoria,
        data_competencia: dataComp,
        pago:     tipo === 'despesa' ? pago : undefined,
        recebido: tipo === 'receita' ? pago : undefined,
        fonte: 'manual',
        observacao,
      }),
    })
    setSaving(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      return showAlert(e.error || 'Erro', 'error')
    }
    await onSaved()
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 18px', color: '#f0f0f0' }}>Novo lançamento manual</h3>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={() => setTipo('despesa')} style={tabButton(tipo === 'despesa', '#ef4444')}>Despesa</button>
          <button onClick={() => setTipo('receita')} style={tabButton(tipo === 'receita', '#22c55e')}>Receita</button>
        </div>

        <Field label="Descrição">
          <input value={descricao} onChange={e => setDesc(e.target.value)} placeholder="Ex: Pagamento freelancer X" style={inputStyle} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Valor bruto (R$)">
            <input value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" style={inputStyle} />
          </Field>
          <Field label={tipo === 'receita' ? 'Taxa (R$)' : 'Outras taxas (R$)'}>
            <input value={taxa} onChange={e => setTaxa(e.target.value)} placeholder="0,00" inputMode="decimal" style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Categoria">
            <select value={categoria} onChange={e => setCategoria(e.target.value)} style={inputStyle}>
              {cats.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
            </select>
          </Field>
          <Field label="Data">
            <input type="date" value={dataComp} onChange={e => setDataComp(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <Field label="Observação (opcional)">
          <input value={observacao} onChange={e => setObs(e.target.value)} placeholder="..." style={inputStyle} />
        </Field>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>
          <input type="checkbox" checked={pago} onChange={e => setPago(e.target.checked)} />
          Já {tipo === 'receita' ? 'recebido' : 'pago'}
        </label>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={salvar} disabled={saving} style={btnPrimary}>
            {saving ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// ─── Estilos compartilhados ──────────────────────────────────────────

const surface: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14, padding: '20px 22px',
}

const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 800, letterSpacing: '-0.01em',
  color: '#f0f0f0', margin: '0 0 14px',
}

const th: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: 10, fontWeight: 800,
  color: 'rgba(255,255,255,0.45)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  textAlign: 'left',
}

const td: React.CSSProperties = { padding: '12px 14px', verticalAlign: 'middle' }

const selectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '7px 10px',
  color: '#f0f0f0', fontSize: 12,
  outline: 'none', fontFamily: 'inherit',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '9px 12px',
  color: '#f0f0f0', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9000,
  background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
}

const modalBox: React.CSSProperties = {
  background: '#0f1117', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 18, padding: '24px 26px', width: '100%', maxWidth: 460,
  fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0',
  boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  maxHeight: '90vh', overflowY: 'auto',
}

const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
  border: 'none', color: '#000',
  padding: '9px 16px', borderRadius: 9,
  fontSize: 13, fontWeight: 800,
  cursor: 'pointer', fontFamily: 'inherit',
}

const btnGhost: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'rgba(255,255,255,0.6)',
  padding: '9px 16px', borderRadius: 9,
  fontSize: 13, cursor: 'pointer', fontWeight: 500,
  fontFamily: 'inherit',
}

const btnIcon = (color: string): React.CSSProperties => ({
  background: 'transparent',
  border: `1px solid ${color}33`,
  color,
  padding: '5px 10px', borderRadius: 7,
  fontSize: 11, fontWeight: 700,
  cursor: 'pointer', marginLeft: 4,
  fontFamily: 'inherit',
})

const tabButton = (active: boolean, color: string): React.CSSProperties => ({
  flex: 1, padding: '8px',
  background: active ? `${color}14` : 'rgba(255,255,255,0.04)',
  border: `1px solid ${active ? `${color}50` : 'rgba(255,255,255,0.1)'}`,
  color: active ? color : 'rgba(255,255,255,0.5)',
  borderRadius: 8,
  fontSize: 13, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
})
