'use client'

/**
 * /recompensas — Marketplace de pontos do Indique e Ganhe.
 *
 * Autenticada. Mostra catálogo de rewards ativos com botão "Resgatar"
 * (disabled se saldo insuficiente) + histórico de resgates do user.
 *
 * Toggle Catálogo / Meus resgates evita criar 4ª página.
 *
 * Modal de confirmação antes do resgate (action irreversível).
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/ui/AppLayout'
import { useAppModal } from '@/components/ui/useAppModal'
import { formatPoints } from '@/lib/referrals'
import { IconCheck } from '@/components/ui/Icons'

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface Reward {
  id: string
  sku: string
  title: string
  description: string | null
  cost_points: number
  reward_type: 'pro_days' | 'scan_credits' | 'separadores' | 'physical' | 'other'
  reward_payload: any
  stock: number | null
  sort_order: number
}

interface Redemption {
  id: string
  cost_points: number
  status: 'pending' | 'fulfilled' | 'cancelled'
  created_at: string
  fulfilled_at: string | null
  reward: {
    title: string
    sku: string
    reward_type: string
  }
}

interface MeStats {
  points_balance: number
  points_earned_total: number
}

// ─── Constantes ────────────────────────────────────────────────────────────

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const CARD_BG = '#0f1117'
const BORDER = 'rgba(255,255,255,0.1)'

const TYPE_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  pro_days:     { label: 'PRO',          emoji: '⭐', color: '#f59e0b' },
  scan_credits: { label: 'SCAN IA',      emoji: '📸', color: '#60a5fa' },
  separadores:  { label: 'SEPARADORES',  emoji: '📁', color: '#22c55e' },
  physical:     { label: 'PRÊMIO FÍSICO',emoji: '📦', color: '#ec4899' },
  other:        { label: 'OUTRO',        emoji: '🎁', color: '#94a3b8' },
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Em processamento', color: '#f59e0b' },
  fulfilled: { label: 'Entregue',         color: '#22c55e' },
  cancelled: { label: 'Cancelado',        color: '#ef4444' },
}

// ─── Componente ────────────────────────────────────────────────────────────

export default function RecompensasPage() {
  const router = useRouter()
  const modal = useAppModal()
  const [tab, setTab] = useState<'catalog' | 'history'>('catalog')
  const [rewards, setRewards] = useState<Reward[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [me, setMe] = useState<MeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState<string | null>(null)

  // ── Auth + fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          router.replace('/?auth=signup&next=/recompensas')
          return
        }
        const token = session.access_token
        const headers = { Authorization: `Bearer ${token}` }

        const [meRes, rewardsRes, redRes] = await Promise.all([
          fetch('/api/referrals/me', { headers, cache: 'no-store' }),
          fetch('/api/referrals/rewards', { cache: 'no-store' }),
          supabase.from('point_redemptions')
            .select('id, cost_points, status, created_at, fulfilled_at, reward:rewards(title, sku, reward_type)')
            .order('created_at', { ascending: false })
            .limit(30),
        ])

        const meJson = await meRes.json()
        const rewardsJson = await rewardsRes.json()

        if (!mounted) return
        if (meJson?.ok) setMe({ points_balance: meJson.points_balance, points_earned_total: meJson.points_earned_total })
        if (rewardsJson?.ok && Array.isArray(rewardsJson.items)) setRewards(rewardsJson.items)
        if (redRes.data) setRedemptions(redRes.data as any)
      } catch (err) {
        console.error('[recompensas] fetch err:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [router])

  // ── Refresh dos dados (chamado após resgate) ─────────────────────────
  async function refresh() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    const headers = { Authorization: `Bearer ${session.access_token}` }

    const [meRes, redRes] = await Promise.all([
      fetch('/api/referrals/me', { headers, cache: 'no-store' }),
      supabase.from('point_redemptions')
        .select('id, cost_points, status, created_at, fulfilled_at, reward:rewards(title, sku, reward_type)')
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    const meJson = await meRes.json()
    if (meJson?.ok) setMe({ points_balance: meJson.points_balance, points_earned_total: meJson.points_earned_total })
    if (redRes.data) setRedemptions(redRes.data as any)
  }

  // ── Resgate ──────────────────────────────────────────────────────────
  async function handleRedeem(reward: Reward) {
    if (!me) return

    if (me.points_balance < reward.cost_points) {
      await modal.showAlert(
        `Você tem ${formatPoints(me.points_balance)} pts e essa recompensa custa ${formatPoints(reward.cost_points)}. Indique mais amigos pra acumular pontos!`,
        'warning'
      )
      return
    }

    const confirmed = await modal.showConfirm({
      message: `Confirmar resgate de "${reward.title}" por ${formatPoints(reward.cost_points)} pts? Seu saldo passará de ${formatPoints(me.points_balance)} para ${formatPoints(me.points_balance - reward.cost_points)} pts. Essa ação não pode ser desfeita.`,
      confirmLabel: 'Resgatar',
      cancelLabel: 'Cancelar',
    })

    if (!confirmed) return

    setRedeeming(reward.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const res = await fetch('/api/referrals/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reward_id: reward.id }),
      })
      const data = await res.json()

      if (data?.ok) {
        await modal.showAlert(
          `Resgate confirmado! Confira o email pra detalhes. Seu novo saldo é ${formatPoints(data.new_balance)} pts.`,
          'success'
        )
        await refresh()
        setTab('history')
      } else {
        const errMsg = data?.error === 'insufficient_points'
          ? 'Saldo insuficiente — atualizamos seu saldo, tenta de novo'
          : data?.error === 'out_of_stock'
          ? 'Esgotou! Avisa o suporte se for sumiço errado'
          : data?.error === 'reward_not_found'
          ? 'Recompensa indisponível'
          : `Erro: ${data?.error || 'desconhecido'}`
        await modal.showAlert(errMsg, 'error')
      }
    } catch (err: any) {
      console.error('[recompensas] redeem err:', err)
      await modal.showAlert('Erro de conexão. Tenta de novo em alguns segundos.', 'error')
    } finally {
      setRedeeming(null)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div style={S.container}>
        {loading && <div style={S.loading}>Carregando…</div>}

        {!loading && (
          <>
            {/* Header */}
            <header style={S.header}>
              <div>
                <h1 style={S.headerTitle}>Recompensas</h1>
                <p style={S.headerSub}>Troque seus pontos do Indique e Ganhe por benefícios.</p>
              </div>
              <div style={S.balanceCard}>
                <div style={S.balanceLabel}>Seu saldo</div>
                <div style={S.balanceValue}>{formatPoints(me?.points_balance || 0)} <span style={S.balanceUnit}>pts</span></div>
                <Link href="/indique-e-ganhe" style={S.balanceLink}>Indicar mais amigos →</Link>
              </div>
            </header>

            {/* Tabs */}
            <div style={S.tabs}>
              <button
                onClick={() => setTab('catalog')}
                style={{ ...S.tabBtn, ...(tab === 'catalog' ? S.tabActive : {}) }}
              >
                Catálogo
              </button>
              <button
                onClick={() => setTab('history')}
                style={{ ...S.tabBtn, ...(tab === 'history' ? S.tabActive : {}) }}
              >
                Meus resgates ({redemptions.length})
              </button>
            </div>

            {/* Catálogo */}
            {tab === 'catalog' && (
              <div style={S.grid}>
                {rewards.length === 0 && (
                  <div style={S.empty}>Nenhuma recompensa disponível no momento.</div>
                )}
                {rewards.map(r => {
                  const cfg = TYPE_CONFIG[r.reward_type] || TYPE_CONFIG.other
                  const canAfford = (me?.points_balance || 0) >= r.cost_points
                  const outOfStock = r.stock !== null && r.stock <= 0
                  const disabled = outOfStock || !canAfford || redeeming === r.id

                  return (
                    <div key={r.id} style={S.rewardCard}>
                      <div style={{
                        ...S.rewardTypeBadge,
                        background: cfg.color + '22',
                        color: cfg.color,
                        borderColor: cfg.color + '40',
                      }}>
                        {cfg.emoji} {cfg.label}
                      </div>

                      <h3 style={S.rewardTitle}>{r.title}</h3>
                      {r.description && <p style={S.rewardDesc}>{r.description}</p>}

                      <div style={S.rewardCost}>
                        <span style={S.rewardCostValue}>{formatPoints(r.cost_points)}</span>
                        <span style={S.rewardCostUnit}>pts</span>
                      </div>

                      {outOfStock ? (
                        <button disabled style={{ ...S.redeemBtn, opacity: 0.4, cursor: 'not-allowed' }}>
                          Esgotado
                        </button>
                      ) : !canAfford ? (
                        <button disabled style={{ ...S.redeemBtn, opacity: 0.4, cursor: 'not-allowed' }}>
                          Faltam {formatPoints(r.cost_points - (me?.points_balance || 0))} pts
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRedeem(r)}
                          disabled={disabled}
                          style={{ ...S.redeemBtn, ...(disabled ? { opacity: 0.6, cursor: 'wait' } : {}) }}
                        >
                          {redeeming === r.id ? 'Resgatando…' : 'Resgatar →'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Histórico */}
            {tab === 'history' && (
              <div style={S.historyList}>
                {redemptions.length === 0 && (
                  <div style={S.empty}>
                    Você ainda não resgatou nenhuma recompensa.
                    <br />
                    <button onClick={() => setTab('catalog')} style={S.emptyCta}>
                      Ver catálogo →
                    </button>
                  </div>
                )}
                {redemptions.map(r => {
                  const st = STATUS_LABEL[r.status] || STATUS_LABEL.pending
                  const typeCfg = TYPE_CONFIG[r.reward?.reward_type || 'other'] || TYPE_CONFIG.other
                  return (
                    <div key={r.id} style={S.historyRow}>
                      <div style={S.historyLeft}>
                        <div style={S.historyTitle}>{typeCfg.emoji} {r.reward?.title || '(reward removido)'}</div>
                        <div style={S.historyMeta}>
                          {new Date(r.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                          {' · '}
                          ID: {r.id.slice(0, 8)}
                        </div>
                      </div>
                      <div style={S.historyRight}>
                        <div style={S.historyCost}>-{formatPoints(r.cost_points)} pts</div>
                        <div style={{ ...S.historyStatus, color: st.color }}>
                          {r.status === 'fulfilled' && <IconCheck size={12} color={st.color} />}
                          {st.label}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}

// ─── Estilos ───────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  container: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '24px 24px 80px',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    color: '#f0f0f0',
  },
  loading: { padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.4)' },

  // Header
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 28,
    flexWrap: 'wrap',
  },
  headerTitle: { fontSize: 28, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.02em' },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.55)' },

  balanceCard: {
    background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.04))',
    border: '1px solid rgba(245,158,11,0.25)',
    borderRadius: 12,
    padding: '14px 20px',
    minWidth: 220,
    textAlign: 'right',
  },
  balanceLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 },
  balanceValue: {
    fontSize: 26, fontWeight: 800,
    background: BRAND,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    lineHeight: 1, marginBottom: 6,
  },
  balanceUnit: { fontSize: 14 },
  balanceLink: { fontSize: 11, color: '#f59e0b', textDecoration: 'none', fontWeight: 600 },

  // Tabs
  tabs: {
    display: 'flex',
    gap: 8,
    marginBottom: 24,
    borderBottom: `1px solid ${BORDER}`,
  },
  tabBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.5)',
    padding: '10px 18px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: -1,
  },
  tabActive: {
    color: '#f59e0b',
    borderBottomColor: '#f59e0b',
  },

  // Grid
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: 16,
  },
  empty: {
    background: CARD_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 14,
    padding: 40,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    gridColumn: '1 / -1',
  },
  emptyCta: {
    marginTop: 16,
    background: BRAND,
    border: 'none',
    color: '#000',
    padding: '10px 20px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },

  // Reward card
  rewardCard: {
    background: CARD_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 14,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  rewardTypeBadge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid',
    letterSpacing: '0.04em',
  },
  rewardTitle: { fontSize: 17, fontWeight: 700, lineHeight: 1.3 },
  rewardDesc: { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, flex: 1 },
  rewardCost: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  rewardCostValue: {
    fontSize: 22,
    fontWeight: 800,
    background: BRAND,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  rewardCostUnit: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  redeemBtn: {
    background: BRAND,
    border: 'none',
    color: '#000',
    padding: '10px 18px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 8,
  },

  // History
  historyList: {
    background: CARD_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 14,
    overflow: 'hidden',
  },
  historyRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 18px',
    borderBottom: `1px solid ${BORDER}`,
    gap: 12,
  },
  historyLeft: { flex: 1 },
  historyTitle: { fontSize: 14, fontWeight: 600, marginBottom: 2 },
  historyMeta: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  historyRight: { textAlign: 'right' },
  historyCost: { fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 4 },
  historyStatus: {
    fontSize: 11,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-end',
  },
}
