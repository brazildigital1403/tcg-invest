'use client'

import { CSSProperties, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/ui/AppLayout'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Estado = 'loading' | 'nao_logado' | 'sem_lojas' | 'com_lojas'

interface LojaCard {
  id: string
  slug: string
  nome: string
  cidade: string
  estado: string
  tipo: 'fisica' | 'online' | 'ambas'
  plano: 'basico' | 'pro' | 'premium'
  status: 'pendente' | 'ativa' | 'suspensa' | 'inativa'
  verificada: boolean | null
  logo_url: string | null
  fotos: string[] | null
  cliques_30d?: number
}

const TIPO_LABEL: Record<string, string> = {
  fisica: 'Física',
  online: 'Online',
  ambas: 'Física + Online',
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function MinhasLojasHubPage() {
  const router = useRouter()

  const [estado, setEstado] = useState<Estado>('loading')
  const [lojas, setLojas] = useState<LojaCard[]>([])

  useEffect(() => {
    let alive = true

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user

      if (!alive) return

      if (!user) {
        setEstado('nao_logado')
        router.replace('/?next=/minha-loja')
        return
      }

      // Busca todas as lojas do user
      const { data: lojasData, error: lojasErr } = await supabase
        .from('lojas')
        .select('id, slug, nome, cidade, estado, tipo, plano, status, verificada, logo_url, fotos')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false })

      if (!alive) return

      if (lojasErr) {
        console.error('[minha-loja hub] erro ao listar lojas', lojasErr)
        setEstado('sem_lojas')
        return
      }

      const lista = (lojasData || []) as LojaCard[]

      // Onboarding direto: 0 lojas → /minha-loja/nova
      if (lista.length === 0) {
        router.replace('/minha-loja/nova')
        return
      }

      // Busca cliques dos últimos 30 dias por loja (analytics preview)
      const ids = lista.map(l => l.id)
      const desde30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      try {
        const { data: cliquesData } = await supabase
          .from('loja_cliques')
          .select('loja_id')
          .in('loja_id', ids)
          .gte('created_at', desde30d)

        const cliquesPorLoja: Record<string, number> = {}
        ;(cliquesData || []).forEach((row: any) => {
          cliquesPorLoja[row.loja_id] = (cliquesPorLoja[row.loja_id] || 0) + 1
        })

        lista.forEach(loja => {
          loja.cliques_30d = cliquesPorLoja[loja.id] || 0
        })
      } catch {
        // Falha de analytics não bloqueia a listagem
        lista.forEach(loja => { loja.cliques_30d = 0 })
      }

      if (!alive) return
      setLojas(lista)
      setEstado('com_lojas')
    }

    load()
    return () => { alive = false }
  }, [router])

  // ─── Render ──────────────────────────────────────────────────

  if (estado === 'loading' || estado === 'nao_logado' || estado === 'sem_lojas') {
    return (
      <AppLayout>
        <div style={S.loadingWrap}>
          <p style={S.loadingText}>Carregando…</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div style={S.page}>
        {/* ─── Header ───────────────────────────────────── */}
        <header style={S.header}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={S.title}>Minhas Lojas</h1>
            <p style={S.subtitle}>
              {lojas.length === 1
                ? 'Gerencie sua loja no Guia de Lojistas.'
                : `Você administra ${lojas.length} lojas no Guia de Lojistas.`}
            </p>
          </div>
          <Link href="/minha-loja/nova" style={S.btnPrimary}>
            + Nova loja
          </Link>
        </header>

        {/* ─── Grid de cards ─────────────────────────────── */}
        <div style={S.lojasGrid}>
          {lojas.map(loja => (
            <CardLoja key={loja.id} loja={loja} />
          ))}
        </div>

        {/* ─── Dica ───────────────────────────────────── */}
        <div style={S.tipBox}>
          <p style={S.tipText}>
            💡 <strong>Dica:</strong> cada loja tem seu próprio plano. Você pode ter
            uma Premium na cidade principal e outras Básico nas filiais.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}

// ─── Card de Loja ─────────────────────────────────────────────────────────────

function CardLoja({ loja }: { loja: LojaCard }) {
  const cfgStatus = STATUS_CONFIG[loja.status]
  const cfgPlano = PLANO_CONFIG[loja.plano]
  const numFotos = (loja.fotos || []).length
  const cliques = loja.cliques_30d ?? 0

  return (
    <Link href={`/minha-loja/${loja.id}`} style={S.cardLink}>
      <article style={{
        ...S.card,
        borderColor: loja.status === 'suspensa' ? 'rgba(239,68,68,0.25)' :
                     loja.status === 'pendente' ? 'rgba(245,158,11,0.25)' :
                     'rgba(255,255,255,0.08)',
      }}>
        {/* Header: logo + nome + verificada */}
        <div style={S.cardHeader}>
          <div style={S.cardLogoWrap}>
            {loja.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={loja.logo_url} alt={loja.nome} style={S.cardLogo} />
            ) : (
              <div style={S.cardLogoFallback}>
                {loja.nome.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={S.cardNome}>
              {loja.nome}
              {loja.verificada && (
                <span style={S.verificadaBadge} title="Loja verificada">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2l2.4 2.8 3.6-.4.4 3.6L19 10l-2.6 2 .4 3.6-3.6.4L10 19l-2.4-2.8-3.6.4-.4-3.6L1 10l2.6-2L3.2 4.4 6.8 4 10 1z"
                      fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.2" strokeLinejoin="round" />
                    <path d="M6 10l2.5 2.5L14 7" stroke="#0d0f14" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </h3>

            <div style={S.cardMetaLine}>
              <span style={{ ...S.planoBadge, color: cfgPlano.color, background: cfgPlano.badgeBg, border: `1px solid ${cfgPlano.border}` }}>
                {cfgPlano.label}
              </span>
              <span style={S.cardLocation}>
                {loja.cidade}, {loja.estado} · {TIPO_LABEL[loja.tipo]}
              </span>
            </div>
          </div>
        </div>

        {/* Status + métricas */}
        <div style={S.cardStats}>
          <span style={{ ...S.statusBadge, color: cfgStatus.color, background: cfgStatus.badgeBg, border: `1px solid ${cfgStatus.borderColor}` }}>
            {cfgStatus.label}
          </span>
          <span style={S.statSep}>·</span>
          <span style={S.statText}>
            {numFotos} foto{numFotos !== 1 ? 's' : ''}
          </span>
          <span style={S.statSep}>·</span>
          <span style={S.statText}>
            {cliques} clique{cliques !== 1 ? 's' : ''} (30d)
          </span>
        </div>

        {/* Footer: editar */}
        <div style={S.cardFooter}>
          <span style={S.cardEditarLabel}>Editar →</span>
        </div>
      </article>
    </Link>
  )
}

// ─── Configs ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string
  color: string
  badgeBg: string
  borderColor: string
}> = {
  pendente: {
    label: 'Em análise',
    color: '#f59e0b',
    badgeBg: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.3)',
  },
  ativa: {
    label: 'Ativa',
    color: '#22c55e',
    badgeBg: 'rgba(34,197,94,0.15)',
    borderColor: 'rgba(34,197,94,0.3)',
  },
  suspensa: {
    label: 'Suspensa',
    color: '#ef4444',
    badgeBg: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  inativa: {
    label: 'Inativa',
    color: 'rgba(255,255,255,0.55)',
    badgeBg: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
}

const PLANO_CONFIG: Record<string, {
  label: string
  color: string
  badgeBg: string
  border: string
}> = {
  basico: {
    label: 'Básico',
    color: 'rgba(255,255,255,0.7)',
    badgeBg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.1)',
  },
  pro: {
    label: 'Pro',
    color: '#f59e0b',
    badgeBg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.25)',
  },
  premium: {
    label: 'Premium',
    color: '#ef4444',
    badgeBg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.25)',
  },
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1080,
    margin: '0 auto',
    padding: '24px 20px 64px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },

  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    paddingBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    margin: 0,
    letterSpacing: '-0.02em',
    color: '#f0f0f0',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    margin: '6px 0 0',
    lineHeight: 1.5,
  },

  loadingWrap: {
    minHeight: '60vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },

  // Grid de cards
  lojasGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 14,
  },

  cardLink: {
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
  },
  card: {
    background: '#0d0f14',
    border: '1px solid',
    borderRadius: 14,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    transition: 'transform 0.15s ease, border-color 0.15s ease',
    cursor: 'pointer',
  },
  cardHeader: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  cardLogoWrap: {
    width: 52,
    height: 52,
    flexShrink: 0,
    borderRadius: 12,
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  cardLogo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  cardLogoFallback: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    color: '#0d0f14',
    fontSize: 22,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardNome: {
    fontSize: 16,
    fontWeight: 700,
    color: '#f0f0f0',
    margin: 0,
    letterSpacing: '-0.01em',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  verificadaBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardMetaLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  cardLocation: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  // Plano badge
  planoBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 6,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    flexShrink: 0,
  },

  // Status + stats
  cardStats: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 6,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  statSep: {
    color: 'rgba(255,255,255,0.2)',
  },
  statText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },

  cardFooter: {
    paddingTop: 8,
    borderTop: '1px solid rgba(255,255,255,0.05)',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  cardEditarLabel: {
    fontSize: 13,
    color: '#f59e0b',
    fontWeight: 600,
  },

  // Botões
  btnPrimary: {
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    border: 'none',
    color: '#000',
    fontSize: 13,
    fontWeight: 700,
    padding: '11px 20px',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'none',
    display: 'inline-block',
    flexShrink: 0,
    letterSpacing: '-0.01em',
  },

  // Tip
  tipBox: {
    background: 'rgba(245,158,11,0.04)',
    border: '1px solid rgba(245,158,11,0.12)',
    borderRadius: 10,
    padding: '12px 16px',
  },
  tipText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    margin: 0,
    lineHeight: 1.5,
  },
}
