'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconPlus, IconWarning, IconClose } from '@/components/ui/Icons'

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
  criado_em: string
  pendenteCents: number
  vendasCiclo: number
}

type StripeInfo = { promotionCodeId: string; ativo: boolean; percentOff: number | null; duration: string | null }

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const FORM_INICIAL = {
  email: '',
  nome: '',
  cupom_code: '',
  desconto_pct: '15',
  comissao_primeira_pct: '100',
  comissao_renovacao_pct: '20',
  recorrente_meses: '12',
  pix_chave: '',
}

export default function AdminParceirosPage() {
  const router = useRouter()

  const [parceiros, setParceiros] = useState<Parceiro[] | null>(null)
  const [loading, setLoading]     = useState(true)
  const [loadErro, setLoadErro]   = useState<string | null>(null)

  // Form de criacao
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm]             = useState({ ...FORM_INICIAL })
  const [salvando, setSalvando]     = useState(false)
  const [formErro, setFormErro]     = useState<string | null>(null)
  // Aviso pos-criacao quando o cupom ja existia na Stripe (fica na tela pro
  // admin conferir se percentOff/duration batem com o combinado)
  const [avisoVinculado, setAvisoVinculado] = useState<StripeInfo | null>(null)

  async function load() {
    setLoading(true)
    setLoadErro(null)
    try {
      const res = await fetch('/api/admin/parceiros')
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoadErro(d.error || `Erro ${res.status} ao carregar parceiros`)
        return
      }
      setParceiros(d.parceiros || [])
    } catch {
      setLoadErro('Erro de rede ao carregar parceiros')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function setCampo(campo: keyof typeof FORM_INICIAL, valor: string) {
    setForm(f => ({ ...f, [campo]: campo === 'cupom_code' ? valor.toUpperCase().replace(/\s/g, '') : valor }))
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    if (salvando) return
    setFormErro(null)
    setAvisoVinculado(null)

    if (!form.email.trim() || !form.nome.trim() || !form.cupom_code.trim()) {
      setFormErro('Email, nome e código do cupom são obrigatórios.')
      return
    }

    setSalvando(true)
    try {
      const payload = {
        email: form.email.trim(),
        nome: form.nome.trim(),
        cupom_code: form.cupom_code.trim(),
        desconto_pct: Number(form.desconto_pct),
        comissao_primeira_pct: Number(form.comissao_primeira_pct),
        comissao_renovacao_pct: Number(form.comissao_renovacao_pct),
        recorrente_meses: Number(form.recorrente_meses),
        pix_chave: form.pix_chave.trim() || null,
      }
      const criar = (extra?: Record<string, unknown>) => fetch('/api/admin/parceiros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, ...extra }),
      })
      let res = await criar()
      let d = await res.json().catch(() => ({}))
      // Cupom compatível já existe na Stripe: a API pede confirmação
      // explícita ANTES de vincular (409 + precisaConfirmar).
      if (res.status === 409 && d.precisaConfirmar) {
        const p = d.promoExistente || {}
        const okVincular = window.confirm(
          `O cupom ${payload.cupom_code} já existe na Stripe (${p.percentOff ?? '?'}% off, duração '${p.duration ?? '?'}').\n\nVincular esse cupom ao parceiro?`
        )
        if (!okVincular) {
          setFormErro('Criação cancelada — o cupom já existia na Stripe.')
          return
        }
        res = await criar({ confirmar_vinculo: true })
        d = await res.json().catch(() => ({}))
      }
      if (!res.ok || !d.ok) {
        setFormErro(d.error || `Erro ${res.status} ao criar parceiro`)
        return
      }
      if (d.vinculadoExistente && d.stripe) setAvisoVinculado(d.stripe as StripeInfo)
      setForm({ ...FORM_INICIAL })
      setFormAberto(false)
      await load()
    } catch {
      setFormErro('Erro de rede ao criar parceiro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="pcx-page" style={{ maxWidth: 1100, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 4px', color: 'var(--bx-text)' }}>
            Parceiros
          </h1>
          <p style={{ fontSize: 13, color: 'var(--bx-text-3)', margin: 0 }}>
            Cupons de indicação e comissões
          </p>
        </div>
        <button
          onClick={() => { setFormAberto(v => !v); setFormErro(null) }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: formAberto ? 'var(--bx-surface-2)' : 'var(--ac-grad)',
            border: formAberto ? '1px solid var(--bx-border-2)' : '1px solid transparent',
            color: formAberto ? 'var(--bx-text-2)' : 'var(--bx-brand-ink, #0a0a0a)',
            padding: '9px 16px', borderRadius: 10,
            fontSize: 13, fontWeight: 800, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'opacity 0.15s ease',
          }}
        >
          {formAberto
            ? <><IconClose size={14} color="currentColor" /> Fechar</>
            : <><IconPlus size={14} color="currentColor" /> Novo parceiro</>}
        </button>
      </div>

      {/* Aviso: cupom ja existia na Stripe */}
      {avisoVinculado && (
        <div style={{
          background: 'rgba(var(--ac-1-rgb), 0.12)',
          border: '1px solid var(--bx-border-2)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 16,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <IconWarning size={15} color="var(--ac-1)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ac-1)', margin: '0 0 2px' }}>
              Cupom já existia na Stripe — vinculado
            </p>
            <p style={{ fontSize: 12, color: 'var(--bx-text-2)', margin: 0, lineHeight: 1.5 }}>
              Confira se bate com o combinado: desconto de <strong>{avisoVinculado.percentOff ?? '?'}%</strong>
              {' '}· duração <strong>{avisoVinculado.duration || '—'}</strong>
              {' '}· {avisoVinculado.ativo ? 'ativo' : 'inativo'} na Stripe
            </p>
          </div>
          <button onClick={() => setAvisoVinculado(null)} aria-label="Fechar aviso" style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 2,
            color: 'var(--bx-text-3)', fontFamily: 'inherit',
          }}>
            <IconClose size={14} color="currentColor" />
          </button>
        </div>
      )}

      {/* Form novo parceiro */}
      {formAberto && (
        <form onSubmit={criar} style={{
          background: 'var(--bx-surface)',
          border: '1px solid var(--bx-border)',
          borderRadius: 12, padding: 16, marginBottom: 20,
        }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--bx-text)', margin: '0 0 14px', letterSpacing: '-0.01em' }}>
            Novo parceiro
          </p>

          <div className="pcx-grid">
            <Campo label="Email da conta Bynx" obrigatorio>
              <input type="email" value={form.email} onChange={e => setCampo('email', e.target.value)}
                placeholder="parceiro@email.com" style={inputStyle} />
            </Campo>
            <Campo label="Nome" obrigatorio>
              <input value={form.nome} onChange={e => setCampo('nome', e.target.value)}
                placeholder="Nome do parceiro" style={inputStyle} />
            </Campo>
            <Campo label="Código do cupom" obrigatorio>
              <input value={form.cupom_code} onChange={e => setCampo('cupom_code', e.target.value)}
                placeholder="PARCEIRO15" style={{ ...inputStyle, letterSpacing: '0.1em', fontWeight: 700 }} />
            </Campo>
            <Campo label="% desconto">
              <input type="number" min={0} max={100} value={form.desconto_pct}
                onChange={e => setCampo('desconto_pct', e.target.value)} style={inputStyle} />
            </Campo>
            <Campo label="% comissão 1ª cobrança">
              <input type="number" min={0} max={100} value={form.comissao_primeira_pct}
                onChange={e => setCampo('comissao_primeira_pct', e.target.value)} style={inputStyle} />
            </Campo>
            <Campo label="% comissão renovação">
              <input type="number" min={0} max={100} value={form.comissao_renovacao_pct}
                onChange={e => setCampo('comissao_renovacao_pct', e.target.value)} style={inputStyle} />
            </Campo>
            <Campo label="Meses de recorrência">
              <input type="number" min={0} value={form.recorrente_meses}
                onChange={e => setCampo('recorrente_meses', e.target.value)} style={inputStyle} />
            </Campo>
            <Campo label="Chave Pix (opcional)">
              <input value={form.pix_chave} onChange={e => setCampo('pix_chave', e.target.value)}
                placeholder="CPF, email ou aleatória" style={inputStyle} />
            </Campo>
          </div>

          {formErro && (
            <p style={{
              fontSize: 12, color: 'var(--bx-red)', margin: '12px 0 0',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '8px 12px',
            }}>
              {formErro}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
            <button type="button" onClick={() => { setFormAberto(false); setFormErro(null) }} style={{
              background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)',
              color: 'var(--bx-text-2)', padding: '9px 18px', borderRadius: 10,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando} style={{
              background: 'var(--ac-grad)', border: 'none', color: 'var(--bx-brand-ink, #0a0a0a)',
              padding: '9px 22px', borderRadius: 10,
              fontSize: 13, fontWeight: 800,
              cursor: salvando ? 'not-allowed' : 'pointer',
              opacity: salvando ? 0.6 : 1, fontFamily: 'inherit',
              transition: 'opacity 0.15s ease',
            }}>
              {salvando ? 'Criando...' : 'Criar parceiro'}
            </button>
          </div>
        </form>
      )}

      {/* Lista */}
      {loading ? (
        <p style={{ color: 'var(--bx-text-3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Carregando...</p>
      ) : loadErro ? (
        <div style={{
          background: 'rgba(239,68,68,0.06)', border: '1px dashed rgba(239,68,68,0.3)',
          borderRadius: 12, padding: '32px 20px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 13, color: 'var(--bx-red)', margin: '0 0 12px', wordBreak: 'break-word' }}>{loadErro}</p>
          <button onClick={load} style={{
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--bx-red)', fontWeight: 700, fontSize: 12,
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Tentar de novo
          </button>
        </div>
      ) : !parceiros || parceiros.length === 0 ? (
        <div style={{
          background: 'var(--bx-surface)', border: '1px dashed var(--bx-border)',
          borderRadius: 12, padding: '40px 20px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: 'var(--bx-text-3)', margin: 0 }}>Nenhum parceiro ainda</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {parceiros.map(p => (
            <div
              key={p.id}
              className="pcx-card"
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/admin/parceiros/${p.id}`)}
              onKeyDown={e => { if (e.key === 'Enter') router.push(`/admin/parceiros/${p.id}`) }}
            >
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--bx-text)', margin: 0 }}>{p.nome}</p>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: p.ativo ? 'var(--bx-green)' : 'var(--bx-text-3)',
                    background: p.ativo ? 'rgba(34,197,94,0.10)' : 'var(--bx-surface-2)',
                    border: `1px solid ${p.ativo ? 'rgba(34,197,94,0.3)' : 'var(--bx-border)'}`,
                  }}>
                    {p.ativo ? 'Ativo' : 'Pausado'}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--bx-text-3)', margin: 0 }}>
                  {p.vendasCiclo} {p.vendasCiclo === 1 ? 'venda' : 'vendas'} no ciclo
                  {' '}· pendente <span style={{ color: p.pendenteCents > 0 ? 'var(--bx-green)' : 'var(--bx-text-3)', fontWeight: 700 }}>{fmtBRL(p.pendenteCents)}</span>
                </p>
              </div>
              <span style={{
                fontSize: 13, fontWeight: 700, letterSpacing: '0.12em',
                color: 'var(--ac-1)', background: 'rgba(var(--ac-1-rgb), 0.12)',
                border: '1px solid var(--bx-border)',
                padding: '5px 12px', borderRadius: 8, whiteSpace: 'nowrap',
              }}>
                {p.cupom_code}
              </span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .pcx-page { padding: 24px 16px; }
        @media (min-width: 768px) { .pcx-page { padding: 32px 24px; } }
        .pcx-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 640px) { .pcx-grid { grid-template-columns: 1fr 1fr; } }
        .pcx-card {
          background: var(--bx-surface);
          border: 1px solid var(--bx-border);
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
        }
        .pcx-card:hover {
          transform: translateY(-2px);
          background: var(--bx-surface-2);
          border-color: var(--bx-border-2);
        }
        @media (prefers-reduced-motion: reduce) {
          .pcx-card, .pcx-card:hover { transition: none; transform: none; }
        }
      `}</style>
    </div>
  )
}

// ─── Auxiliares ──────────────────────────────────────────────────────────

function Campo({ label, obrigatorio, children }: { label: string; obrigatorio?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{
        display: 'block', fontSize: 11, fontWeight: 700,
        color: 'var(--bx-text-3)', textTransform: 'uppercase',
        letterSpacing: '0.07em', marginBottom: 6,
      }}>
        {label}{obrigatorio && <span style={{ color: 'var(--ac-1)' }}> *</span>}
      </span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--bx-surface-2)',
  border: '1px solid var(--bx-border)',
  borderRadius: 8,
  padding: '9px 12px',
  color: 'var(--bx-text)',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
}
