'use client'

// Admin — detalhe do parceiro: cupom, resumo de comissoes, fechamento de
// ciclo (linhas 30d+ fora da janela de refund), pagamentos e ajuste manual.
// Molde: src/app/admin/users/[id]/page.tsx (casca, fetch, loading/erro).

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useAppModal } from '@/components/ui/useAppModal'
import { IconWarning } from '@/components/ui/Icons'

type Parceiro = {
  id: string
  nome: string
  cupom_code: string
  desconto_pct: number
  comissao_primeira_pct: number
  comissao_renovacao_pct: number
  recorrente_meses: number
  pix_chave: string | null
  ativo: boolean
}

type Comissao = {
  id: string
  tipo: 'venda' | 'renovacao' | 'estorno' | 'ajuste'
  plano: string | null
  valor_base_cents: number
  comissao_cents: number
  fechamento_id: string | null
  observacao: string | null
  criado_em: string
}

type Fechamento = {
  id: string
  periodo_inicio: string
  periodo_fim: string
  total_comissao_cents: number
  qtd_linhas: number
  status: 'fechado' | 'pago'
  pago_em: string | null
  comprovante: string | null
  criado_em: string
}

type Resumo = {
  pendenteCents: number
  elegivelCents: number
  elegivelLinhas: number
  naJanelaCents: number
}

const TIPO_LABEL: Record<Comissao['tipo'], string> = {
  venda: 'Venda',
  renovacao: 'Renovação',
  estorno: 'Estorno',
  ajuste: 'Ajuste',
}

const fmtCents = (cents: number) =>
  ((Number(cents) || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Datas 'YYYY-MM-DD' (periodo) — parse manual pra nao voltar um dia no fuso BRT
const fmtDia = (d?: string | null) => {
  if (!d) return '—'
  const [y, m, dd] = d.slice(0, 10).split('-')
  return y && m && dd ? `${dd}/${m}/${y.slice(2)}` : '—'
}

const fmtDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

// "12,50" / "-12,50" / "R$ 1.234,56" / "12.50" -> centavos (aceita negativo).
// Sem virgula, o ponto e decimal ("12.50") — EXCETO no padrao de milhar
// pt-BR ("1.250", "1.234.567"), senao R$ 1.250 digitado viraria R$ 1,25.
function parseReaisToCents(raw: string): number | null {
  const s = raw.trim().replace(/[R$\s]/g, '')
  if (!s) return null
  const neg = s.startsWith('-')
  let clean = s.replace(/-/g, '')
  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.')
  } else {
    const partes = clean.split('.')
    if (partes.length > 2 || (partes.length === 2 && partes[1].length === 3)) {
      clean = partes.join('')
    }
  }
  const v = parseFloat(clean)
  if (!Number.isFinite(v)) return null
  const cents = Math.round(v * 100) * (neg ? -1 : 1)
  return cents === 0 ? null : cents
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AdminParceiroDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { showAlert, showConfirm } = useAppModal()

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)
  const [busy, setBusy] = useState(false)

  const [parceiro, setParceiro] = useState<Parceiro | null>(null)
  const [comissoes, setComissoes] = useState<Comissao[]>([])
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)

  // comprovante por fechamento (campo livre, opcional)
  const [comprovanteDraft, setComprovanteDraft] = useState<Record<string, string>>({})

  // ajuste manual (secao discreta no fim)
  const [ajusteOpen, setAjusteOpen] = useState(false)
  const [ajusteValor, setAjusteValor] = useState('')
  const [ajusteObs, setAjusteObs] = useState('')

  async function load() {
    setLoading(true)
    setErro(false)
    try {
      const res = await fetch(`/api/admin/parceiros/${id}`)
      if (!res.ok) { setErro(true); return }
      const d = await res.json()
      setParceiro(d.parceiro)
      setComissoes(d.comissoes || [])
      setFechamentos(d.fechamentos || [])
      setResumo(d.resumo || null)
    } catch {
      setErro(true)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [id])

  async function patch(body: Record<string, unknown>): Promise<{ ok: boolean; data: any }> {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/parceiros/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      return { ok: res.ok, data }
    } catch {
      return { ok: false, data: { error: 'Erro de rede.' } }
    } finally {
      setBusy(false)
    }
  }

  // ─── Ações ────────────────────────────────────────────────────────────────

  async function togglePausa() {
    if (!parceiro) return
    const pausar = parceiro.ativo
    const ok = await showConfirm({
      message: pausar
        ? `Pausar o cupom ${parceiro.cupom_code}? Ele para de funcionar na hora para novas assinaturas.`
        : `Reativar o cupom ${parceiro.cupom_code}?`,
      danger: pausar,
      confirmLabel: pausar ? 'Pausar cupom' : 'Reativar',
    })
    if (!ok) return
    const r = await patch({ acao: pausar ? 'pausar' : 'ativar' })
    if (!r.ok) return showAlert(r.data.error || 'Erro ao atualizar o cupom.', 'error')
    showAlert(pausar ? 'Cupom pausado.' : 'Cupom reativado.', 'success')
    await load()
  }

  async function fecharCiclo() {
    if (!resumo) return
    const ok = await showConfirm({
      message: `Fechar ciclo com ${resumo.elegivelLinhas} linha${resumo.elegivelLinhas === 1 ? '' : 's'} (${fmtCents(resumo.elegivelCents)})? As linhas ficam carimbadas neste fechamento.`,
      confirmLabel: 'Fechar ciclo',
    })
    if (!ok) return
    const r = await patch({ acao: 'fechar_ciclo' })
    if (!r.ok) return showAlert(r.data.error || 'Erro ao fechar o ciclo.', 'error')
    showAlert(`Ciclo fechado: ${fmtCents(r.data.totalCents)} em ${r.data.linhas} linha${r.data.linhas === 1 ? '' : 's'}.`, 'success')
    await load()
  }

  async function marcarPago(f: Fechamento) {
    const comprovante = (comprovanteDraft[f.id] || '').trim()
    const ok = await showConfirm({
      message: `Marcar como pago o fechamento de ${fmtDia(f.periodo_inicio)} a ${fmtDia(f.periodo_fim)} (${fmtCents(f.total_comissao_cents)})?${comprovante ? `\n\nComprovante: ${comprovante}` : '\n\nSem comprovante informado.'}`,
      confirmLabel: 'Marcar pago',
    })
    if (!ok) return
    const r = await patch({ acao: 'marcar_pago', fechamento_id: f.id, comprovante })
    if (!r.ok) return showAlert(r.data.error || 'Erro ao marcar como pago.', 'error')
    showAlert('Fechamento marcado como pago e despesa lançada no financeiro.', 'success')
    await load()
  }

  async function enviarAjuste() {
    const cents = parseReaisToCents(ajusteValor)
    if (cents === null) {
      return showAlert('Valor inválido. Use o formato 12,50 (negativo permitido, zero não).', 'warning')
    }
    if (!ajusteObs.trim()) {
      return showAlert('A observação é obrigatória num ajuste manual.', 'warning')
    }
    const ok = await showConfirm({
      message: `Lançar ajuste de ${fmtCents(cents)} no ledger de ${parceiro?.nome}?\n\nObservação: ${ajusteObs.trim()}`,
      danger: cents < 0,
      confirmLabel: 'Lançar ajuste',
    })
    if (!ok) return
    const r = await patch({ acao: 'ajuste', comissao_cents: cents, observacao: ajusteObs.trim() })
    if (!r.ok) return showAlert(r.data.error || 'Erro ao lançar o ajuste.', 'error')
    showAlert('Ajuste lançado.', 'success')
    setAjusteValor('')
    setAjusteObs('')
    setAjusteOpen(false)
    await load()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--bx-text-3)', textAlign: 'center' }}>Carregando...</div>
  }

  if (erro || !parceiro) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--bx-red)', marginBottom: 12 }}>
          {erro ? 'Não deu pra carregar este parceiro.' : 'Parceiro não encontrado.'}
        </p>
        {erro && (
          <button onClick={load} className="pz-btn" style={{ ...btnGhost, marginBottom: 14 }}>
            Tentar de novo
          </button>
        )}
        <br />
        <Link href="/admin/parceiros" style={{ color: 'var(--ac-1)', fontSize: 14, textDecoration: 'none' }}>
          ← Voltar
        </Link>
      </div>
    )
  }

  const semElegivel = !resumo || resumo.elegivelLinhas === 0

  return (
    <div style={{ padding: '28px 20px', maxWidth: 900, margin: '0 auto' }}>

      <Link href="/admin/parceiros" style={{ color: 'var(--bx-text-3)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', gap: 6, marginBottom: 14 }}>
        ← Voltar para Parceiros
      </Link>

      {/* ── Header ── */}
      <section style={{ ...surface, borderRadius: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: 'var(--bx-text)' }}>
                {parceiro.nome}
              </h1>
              <span style={parceiro.ativo ? chipVerde : chipVermelho}>
                {parceiro.ativo ? 'Cupom ativo' : 'Cupom pausado'}
              </span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--bx-text-2)' }}>
              Cupom{' '}
              <span style={{
                fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                color: 'var(--ac-1)', background: 'rgba(var(--ac-1-rgb), 0.12)',
                padding: '2px 8px', borderRadius: 6, letterSpacing: '0.04em',
              }}>
                {parceiro.cupom_code}
              </span>
              {' '}· {parceiro.desconto_pct}% de desconto
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--bx-text-3)', lineHeight: 1.6 }}>
              Comissão: {parceiro.comissao_primeira_pct}% na primeira · {parceiro.comissao_renovacao_pct}% na renovação
              {parceiro.recorrente_meses > 0 ? ` por ${parceiro.recorrente_meses} ${parceiro.recorrente_meses === 1 ? 'mês' : 'meses'}` : ''}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--bx-text-3)' }}>
              Pix: <span style={{ fontFamily: 'monospace', color: 'var(--bx-text-2)', wordBreak: 'break-all' }}>{parceiro.pix_chave || '—'}</span>
            </p>
          </div>

          <button
            onClick={togglePausa}
            disabled={busy}
            className="pz-btn"
            style={parceiro.ativo ? btnDestrutivoGhost : btnVerdeGhost}
          >
            {parceiro.ativo ? 'Pausar cupom' : 'Reativar cupom'}
          </button>
        </div>
      </section>

      {/* ── Resumo + fechar ciclo ── */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 12 }}>
        <div style={{ ...surface, padding: '16px 18px' }}>
          <p style={statLabel}>Elegível pra fechamento</p>
          <p style={{ ...statValue, color: resumo && resumo.elegivelCents > 0 ? 'var(--bx-green)' : 'var(--bx-text)' }}>
            {fmtCents(resumo?.elegivelCents || 0)}
          </p>
          <p style={statHint}>
            {resumo?.elegivelLinhas || 0} linha{(resumo?.elegivelLinhas || 0) === 1 ? '' : 's'} com 30d+
          </p>
        </div>
        <div style={{ ...surface, padding: '16px 18px' }}>
          <p style={statLabel}>Ainda na janela de 30d</p>
          <p style={statValue}>{fmtCents(resumo?.naJanelaCents || 0)}</p>
          <p style={statHint}>libera conforme completa 30 dias</p>
        </div>
      </section>

      <button
        onClick={fecharCiclo}
        disabled={busy || semElegivel}
        className="pz-btn"
        style={{
          ...btnPrimario,
          width: '100%', marginBottom: 24,
          opacity: busy || semElegivel ? 0.45 : 1,
          cursor: busy || semElegivel ? 'not-allowed' : 'pointer',
        }}
      >
        {semElegivel ? 'Fechar ciclo — nada elegível ainda' : `Fechar ciclo (${fmtCents(resumo?.elegivelCents || 0)})`}
      </button>

      {/* ── Fechamentos ── */}
      <h2 style={sectionTitle}>Fechamentos</h2>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {fechamentos.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--bx-text-3)', margin: 0, padding: '14px 2px' }}>
            Nenhum ciclo fechado ainda.
          </p>
        )}
        {fechamentos.map(f => (
          <div key={f.id} style={{ ...surface, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--bx-text)' }}>
                  {fmtDia(f.periodo_inicio)} — {fmtDia(f.periodo_fim)}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--bx-text-3)' }}>
                  {f.qtd_linhas} linha{f.qtd_linhas === 1 ? '' : 's'} · fechado em {fmtDateTime(f.criado_em)}
                </p>
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--bx-text)', fontVariantNumeric: 'tabular-nums' }}>
                {fmtCents(f.total_comissao_cents)}
              </span>
              <span style={f.status === 'pago' ? chipVerde : chipAcento}>
                {f.status === 'pago' ? 'Pago' : 'Aguardando Pix'}
              </span>
            </div>

            {f.status === 'pago' ? (
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--bx-text-3)', borderTop: '1px solid var(--bx-border)', paddingTop: 10 }}>
                Pago em {fmtDateTime(f.pago_em)}
                {f.comprovante ? <> · Comprovante: <span style={{ color: 'var(--bx-text-2)' }}>{f.comprovante}</span></> : ''}
              </p>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, borderTop: '1px solid var(--bx-border)', paddingTop: 12, flexWrap: 'wrap' }}>
                <input
                  value={comprovanteDraft[f.id] || ''}
                  onChange={e => setComprovanteDraft(prev => ({ ...prev, [f.id]: e.target.value }))}
                  placeholder="Comprovante (E2E do Pix, opcional)"
                  style={{ ...inputBase, flex: 1, minWidth: 200 }}
                />
                <button onClick={() => marcarPago(f)} disabled={busy} className="pz-btn" style={btnVerdeGhost}>
                  Marcar pago
                </button>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ── Ledger ── */}
      <h2 style={sectionTitle}>Ledger de comissões</h2>
      <section style={{ ...surface, padding: '4px 16px', marginBottom: 28 }}>
        {comissoes.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--bx-text-3)', padding: '18px 0' }}>
            Nenhuma comissão registrada ainda.
          </p>
        )}
        {comissoes.map((c, i) => {
          const cents = Number(c.comissao_cents) || 0
          const negativo = cents < 0
          return (
            <div key={c.id} style={{ padding: '12px 0', borderTop: i > 0 ? '1px solid var(--bx-border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--bx-text-3)', whiteSpace: 'nowrap' }}>
                  {fmtDateTime(c.criado_em)}
                </span>
                <span style={c.tipo === 'estorno' ? chipVermelho : c.tipo === 'ajuste' ? chipAcento : chipNeutro}>
                  {TIPO_LABEL[c.tipo] || c.tipo}
                </span>
                {c.plano && <span style={{ fontSize: 12, color: 'var(--bx-text-2)' }}>{c.plano}</span>}
                {c.fechamento_id && <span style={chipNeutro}>no fechamento</span>}
                <span style={{
                  marginLeft: 'auto', fontSize: 14, fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: negativo ? 'var(--bx-red)' : 'var(--bx-green)',
                }}>
                  {fmtCents(cents)}
                </span>
              </div>
              {c.observacao && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--bx-text-3)', lineHeight: 1.5 }}>
                  {c.observacao}
                </p>
              )}
            </div>
          )
        })}
      </section>

      {/* ── Ajuste manual ── */}
      <section style={{ marginBottom: 40 }}>
        {!ajusteOpen ? (
          <button onClick={() => setAjusteOpen(true)} className="pz-btn" style={{ ...btnGhost, fontSize: 12 }}>
            Ajuste manual…
          </button>
        ) : (
          <div style={{ ...surface, padding: '16px 18px' }}>
            <p style={{ ...sectionTitle, margin: '0 0 4px' }}>
              <IconWarning size={12} style={{ display: 'inline-block', verticalAlign: -2, marginRight: 4 }} />
              Ajuste manual
            </p>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--bx-text-3)', lineHeight: 1.5 }}>
              Lança uma linha avulsa no ledger (dispute perdido, correção). Valor negativo desconta do próximo ciclo.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={ajusteValor}
                onChange={e => setAjusteValor(e.target.value)}
                placeholder="Valor em R$ (ex.: -12,50)"
                inputMode="decimal"
                style={{ ...inputBase, width: 170 }}
              />
              <input
                value={ajusteObs}
                onChange={e => setAjusteObs(e.target.value)}
                placeholder="Observação (obrigatória)"
                style={{ ...inputBase, flex: 1, minWidth: 200 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setAjusteOpen(false); setAjusteValor(''); setAjusteObs('') }} className="pz-btn" style={btnGhost}>
                  Cancelar
                </button>
                <button onClick={enviarAjuste} disabled={busy} className="pz-btn" style={btnPrimario}>
                  Lançar
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <style>{`
        .pz-btn { transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease; }
        .pz-btn:hover:not(:disabled) { filter: brightness(1.1); }
        @media (prefers-reduced-motion: reduce) {
          .pz-btn { transition: none; }
        }
      `}</style>
    </div>
  )
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const surface: React.CSSProperties = {
  background: 'var(--bx-surface)',
  border: '1px solid var(--bx-border)',
  borderRadius: 12,
  padding: '20px 22px',
}

const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 800,
  textTransform: 'uppercase', letterSpacing: '0.1em',
  color: 'var(--bx-text-3)',
  margin: '0 0 10px',
}

const statLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  color: 'var(--bx-text-3)',
  margin: '0 0 6px',
}

const statValue: React.CSSProperties = {
  fontSize: 20, fontWeight: 800,
  letterSpacing: '-0.02em',
  color: 'var(--bx-text)',
  margin: 0,
  fontVariantNumeric: 'tabular-nums',
}

const statHint: React.CSSProperties = {
  fontSize: 11, color: 'var(--bx-text-3)',
  margin: '4px 0 0',
}

const inputBase: React.CSSProperties = {
  background: 'var(--bx-surface-2)',
  border: '1px solid var(--bx-border)',
  borderRadius: 8, padding: '8px 12px',
  color: 'var(--bx-text)', fontSize: 13,
  outline: 'none', fontFamily: 'inherit',
}

const btnBase: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 10,
  fontSize: 13, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

const btnPrimario: React.CSSProperties = {
  ...btnBase,
  background: 'var(--ac-grad)',
  border: 'none',
  color: 'var(--bx-brand-ink, #0a0a0a)',
  fontWeight: 800,
}

const btnGhost: React.CSSProperties = {
  ...btnBase,
  background: 'transparent',
  border: '1px solid var(--bx-border-2)',
  color: 'var(--bx-text-2)',
}

const btnDestrutivoGhost: React.CSSProperties = {
  ...btnBase,
  background: 'transparent',
  border: '1px solid rgba(239,68,68,0.3)',
  color: 'var(--bx-red)',
}

const btnVerdeGhost: React.CSSProperties = {
  ...btnBase,
  background: 'transparent',
  border: '1px solid var(--bx-green)',
  color: 'var(--bx-green)',
}

const chipBase: React.CSSProperties = {
  fontSize: 10, fontWeight: 800,
  padding: '3px 9px', borderRadius: 999,
  textTransform: 'uppercase', letterSpacing: '0.06em',
  whiteSpace: 'nowrap',
}

const chipVerde: React.CSSProperties = {
  ...chipBase,
  color: 'var(--bx-green)',
  background: 'rgba(34,197,94,0.1)',
  border: '1px solid rgba(34,197,94,0.3)',
}

const chipVermelho: React.CSSProperties = {
  ...chipBase,
  color: 'var(--bx-red)',
  background: 'rgba(239,68,68,0.1)',
  border: '1px solid rgba(239,68,68,0.3)',
}

const chipAcento: React.CSSProperties = {
  ...chipBase,
  color: 'var(--ac-1)',
  background: 'rgba(var(--ac-1-rgb), 0.12)',
  border: '1px solid rgba(var(--ac-1-rgb), 0.3)',
}

const chipNeutro: React.CSSProperties = {
  ...chipBase,
  color: 'var(--bx-text-3)',
  background: 'var(--bx-surface-2)',
  border: '1px solid var(--bx-border)',
}
