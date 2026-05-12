'use client'

/**
 * /indique-e-ganhe — Dashboard pessoal do Indique e Ganhe.
 *
 * Autenticada. Se deslogado, redireciona pro signup com next=/indique-e-ganhe.
 *
 * Mostra:
 *   - Saldo de pontos + total ganho
 *   - Ref code + link único + botões de compartilhar (WhatsApp/Twitter/Telegram/Email/Copy)
 *   - Como funciona (3 tiers: Cadastrou, Ativou, Engajado)
 *   - Próxima indicação vale Xpts (escalonamento)
 *   - Stats (counts: cadastrou, ativou, engajado)
 *   - Indicações recentes (últimas 10, com email mascarado)
 *   - Trust suspended alert (se aplicável)
 *   - CTAs pra /recompensas e /ranking
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/ui/AppLayout'
import { useAppModal } from '@/components/ui/useAppModal'
import {
  IconShare, IconCheck, IconWhatsApp,
} from '@/components/ui/Icons'
import {
  formatPoints,
  getNextTierPoints,
  buildShareLink,
  buildShareMessage,
} from '@/lib/referrals'

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface MeData {
  ok: boolean
  referral_code: string
  points_balance: number
  points_earned_total: number
  trust_suspended: boolean
  monthly_position: number | null
  counts: {
    cadastrou: number
    ativou: number
    engajado: number
    total: number
  }
}

interface RecentItem {
  id: string
  status: 'cadastrou' | 'ativou' | 'engajado'
  cadastrou_at: string
  ativou_at: string | null
  engajou_at: string | null
  is_suspicious: boolean
  referred: {
    username: string | null
    email_masked: string
  }
}

// ─── Constantes ────────────────────────────────────────────────────────────

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const CARD_BG = '#0f1117'
const BORDER = 'rgba(255,255,255,0.1)'

const STATUS_CONFIG = {
  cadastrou: { label: 'Cadastrou', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', emoji: '👋' },
  ativou:    { label: 'Ativou',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  emoji: '✅' },
  engajado:  { label: 'Pro',       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', emoji: '🚀' },
}

// ─── Componente ────────────────────────────────────────────────────────────

export default function IndiqueEGanhePage() {
  const router = useRouter()
  const modal = useAppModal()
  const [me, setMe] = useState<MeData | null>(null)
  const [recent, setRecent] = useState<RecentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  // ── Auth + fetch dados ──────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          // Não logado: redireciona pra signup com next
          router.replace('/?auth=signup&next=/indique-e-ganhe')
          return
        }
        const token = session.access_token
        const headers = { Authorization: `Bearer ${token}` }

        const [meRes, recentRes] = await Promise.all([
          fetch('/api/referrals/me', { headers, cache: 'no-store' }),
          fetch('/api/referrals/recent', { headers, cache: 'no-store' }),
        ])

        const meJson = await meRes.json()
        const recentJson = await recentRes.json()

        if (!mounted) return
        if (meJson?.ok) setMe(meJson)
        if (recentJson?.ok && Array.isArray(recentJson.items)) setRecent(recentJson.items)
      } catch (err) {
        console.error('[indique-e-ganhe] fetch err:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [router])

  // ── Compartilhamento ─────────────────────────────────────────────────

  async function copyToClipboard(text: string, kind: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      await modal.showAlert('Não consegui copiar pro clipboard. Cola manualmente: ' + text, 'warning')
    }
  }

  function shareWhatsApp() {
    if (!me?.referral_code) return
    const msg = buildShareMessage(me.referral_code)
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function shareTwitter() {
    if (!me?.referral_code) return
    const msg = buildShareMessage(me.referral_code)
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function shareTelegram() {
    if (!me?.referral_code) return
    const link = buildShareLink(me.referral_code)
    const msg = `Tô usando o Bynx pra organizar minha coleção de Pokémon TCG 🎴`
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(msg)}`, '_blank')
  }

  function shareEmail() {
    if (!me?.referral_code) return
    const msg = buildShareMessage(me.referral_code)
    const subject = 'Você vai gostar do Bynx 🎴'
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`
  }

  // ── Derivados ────────────────────────────────────────────────────────

  const nextTierPts = me ? getNextTierPoints(me.counts.ativou + me.counts.engajado) : 30
  const shareLink = me ? buildShareLink(me.referral_code) : ''

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div style={S.container}>
        {loading && (
          <div style={S.loading}>Carregando…</div>
        )}

        {!loading && me && (
          <>
            {/* Header */}
            <header style={S.header}>
              <div style={S.headerBadge}>✨ Indique e Ganhe</div>
              <h1 style={S.headerTitle}>
                Convide amigos. Ganhe pontos. Troque por recompensas.
              </h1>
              <p style={S.headerSubtitle}>
                Cada amigo que ativar a conta dá pontos pra você. Quem virar Pro, dá ainda mais. Os Top 3 do mês ganham prêmios em dinheiro.
              </p>
            </header>

            {/* Trust alert */}
            {me.trust_suspended && (
              <div style={S.trustAlert}>
                <strong>⚠️ Indicações pausadas:</strong> detectamos um padrão suspeito nas suas indicações.
                Entre em contato com o suporte pra revisar.
                {' '}
                <Link href="/suporte" style={S.trustAlertLink}>Abrir ticket →</Link>
              </div>
            )}

            {/* Saldo + próximo tier */}
            <section style={S.balanceSection}>
              <div style={S.balanceCard}>
                <div style={S.balanceLabel}>Saldo atual</div>
                <div style={S.balanceValue}>{formatPoints(me.points_balance)} <span style={S.balanceUnit}>pts</span></div>
                <div style={S.balanceFooter}>
                  Total ganho: <strong>{formatPoints(me.points_earned_total)} pts</strong>
                  {me.monthly_position && (
                    <>
                      {' · '}
                      Posição no mês: <strong style={{ color: '#f59e0b' }}>#{me.monthly_position}</strong>
                    </>
                  )}
                </div>
              </div>

              <div style={S.nextTierCard}>
                <div style={S.nextTierLabel}>Sua próxima indicação ativa vale</div>
                <div style={S.nextTierValue}>+{nextTierPts} pts</div>
                <div style={S.nextTierHint}>
                  Pontos escalonam: 30 → 50 → 70 → 100 (a partir da 4ª)
                </div>
              </div>
            </section>

            {/* Ref code + link + share */}
            <section style={S.shareSection}>
              <h2 style={S.sectionTitle}>Seu link único</h2>

              <div style={S.refCodeRow}>
                <div style={S.refCodeBox}>
                  <div style={S.refCodeLabel}>Código</div>
                  <div style={S.refCodeValue}>{me.referral_code}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(me.referral_code, 'code')}
                  style={S.copyBtn}
                >
                  {copied === 'code' ? <><IconCheck size={16} color="#22c55e" /> Copiado</> : 'Copiar código'}
                </button>
              </div>

              <div style={S.linkRow}>
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  style={S.linkInput}
                />
                <button
                  onClick={() => copyToClipboard(shareLink, 'link')}
                  style={S.copyBtnPrimary}
                >
                  {copied === 'link' ? <><IconCheck size={16} color="#000" /> Copiado</> : 'Copiar link'}
                </button>
              </div>

              <div style={S.shareBtns}>
                <button onClick={shareWhatsApp} style={{ ...S.shareBtn, background: 'rgba(37,211,102,0.12)', borderColor: 'rgba(37,211,102,0.3)', color: '#25D366' }}>
                  <IconWhatsApp size={18} color="#25D366" /> WhatsApp
                </button>
                <button onClick={shareTwitter} style={S.shareBtn}>
                  <IconShare size={18} /> Twitter/X
                </button>
                <button onClick={shareTelegram} style={S.shareBtn}>
                  <IconShare size={18} /> Telegram
                </button>
                <button onClick={shareEmail} style={S.shareBtn}>
                  <IconShare size={18} /> E-mail
                </button>
              </div>
            </section>

            {/* Stats */}
            <section style={S.statsSection}>
              <h2 style={S.sectionTitle}>Suas indicações</h2>
              <div style={S.statsGrid}>
                <div style={S.statCard}>
                  <div style={{ ...S.statValue, color: '#94a3b8' }}>{me.counts.cadastrou}</div>
                  <div style={S.statLabel}>Cadastraram</div>
                  <div style={S.statHint}>Aguardando ativar</div>
                </div>
                <div style={S.statCard}>
                  <div style={{ ...S.statValue, color: '#22c55e' }}>{me.counts.ativou}</div>
                  <div style={S.statLabel}>Ativaram</div>
                  <div style={S.statHint}>+30 a +100 pts cada</div>
                </div>
                <div style={S.statCard}>
                  <div style={{ ...S.statValue, color: '#f59e0b' }}>{me.counts.engajado}</div>
                  <div style={S.statLabel}>Viraram Pro</div>
                  <div style={S.statHint}>+200 pts cada</div>
                </div>
                <div style={S.statCard}>
                  <div style={S.statValue}>{me.counts.total}</div>
                  <div style={S.statLabel}>Total</div>
                  <div style={S.statHint}>Histórico completo</div>
                </div>
              </div>
            </section>

            {/* Como funciona */}
            <section style={S.howSection}>
              <h2 style={S.sectionTitle}>Como funciona</h2>
              <div style={S.howGrid}>
                <div style={S.howStep}>
                  <div style={{ ...S.howStepBadge, background: 'rgba(148,163,184,0.15)', color: '#94a3b8' }}>1</div>
                  <h3 style={S.howStepTitle}>Compartilhe seu link</h3>
                  <p style={S.howStepText}>
                    Mande pra galera por WhatsApp, Twitter, ou Instagram. Cada cadastro com seu link conta como uma indicação.
                  </p>
                </div>
                <div style={S.howStep}>
                  <div style={{ ...S.howStepBadge, background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>2</div>
                  <h3 style={S.howStepTitle}>Ele ATIVA → você ganha pontos</h3>
                  <p style={S.howStepText}>
                    Quando seu amigo confirmar o email e adicionar 5 cartas (após 7 dias), você ganha de 30 a 100 pts.
                  </p>
                </div>
                <div style={S.howStep}>
                  <div style={{ ...S.howStepBadge, background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>3</div>
                  <h3 style={S.howStepTitle}>Ele vira PRO → bônus de 200 pts</h3>
                  <p style={S.howStepText}>
                    Se ele assinar o Bynx Pro, você ganha mais +200 pts e ele entra no seu histórico de engajados.
                  </p>
                </div>
              </div>
            </section>

            {/* Recent */}
            {recent.length > 0 && (
              <section style={S.recentSection}>
                <h2 style={S.sectionTitle}>Indicações recentes</h2>
                <div style={S.recentList}>
                  {recent.map(item => {
                    const cfg = STATUS_CONFIG[item.status]
                    return (
                      <div key={item.id} style={S.recentRow}>
                        <div style={S.recentLeft}>
                          <div style={S.recentName}>
                            {item.referred.username || item.referred.email_masked}
                          </div>
                          <div style={S.recentMeta}>
                            Cadastrado em {new Date(item.cadastrou_at).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                        <div style={{
                          ...S.recentBadge,
                          background: cfg.bg,
                          color: cfg.color,
                          borderColor: cfg.color + '40',
                        }}>
                          {cfg.emoji} {cfg.label}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* CTAs finais */}
            <section style={S.ctaSection}>
              <Link href="/recompensas" style={S.ctaLeft}>
                <div style={S.ctaIcon}>🎁</div>
                <div>
                  <div style={S.ctaTitle}>Trocar pontos por recompensas</div>
                  <div style={S.ctaSub}>Pro, scans IA, separadores e mais</div>
                </div>
              </Link>
              <Link href="/ranking" style={S.ctaRight}>
                <div style={S.ctaIcon}>🏆</div>
                <div>
                  <div style={S.ctaTitle}>Ver ranking do mês</div>
                  <div style={S.ctaSub}>Top 3 ganham prêmios em dinheiro</div>
                </div>
              </Link>
            </section>
          </>
        )}
      </div>
    </AppLayout>
  )
}

// ─── Estilos ───────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  container: {
    maxWidth: 1000,
    margin: '0 auto',
    padding: '24px 24px 80px',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    color: '#f0f0f0',
  },

  loading: { padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.4)' },

  // Header
  header: { textAlign: 'center', marginBottom: 36 },
  headerBadge: {
    display: 'inline-block',
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.3)',
    color: '#f59e0b',
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
  },
  headerTitle: { fontSize: 32, fontWeight: 800, lineHeight: 1.2, marginBottom: 12, letterSpacing: '-0.02em' },
  headerSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, maxWidth: 640, margin: '0 auto' },

  // Trust alert
  trustAlert: {
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.3)',
    borderRadius: 12,
    padding: '14px 18px',
    fontSize: 14,
    color: '#fbbf24',
    marginBottom: 28,
    lineHeight: 1.5,
  },
  trustAlertLink: { color: '#f59e0b', fontWeight: 700, textDecoration: 'none' },

  // Balance
  balanceSection: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
    marginBottom: 32,
  },
  balanceCard: {
    background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.04))',
    border: '1px solid rgba(245,158,11,0.25)',
    borderRadius: 16,
    padding: 24,
  },
  balanceLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 },
  balanceValue: {
    fontSize: 40,
    fontWeight: 800,
    background: BRAND,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    lineHeight: 1,
    marginBottom: 12,
  },
  balanceUnit: { fontSize: 20 },
  balanceFooter: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },

  nextTierCard: {
    background: CARD_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    padding: 24,
  },
  nextTierLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 },
  nextTierValue: { fontSize: 36, fontWeight: 800, color: '#22c55e', lineHeight: 1, marginBottom: 12 },
  nextTierHint: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 },

  // Section title
  sectionTitle: { fontSize: 18, fontWeight: 700, marginBottom: 14, letterSpacing: '-0.01em' },

  // Share
  shareSection: {
    background: CARD_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
  },
  refCodeRow: { display: 'flex', gap: 10, marginBottom: 12, alignItems: 'stretch' },
  refCodeBox: {
    flex: 1,
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    padding: '10px 14px',
  },
  refCodeLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 },
  refCodeValue: { fontSize: 20, fontWeight: 700, letterSpacing: '0.1em', fontFamily: "'SF Mono', Monaco, monospace" },
  copyBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${BORDER}`,
    color: '#f0f0f0',
    padding: '10px 16px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  copyBtnPrimary: {
    background: BRAND,
    border: 'none',
    color: '#000',
    padding: '10px 16px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  linkRow: { display: 'flex', gap: 10, marginBottom: 16 },
  linkInput: {
    flex: 1,
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    color: '#f0f0f0',
    outline: 'none',
    fontFamily: "'SF Mono', Monaco, monospace",
  },
  shareBtns: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  shareBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${BORDER}`,
    color: 'rgba(255,255,255,0.85)',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },

  // Stats
  statsSection: { marginBottom: 32 },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
  },
  statCard: {
    background: CARD_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    padding: 18,
    textAlign: 'center',
  },
  statValue: { fontSize: 32, fontWeight: 800, lineHeight: 1, marginBottom: 6 },
  statLabel: { fontSize: 13, fontWeight: 600, marginBottom: 2 },
  statHint: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },

  // How
  howSection: { marginBottom: 32 },
  howGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12,
  },
  howStep: {
    background: CARD_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    padding: 20,
  },
  howStepBadge: {
    width: 36, height: 36, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 17, marginBottom: 12,
  },
  howStepTitle: { fontSize: 15, fontWeight: 700, marginBottom: 6 },
  howStepText: { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 },

  // Recent
  recentSection: { marginBottom: 32 },
  recentList: {
    background: CARD_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    overflow: 'hidden',
  },
  recentRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 18px',
    borderBottom: `1px solid ${BORDER}`,
    gap: 12,
  },
  recentLeft: { flex: 1 },
  recentName: { fontSize: 14, fontWeight: 600, marginBottom: 2 },
  recentMeta: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  recentBadge: {
    fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
    border: '1px solid', whiteSpace: 'nowrap',
  },

  // CTAs
  ctaSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 12,
    marginTop: 8,
  },
  ctaLeft: {
    background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.04))',
    border: '1px solid rgba(245,158,11,0.25)',
    borderRadius: 14,
    padding: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    textDecoration: 'none',
    color: '#f0f0f0',
  },
  ctaRight: {
    background: CARD_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 14,
    padding: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    textDecoration: 'none',
    color: '#f0f0f0',
  },
  ctaIcon: { fontSize: 32, lineHeight: 1 },
  ctaTitle: { fontSize: 15, fontWeight: 700, marginBottom: 2 },
  ctaSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
}
