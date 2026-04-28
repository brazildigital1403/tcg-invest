'use client'

import { CSSProperties, useEffect, useState, use as usePromise } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import FormLoja, { LojaFormData } from '@/components/lojas/FormLoja'
import { useAppModal } from '@/components/ui/useAppModal'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Estado = 'loading' | 'nao_admin' | 'nao_encontrada' | 'pronto'

interface LojaFull extends LojaFormData {
  id: string
  slug: string
  plano: 'basico' | 'pro' | 'premium'
  status: 'pendente' | 'ativa' | 'suspensa' | 'inativa'
  verificada: boolean | null
  suspensao_motivo: string | null
  plano_expira_em: string | null
  owner_user_id: string
  created_at: string
}

interface OwnerInfo {
  id: string
  email: string
  name: string | null
}

const STATUS_LABEL: Record<LojaFull['status'], { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: '#f59e0b' },
  ativa:    { label: 'Ativa',    color: '#22c55e' },
  suspensa: { label: 'Suspensa', color: '#ef4444' },
  inativa:  { label: 'Inativa',  color: 'rgba(255,255,255,0.4)' },
}

const PLANO_LABEL: Record<LojaFull['plano'], { label: string; color: string }> = {
  basico:  { label: 'Básico',  color: 'rgba(255,255,255,0.5)' },
  pro:     { label: 'Pro',     color: '#60a5fa' },
  premium: { label: 'Premium', color: '#f59e0b' },
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AdminLojaEditarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: lojaId } = usePromise(params)
  const router = useRouter()
  const { showAlert } = useAppModal()

  const [estado, setEstado] = useState<Estado>('loading')
  const [loja, setLoja] = useState<LojaFull | null>(null)
  const [owner, setOwner] = useState<OwnerInfo | null>(null)

  // ─── Load loja via API admin ──────────────────────────────
  useEffect(() => {
    let alive = true

    async function load() {
      try {
        const res = await fetch(`/api/admin/lojas/${lojaId}`, {
          method: 'GET',
          credentials: 'include',
        })

        if (!alive) return

        if (res.status === 401) {
          setEstado('nao_admin')
          router.replace('/admin/login')
          return
        }

        if (res.status === 404) {
          setEstado('nao_encontrada')
          return
        }

        if (!res.ok) {
          showAlert('Erro ao carregar loja. Tente novamente.', 'error')
          setEstado('nao_encontrada')
          return
        }

        const data = await res.json()
        if (!alive) return

        setLoja(data.loja as LojaFull)
        setOwner(data.owner as OwnerInfo | null)
        setEstado('pronto')
      } catch (err) {
        console.error('[admin/lojas/editar] erro ao carregar', err)
        if (alive) setEstado('nao_encontrada')
      }
    }

    load()
    return () => { alive = false }
  }, [lojaId, router, showAlert])

  // ─── Handler de save ──────────────────────────────────────
  function onLojaSalva(nova: LojaFormData) {
    setLoja(prev => ({ ...(prev || {}), ...nova } as LojaFull))
    showAlert('Alterações salvas com sucesso.', 'success')
  }

  // ─── Render: estados ──────────────────────────────────────
  if (estado === 'loading' || estado === 'nao_admin') {
    return (
      <div style={S.wrap}>
        <p style={S.loadingText}>Carregando…</p>
      </div>
    )
  }

  if (estado === 'nao_encontrada') {
    return (
      <div style={S.wrap}>
        <h2 style={S.errorTitle}>Loja não encontrada</h2>
        <p style={S.errorText}>
          A loja que você está tentando editar não existe ou foi removida.
        </p>
        <Link href="/admin/lojas" style={S.btnVoltar}>
          ← Voltar para Moderação de Lojas
        </Link>
      </div>
    )
  }

  if (!loja) return null

  const statusCfg = STATUS_LABEL[loja.status]
  const planoCfg = PLANO_LABEL[loja.plano]

  return (
    <div style={S.wrap}>
      {/* ─── Banner ADMIN ──────────────────────────────── */}
      <div style={S.adminBanner}>
        <div style={S.bannerLeft}>
          <span style={S.bannerIcon}>🛡️</span>
          <div>
            <p style={S.bannerTitle}>Você está editando como ADMIN</p>
            <p style={S.bannerSub}>
              Esta loja pertence a{' '}
              {owner ? (
                <strong style={{ color: '#f0f0f0' }}>
                  {owner.name || 'Sem nome'} ({owner.email})
                </strong>
              ) : (
                <strong style={{ color: 'rgba(255,255,255,0.4)' }}>(sem owner)</strong>
              )}
              . Mudanças aqui são feitas em nome do dono.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Breadcrumb ─────────────────────────────────── */}
      <Link href="/admin/lojas" style={S.breadcrumb}>
        ← Moderação de Lojas
      </Link>

      {/* ─── Header ─────────────────────────────────────── */}
      <header style={S.header}>
        <div style={S.headerTop}>
          <h1 style={S.title}>{loja.nome}</h1>
          <a
            href={`/lojas/${loja.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            style={S.btnExternal}
          >
            Abrir página pública ↗
          </a>
        </div>
        <div style={S.headerMeta}>
          <span style={{ ...S.metaBadge, color: statusCfg.color, borderColor: `${statusCfg.color}55`, background: `${statusCfg.color}15` }}>
            {statusCfg.label}
          </span>
          <span style={{ ...S.metaBadge, color: planoCfg.color, borderColor: `${planoCfg.color}55`, background: `${planoCfg.color}10` }}>
            {planoCfg.label}
          </span>
          <span style={S.metaText}>/{loja.slug}</span>
        </div>
      </header>

      {/* ─── Form ───────────────────────────────────────── */}
      <FormLoja
        userId={loja.owner_user_id}
        initialData={loja}
        isEditMode
        onSaved={onLojaSalva}
      />
    </div>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  wrap: {
    padding: '32px 24px',
    maxWidth: 920,
    margin: '0 auto',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },

  loadingText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    padding: '40px 0',
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: '#f0f0f0',
    margin: '40px 0 8px',
    letterSpacing: '-0.02em',
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.6,
    margin: '0 0 20px',
  },
  btnVoltar: {
    display: 'inline-block',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.7)',
    padding: '10px 20px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
  },

  // Banner admin
  adminBanner: {
    background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(245,158,11,0.08))',
    border: '1px solid rgba(168,85,247,0.35)',
    borderRadius: 14,
    padding: '14px 18px',
    marginBottom: 20,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
  },
  bannerLeft: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    flex: 1,
  },
  bannerIcon: {
    fontSize: 24,
    lineHeight: 1,
    flexShrink: 0,
  },
  bannerTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: '0.02em',
    color: '#a855f7',
    textTransform: 'uppercase',
  },
  bannerSub: {
    margin: '4px 0 0',
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 1.5,
  },

  // Breadcrumb
  breadcrumb: {
    display: 'inline-block',
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textDecoration: 'none',
    marginBottom: 14,
  },

  // Header
  header: {
    marginBottom: 24,
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    color: '#f0f0f0',
    letterSpacing: '-0.03em',
    margin: 0,
    flex: 1,
    minWidth: 200,
  },
  btnExternal: {
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.3)',
    color: '#f59e0b',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  headerMeta: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 100,
    border: '1px solid',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  metaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'monospace',
  },
}
