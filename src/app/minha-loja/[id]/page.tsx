'use client'

import { CSSProperties, useEffect, useState, use as usePromise } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/ui/AppLayout'
import FormLoja, { LojaFormData } from '@/components/lojas/FormLoja'
import { useAppModal } from '@/components/ui/useAppModal'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Estado = 'loading' | 'nao_logado' | 'nao_encontrada' | 'sem_permissao' | 'pronto'

interface LojaFull extends LojaFormData {
  id: string
  slug: string
  plano: 'basico' | 'pro' | 'premium'
  status: 'pendente' | 'ativa' | 'suspensa' | 'inativa'
  verificada: boolean | null
  suspensao_motivo: string | null
  motivo_suspensao: string | null
  plano_expira_em: string | null
  owner_user_id: string
  created_at: string
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function MinhaLojaEditarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: lojaId } = usePromise(params)
  const router = useRouter()
  const { showConfirm, showAlert } = useAppModal()

  const [estado, setEstado] = useState<Estado>('loading')
  const [userId, setUserId] = useState<string | null>(null)
  const [loja, setLoja] = useState<LojaFull | null>(null)
  const [editando, setEditando] = useState(false)

  // ─── Load user + loja ────────────────────────────────────────
  useEffect(() => {
    let alive = true

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user

      if (!alive) return

      if (!user) {
        setEstado('nao_logado')
        router.replace(`/?next=/minha-loja/${lojaId}`)
        return
      }

      setUserId(user.id)

      const { data, error } = await supabase
        .from('lojas')
        .select('*')
        .eq('id', lojaId)
        .limit(1)

      if (!alive) return

      if (error || !data || data.length === 0) {
        setEstado('nao_encontrada')
        return
      }

      const lojaData = data[0] as LojaFull

      // Verifica ownership
      if (lojaData.owner_user_id !== user.id) {
        setEstado('sem_permissao')
        return
      }

      setLoja(lojaData)
      setEstado('pronto')
    }

    load()
    return () => { alive = false }
  }, [router, lojaId])

  // ─── Handlers ────────────────────────────────────────────────

  function onLojaSalva(nova: LojaFormData) {
    setLoja(prev => ({ ...(prev || {}), ...nova } as LojaFull))
    setEditando(false)
  }

  async function desativarLoja() {
    if (!loja) return
    const ok = await showConfirm({
      message: 'Sua loja ficará oculta do Guia e dos mecanismos de busca. Você pode reativar a qualquer momento. Confirma?',
      confirmLabel: 'Desativar',
      cancelLabel: 'Cancelar',
      danger: true,
    })
    if (!ok) return

    const { error } = await supabase
      .from('lojas')
      .update({ status: 'inativa' })
      .eq('id', loja.id)
      .eq('owner_user_id', userId!)

    if (error) {
      showAlert('Erro ao desativar. Tente novamente.', 'error')
      return
    }
    setLoja({ ...loja, status: 'inativa' })
    showAlert('Loja desativada. Ela não aparece mais no Guia.', 'info')
  }

  async function reativarLoja() {
    if (!loja) return
    const { error } = await supabase
      .from('lojas')
      .update({ status: 'pendente' })
      .eq('id', loja.id)
      .eq('owner_user_id', userId!)

    if (error) {
      showAlert('Erro ao reativar. Tente novamente.', 'error')
      return
    }
    setLoja({ ...loja, status: 'pendente' })
    showAlert('Loja enviada para nova análise. Avisaremos por email quando aprovada.', 'success')
  }

  // ─── Render ──────────────────────────────────────────────────

  if (estado === 'loading' || estado === 'nao_logado') {
    return (
      <AppLayout>
        <div style={S.loadingWrap}>
          <p style={S.loadingText}>Carregando…</p>
        </div>
      </AppLayout>
    )
  }

  if (estado === 'nao_encontrada') {
    return (
      <AppLayout>
        <div style={S.errorWrap}>
          <h2 style={S.errorTitle}>Loja não encontrada</h2>
          <p style={S.errorText}>
            A loja que você está tentando acessar não existe ou foi removida.
          </p>
          <Link href="/minha-loja" style={S.btnPrimary}>← Voltar para Minhas Lojas</Link>
        </div>
      </AppLayout>
    )
  }

  if (estado === 'sem_permissao') {
    return (
      <AppLayout>
        <div style={S.errorWrap}>
          <h2 style={S.errorTitle}>Acesso negado</h2>
          <p style={S.errorText}>
            Você não tem permissão para editar essa loja. Apenas o dono pode acessá-la.
          </p>
          <Link href="/minha-loja" style={S.btnPrimary}>← Voltar para Minhas Lojas</Link>
        </div>
      </AppLayout>
    )
  }

  if (!loja) return null

  return (
    <AppLayout>
      <div style={S.page}>
        {/* ─── Breadcrumb ──────────────────────────────── */}
        <Link href="/minha-loja" style={S.breadcrumb}>
          ← Minhas Lojas
        </Link>

        {/* ─── Header ───────────────────────────────────── */}
        <header style={S.header}>
          <h1 style={S.title}>{loja.nome}</h1>
          <p style={S.subtitle}>
            Gerencie os dados, o plano e as fotos desta loja.
          </p>
        </header>

        {/* ─── Status + Plano ───────────────────────────── */}
        <StatusCard loja={loja} onDesativar={desativarLoja} onReativar={reativarLoja} />
        <PlanoCard loja={loja} />

        {/* ─── Form ou Resumo ──────────────────────────── */}
        {editando ? (
          <>
            <div style={S.editHeader}>
              <h2 style={S.sectionTitle}>Editar dados da loja</h2>
              <button
                type="button"
                onClick={() => setEditando(false)}
                style={S.btnGhost}
              >
                Cancelar
              </button>
            </div>
            <FormLoja
              userId={userId!}
              initialData={loja}
              isEditMode
              onSaved={onLojaSalva}
            />
          </>
        ) : (
          loja.status !== 'suspensa' && (
            <ResumoCard loja={loja} onEditar={() => setEditando(true)} />
          )
        )}
      </div>
    </AppLayout>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StatusCard({
  loja,
  onDesativar,
  onReativar,
}: {
  loja: LojaFull
  onDesativar: () => void
  onReativar: () => void
}) {
  const cfg = STATUS_CONFIG[loja.status]
  const publicUrl = `/lojas/${loja.slug}`
  // motivo: nova coluna `suspensao_motivo` (Passo 9), legado `motivo_suspensao`
  const motivo = loja.suspensao_motivo || loja.motivo_suspensao

  return (
    <div style={{ ...S.statusCard, borderColor: cfg.borderColor, background: cfg.bg }}>
      <div style={S.statusHeader}>
        <div>
          <span style={{ ...S.statusBadge, color: cfg.color, background: cfg.badgeBg, border: `1px solid ${cfg.borderColor}` }}>
            {cfg.label}
          </span>
          <p style={S.statusDescription}>{cfg.description}</p>
          {loja.status === 'suspensa' && motivo && (
            <p style={S.motivoBox}>
              <strong>Motivo:</strong> {motivo}
            </p>
          )}
        </div>
      </div>

      <div style={S.statusActions}>
        {loja.status === 'ativa' && (
          <>
            <Link href={publicUrl} target="_blank" style={S.btnSecondary}>
              Ver página pública ↗
            </Link>
            <button type="button" onClick={onDesativar} style={S.btnGhost}>
              Desativar loja
            </button>
          </>
        )}
        {loja.status === 'pendente' && (
          <p style={S.hintText}>
            Você receberá um email assim que a aprovação for concluída (costuma levar até 48h).
          </p>
        )}
        {loja.status === 'inativa' && (
          <button type="button" onClick={onReativar} style={S.btnPrimary}>
            Reativar loja
          </button>
        )}
        {loja.status === 'suspensa' && (
          <Link href="/suporte" style={S.btnPrimary}>
            Entrar em contato com o suporte
          </Link>
        )}
      </div>
    </div>
  )
}

function PlanoCard({ loja }: { loja: LojaFull }) {
  const plano = loja.plano || 'basico'
  const cfg = PLANO_CONFIG[plano]
  const expiraEm = loja.plano_expira_em ? new Date(loja.plano_expira_em) : null
  const hoje = new Date()
  const diasRestantes = expiraEm ? Math.ceil((expiraEm.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)) : null

  return (
    <div style={{ ...S.planoCard, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div style={S.planoHeader}>
        <div>
          <span style={S.planoLabel}>Plano desta loja</span>
          <h3 style={{ ...S.planoName, color: cfg.color }}>{cfg.label}</h3>
          {diasRestantes !== null && diasRestantes > 0 && (
            <p style={S.planoTrial}>
              {plano === 'pro' && !loja.plano_expira_em ? 'Ativo' : `${diasRestantes} dias restantes`}
            </p>
          )}
        </div>
        {plano !== 'premium' && (
          <Link href={`/minha-loja/${loja.id}/plano`} style={S.btnPrimary}>
            Fazer upgrade →
          </Link>
        )}
      </div>
      <p style={S.planoDescription}>{cfg.description}</p>
    </div>
  )
}

function ResumoCard({ loja, onEditar }: { loja: LojaFull; onEditar: () => void }) {
  const campos = [
    { label: 'Nome', valor: loja.nome },
    { label: 'Cidade', valor: loja.cidade && loja.estado ? `${loja.cidade}, ${loja.estado}` : null },
    { label: 'Tipo', valor: loja.tipo ? TIPO_LABEL[loja.tipo] : null },
    { label: 'Especialidades', valor: loja.especialidades?.length ? loja.especialidades.join(', ') : null },
    { label: 'WhatsApp', valor: loja.whatsapp },
    { label: 'Descrição', valor: loja.descricao ? `${loja.descricao.slice(0, 80)}${loja.descricao.length > 80 ? '…' : ''}` : null },
    { label: 'Logo', valor: loja.logo_url ? 'Sim' : null },
    { label: 'Fotos', valor: loja.fotos?.length ? `${loja.fotos.length} foto(s)` : null },
  ]

  const preenchidos = campos.filter(c => c.valor).length
  const pct = Math.round((preenchidos / campos.length) * 100)

  return (
    <div style={S.resumoCard}>
      <div style={S.resumoHeader}>
        <div style={{ flex: 1 }}>
          <h2 style={S.sectionTitle}>Dados da loja</h2>
          <div style={S.progressWrap}>
            <div style={S.progressTrack}>
              <div style={{ ...S.progressFill, width: `${pct}%` }} />
            </div>
            <span style={S.progressText}>{preenchidos}/{campos.length} campos · {pct}%</span>
          </div>
        </div>
        <button type="button" onClick={onEditar} style={S.btnSecondary}>
          Editar
        </button>
      </div>

      <dl style={S.resumoGrid}>
        {campos.map(c => (
          <div key={c.label} style={S.resumoItem}>
            <dt style={S.resumoLabel}>{c.label}</dt>
            <dd style={{ ...S.resumoValor, color: c.valor ? '#f0f0f0' : 'rgba(255,255,255,0.25)' }}>
              {c.valor || '— vazio'}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ─── Configs ──────────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  fisica: 'Física',
  online: 'Online',
  ambas: 'Física + Online',
}

const STATUS_CONFIG: Record<string, {
  label: string
  color: string
  badgeBg: string
  borderColor: string
  bg: string
  description: string
}> = {
  pendente: {
    label: 'Em análise',
    color: '#f59e0b',
    badgeBg: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.25)',
    bg: 'linear-gradient(180deg, rgba(245,158,11,0.04), rgba(13,15,20,0) 80%)',
    description: 'Sua loja está sendo analisada pela equipe Bynx. Assim que aprovada, aparece no Guia de Lojas.',
  },
  ativa: {
    label: 'Ativa',
    color: '#22c55e',
    badgeBg: 'rgba(34,197,94,0.15)',
    borderColor: 'rgba(34,197,94,0.25)',
    bg: 'linear-gradient(180deg, rgba(34,197,94,0.04), rgba(13,15,20,0) 80%)',
    description: 'Sua loja está visível no Guia de Lojas e pode ser encontrada pelos colecionadores.',
  },
  suspensa: {
    label: 'Suspensa',
    color: '#ef4444',
    badgeBg: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.25)',
    bg: 'linear-gradient(180deg, rgba(239,68,68,0.04), rgba(13,15,20,0) 80%)',
    description: 'Sua loja foi suspensa e não está visível no Guia. Entre em contato com o suporte para regularizar.',
  },
  inativa: {
    label: 'Inativa',
    color: 'rgba(255,255,255,0.55)',
    badgeBg: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    bg: '#0d0f14',
    description: 'Sua loja está desativada e oculta do Guia. Você pode reativá-la quando quiser.',
  },
}

const PLANO_CONFIG: Record<string, {
  label: string
  color: string
  bg: string
  border: string
  description: string
}> = {
  basico: {
    label: 'Básico',
    color: 'rgba(255,255,255,0.75)',
    bg: '#0d0f14',
    border: 'rgba(255,255,255,0.08)',
    description: 'Listagem gratuita no Guia. Faça upgrade para desbloquear fotos, redes sociais e mais.',
  },
  pro: {
    label: 'Pro',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.2)',
    description: 'Até 5 fotos, redes sociais, especialidades ilimitadas e destaque acima do Básico.',
  },
  premium: {
    label: 'Premium',
    color: '#f59e0b',
    bg: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.06))',
    border: 'rgba(245,158,11,0.3)',
    description: 'Até 10 fotos, eventos e torneios, analytics e rotação no topo da listagem.',
  },
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  page: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '24px 20px 64px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },

  breadcrumb: {
    fontSize: 13,
    color: 'rgba(245,158,11,0.85)',
    textDecoration: 'none',
    fontWeight: 600,
    marginBottom: -8,
  },

  header: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#f0f0f0',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  editHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: -8,
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
    maxWidth: 520,
    margin: '80px auto',
    textAlign: 'center',
    padding: '32px 24px',
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: '#f0f0f0',
    margin: '0 0 12px',
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    margin: '0 0 24px',
    lineHeight: 1.5,
  },

  // Status card
  statusCard: {
    background: '#0d0f14',
    border: '1px solid',
    borderRadius: 14,
    padding: 20,
  },
  statusHeader: {
    marginBottom: 16,
  },
  statusBadge: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 6,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  statusDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.5,
    margin: 0,
  },
  motivoBox: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 8,
    padding: '10px 12px',
    margin: '12px 0 0',
    lineHeight: 1.5,
  },
  statusActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },

  // Plano card
  planoCard: {
    borderRadius: 14,
    padding: 20,
  },
  planoHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  planoLabel: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: 4,
  },
  planoName: {
    fontSize: 22,
    fontWeight: 800,
    margin: 0,
    letterSpacing: '-0.01em',
  },
  planoTrial: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    margin: '4px 0 0',
  },
  planoDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.5,
    margin: 0,
  },

  // Resumo card
  resumoCard: {
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 20,
  },
  resumoHeader: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  progressWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  progressTrack: {
    flex: 1,
    maxWidth: 240,
    height: 6,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 500,
  },
  resumoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
    margin: 0,
    padding: 0,
  },
  resumoItem: {
    margin: 0,
  },
  resumoLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    margin: '0 0 4px',
  },
  resumoValor: {
    fontSize: 14,
    color: '#f0f0f0',
    margin: 0,
    lineHeight: 1.4,
  },

  // Botões
  btnPrimary: {
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    border: 'none',
    color: '#000',
    fontSize: 13,
    fontWeight: 700,
    padding: '10px 20px',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'none',
    display: 'inline-block',
  },
  btnSecondary: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#f0f0f0',
    fontSize: 13,
    fontWeight: 600,
    padding: '10px 18px',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'none',
    display: 'inline-block',
  },
  btnGhost: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: 500,
    padding: '10px 18px',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  hintText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    margin: 0,
    lineHeight: 1.5,
  },
}
