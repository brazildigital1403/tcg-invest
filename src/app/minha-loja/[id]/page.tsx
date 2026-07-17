'use client'

import { CSSProperties, useEffect, useState, use as usePromise } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAppModal } from '@/components/ui/useAppModal'
import {
  useLojaOwner, LojaEstadoFallback, STATUS_CONFIG, PLANO_CONFIG, SH,
  type LojaFull,
} from './_shared'

export default function VisaoGeralPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: lojaId } = usePromise(params)
  const { estado, userId, loja, setLoja } = useLojaOwner(lojaId)
  const { showConfirm, showAlert } = useAppModal()

  // ─── Desempenho (ultimos 7 dias) ───────────────────────────────
  const [perf, setPerf] = useState<{ total: number } | null>(null)
  useEffect(() => {
    let alive = true
    fetch(`/api/lojas/${lojaId}/analytics?days=7`)
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j) setPerf({ total: Number(j.total) || 0 }) })
      .catch(() => {})
    return () => { alive = false }
  }, [lojaId])

  async function desativarLoja() {
    if (!loja) return
    const ok = await showConfirm({
      message: 'Sua loja ficará oculta do Guia e dos mecanismos de busca. Você pode reativar a qualquer momento. Confirma?',
      confirmLabel: 'Desativar', cancelLabel: 'Cancelar', danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('lojas').update({ status: 'inativa' }).eq('id', loja.id).eq('owner_user_id', userId!)
    if (error) { showAlert('Erro ao desativar. Tente novamente.', 'error'); return }
    setLoja({ ...loja, status: 'inativa' })
    showAlert('Loja desativada. Ela não aparece mais no Guia.', 'info')
  }

  async function reativarLoja() {
    if (!loja) return
    const { error } = await supabase.from('lojas').update({ status: 'pendente' }).eq('id', loja.id).eq('owner_user_id', userId!)
    if (error) { showAlert('Erro ao reativar. Tente novamente.', 'error'); return }
    setLoja({ ...loja, status: 'pendente' })
    showAlert('Loja enviada para nova análise. Avisaremos por email quando aprovada.', 'success')
  }

  if (estado !== 'pronto' || !loja) return <LojaEstadoFallback estado={estado} />

  const base = `/minha-loja/${loja.id}`

  return (
    <div style={SH.page}>
      <style>{`
        .vg-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .vg-atalhos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        @media (max-width: 720px) { .vg-atalhos { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 560px) { .vg-grid2 { grid-template-columns: 1fr; } }
      `}</style>
      <header style={SH.head}>
        <h1 style={SH.title}>{loja.nome}</h1>
        {loja.slug && <p style={SH.subtitle}>bynx.gg/lojas/{loja.slug}</p>}
      </header>

      <div className="vg-grid2">
        <StatusCard loja={loja} onDesativar={desativarLoja} onReativar={reativarLoja} />
        <PlanoCard loja={loja} />
      </div>

      {/* Desempenho resumo */}
      <div style={SH.card}>
        <div style={S.perfHead}>
          <h3 style={{ ...SH.cardH3, margin: 0 }}>Desempenho · últimos 7 dias</h3>
          <Link href={`${base}/analytics`} style={SH.btnPrimary}>Ver analytics completo</Link>
        </div>
        <div style={S.perfRow}>
          <div style={S.perfBig}>{perf === null ? '—' : perf.total}</div>
          <div style={S.perfLabel}>cliques nos seus contatos (WhatsApp, redes, mapa)</div>
        </div>
      </div>

      {/* Atalhos */}
      <div className="vg-atalhos">
        <Link href={`${base}/vitrine`} style={S.atalho}>
          <span style={S.ai}><IconEdit /></span>
          <span style={S.at}>Editar vitrine</span>
          <span style={S.ad}>Logo, descrição, fotos, contatos</span>
        </Link>
        {loja.slug && (
          <a href={`/lojas/${loja.slug}`} target="_blank" rel="noopener noreferrer" style={S.atalho}>
            <span style={S.ai}><IconExternal /></span>
            <span style={S.at}>Ver vitrine pública</span>
            <span style={S.ad}>Como o cliente vê sua loja</span>
          </a>
        )}
        <Link href={`${base}/analytics`} style={S.atalho}>
          <span style={S.ai}><IconChart /></span>
          <span style={S.at}>Analytics</span>
          <span style={S.ad}>Contatos, visitas e canais</span>
        </Link>
        <Link href={`${base}/produtos`} style={S.atalho}>
          <span style={S.ai}>🎁</span>
          <span style={S.at}>Produtos</span>
          <span style={S.ad}>Selados, pelúcias, funkos e mais</span>
        </Link>
        <Link href={`${base}/pedidos`} style={S.atalho}>
          <span style={S.ai}>📦</span>
          <span style={S.at}>Pedidos</span>
          <span style={S.ad}>Vendas a enviar e histórico</span>
        </Link>
        <Link href={`${base}/pagamentos`} style={S.atalho}>
          <span style={S.ai}>🏦</span>
          <span style={S.at}>Pagamentos</span>
          <span style={S.ad}>Receba pelas vendas na Bynx</span>
        </Link>
        <Link href={`${base}/vitrine`} style={S.atalho}>
          <span style={S.ai}><IconCalendar /></span>
          <span style={S.at}>Eventos</span>
          <span style={S.ad}>Torneios e ligas da loja</span>
        </Link>
      </div>
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function StatusCard({ loja, onDesativar, onReativar }: { loja: LojaFull; onDesativar: () => void; onReativar: () => void }) {
  const cfg = STATUS_CONFIG[loja.status]
  const motivo = loja.suspensao_motivo || loja.motivo_suspensao
  return (
    <div style={{ ...SH.card, borderColor: cfg.borderColor, background: cfg.bg }}>
      <h3 style={SH.cardH3}>Status da loja</h3>
      <span style={{ ...S.badge, color: cfg.color, background: cfg.badgeBg, border: `1px solid ${cfg.borderColor}` }}>{cfg.label}</span>
      <p style={S.desc}>{cfg.description}</p>
      {loja.status === 'suspensa' && motivo && <p style={S.motivo}><strong>Motivo:</strong> {motivo}</p>}
      <div style={S.actions}>
        {loja.status === 'ativa' && <button type="button" onClick={onDesativar} style={SH.btnGhost}>Desativar temporariamente</button>}
        {loja.status === 'pendente' && <p style={S.hint}>Você receberá um email assim que a aprovação for concluída (até 48h).</p>}
        {loja.status === 'inativa' && <button type="button" onClick={onReativar} style={SH.btnPrimary}>Reativar loja</button>}
        {loja.status === 'suspensa' && <Link href="/suporte" style={SH.btnPrimary}>Falar com o suporte</Link>}
      </div>
    </div>
  )
}

function PlanoCard({ loja }: { loja: LojaFull }) {
  const plano = loja.plano || 'basico'
  const cfg = PLANO_CONFIG[plano]
  const expiraEm = loja.plano_expira_em ? new Date(loja.plano_expira_em) : null
  const dias = expiraEm ? Math.ceil((expiraEm.getTime() - Date.now()) / 86400000) : null
  return (
    <div style={{ ...SH.card, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <h3 style={SH.cardH3}>Plano</h3>
      <div style={S.planoRow}>
        <h4 style={{ ...S.planoName, color: cfg.color }}>{cfg.label}</h4>
        {plano !== 'premium' && <Link href={`/minha-loja/${loja.id}/plano`} style={SH.btnSecondary}>Fazer upgrade →</Link>}
      </div>
      {dias !== null && dias > 0 && <p style={S.planoTrial}>{plano === 'pro' && !loja.plano_expira_em ? 'Ativo' : `${dias} dias restantes`}</p>}
      <p style={S.desc}>{cfg.description}</p>
      <Link href={`/minha-loja/${loja.id}/plano`} style={S.lnk}>Gerenciar plano &amp; cobrança →</Link>
    </div>
  )
}

// ─── Ícones ───────────────────────────────────────────────────────────────────
const Ico = ({ children }: { children: React.ReactNode }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>{children}</svg>
)
const IconEdit = () => <Ico><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Ico>
const IconExternal = () => <Ico><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" /></Ico>
const IconChart = () => <Ico><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-4" /><path d="M13 16V8" /><path d="M18 16v-7" /></Ico>
const IconCalendar = () => <Ico><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></Ico>

const S: Record<string, CSSProperties> = {
  badge: { display: 'inline-block', fontSize: 12, fontWeight: 800, padding: '5px 12px', borderRadius: 999 },
  desc: { color: 'var(--bx-text-2)', fontSize: 12.5, margin: '10px 0 14px', lineHeight: 1.5 },
  motivo: { fontSize: 12.5, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 10px', marginBottom: 12 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  hint: { fontSize: 12, color: 'var(--bx-text-3)', margin: 0 },
  planoRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  planoName: { fontSize: 19, fontWeight: 800, margin: 0 },
  planoTrial: { fontSize: 11.5, color: 'var(--bx-text-3)', margin: '4px 0 0' },
  lnk: { color: '#60a5fa', fontSize: 12.5, fontWeight: 700, textDecoration: 'none', display: 'inline-block', marginTop: 4 },
  perfHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6, flexWrap: 'wrap' },
  perfRow: { display: 'flex', alignItems: 'baseline', gap: 12 },
  perfBig: { fontSize: 34, fontWeight: 800, background: 'linear-gradient(135deg, #60a5fa, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' as CSSProperties['WebkitTextFillColor'], lineHeight: 1 },
  perfLabel: { fontSize: 12.5, color: 'var(--bx-text-2)' },
  atalho: { background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 14, padding: '16px 14px', textDecoration: 'none', color: 'var(--bx-text)', display: 'flex', flexDirection: 'column', gap: 8 },
  ai: { width: 38, height: 38, borderRadius: 10, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' },
  at: { fontSize: 13, fontWeight: 700 },
  ad: { fontSize: 11.5, color: 'var(--bx-text-3)' },
}
