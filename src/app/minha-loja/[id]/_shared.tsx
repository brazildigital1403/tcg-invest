'use client'

import { CSSProperties, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import type { LojaFormData } from '@/components/lojas/FormLoja'

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type Estado = 'loading' | 'nao_logado' | 'nao_encontrada' | 'sem_permissao' | 'pronto'

export interface LojaFull extends LojaFormData {
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

// ─── Hook compartilhado: carrega loja + valida dono ──────────────────────────
export function useLojaOwner(lojaId: string) {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('loading')
  const [userId, setUserId] = useState<string | null>(null)
  const [loja, setLoja] = useState<LojaFull | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      let sessionData: Awaited<ReturnType<typeof supabase.auth.getSession>>['data'] | null = null
      try {
        const r = await supabase.auth.getSession()
        sessionData = r.data
      } catch { /* lock benigno do supabase-js */ }
      const user = sessionData?.session?.user
      if (!alive) return
      if (!user) {
        setEstado('nao_logado')
        router.replace(`/?next=/minha-loja/${lojaId}`)
        return
      }
      setUserId(user.id)
      const { data, error } = await supabase.from('lojas').select('*').eq('id', lojaId).limit(1)
      if (!alive) return
      if (error || !data || data.length === 0) { setEstado('nao_encontrada'); return }
      const lojaData = data[0] as LojaFull
      if (lojaData.owner_user_id !== user.id) { setEstado('sem_permissao'); return }
      setLoja(lojaData)
      setEstado('pronto')
    }
    load()
    return () => { alive = false }
  }, [router, lojaId])

  return { estado, userId, loja, setLoja }
}

// ─── Fallback de estado (loading / erro) ─────────────────────────────────────
export function LojaEstadoFallback({ estado }: { estado: Estado }) {
  if (estado === 'loading' || estado === 'nao_logado') {
    return <div style={SH.loadingWrap}><p style={SH.loadingText}>Carregando…</p></div>
  }
  if (estado === 'nao_encontrada') {
    return (
      <div style={SH.errorWrap}>
        <h2 style={SH.errorTitle}>Loja não encontrada</h2>
        <p style={SH.errorText}>A loja que você está tentando acessar não existe ou foi removida.</p>
        <Link href="/minha-loja" style={SH.btnPrimary}>← Voltar para Minhas Lojas</Link>
      </div>
    )
  }
  if (estado === 'sem_permissao') {
    return (
      <div style={SH.errorWrap}>
        <h2 style={SH.errorTitle}>Acesso negado</h2>
        <p style={SH.errorText}>Você não tem permissão para acessar essa loja. Apenas o dono pode.</p>
        <Link href="/minha-loja" style={SH.btnPrimary}>← Voltar para Minhas Lojas</Link>
      </div>
    )
  }
  return null
}

// ─── Configs ──────────────────────────────────────────────────────────────────
export const TIPO_LABEL: Record<string, string> = { fisica: 'Física', online: 'Online', ambas: 'Física + Online' }

export const STATUS_CONFIG: Record<string, { label: string; color: string; badgeBg: string; borderColor: string; bg: string; description: string }> = {
  pendente: { label: 'Em análise', color: '#f59e0b', badgeBg: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.25)', bg: 'linear-gradient(180deg, rgba(245,158,11,0.04), rgba(13,15,20,0) 80%)', description: 'Sua loja está sendo analisada pela equipe Bynx. Assim que aprovada, aparece no Guia de Lojas.' },
  ativa: { label: 'Ativa', color: '#22c55e', badgeBg: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.25)', bg: 'linear-gradient(180deg, rgba(34,197,94,0.04), rgba(13,15,20,0) 80%)', description: 'Sua loja está visível no Guia de Lojas e pode ser encontrada pelos colecionadores.' },
  suspensa: { label: 'Suspensa', color: '#ef4444', badgeBg: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.25)', bg: 'linear-gradient(180deg, rgba(239,68,68,0.04), rgba(13,15,20,0) 80%)', description: 'Sua loja foi suspensa e não está visível no Guia. Entre em contato com o suporte para regularizar.' },
  inativa: { label: 'Inativa', color: 'rgba(255,255,255,0.55)', badgeBg: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', bg: '#0d0f14', description: 'Sua loja está desativada e oculta do Guia. Você pode reativá-la quando quiser.' },
}

export const PLANO_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; description: string }> = {
  basico: { label: 'Básico', color: 'rgba(255,255,255,0.75)', bg: '#0d0f14', border: 'rgba(255,255,255,0.08)', description: 'Listagem gratuita no Guia. Faça upgrade para desbloquear fotos, redes sociais e mais.' },
  pro: { label: 'Pro', color: '#60a5fa', bg: 'rgba(96,165,250,0.06)', border: 'rgba(96,165,250,0.2)', description: 'Até 5 fotos, redes sociais, especialidades ilimitadas e destaque acima do Básico.' },
  premium: { label: 'Premium', color: '#a855f7', bg: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(168,85,247,0.06))', border: 'rgba(168,85,247,0.3)', description: 'Até 10 fotos, eventos e torneios, analytics e rotação no topo da listagem.' },
}

// ─── Estilos base (identidade LOJA azul->roxo) ───────────────────────────────
const LOJA_GRAD = 'linear-gradient(135deg, #60a5fa, #a855f7)'
export const SH: Record<string, CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: 16 },
  head: { marginBottom: 4 },
  title: { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--bx-text)' },
  subtitle: { color: 'var(--bx-text-3)', fontSize: 13, marginTop: 3 },
  btnPrimary: { display: 'inline-block', background: LOJA_GRAD, color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none', border: 0, cursor: 'pointer' },
  btnGhost: { display: 'inline-block', background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)', padding: '9px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, textDecoration: 'none', cursor: 'pointer' },
  btnSecondary: { display: 'inline-block', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', padding: '9px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, textDecoration: 'none', cursor: 'pointer' },
  card: { background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 16, padding: 18 },
  cardH3: { fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--bx-text-3)', marginBottom: 12 },
  loadingWrap: { minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: 'var(--bx-text-3)' },
  errorWrap: { maxWidth: 520, margin: '40px auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' },
  errorTitle: { fontSize: 22, fontWeight: 800, color: 'var(--bx-text)' },
  errorText: { color: 'var(--bx-text-2)', fontSize: 14 },
}
