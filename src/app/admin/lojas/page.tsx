'use client'

import { useEffect, useState, Suspense, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAppModal } from '@/components/ui/useAppModal'

type Loja = {
  id: string
  owner_user_id: string | null
  nome: string
  slug: string
  logo_url: string | null
  cidade: string
  estado: string
  tipo: 'fisica' | 'online' | 'ambas'
  especialidades: string[]
  plano: 'basico' | 'pro' | 'premium'
  status: 'pendente' | 'ativa' | 'suspensa' | 'inativa'
  verificada: boolean
  suspensao_motivo: string | null
  suspensao_data: string | null
  aprovada_data: string | null
  plano_expira_em: string | null
  created_at: string
  owner_email: string | null
  owner_name: string | null
}

type Counts = { pendente: number; ativa: number; suspensa: number; inativa: number }

const STATUS_TABS = [
  { key: '',          label: 'Todas' },
  { key: 'pendente',  label: 'Pendentes' },
  { key: 'ativa',     label: 'Ativas' },
  { key: 'suspensa',  label: 'Suspensas' },
  { key: 'inativa',   label: 'Inativas' },
]

const STATUS_STYLE: Record<Loja['status'], { label: string; color: string; bg: string; border: string }> = {
  pendente: { label: 'Pendente', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.3)' },
  ativa:    { label: 'Ativa',    color: '#22c55e', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.3)' },
  suspensa: { label: 'Suspensa', color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.3)' },
  inativa:  { label: 'Inativa',  color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)' },
}

const PLANO_STYLE: Record<Loja['plano'], { label: string; color: string }> = {
  basico:  { label: 'Básico',  color: 'rgba(255,255,255,0.5)' },
  pro:     { label: 'Pro',     color: '#60a5fa' },
  premium: { label: 'Premium', color: '#f59e0b' },
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtDateTime = (iso?: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// Opções de duração no modal de mudança de plano
const DURACAO_OPCOES: Array<{ value: number | null; label: string }> = [
  { value: 30,   label: '30 dias' },
  { value: 60,   label: '60 dias' },
  { value: 90,   label: '90 dias' },
  { value: 180,  label: '6 meses' },
  { value: 365,  label: '1 ano' },
  { value: null, label: 'Permanente (sem expiração)' },
]

// ─── Page ────────────────────────────────────────────────────────────────

function LojasView() {
  const qp = useSearchParams()
  const { showAlert, showConfirm } = useAppModal()

  const [status, setStatus] = useState(qp.get('status') || '')
  const [q, setQ]           = useState('')
  const [lojas, setLojas]   = useState<Loja[] | null>(null)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(false)

  // Modal de suspender
  const [suspendingLoja, setSuspendingLoja] = useState<Loja | null>(null)
  const [motivo, setMotivo] = useState('')

  // Modal de detalhes
  const [detailsLoja, setDetailsLoja] = useState<Loja | null>(null)

  // Modal de mudança de plano
  const [planoModalLoja, setPlanoModalLoja] = useState<Loja | null>(null)
  const [planoNovoSelecionado, setPlanoNovoSelecionado] = useState<Loja['plano']>('pro')
  const [duracaoSelecionada, setDuracaoSelecionada] = useState<number | null>(30)

  // Dropdown Plano (qual loja está com o dropdown aberto)
  const [planoDropdownLojaId, setPlanoDropdownLojaId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPlanoDropdownLojaId(null)
      }
    }
    if (planoDropdownLojaId) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [planoDropdownLojaId])

  async function load() {
    setLoading(true)
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    if (q.trim()) p.set('q', q.trim())
    p.set('page', String(page))
    p.set('perPage', '50')

    const res = await fetch(`/api/admin/lojas?${p}`)
    setLoading(false)
    if (!res.ok) return
    const d = await res.json()
    setLojas(d.lojas || [])
    setCounts(d.counts || null)
    setTotal(d.total || 0)
    setTotalPages(d.totalPages || 1)
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [status, page])

  function handleSearch() { setPage(1); load() }

  // ─── Ações ────────────────────────────────────────────────────────────

  async function aprovar(loja: Loja) {
    const ok = await showConfirm({
      message: `Aprovar a loja "${loja.nome}"? Ela vai aparecer no guia público.${loja.aprovada_data ? '' : ' O owner receberá um email de boas-vindas.'}`,
      confirmLabel: 'Aprovar',
    })
    if (!ok) return
    setBusy(true)
    const res = await fetch(`/api/admin/lojas/${loja.id}/approve`, { method: 'POST' })
    setBusy(false)
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      return showAlert(e.error || 'Erro ao aprovar', 'error')
    }
    showAlert('Loja aprovada.', 'success')
    await load()
  }

  function abrirSuspender(loja: Loja) {
    setMotivo('')
    setSuspendingLoja(loja)
  }

  async function confirmarSuspender() {
    if (!suspendingLoja) return
    if (motivo.trim().length < 10) {
      return showAlert('Motivo precisa ter pelo menos 10 caracteres.', 'warning')
    }
    setBusy(true)
    const res = await fetch(`/api/admin/lojas/${suspendingLoja.id}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: motivo.trim() }),
    })
    setBusy(false)
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      return showAlert(e.error || 'Erro ao suspender', 'error')
    }
    setSuspendingLoja(null)
    setMotivo('')
    showAlert('Loja suspensa. Email enviado ao owner.', 'success')
    await load()
  }

  async function toggleVerificada(loja: Loja) {
    const ok = await showConfirm({
      message: loja.verificada
        ? `Remover badge "Verificada" de "${loja.nome}"?`
        : `Marcar "${loja.nome}" como verificada? (badge âmbar no card público)`,
    })
    if (!ok) return
    setBusy(true)
    const res = await fetch(`/api/admin/lojas/${loja.id}/toggle-verified`, { method: 'POST' })
    setBusy(false)
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      return showAlert(e.error || 'Erro ao alterar', 'error')
    }
    await load()
  }

  // ─── Plano ────────────────────────────────────────────────────────────

  function abrirModalPlano(loja: Loja, planoNovo: Loja['plano']) {
    setPlanoModalLoja(loja)
    setPlanoNovoSelecionado(planoNovo)
    // Default: 30 dias para Pro/Premium, irrelevante para Basico (sempre permanente)
    setDuracaoSelecionada(planoNovo === 'basico' ? null : 30)
    setPlanoDropdownLojaId(null) // fecha dropdown
  }

  async function confirmarMudancaPlano() {
    if (!planoModalLoja) return
    setBusy(true)
    const res = await fetch(`/api/admin/lojas/${planoModalLoja.id}/plano`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plano: planoNovoSelecionado,
        // Para basico, sempre permanente (null). Para outros, usa duracaoSelecionada
        dias: planoNovoSelecionado === 'basico' ? null : duracaoSelecionada,
      }),
    })
    setBusy(false)
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      return showAlert(e.error || 'Erro ao alterar plano', 'error')
    }
    setPlanoModalLoja(null)
    showAlert(`Plano alterado para ${PLANO_STYLE[planoNovoSelecionado].label}. Email enviado ao owner.`, 'success')
    await load()
  }

  // ─── Render ──────────────────────────────────────────────────────────

  const hasPendentes = (counts?.pendente || 0) > 0

  return (
    <div style={{ padding: '32px 24px', maxWidth: 1300, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px', color: '#f0f0f0' }}>
          Moderação de Lojas
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
          Aprovar, suspender e verificar lojas do Guia
        </p>
      </div>

      {/* Banner de alerta se tem pendentes */}
      {hasPendentes && status !== 'pendente' && (
        <div style={{
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 12, padding: '12px 18px',
          marginBottom: 18,
          display: 'flex', alignItems: 'center', gap: 12,
          flexWrap: 'wrap',
        }}>
          <p style={{ fontSize: 13, color: '#f59e0b', margin: 0, fontWeight: 600 }}>
            ⚠️ {counts?.pendente} {counts?.pendente === 1 ? 'loja pendente' : 'lojas pendentes'} aguardando aprovação
          </p>
          <button onClick={() => { setStatus('pendente'); setPage(1) }} style={{
            marginLeft: 'auto',
            background: 'rgba(245,158,11,0.15)',
            border: '1px solid rgba(245,158,11,0.4)',
            color: '#f59e0b',
            padding: '6px 12px', borderRadius: 8,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            Ver pendentes →
          </button>
        </div>
      )}

      {/* Contadores */}
      {counts && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <Counter label="Pendentes" value={counts.pendente} color="#f59e0b" />
          <Counter label="Ativas"    value={counts.ativa}    color="#22c55e" />
          <Counter label="Suspensas" value={counts.suspensa} color="#ef4444" />
          <Counter label="Inativas"  value={counts.inativa}  color="rgba(255,255,255,0.4)" />
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        {STATUS_TABS.map(t => {
          const active = status === t.key
          return (
            <button
              key={t.key || 'all'}
              onClick={() => { setStatus(t.key); setPage(1) }}
              style={{
                padding: '7px 14px', borderRadius: 100,
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${active ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`,
                background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                color: active ? '#f59e0b' : 'rgba(255,255,255,0.55)',
              }}
            >
              {t.label}
            </button>
          )
        })}

        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flex: 1, maxWidth: 380 }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar por nome, slug ou cidade..."
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 100,
              padding: '7px 14px',
              color: '#f0f0f0', fontSize: 13,
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button onClick={handleSearch} style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#f0f0f0',
            padding: '7px 14px', borderRadius: 100,
            fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Buscar
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Carregando...</p>
      ) : !lojas || lojas.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px dashed rgba(255,255,255,0.12)',
          borderRadius: 14, padding: '40px 20px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Nenhuma loja encontrada.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lojas.map(l => {
              const s = STATUS_STYLE[l.status]
              const p = PLANO_STYLE[l.plano]
              const isPending = l.status === 'pendente'
              const planosDisponiveis = (['basico', 'pro', 'premium'] as Loja['plano'][]).filter(x => x !== l.plano)

              return (
                <div key={l.id} style={{
                  background: isPending ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isPending ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 14, padding: '16px 20px',
                  display: 'flex', gap: 16,
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                }}>
                  {/* Logo (clicável → abre página pública em nova aba) */}
                  <a
                    href={`/lojas/${l.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Abrir ${l.nome} em nova aba`}
                    style={{
                      flexShrink: 0,
                      display: 'block',
                      borderRadius: 10,
                      transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.04)'
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(245,158,11,0.25)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'scale(1)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    {l.logo_url ? (
                      <img src={l.logo_url} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', display: 'block', background: 'rgba(255,255,255,0.04)' }} />
                    ) : (
                      <div style={{
                        width: 56, height: 56, borderRadius: 10,
                        background: 'rgba(255,255,255,0.04)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, fontWeight: 800,
                        color: 'rgba(255,255,255,0.3)',
                      }}>
                        {l.nome.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </a>

                  {/* Info principal */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0', margin: 0 }}>
                        {l.nome}
                      </p>
                      <span style={{
                        fontSize: 10, fontWeight: 800,
                        padding: '3px 8px', borderRadius: 100,
                        color: s.color, background: s.bg,
                        border: `1px solid ${s.border}`,
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                      }}>
                        {s.label}
                      </span>
                      {l.verificada && (
                        <span style={{
                          fontSize: 10, fontWeight: 800,
                          padding: '3px 8px', borderRadius: 100,
                          color: '#f59e0b', background: 'rgba(245,158,11,0.1)',
                          border: '1px solid rgba(245,158,11,0.3)',
                        }}>
                          ✓ Verificada
                        </span>
                      )}
                      <span style={{ fontSize: 11, fontWeight: 700, color: p.color }}>
                        {p.label}
                      </span>
                      {l.plano_expira_em && l.plano !== 'basico' && (
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                          (expira {fmtDate(l.plano_expira_em)})
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px' }}>
                      /{l.slug} · {l.cidade}/{l.estado} · {l.tipo === 'fisica' ? 'Física' : l.tipo === 'online' ? 'Online' : 'Ambas'}
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0, wordBreak: 'break-all' }}>
                      {l.owner_name && `${l.owner_name} · `}{l.owner_email || '(sem owner)'} · cadastrada {fmtDate(l.created_at)}
                    </p>
                    {l.status === 'suspensa' && l.suspensao_motivo && (
                      <p style={{
                        fontSize: 11, color: '#ef4444', margin: '6px 0 0',
                        background: 'rgba(239,68,68,0.06)',
                        padding: '4px 10px', borderRadius: 6,
                        display: 'inline-block',
                      }}>
                        Motivo: {l.suspensao_motivo}
                      </p>
                    )}
                  </div>

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', position: 'relative' }}>
                    {(l.status === 'pendente' || l.status === 'suspensa') && (
                      <BtnAction onClick={() => aprovar(l)} busy={busy} color="#22c55e">
                        {l.status === 'suspensa' ? 'Reativar' : 'Aprovar'}
                      </BtnAction>
                    )}
                    {(l.status === 'pendente' || l.status === 'ativa') && (
                      <BtnAction onClick={() => abrirSuspender(l)} busy={busy} color="#ef4444">
                        Suspender
                      </BtnAction>
                    )}
                    {l.status === 'ativa' && (
                      <BtnAction onClick={() => toggleVerificada(l)} busy={busy} color={l.verificada ? 'rgba(255,255,255,0.5)' : '#f59e0b'}>
                        {l.verificada ? 'Remover ✓' : 'Verificar'}
                      </BtnAction>
                    )}

                    {/* Dropdown Plano (sempre disponível) */}
                    <div style={{ position: 'relative' }} ref={planoDropdownLojaId === l.id ? dropdownRef : undefined}>
                      <BtnAction
                        onClick={() => setPlanoDropdownLojaId(planoDropdownLojaId === l.id ? null : l.id)}
                        busy={busy}
                        color="#60a5fa"
                      >
                        Plano ▾
                      </BtnAction>

                      {planoDropdownLojaId === l.id && (
                        <div style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          right: 0,
                          background: '#0f1117',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 10,
                          padding: 4,
                          minWidth: 140,
                          zIndex: 100,
                          boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}>
                          {planosDisponiveis.map(planoNovo => {
                            const cfg = PLANO_STYLE[planoNovo]
                            return (
                              <button
                                key={planoNovo}
                                onClick={() => abrirModalPlano(l, planoNovo)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: cfg.color,
                                  padding: '8px 12px',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  fontFamily: 'inherit',
                                  textAlign: 'left',
                                  transition: 'background 0.1s ease',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                → {cfg.label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <BtnAction onClick={() => setDetailsLoja(l)} busy={busy} color="rgba(255,255,255,0.6)" variant="ghost">
                      Detalhes
                    </BtnAction>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', marginTop: 20 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pgBtn(page === 1)}>
                ← Anterior
              </button>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', minWidth: 80, textAlign: 'center' }}>
                Página {page} de {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={pgBtn(page >= totalPages)}>
                Próxima →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Modal: suspender ── */}
      {suspendingLoja && (
        <div style={overlayStyle} onClick={() => setSuspendingLoja(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px', color: '#ef4444' }}>
              Suspender "{suspendingLoja.nome}"
            </h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: '0 0 16px' }}>
              O owner receberá um email com este motivo. Seja claro e profissional.
            </p>

            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, display: 'block' }}>
              Motivo da suspensão (mín. 10 caracteres)
            </label>
            <textarea
              autoFocus
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: Fraude confirmada · Dados falsos · Produto pirata · Múltiplas reclamações"
              rows={5}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '12px 14px',
                color: '#f0f0f0', fontSize: 14,
                outline: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit',
                resize: 'vertical', minHeight: 100, marginBottom: 6,
              }}
            />
            <p style={{ fontSize: 11, color: motivo.length >= 10 ? 'rgba(34,197,94,0.7)' : 'rgba(255,255,255,0.35)', margin: '0 0 18px', textAlign: 'right' }}>
              {motivo.length}/500 {motivo.length >= 10 ? '✓' : `(mín. 10)`}
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setSuspendingLoja(null)} style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.6)',
                padding: '10px 20px', borderRadius: 10,
                fontSize: 14, cursor: 'pointer', fontWeight: 500,
                fontFamily: 'inherit',
              }}>
                Cancelar
              </button>
              <button onClick={confirmarSuspender} disabled={busy || motivo.trim().length < 10} style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444',
                padding: '10px 24px', borderRadius: 10,
                fontSize: 14, cursor: (busy || motivo.trim().length < 10) ? 'not-allowed' : 'pointer', fontWeight: 700,
                opacity: (busy || motivo.trim().length < 10) ? 0.5 : 1,
                fontFamily: 'inherit',
              }}>
                {busy ? 'Suspendendo...' : 'Suspender'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: mudança de plano ── */}
      {planoModalLoja && (
        <div style={overlayStyle} onClick={() => setPlanoModalLoja(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px', color: PLANO_STYLE[planoNovoSelecionado].color }}>
              Alterar plano de "{planoModalLoja.nome}"
            </h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: '0 0 18px' }}>
              De <strong style={{ color: PLANO_STYLE[planoModalLoja.plano].color }}>{PLANO_STYLE[planoModalLoja.plano].label}</strong> para <strong style={{ color: PLANO_STYLE[planoNovoSelecionado].color }}>{PLANO_STYLE[planoNovoSelecionado].label}</strong>.
              {' '}O owner receberá um email avisando da mudança.
            </p>

            {planoNovoSelecionado !== 'basico' ? (
              <>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, display: 'block' }}>
                  Duração do plano
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                  {DURACAO_OPCOES.map(opt => {
                    const selected = duracaoSelecionada === opt.value
                    return (
                      <button
                        key={String(opt.value)}
                        onClick={() => setDuracaoSelecionada(opt.value)}
                        style={{
                          background: selected ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${selected ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
                          color: selected ? '#f59e0b' : 'rgba(255,255,255,0.65)',
                          padding: '10px 14px',
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>{opt.label}</span>
                        {selected && <span style={{ fontSize: 16 }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 18,
                fontSize: 12,
                color: 'rgba(255,255,255,0.55)',
                lineHeight: 1.5,
              }}>
                ℹ️ Plano Básico não tem expiração. A mudança é permanente.
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setPlanoModalLoja(null)} style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.6)',
                padding: '10px 20px', borderRadius: 10,
                fontSize: 14, cursor: 'pointer', fontWeight: 500,
                fontFamily: 'inherit',
              }}>
                Cancelar
              </button>
              <button onClick={confirmarMudancaPlano} disabled={busy} style={{
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                border: 'none',
                color: '#000',
                padding: '10px 24px', borderRadius: 10,
                fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 800,
                opacity: busy ? 0.5 : 1,
                fontFamily: 'inherit',
              }}>
                {busy ? 'Aplicando...' : 'Confirmar mudança'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: detalhes ── */}
      {detailsLoja && (
        <div style={overlayStyle} onClick={() => setDetailsLoja(null)}>
          <div style={{ ...modalStyle, maxWidth: 640, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 4px', color: '#f0f0f0' }}>
              {detailsLoja.nome}
            </h3>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 18px' }}>
              /{detailsLoja.slug} · {detailsLoja.cidade}/{detailsLoja.estado}
            </p>

            <InfoRow label="Status" value={<span style={{ color: STATUS_STYLE[detailsLoja.status].color, fontWeight: 700 }}>{STATUS_STYLE[detailsLoja.status].label}</span>} />
            <InfoRow label="Plano"  value={<span style={{ color: PLANO_STYLE[detailsLoja.plano].color, fontWeight: 700 }}>{PLANO_STYLE[detailsLoja.plano].label}</span>} />
            <InfoRow label="Verificada" value={detailsLoja.verificada ? '✓ Sim' : 'Não'} />
            <InfoRow label="Tipo" value={detailsLoja.tipo === 'fisica' ? 'Física' : detailsLoja.tipo === 'online' ? 'Online' : 'Física + Online'} />
            <InfoRow label="Especialidades" value={detailsLoja.especialidades?.join(', ') || '—'} />
            <InfoRow label="Owner" value={detailsLoja.owner_name ? `${detailsLoja.owner_name} (${detailsLoja.owner_email})` : detailsLoja.owner_email || '—'} />
            <InfoRow label="Cadastrada em" value={fmtDateTime(detailsLoja.created_at)} />
            <InfoRow label="Aprovada em"   value={fmtDateTime(detailsLoja.aprovada_data)} />
            {detailsLoja.status === 'suspensa' && (
              <>
                <InfoRow label="Suspensa em" value={fmtDateTime(detailsLoja.suspensao_data)} />
                <InfoRow label="Motivo"      value={detailsLoja.suspensao_motivo || '—'} />
              </>
            )}
            {detailsLoja.plano_expira_em && (
              <InfoRow label="Plano expira em" value={fmtDateTime(detailsLoja.plano_expira_em)} />
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
              <a href={`/lojas/${detailsLoja.slug}`} target="_blank" rel="noopener noreferrer" style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.7)',
                padding: '8px 14px', borderRadius: 8,
                fontSize: 12, fontWeight: 600,
                textDecoration: 'none',
              }}>
                Abrir página pública →
              </a>
              {detailsLoja.owner_user_id && (
                <a href={`/admin/users/${detailsLoja.owner_user_id}`} target="_blank" rel="noopener noreferrer" style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.7)',
                  padding: '8px 14px', borderRadius: 8,
                  fontSize: 12, fontWeight: 600,
                  textDecoration: 'none',
                }}>
                  Ver perfil do owner →
                </a>
              )}
              <button onClick={() => setDetailsLoja(null)} style={{
                marginLeft: 'auto',
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                border: 'none', color: '#000',
                padding: '10px 20px', borderRadius: 10,
                fontSize: 13, fontWeight: 800,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Componentes auxiliares ──────────────────────────────────────────────

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: '12px 18px',
      flex: 1, minWidth: 130,
    }}>
      <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.4)', margin: '0 0 6px' }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 800, color, margin: 0, letterSpacing: '-0.03em' }}>
        {value}
      </p>
    </div>
  )
}

function BtnAction({ children, onClick, busy, color, variant = 'solid' }: {
  children: React.ReactNode
  onClick: () => void
  busy: boolean
  color: string
  variant?: 'solid' | 'ghost'
}) {
  return (
    <button onClick={onClick} disabled={busy} style={{
      background: variant === 'ghost' ? 'transparent' : `${color}14`,
      border: `1px solid ${variant === 'ghost' ? 'rgba(255,255,255,0.1)' : `${color}4d`}`,
      color,
      padding: '6px 12px', borderRadius: 8,
      fontSize: 11, fontWeight: 700,
      cursor: busy ? 'not-allowed' : 'pointer',
      opacity: busy ? 0.5 : 1,
      fontFamily: 'inherit',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', width: 140, flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', wordBreak: 'break-word', flex: 1 }}>
        {value}
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9000,
  background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
}

const modalStyle: React.CSSProperties = {
  background: '#0f1117', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 20, padding: '28px 28px', width: '100%', maxWidth: 480,
  fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0',
  boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
}

const pgBtn = (disabled: boolean): React.CSSProperties => ({
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)',
  padding: '6px 14px', borderRadius: 8,
  fontSize: 12, fontFamily: 'inherit',
  cursor: disabled ? 'not-allowed' : 'pointer',
})

export default function AdminLojasPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Sans' }}>Carregando...</div>}>
      <LojasView />
    </Suspense>
  )
}
