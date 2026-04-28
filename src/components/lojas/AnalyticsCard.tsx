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
  periodoDias: number
  plano: 'premium'
}

interface UpgradeRequired {
  error: string
  requires_upgrade: true
  plano_atual: 'basico' | 'pro'
}

interface Props {
  lojaId: string
  plano: 'basico' | 'pro' | 'premium'
}

const TIPO_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  whatsapp:  { label: 'WhatsApp',  color: '#22c55e', icon: '💬' },
  instagram: { label: 'Instagram', color: '#a855f7', icon: '📸' },
  facebook:  { label: 'Facebook',  color: '#3b82f6', icon: '👍' },
  website:   { label: 'Website',   color: '#f59e0b', icon: '🌐' },
  maps:      { label: 'Maps',      color: '#ef4444', icon: '📍' },
}

const PERIODOS = [
  { dias: 7,  label: '7 dias' },
  { dias: 30, label: '30 dias' },
  { dias: 90, label: '90 dias' },
]

// ─── Componente ───────────────────────────────────────────────────────────

export default function AnalyticsCard({ lojaId, plano }: Props) {
  const [days, setDays] = useState<number>(30)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Gating no client: se NÃO é premium, não chama a API (evita request 402)
  const isPremium = plano === 'premium'

  useEffect(() => {
    if (!isPremium) {
      setLoading(false)
      return
    }

    let alive = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) {
          if (alive) {
            setError('Sessão expirada. Recarregue a página.')
            setLoading(false)
          }
          return
        }

        const res = await fetch(`/api/lojas/${lojaId}/analytics?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
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
  }, [lojaId, days, isPremium])

  // ─── Render: não-premium (teaser borrado + CTA) ───────────────────────
  if (!isPremium) {
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
                stroke="rgba(245,158,11,0.5)"
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
                Acompanhe cliques nos seus contatos por dia, tipo e origem. Saiba quem está te encontrando.
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

  // ─── Render: premium dashboard ────────────────────────────────────────
  const totalLogados = data.porUsuario.logados
  const totalAnonimos = data.porUsuario.anonimos
  const pctLogados = data.total > 0 ? Math.round((totalLogados / data.total) * 100) : 0

  // Chart data
  const chartData = {
    labels: data.porDia.map(d => {
      const date = new Date(d.data + 'T12:00:00')
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    }),
    datasets: [
      {
        label: 'Cliques',
        data: data.porDia.map(d => d.cliques),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: data.porDia.length <= 14 ? 3 : 0,
        pointHoverRadius: 5,
        pointBackgroundColor: '#f59e0b',
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
        borderColor: 'rgba(245,158,11,0.3)',
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
          <p style={S.subtitle}>{data.total} clique{data.total !== 1 ? 's' : ''} nos últimos {data.periodoDias} dias</p>
        </div>
        <div style={S.periodoSelect}>
          {PERIODOS.map(p => (
            <button
              key={p.dias}
              onClick={() => setDays(p.dias)}
              style={{
                ...S.periodoBtn,
                ...(days === p.dias ? S.periodoBtnAtivo : {}),
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs por tipo de CTA */}
      <div style={S.kpiGrid}>
        {Object.entries(TIPO_LABELS).map(([key, info]) => {
          const valor = data.porTipo[key] || 0
          return (
            <div key={key} style={S.kpiCard}>
              <div style={S.kpiIcon}>{info.icon}</div>
              <div style={{ ...S.kpiValue, color: valor > 0 ? info.color : 'rgba(255,255,255,0.3)' }}>
                {valor}
              </div>
              <div style={S.kpiLabel}>{info.label}</div>
            </div>
          )
        })}
      </div>

      {/* Gráfico temporal */}
      <div style={S.chartWrap}>
        {data.total === 0 ? (
          <div style={S.emptyChart}>
            Nenhum clique registrado nos últimos {data.periodoDias} dias.
          </div>
        ) : (
          <Line data={chartData} options={chartOptions} />
        )}
      </div>

      {/* Stats de origem */}
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
    color: '#f59e0b',
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.3)',
  },
  periodoSelect: {
    display: 'flex',
    gap: 4,
    background: 'rgba(255,255,255,0.04)',
    padding: 3,
    borderRadius: 10,
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
    background: 'rgba(245,158,11,0.15)',
    color: '#f59e0b',
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
    border: '1px solid rgba(245,158,11,0.3)',
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
    color: '#f59e0b',
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
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    color: '#000',
    padding: '10px 20px',
    borderRadius: 10,
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 800,
  },
}
