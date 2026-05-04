'use client'

import { CSSProperties, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/ui/AppLayout'
import { useAppModal } from '@/components/ui/useAppModal'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Loja = {
  id: string
  slug: string
  nome: string
  plano: 'basico' | 'pro' | 'premium'
  plano_expira_em: string | null
  trial_usado_em: string | null
  stripe_subscription_id: string | null
  owner_user_id: string
}

type Periodicidade = 'mensal' | 'anual'

// ─── Configuração dos planos (espelha o admin/PLANO_INFO + valores do print) ─

const PLANS = {
  pro: {
    label: 'Pro',
    color: '#60a5fa', // azul (consistente com admin email)
    gradient: 'linear-gradient(135deg, #60a5fa, #a855f7)',
    border: 'rgba(96,165,250,0.4)',
    bg: 'rgba(96,165,250,0.06)',
    tagline: 'Pra quem quer ser levado a sério.',
    precoMensal: 39,
    precoAnual: 390,
    features: [
      'Até **5 fotos** da sua loja',
      'Instagram, Facebook e website',
      'Especialidades ilimitadas',
      'Descrição sem limite de caracteres',
      'Badge **Pro** no card',
      'Aparece acima das lojas Básico',
    ],
    recomendado: true,
  },
  premium: {
    label: 'Premium',
    color: '#a855f7', // roxo
    gradient: 'linear-gradient(135deg, #a855f7, #ec4899)',
    border: 'rgba(168,85,247,0.4)',
    bg: 'rgba(168,85,247,0.06)',
    tagline: 'Pra quem quer ser o topo.',
    precoMensal: 89,
    precoAnual: 890,
    features: [
      'Até **10 fotos** da sua loja',
      '**Eventos e torneios** ilimitados',
      '**Card 1.5x maior** e borda destacada',
      'Preview de fotos e evento no card',
      '**Rotação no topo** da listagem',
      'Analytics: views e cliques no WhatsApp',
      'SEO customizável por loja',
    ],
    recomendado: false,
  },
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function PlanoLojaPage() {
  const params = useParams<{ lojaId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const lojaId = params.lojaId
  const { showAlert } = useAppModal()

  const [loja, setLoja] = useState<Loja | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>('anual')
  const [busy, setBusy] = useState<string | null>(null)

  // Indicador "?cancelado=1" vindo do Stripe (cancel_url)
  const cancelado = searchParams.get('cancelado') === '1'

  // ─── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true

    async function load() {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user

      if (!alive) return

      if (!user) {
        router.replace(`/?next=/minha-loja/${lojaId}/plano`)
        return
      }

      const { data: lojaData, error: lojaErr } = await supabase
        .from('lojas')
        .select('id, slug, nome, plano, plano_expira_em, trial_usado_em, stripe_subscription_id, owner_user_id')
        .eq('id', lojaId)
        .limit(1)

      if (!alive) return

      if (lojaErr || !lojaData?.[0]) {
        setErro('Loja não encontrada.')
        setLoading(false)
        return
      }

      const lj = lojaData[0] as Loja

      // Owner check (frontend; backend valida via RLS/checkout)
      if (lj.owner_user_id !== user.id) {
        setErro('Você não tem permissão pra gerenciar esta loja.')
        setLoading(false)
        return
      }

      setLoja(lj)
      setLoading(false)
    }

    load()
    return () => { alive = false }
  }, [lojaId, router])

  // ─── Ações ────────────────────────────────────────────────────────────────

  async function iniciarCheckout(tier: 'pro' | 'premium') {
    if (!loja) return
    const planoMeta = `lojista_${tier}_${periodicidade}`
    setBusy(tier)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        await showAlert('Faça login para continuar.', 'error')
        setBusy(null)
        return
      }

      // S29: pega session pra Bearer token. userId/email não vão mais no body.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        await showAlert('Sessão expirada. Faça login novamente.', 'error')
        setBusy(null)
        return
      }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          plano: planoMeta,
          lojaId: loja.id,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.url) {
        await showAlert(data.error || 'Erro ao iniciar checkout. Tente novamente.', 'error')
        setBusy(null)
        return
      }

      window.location.href = data.url
    } catch (err: any) {
      console.error('[plano loja] erro checkout', err)
      await showAlert('Erro ao iniciar checkout. Tente novamente.', 'error')
      setBusy(null)
    }
  }

  async function abrirPortal() {
    if (!loja) return
    setBusy('portal')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        await showAlert('Faça login para continuar.', 'error')
        setBusy(null)
        return
      }

      // S29: Bearer token. userId do body é mantido como fallback (a API
      // valida que Bearer === body.userId pra prevenir impersonation).
      const { data: { session: portalSession } } = await supabase.auth.getSession()
      if (!portalSession?.access_token) {
        await showAlert('Sessão expirada. Faça login novamente.', 'error')
        setBusy(null)
        return
      }

      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${portalSession.access_token}`,
        },
        body: JSON.stringify({
          lojaId: loja.id,
          returnUrl: `${window.location.origin}/minha-loja/${loja.id}/plano`,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.url) {
        await showAlert(data.error || 'Erro ao abrir portal de gerenciamento.', 'error')
        setBusy(null)
        return
      }

      window.location.href = data.url
    } catch (err: any) {
      console.error('[plano loja] erro portal', err)
      await showAlert('Erro ao abrir portal de gerenciamento.', 'error')
      setBusy(null)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <div style={S.loadingWrap}>
          <p style={S.loadingText}>Carregando…</p>
        </div>
      </AppLayout>
    )
  }

  if (erro || !loja) {
    return (
      <AppLayout>
        <div style={S.errorWrap}>
          <h2 style={S.errorTitle}>Ops</h2>
          <p style={S.errorText}>{erro || 'Loja não encontrada.'}</p>
          <Link href="/minha-loja" style={S.btnSecondary}>← Voltar</Link>
        </div>
      </AppLayout>
    )
  }

  const temAssinaturaAtiva = !!loja.stripe_subscription_id && loja.plano !== 'basico'
  const podeUsarTrial = !loja.trial_usado_em

  return (
    <AppLayout>
      <div style={S.page}>
        {/* ── Breadcrumb ──────────────────────────── */}
        <Link href={`/minha-loja/${loja.id}`} style={S.breadcrumb}>
          ← Voltar para {loja.nome}
        </Link>

        {/* ── Hero ────────────────────────────────── */}
        <header style={S.hero}>
          <h1 style={S.title}>Escolha o plano da {loja.nome}</h1>
          <p style={S.subtitle}>
            Plano atual:{' '}
            <strong style={{ color: '#f0f0f0' }}>
              {loja.plano === 'basico' ? 'Básico (grátis)' :
               loja.plano === 'pro'    ? 'Pro' : 'Premium'}
            </strong>
            {loja.plano_expira_em && (
              <> · expira em <strong style={{ color: '#f0f0f0' }}>{fmtDate(loja.plano_expira_em)}</strong></>
            )}
          </p>
        </header>

        {/* ── Banner cancelado ────────────────────── */}
        {cancelado && (
          <div style={S.cancelBanner}>
            <p style={S.cancelText}>
              ⓘ Você cancelou o checkout. Quando estiver pronta(o), é só clicar em
              "Começar 14 dias grátis" novamente.
            </p>
          </div>
        )}

        {/* ── Banner assinatura ativa ─────────────── */}
        {temAssinaturaAtiva && (
          <div style={S.activeBanner}>
            <div>
              <p style={S.activeTitle}>✓ Assinatura ativa</p>
              <p style={S.activeText}>
                Sua loja está no plano <strong style={{ color: '#f0f0f0' }}>{loja.plano === 'pro' ? 'Pro' : 'Premium'}</strong>.
                Pra trocar de plano, atualizar dados de cobrança ou cancelar, use o portal de gerenciamento.
              </p>
            </div>
            <button
              onClick={abrirPortal}
              disabled={busy === 'portal'}
              style={S.btnPortal}
            >
              {busy === 'portal' ? 'Abrindo...' : 'Gerenciar assinatura'}
            </button>
          </div>
        )}

        {/* ── Toggle periodicidade ────────────────── */}
        <div style={S.toggleWrap}>
          <button
            onClick={() => setPeriodicidade('mensal')}
            style={{
              ...S.toggleBtn,
              ...(periodicidade === 'mensal' ? S.toggleBtnActive : {}),
            }}
          >
            Mensal
          </button>
          <button
            onClick={() => setPeriodicidade('anual')}
            style={{
              ...S.toggleBtn,
              ...(periodicidade === 'anual' ? S.toggleBtnActive : {}),
            }}
          >
            Anual
            <span style={S.economiaBadge}>-2 meses</span>
          </button>
        </div>

        {/* ── Cards dos planos ────────────────────── */}
        <div style={S.cardsGrid}>
          {(['pro', 'premium'] as const).map(tier => {
            const cfg = PLANS[tier]
            const preco = periodicidade === 'mensal' ? cfg.precoMensal : cfg.precoAnual
            const precoUnitario = periodicidade === 'anual' ? cfg.precoAnual / 12 : cfg.precoMensal

            const isCurrent = loja.plano === tier && temAssinaturaAtiva
            const isProcessing = busy === tier

            return (
              <div
                key={tier}
                style={{
                  ...S.card,
                  border: `1px solid ${cfg.border}`,
                  background: cfg.bg,
                  ...(cfg.recomendado ? { boxShadow: `0 0 0 1px ${cfg.border}, 0 12px 32px rgba(96,165,250,0.08)` } : {}),
                }}
              >
                {cfg.recomendado && (
                  <div style={{ ...S.recomendadoTag, background: cfg.gradient }}>
                    RECOMENDADO
                  </div>
                )}

                <h2 style={{ ...S.planLabel, color: cfg.color }}>{cfg.label}</h2>
                <p style={S.planTagline}>{cfg.tagline}</p>

                <div style={S.divider} />

                <div style={S.precoBox}>
                  <p style={S.precoValor}>
                    {fmtBRL(preco)}
                    <span style={S.precoUnit}>
                      {periodicidade === 'mensal' ? '/mês' : '/ano'}
                    </span>
                  </p>
                  {periodicidade === 'anual' && (
                    <p style={S.precoEquivalencia}>
                      equivale a {fmtBRL(precoUnitario)}/mês · economize 2 meses
                    </p>
                  )}
                </div>

                <div style={S.divider} />

                <p style={S.featuresTitle}>
                  {tier === 'pro' ? 'TUDO DO BÁSICO, E MAIS:' : 'TUDO DO PRO, E MAIS:'}
                </p>

                <ul style={S.featuresList}>
                  {cfg.features.map((feat, i) => (
                    <li key={i} style={S.featureItem}>
                      <span style={{ ...S.featureCheck, color: cfg.color }}>✓</span>
                      <span dangerouslySetInnerHTML={{ __html: feat.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#f0f0f0">$1</strong>') }} />
                    </li>
                  ))}
                </ul>

                <div style={{ flex: 1 }} />

                {/* CTA */}
                {isCurrent ? (
                  <div style={S.ctaCurrent}>
                    ✓ Plano atual
                  </div>
                ) : (
                  <button
                    onClick={() => iniciarCheckout(tier)}
                    disabled={!!busy}
                    style={{
                      ...S.cta,
                      background: cfg.gradient,
                      opacity: busy ? 0.6 : 1,
                      cursor: busy ? 'wait' : 'pointer',
                    }}
                  >
                    {isProcessing
                      ? 'Aguarde...'
                      : podeUsarTrial
                        ? 'Começar 14 dias grátis'
                        : `Assinar ${cfg.label}`}
                  </button>
                )}

                {!isCurrent && podeUsarTrial && (
                  <p style={S.ctaSub}>
                    Sem compromisso · cancele quando quiser
                  </p>
                )}
                {!isCurrent && !podeUsarTrial && (
                  <p style={S.ctaSub}>
                    Trial já utilizado · cobrança imediata
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* ── FAQ rápido ──────────────────────────── */}
        <div style={S.faqBox}>
          <p style={S.faqTitle}>Perguntas frequentes</p>
          <div style={S.faqItem}>
            <p style={S.faqQ}>Posso cancelar a qualquer momento?</p>
            <p style={S.faqA}>
              Sim. Você mantém acesso até o fim do ciclo já pago. Não tem multa nem fidelidade.
            </p>
          </div>
          <div style={S.faqItem}>
            <p style={S.faqQ}>O que acontece quando o trial de 14 dias acaba?</p>
            <p style={S.faqA}>
              Cobramos o primeiro mês/ano automaticamente no cartão cadastrado.
              Se você cancelar antes, não cobramos nada.
            </p>
          </div>
          <div style={S.faqItem}>
            <p style={S.faqQ}>Posso trocar de Pro pra Premium depois?</p>
            <p style={S.faqA}>
              Pode. É só usar o "Gerenciar assinatura" — Stripe ajusta o valor automaticamente.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1080,
    margin: '0 auto',
    padding: '20px 20px 64px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },

  breadcrumb: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textDecoration: 'none',
    alignSelf: 'flex-start',
  },

  hero: {
    textAlign: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: 800,
    margin: 0,
    letterSpacing: '-0.025em',
    color: '#f0f0f0',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    margin: '8px 0 0',
    lineHeight: 1.6,
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

  errorWrap: {
    minHeight: '60vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: '40px 20px',
    textAlign: 'center',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  errorTitle: {
    fontSize: 20,
    color: '#f0f0f0',
    margin: 0,
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    margin: 0,
  },

  cancelBanner: {
    background: 'rgba(96,165,250,0.06)',
    border: '1px solid rgba(96,165,250,0.2)',
    borderRadius: 12,
    padding: '12px 16px',
  },
  cancelText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    margin: 0,
    lineHeight: 1.5,
  },

  activeBanner: {
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.25)',
    borderRadius: 12,
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    flexWrap: 'wrap',
  },
  activeTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#22c55e',
    margin: '0 0 4px',
  },
  activeText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    margin: 0,
    lineHeight: 1.5,
  },
  btnPortal: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#f0f0f0',
    padding: '9px 18px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
  },

  toggleWrap: {
    display: 'flex',
    justifyContent: 'center',
    gap: 6,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 4,
    width: 'fit-content',
    margin: '0 auto',
  },
  toggleBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.6)',
    padding: '8px 18px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  toggleBtnActive: {
    background: 'rgba(255,255,255,0.08)',
    color: '#f0f0f0',
  },
  economiaBadge: {
    fontSize: 10,
    fontWeight: 800,
    background: 'linear-gradient(135deg, #22c55e, #10b981)',
    color: '#000',
    padding: '2px 7px',
    borderRadius: 100,
    letterSpacing: '0.04em',
  },

  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
    alignItems: 'stretch',
    marginTop: 8,
  },
  card: {
    background: '#0d0f14',
    borderRadius: 18,
    padding: '28px 26px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    position: 'relative',
    minHeight: 580,
  },
  recomendadoTag: {
    position: 'absolute',
    top: -11,
    left: 24,
    color: '#fff',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.08em',
    padding: '5px 12px',
    borderRadius: 100,
  },
  planLabel: {
    fontSize: 28,
    fontWeight: 800,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  planTagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    margin: 0,
    lineHeight: 1.5,
  },
  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.08)',
    margin: '6px 0',
  },
  precoBox: {
    margin: '4px 0',
  },
  precoValor: {
    fontSize: 36,
    fontWeight: 800,
    color: '#f0f0f0',
    margin: 0,
    letterSpacing: '-0.025em',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
  },
  precoUnit: {
    fontSize: 14,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.5)',
  },
  precoEquivalencia: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    margin: '8px 0 0',
  },
  featuresTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#60a5fa',
    letterSpacing: '0.08em',
    margin: '4px 0 0',
  },
  featuresList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  featureItem: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 9,
    lineHeight: 1.5,
  },
  featureCheck: {
    fontSize: 14,
    fontWeight: 800,
    flexShrink: 0,
    marginTop: 1,
  },
  cta: {
    border: 'none',
    color: '#fff',
    fontSize: 14,
    fontWeight: 800,
    padding: '14px 24px',
    borderRadius: 12,
    fontFamily: 'inherit',
    letterSpacing: '-0.01em',
  },
  ctaCurrent: {
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: '#22c55e',
    fontSize: 14,
    fontWeight: 700,
    padding: '14px 24px',
    borderRadius: 12,
    textAlign: 'center',
  },
  ctaSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    margin: '8px 0 0',
    textAlign: 'center',
  },

  faqBox: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: '20px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    marginTop: 8,
  },
  faqTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    margin: 0,
  },
  faqItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  faqQ: {
    fontSize: 13,
    fontWeight: 700,
    color: '#f0f0f0',
    margin: 0,
  },
  faqA: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    margin: 0,
    lineHeight: 1.6,
  },

  btnSecondary: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.8)',
    padding: '10px 18px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
    fontFamily: 'inherit',
  },
}
