'use client'

/**
 * /ranking — Indique e Ganhe.
 *
 * Página PÚBLICA mostrando top 20 indicadores do mês corrente.
 * Se o user estiver logado, mostra a posição relativa dele (mesmo se fora do top 20).
 *
 * Não exige cadastro pra ver — é parte da estratégia "social proof" do programa.
 *
 * Estrutura:
 *   - Hero com mês corrente + breve explicação dos prêmios
 *   - Cards Top 1, 2, 3 destacados (prêmios em R$)
 *   - Tabela do 4º ao 20º
 *   - Sua posição (se logado e fora do top 20)
 *   - CTA pra cadastrar e participar
 */

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'
import { supabase } from '@/lib/supabaseClient'

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface RankingItem {
  position: number
  user_id: string
  username: string
  qualified_count: number
  prize_awarded?: string | null
}

interface RankingResponse {
  ok: boolean
  year: number
  month: number
  is_historical: boolean
  top: RankingItem[]
  my_position: number | null
  my_qualified_count: number
}

// ─── Constantes visuais ────────────────────────────────────────────────────

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const BG = '#080a0f'
const CARD_BG = '#0f1117'
const BORDER = 'rgba(255,255,255,0.1)'

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

// ─── Helpers ───────────────────────────────────────────────────────────────

function getMedalEmoji(pos: number): string {
  if (pos === 1) return '🥇'
  if (pos === 2) return '🥈'
  if (pos === 3) return '🥉'
  return ''
}

function getPositionColor(pos: number): string {
  if (pos === 1) return '#f59e0b'
  if (pos === 2) return '#94a3b8'
  if (pos === 3) return '#d97706'
  return 'rgba(255,255,255,0.5)'
}

// ─── Componente ────────────────────────────────────────────────────────────

export default function RankingPage() {
  const router = useRouter()
  const [data, setData] = useState<RankingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [logged, setLogged] = useState<boolean | null>(null)

  // Busca ranking + check de auth (paralelo)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (mounted) setLogged(!!token)

        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
        const res = await fetch('/api/referrals/ranking', { headers, cache: 'no-store' })
        const json: RankingResponse = await res.json()
        if (mounted) setData(json)
      } catch (err) {
        console.error('[ranking] erro:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const monthName = data ? `${MONTHS_PT[(data.month - 1) % 12]} de ${data.year}` : '...'
  const top = data?.top || []
  const top3 = top.slice(0, 3)
  const restOfTop = top.slice(3, 20)
  const myPosition = data?.my_position ?? null
  const isInTop20 = myPosition !== null && myPosition <= 20

  return (
    <div style={S.page}>
      <PublicHeader />

      <main style={S.main}>
        {/* Hero */}
        <section style={S.hero}>
          <div style={S.heroBadge}>✨ Indique e Ganhe</div>
          <h1 style={S.heroTitle}>
            Ranking de <span style={S.heroTitleAccent}>{monthName}</span>
          </h1>
          <p style={S.heroSubtitle}>
            Os colecionadores que mais indicaram amigos pro Bynx este mês.
            <br />
            Top 3 ganham <strong style={{ color: '#f59e0b' }}>prêmios em dinheiro</strong> no fim de cada mês.
          </p>

          <div style={S.prizesRow}>
            <div style={S.prizeCard}>
              <div style={{ ...S.prizeMedal, color: '#f59e0b' }}>🥇</div>
              <div style={S.prizeAmount}>R$ 200</div>
              <div style={S.prizeLabel}>Top 1</div>
            </div>
            <div style={S.prizeCard}>
              <div style={{ ...S.prizeMedal, color: '#94a3b8' }}>🥈</div>
              <div style={S.prizeAmount}>R$ 100</div>
              <div style={S.prizeLabel}>Top 2</div>
            </div>
            <div style={S.prizeCard}>
              <div style={{ ...S.prizeMedal, color: '#d97706' }}>🥉</div>
              <div style={S.prizeAmount}>R$ 50</div>
              <div style={S.prizeLabel}>Top 3</div>
            </div>
          </div>
        </section>

        {/* Loading */}
        {loading && (
          <div style={S.loading}>Carregando ranking...</div>
        )}

        {/* Top 3 destacados */}
        {!loading && top3.length > 0 && (
          <section style={S.top3Section}>
            <h2 style={S.sectionTitle}>Pódio do mês</h2>
            <div style={S.top3Grid}>
              {top3.map(item => (
                <div
                  key={item.user_id}
                  style={{
                    ...S.top3Card,
                    borderColor: getPositionColor(item.position),
                    background: item.position === 1
                      ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.04))'
                      : CARD_BG,
                  }}
                >
                  <div style={{ ...S.top3Medal, color: getPositionColor(item.position) }}>
                    {getMedalEmoji(item.position)}
                  </div>
                  <div style={S.top3Position}>#{item.position}</div>
                  <div style={S.top3Username}>{item.username}</div>
                  <div style={S.top3Stat}>
                    <strong>{item.qualified_count}</strong>
                    {' '}
                    indicaç{item.qualified_count === 1 ? 'ão' : 'ões'}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top 4-20 */}
        {!loading && restOfTop.length > 0 && (
          <section style={S.tableSection}>
            <h2 style={S.sectionTitle}>Próximos do top 20</h2>
            <div style={S.tableCard}>
              {restOfTop.map(item => (
                <div
                  key={item.user_id}
                  style={S.tableRow}
                >
                  <div style={S.tablePosition}>#{item.position}</div>
                  <div style={S.tableUsername}>{item.username}</div>
                  <div style={S.tableStat}>
                    {item.qualified_count} indicaç{item.qualified_count === 1 ? 'ão' : 'ões'}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tabela vazia */}
        {!loading && top.length === 0 && (
          <section style={S.emptySection}>
            <div style={S.emptyCard}>
              <div style={S.emptyEmoji}>🌱</div>
              <h3 style={S.emptyTitle}>Ranking ainda vazio este mês</h3>
              <p style={S.emptyText}>
                Ninguém qualificou indicações ainda em {monthName}. Pode ser você o primeiro!
              </p>
              {!logged && (
                <button onClick={() => router.push('/?auth=signup')} style={S.emptyCta}>
                  Começar agora →
                </button>
              )}
            </div>
          </section>
        )}

        {/* Minha posição (logado, fora do top 20) */}
        {!loading && logged && myPosition !== null && !isInTop20 && (
          <section style={S.mySection}>
            <h2 style={S.sectionTitle}>Sua posição</h2>
            <div style={S.myCard}>
              <div style={S.myPosition}>#{myPosition}</div>
              <div style={S.myStat}>
                <strong>{data?.my_qualified_count || 0}</strong> indicaç{(data?.my_qualified_count || 0) === 1 ? 'ão' : 'ões'} qualificada{(data?.my_qualified_count || 0) === 1 ? '' : 's'} em {monthName}
              </div>
              <p style={S.myHint}>
                Continue indicando — quem sabe esse mês não vai pro top 3? 💪
              </p>
              <Link href="/indique-e-ganhe" style={S.myCtaBtn}>
                Ver meu link de indicação →
              </Link>
            </div>
          </section>
        )}

        {/* CTA pra deslogado */}
        {!loading && !logged && (
          <section style={S.ctaSection}>
            <div style={S.ctaCard}>
              <h2 style={S.ctaTitle}>Quer participar do ranking?</h2>
              <p style={S.ctaText}>
                Cadastre-se grátis, ganhe seu link único de indicação e comece a chamar a galera.
                Cada amigo que ativar conta como ponto pro ranking + pontos pra trocar por recompensas.
              </p>
              <div style={S.ctaBtns}>
                <Link href="/?auth=signup" style={S.ctaPrimary}>
                  Começar grátis →
                </Link>
                <Link href="/indique-e-ganhe" style={S.ctaSecondary}>
                  Como funciona
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>

      <PublicFooter />
    </div>
  )
}

// ─── Estilos ───────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  page: {
    background: BG,
    color: '#f0f0f0',
    minHeight: '100vh',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  main: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '40px 24px 80px',
  },

  // Hero
  hero: {
    textAlign: 'center',
    paddingTop: 24,
    paddingBottom: 56,
  },
  heroBadge: {
    display: 'inline-block',
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.3)',
    color: '#f59e0b',
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 20,
    letterSpacing: '0.02em',
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: 800,
    lineHeight: 1.1,
    marginBottom: 16,
    letterSpacing: '-0.03em',
  },
  heroTitleAccent: {
    background: BRAND,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    textTransform: 'capitalize',
  },
  heroSubtitle: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.6,
    maxWidth: 600,
    margin: '0 auto 36px',
  },

  // Prizes
  prizesRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  prizeCard: {
    background: CARD_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    padding: '20px 28px',
    minWidth: 140,
    textAlign: 'center',
  },
  prizeMedal: { fontSize: 32, marginBottom: 4 },
  prizeAmount: {
    fontSize: 22,
    fontWeight: 800,
    background: BRAND,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: 2,
  },
  prizeLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' },

  // Loading
  loading: {
    textAlign: 'center',
    padding: 60,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
  },

  // Section title
  sectionTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 20,
    letterSpacing: '-0.02em',
  },

  // Top 3
  top3Section: { marginBottom: 56 },
  top3Grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 16,
  },
  top3Card: {
    background: CARD_BG,
    border: '2px solid',
    borderRadius: 20,
    padding: 28,
    textAlign: 'center',
    transition: 'transform 0.2s',
  },
  top3Medal: { fontSize: 48, marginBottom: 8 },
  top3Position: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 4 },
  top3Username: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 12,
    wordBreak: 'break-word',
  },
  top3Stat: { fontSize: 15, color: 'rgba(255,255,255,0.7)' },

  // Tabela 4-20
  tableSection: { marginBottom: 48 },
  tableCard: {
    background: CARD_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    overflow: 'hidden',
  },
  tableRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 20px',
    borderBottom: `1px solid ${BORDER}`,
    gap: 16,
  },
  tablePosition: {
    fontSize: 15,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.4)',
    minWidth: 40,
  },
  tableUsername: { flex: 1, fontSize: 15, fontWeight: 600 },
  tableStat: { fontSize: 14, color: 'rgba(255,255,255,0.55)' },

  // Empty
  emptySection: { marginBottom: 48 },
  emptyCard: {
    background: CARD_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 20,
    padding: 56,
    textAlign: 'center',
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 22, fontWeight: 700, marginBottom: 8 },
  emptyText: { fontSize: 15, color: 'rgba(255,255,255,0.55)', marginBottom: 24, lineHeight: 1.6 },
  emptyCta: {
    background: BRAND,
    border: 'none',
    color: '#000',
    padding: '12px 28px',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },

  // My position
  mySection: { marginBottom: 48 },
  myCard: {
    background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(239,68,68,0.03))',
    border: '1px solid rgba(245,158,11,0.25)',
    borderRadius: 20,
    padding: 32,
    textAlign: 'center',
  },
  myPosition: {
    fontSize: 48,
    fontWeight: 800,
    background: BRAND,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: 8,
  },
  myStat: { fontSize: 15, color: 'rgba(255,255,255,0.7)', marginBottom: 16 },
  myHint: { fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 20 },
  myCtaBtn: {
    display: 'inline-block',
    background: BRAND,
    color: '#000',
    padding: '10px 24px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    textDecoration: 'none',
  },

  // CTA
  ctaSection: { marginTop: 64 },
  ctaCard: {
    background: CARD_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 20,
    padding: 40,
    textAlign: 'center',
  },
  ctaTitle: { fontSize: 26, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.02em' },
  ctaText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.7,
    maxWidth: 560,
    margin: '0 auto 28px',
  },
  ctaBtns: { display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' },
  ctaPrimary: {
    background: BRAND,
    color: '#000',
    padding: '14px 28px',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    textDecoration: 'none',
  },
  ctaSecondary: {
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${BORDER}`,
    color: '#f0f0f0',
    padding: '14px 28px',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    textDecoration: 'none',
  },
}
