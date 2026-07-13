'use client'

import { CSSProperties, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Filler)

// ─── Tipos ────────────────────────────────────────────────────────────────

interface AnalyticsData {
  total: number
  porTipo: Record<string, number>
  porDia: { data: string; cliques: number }[]
  porUsuario: { logados: number; anonimos: number }
  porOrigem?: { origem: string; total: number }[]
  visitas?: number
  contatos?: number
  conversao?: number
  deltas?: { visitas: number; contatos: number; conversao: number } | null
  device?: { mobile: number; desktop: number }
  periodoDias: number
  desde?: string | null
  ate?: string | null
  tipoFiltro?: string | null
  plano: string
  isAdmin?: boolean
}

interface Props {
  lojaId: string
  plano: 'basico' | 'pro' | 'premium'
  /**
   * Modo admin: usado dentro do painel admin (modal Detalhes).
   * - Bypassa o gate de premium (vê analytics de qualquer loja)
   * - Autentica via cookie HMAC (sem Bearer)
   * - Habilita período "Tudo", filtro por tipo e seção "Origem dos cliques"
   */
  admin?: boolean
}

type Periodo = number | 'all'

const TIPO_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  whatsapp:  { label: 'WhatsApp',  color: '#22c55e', icon: '💬' },
  instagram: { label: 'Instagram', color: '#a855f7', icon: '📸' },
  facebook:  { label: 'Facebook',  color: '#3b82f6', icon: '👍' },
  website:   { label: 'Website',   color: '#f59e0b', icon: '🌐' },
  maps:      { label: 'Maps',      color: '#ef4444', icon: '📍' },
}

const PERIODOS: { v: Periodo; label: string }[] = [
  { v: 7,  label: '7 dias' },
  { v: 30, label: '30 dias' },
  { v: 90, label: '90 dias' },
]

// ─── Componente ───────────────────────────────────────────────────────────

export default function AnalyticsCard({ lojaId, plano, admin = false }: Props) {
  // Acento do chart/SVG (canvas nao aceita var CSS): Painel=azul->roxo, Admin=ambar
  const AC1 = admin ? '#f59e0b' : '#60a5fa'
  const AC1_RGB = admin ? '245,158,11' : '96,165,250'
  const [periodo, setPeriodo] = useState<Periodo>(admin ? 'all' : 30)
  const [tipoFiltro, setTipoFiltro] = useState<string | null>(null)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Gating no client: owner não-premium vê teaser. Admin nunca é gated.
  const showTeaser = !admin && plano !== 'premium'

  // Períodos disponíveis: owner mantém 7/30/90; admin ganha "Tudo".
  const periodos = admin ? [...PERIODOS, { v: 'all' as Periodo, label: 'Tudo' }] : PERIODOS

  useEffect(() => {
    if (showTeaser) {
      setLoading(false)
      return
    }

    let alive = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const qs = new URLSearchParams()
        if (periodo === 'all') qs.set('range', 'all')
        else qs.set('days', String(periodo))
        if (tipoFiltro) qs.set('tipo', tipoFiltro)
        const url = `/api/lojas/${lojaId}/analytics?${qs.toString()}`

        let res: Response
        if (admin) {
          // Admin: cookie HMAC (bynx_admin) vai junto em same-origin
          res = await fetch(url, { credentials: 'same-origin' })
        } else {
          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token
          if (!token) {
            if (alive) {
              setError('Sessão expirada. Recarregue a página.')
              setLoading(false)
            }
            return
          }
          res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        }

        const json = await res.json()
        if (!alive) return

        if (!res.ok) {
          setError(json.error || 'Erro ao carregar analytics')
        } else {
          setData(json as AnalyticsData)
        }
      } catch {
        if (alive) setError('Erro ao carregar analytics')
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => { alive = false }
  }, [lojaId, periodo, tipoFiltro, admin, showTeaser])

  // ─── Render: não-premium (teaser borrado + CTA) — só owner ────────────
  if (showTeaser) {
    return (
      <div style={S.card}>
        <div style={S.header}>
          <div>
            <h2 style={S.title}>Analytics</h2>
            <p style={S.subtitle}>Veja quem está clicando nos seus contatos</p>
          </div>
          <span style={S.premiumBadge}>Premium</span>
        </div>

        <div style={S.teaserWrap}>
          {/* KPIs borrados (mock) */}
          <div style={S.kpiGrid}>
            {Object.entries(TIPO_LABELS).map(([key, info]) => (
              <div key={key} style={{ ...S.kpiCard, ...S.blurred }}>
                <div style={S.kpiIcon}>{info.icon}</div>
                <div style={{ ...S.kpiValue, color: info.color }}>—</div>
                <div style={S.kpiLabel}>{info.label}</div>
              </div>
            ))}
          </div>

          {/* Gráfico borrado (mock minimal) */}
          <div style={{ ...S.chartWrap, ...S.blurred, height: 140 }}>
            <svg viewBox="0 0 300 100" style={{ width: '100%', height: '100%' }}>
              <polyline
                points="0,80 30,60 60,70 90,40 120,50 150,30 180,45 210,25 240,35 270,15 300,20"
                fill="none"
                stroke={`rgba(${AC1_RGB},0.5)`}
                strokeWidth="2"
              />
            </svg>
          </div>

          {/* Overlay com CTA */}
          <div style={S.ctaOverlay}>
            <div style={S.ctaBox}>
              <div style={S.ctaIcon}>📊</div>
              <h3 style={S.ctaTitle}>Disponível no plano Premium</h3>
              <p style={S.ctaText}>
                Acompanhe visitas, contatos e taxa de conversão da sua loja. Saiba quem está te encontrando.
              </p>
              <Link href={`/minha-loja/${lojaId}/plano`} style={S.ctaBtn}>
                Fazer upgrade →
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render: loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={S.card}>
        <div style={S.header}>
          <h2 style={S.title}>Analytics</h2>
        </div>
        <div style={S.loading}>Carregando dados...</div>
      </div>
    )
  }

  // ─── Render: erro ─────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div style={S.card}>
        <div style={S.header}>
          <h2 style={S.title}>Analytics</h2>
        </div>
        <div style={S.errorBox}>{error || 'Dados indisponíveis'}</div>
      </div>
    )
  }

  // ─── Render: dashboard ────────────────────────────────────────────────
  const totalLogados = data.porUsuario.logados
  const totalAnonimos = data.porUsuario.anonimos
  const pctLogados = data.total > 0 ? Math.round((totalLogados / data.total) * 100) : 0

  // Funil + dispositivo (parte 1 backend ja envia)
  const visitas = data.visitas ?? 0
  const contatos = data.contatos ?? 0
  const conversao = data.conversao ?? 0
  const deltas = data.deltas ?? null
  const device = data.device ?? { mobile: 0, desktop: 0 }
  const totalDevice = device.mobile + device.desktop
  const pctMobile = totalDevice > 0 ? Math.round((device.mobile / totalDevice) * 100) : 0
  const pctDesktop = 100 - pctMobile
  const fmtDelta = (d: number) => (d > 0 ? `▲ ${d}%` : d < 0 ? `▼ ${Math.abs(d)}%` : '—')

  const filtroLabel = tipoFiltro ? TIPO_LABELS[tipoFiltro]?.label : null
  const unidade = tipoFiltro ? 'clique' : 'visita'
  const subtitle =
    (periodo === 'all'
      ? `${data.total} ${unidade}${data.total !== 1 ? 's' : ''} no total`
      : `${data.total} ${unidade}${data.total !== 1 ? 's' : ''} nos últimos ${data.periodoDias} dias`) +
    (filtroLabel ? ` · filtrando ${filtroLabel}` : '')

  // Chart data
  const chartData = {
    labels: data.porDia.map(d => {
      const date = new Date(d.data + 'T12:00:00')
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    }),
    datasets: [
      {
        label: tipoFiltro ? 'Cliques' : 'Visitas',
        data: data.porDia.map(d => d.cliques),
        borderColor: AC1,
        backgroundColor: `rgba(${AC1_RGB},0.15)`,
        fill: true,
        tension: 0.3,
        pointRadius: data.porDia.length <= 14 ? 3 : 0,
        pointHoverRadius: 5,
        pointBackgroundColor: AC1,
        borderWidth: 2,
      },
    ],
  }

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0d0f14',
        titleColor: '#f0f0f0',
        bodyColor: '#f0f0f0',
        borderColor: `rgba(${AC1_RGB},0.3)`,
        borderWidth: 1,
        padding: 10,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: 'rgba(255,255,255,0.4)',
          font: { size: 10 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: {
          color: 'rgba(255,255,255,0.4)',
          font: { size: 10 },
          stepSize: 1,
          precision: 0,
        },
        beginAtZero: true,
      },
    },
  }

  return (
    <div style={S.card}>
      <div style={S.header}>
        <div>
          <h2 style={S.title}>Analytics</h2>
          <p style={S.subtitle}>{subtitle}</p>
        </div>
        <div style={S.periodoSelect}>
          {periodos.map(p => (
            <button
              key={String(p.v)}
              onClick={() => setPeriodo(p.v)}
              style={{
                ...S.periodoBtn,
                ...(periodo === p.v ? S.periodoBtnAtivo : {}),
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Visão geral: funil Visitas -> Contatos -> Conversão */}
      <div style={S.secLabelRow}><span style={S.secLabel}>Visão geral</span></div>
      <div style={S.funil}>
        <div style={{ ...S.fstep, borderColor: `rgba(${AC1_RGB},0.22)` }}>
          <div style={S.fic}>👁️</div>
          <div style={S.fval}>{visitas}</div>
          <div style={S.flbl}>Visitas</div>
          {deltas && <div style={{ ...S.delta, color: deltas.visitas >= 0 ? '#22c55e' : '#ef4444' }}>{fmtDelta(deltas.visitas)}</div>}
        </div>
        <div style={S.farrow}>→</div>
        <div style={{ ...S.fstep, borderColor: `rgba(${AC1_RGB},0.22)` }}>
          <div style={S.fic}>💬</div>
          <div style={S.fval}>{contatos}</div>
          <div style={S.flbl}>Contatos</div>
          {deltas && <div style={{ ...S.delta, color: deltas.contatos >= 0 ? '#22c55e' : '#ef4444' }}>{fmtDelta(deltas.contatos)}</div>}
        </div>
        <div style={S.farrow}>→</div>
        <div style={{ ...S.fstep, ...S.fconv }}>
          <div style={S.fic}>📈</div>
          <div style={{ ...S.fval, color: '#22c55e' }}>{conversao > 0 ? `${(conversao * 100).toFixed(1).replace('.', ',')}%` : '—'}</div>
          <div style={S.flbl}>Conversão</div>
          {deltas && <div style={{ ...S.delta, color: deltas.conversao >= 0 ? '#22c55e' : '#ef4444' }}>{fmtDelta(deltas.conversao)}</div>}
        </div>
      </div>

      {totalDevice > 0 && (
        <div style={S.devWrap}>
          <span style={S.secLabel}>Dispositivo</span>
          <div style={S.devBar}>
            {pctMobile > 0 && (
              <div style={{ ...S.devSeg, width: `${pctMobile}%`, background: `linear-gradient(135deg, ${AC1}, #818cf8)` }}>📱 {pctMobile}%</div>
            )}
            {pctDesktop > 0 && (
              <div style={{ ...S.devSeg, ...S.devSegD, width: `${pctDesktop}%` }}>💻 {pctDesktop}%</div>
            )}
          </div>
        </div>
      )}

      {/* KPIs por tipo de CTA. No admin, clicáveis = filtro. */}
      <div style={S.kpiGrid}>
        {Object.entries(TIPO_LABELS).map(([key, info]) => {
          const valor = data.porTipo[key] || 0
          const ativo = tipoFiltro === key
          return (
            <div
              key={key}
              onClick={admin ? () => setTipoFiltro(ativo ? null : key) : undefined}
              role={admin ? 'button' : undefined}
              title={admin ? (ativo ? 'Remover filtro' : `Filtrar por ${info.label}`) : undefined}
              style={{
                ...S.kpiCard,
                ...(admin ? S.kpiClickable : {}),
                ...(ativo ? { borderColor: info.color, background: 'rgba(255,255,255,0.05)' } : {}),
              }}
            >
              <div style={S.kpiIcon}>{info.icon}</div>
              <div style={{ ...S.kpiValue, color: valor > 0 ? info.color : 'rgba(255,255,255,0.3)' }}>
                {valor}
              </div>
              <div style={S.kpiLabel}>{info.label}</div>
            </div>
          )
        })}
      </div>

      {admin && tipoFiltro && (
        <button onClick={() => setTipoFiltro(null)} style={S.limparFiltro}>
          ✕ Limpar filtro ({filtroLabel})
        </button>
      )}

      {/* Gráfico temporal */}
      <div style={S.chartWrap}>
        {data.total === 0 ? (
          <div style={S.emptyChart}>
            Nenhum clique registrado no período.
          </div>
        ) : (
          <Line data={chartData} options={chartOptions} />
        )}
      </div>

      {/* Logados vs anônimos */}
      {data.total > 0 && (
        <div style={S.statsRow}>
          <div style={S.statItem}>
            <span style={S.statLabel}>Visitantes logados</span>
            <span style={S.statValue}>
              {totalLogados} <span style={S.statPct}>({pctLogados}%)</span>
            </span>
          </div>
          <div style={S.statDivider} />
          <div style={S.statItem}>
            <span style={S.statLabel}>Visitantes anônimos</span>
            <span style={S.statValue}>
              {totalAnonimos} <span style={S.statPct}>({100 - pctLogados}%)</span>
            </span>
          </div>
        </div>
      )}

      {/* Origem dos cliques (lojista premium + admin) — agregado por domínio, SEM IP */}
      {data.porOrigem && data.porOrigem.length > 0 && (
        <div style={S.origemWrap}>
          <div style={S.origemHead}>
            Origem dos cliques <span style={S.origemHint}>(agregado, sem IP)</span>
          </div>
          {data.porOrigem.slice(0, 12).map(o => {
            const pct = data.total > 0 ? Math.round((o.total / data.total) * 100) : 0
            return (
              <div key={o.origem} style={S.origemRow}>
                <span style={S.origemNome} title={o.origem}>{o.origem}</span>
                <div style={S.origemBarTrack}>
                  <div style={{ ...S.origemBarFill, width: `${pct}%` }} />
                </div>
                <span style={S.origemVal}>{o.total}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  card: {
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    position: 'relative',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#f0f0f0',
    margin: 0,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    margin: 0,
  },
  premiumBadge: {
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '4px 10px',
    borderRadius: 100,
    color: 'var(--ac-1)',
    background: 'rgba(var(--ac-1-rgb), 0.1)',
    border: '1px solid rgba(var(--ac-1-rgb), 0.3)',
  },
  periodoSelect: {
    display: 'flex',
    gap: 4,
    background: 'rgba(255,255,255,0.04)',
    padding: 3,
    borderRadius: 10,
    flexWrap: 'wrap',
  },
  periodoBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: 600,
    padding: '6px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  periodoBtnAtivo: {
    background: 'rgba(var(--ac-1-rgb), 0.15)',
    color: 'var(--ac-1)',
  },

  // KPI cards
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 10,
  },
  kpiCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: '14px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    transition: 'all 0.15s',
  },
  kpiClickable: {
    cursor: 'pointer',
  },
  kpiIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.02em',
  },
  kpiLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  limparFiltro: {
    alignSelf: 'flex-start',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: 600,
    padding: '6px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: -8,
  },

  // Funil (visao geral) + dispositivo
  secLabelRow: { marginBottom: 10 },
  secLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  funil: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr auto 1fr',
    alignItems: 'center',
    gap: 8,
    marginBottom: 22,
  },
  fstep: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '16px 12px',
    textAlign: 'center',
    minWidth: 0,
  },
  fconv: {
    borderColor: 'rgba(34,197,94,0.3)',
    background: 'rgba(34,197,94,0.05)',
  },
  fic: { fontSize: 18, marginBottom: 5 },
  fval: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  flbl: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 5 },
  farrow: { color: 'rgba(255,255,255,0.25)', fontSize: 18, textAlign: 'center' },
  delta: { fontSize: 11, fontWeight: 700, marginTop: 4 },
  devWrap: { marginBottom: 22 },
  devBar: {
    display: 'flex',
    height: 32,
    borderRadius: 9,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
    marginTop: 8,
  },
  devSeg: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
    whiteSpace: 'nowrap',
  },
  devSegD: { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' },

  // Chart
  chartWrap: {
    height: 200,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  emptyChart: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    textAlign: 'center',
  },

  // Stats row
  statsRow: {
    display: 'flex',
    alignItems: 'stretch',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  statItem: {
    flex: 1,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 800,
    color: '#f0f0f0',
    fontVariantNumeric: 'tabular-nums',
  },
  statPct: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: 600,
  },
  statDivider: {
    width: 1,
    background: 'rgba(255,255,255,0.05)',
  },

  // Origem (admin)
  origemWrap: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  origemHead: {
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  origemHint: {
    fontSize: 10,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'none',
    letterSpacing: 0,
  },
  origemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  origemNome: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    width: 130,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  origemBarTrack: {
    flex: 1,
    height: 6,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 100,
    overflow: 'hidden',
  },
  origemBarFill: {
    height: '100%',
    background: 'var(--ac-grad)',
    borderRadius: 100,
  },
  origemVal: {
    fontSize: 12,
    fontWeight: 700,
    color: '#f0f0f0',
    width: 32,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },

  // Loading / erro
  loading: {
    padding: '40px 0',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
  errorBox: {
    padding: 16,
    background: 'rgba(239,68,68,0.06)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 10,
    color: '#ef4444',
    fontSize: 13,
  },

  // Teaser / gating
  teaserWrap: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  blurred: {
    filter: 'blur(4px)',
    opacity: 0.4,
    pointerEvents: 'none',
    userSelect: 'none',
  },
  ctaOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  ctaBox: {
    background: 'rgba(13,15,20,0.95)',
    border: '1px solid rgba(var(--ac-1-rgb), 0.3)',
    borderRadius: 16,
    padding: '24px 28px',
    maxWidth: 380,
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(8px)',
  },
  ctaIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  ctaTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--ac-1)',
    margin: 0,
    marginBottom: 8,
  },
  ctaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 1.5,
    margin: 0,
    marginBottom: 16,
  },
  ctaBtn: {
    display: 'inline-block',
    background: 'var(--ac-grad)',
    color: '#000',
    padding: '10px 20px',
    borderRadius: 10,
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 800,
  },
}
