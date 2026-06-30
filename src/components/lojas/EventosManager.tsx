'use client'

import { CSSProperties, useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

// ─── Constantes ─────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  torneio: 'Torneio',
  liga: 'Liga',
  pre_lancamento: 'Pré-lançamento',
  encontro: 'Encontro',
  outro: 'Outro',
}
const RECOR_LABELS: Record<string, string> = {
  nenhuma: 'Não repete',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
}

interface Evento {
  id: string
  loja_id: string
  titulo: string
  tipo: string
  data_inicio: string
  data_fim: string | null
  recorrencia: string
  recorrencia_fim: string | null
  local: string | null
  descricao: string | null
  link: string | null
  banner: string | null
  status: string
}

type FormState = {
  id?: string
  titulo: string
  tipo: string
  status: string
  data_inicio: string
  data_fim: string
  recorrencia: string
  recorrencia_fim: string
  local: string
  link: string
  banner: string
  descricao: string
}

const FORM_VAZIO: FormState = {
  titulo: '', tipo: 'torneio', status: 'rascunho',
  data_inicio: '', data_fim: '', recorrencia: 'nenhuma', recorrencia_fim: '',
  local: '', link: '', banner: '', descricao: '',
}

// ─── Helpers de data ──────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')

function isoParaInputDateTime(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function isoParaInputDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function rotuloQuando(ev: Evento): string {
  const d = new Date(ev.data_inicio)
  if (isNaN(d.getTime())) return '—'
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (ev.recorrencia === 'nenhuma') {
    return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'long' })
  if (ev.recorrencia === 'semanal') return `Toda ${dia}, ${hora}`
  if (ev.recorrencia === 'quinzenal') return `Quinzenal · ${dia}, ${hora}`
  if (ev.recorrencia === 'mensal') return `Mensal · dia ${d.getDate()}, ${hora}`
  return hora
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  lojaId: string
  /** true = autentica por cookie admin (bynx_admin); false/omitido = owner via Bearer da sessão Supabase */
  admin?: boolean
  /** Título do bloco. Default: "Eventos" */
  titulo?: string
  /** Subtítulo opcional sob o título */
  sub?: string
  /** Nota informativa opcional (ex.: aviso de gating premium) */
  nota?: string
  /** Se true, anexa "· {nome da loja}" ao título quando carregado (uso no admin) */
  mostrarNomeLoja?: boolean
}

// ─── Componente ─────────────────────────────────────────────────────────────

export default function EventosManager({
  lojaId,
  admin = false,
  titulo = 'Eventos',
  sub,
  nota,
  mostrarNomeLoja = false,
}: Props) {
  const [lojaNome, setLojaNome] = useState<string>('')
  const [eventos, setEventos] = useState<Evento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState | null>(null) // null = form fechado
  const [saving, setSaving] = useState(false)
  const [formErro, setFormErro] = useState<string | null>(null)

  // Fetch com auth correta: admin = cookie; owner = Bearer da sessão
  const authFetch = useCallback(
    async (url: string, opts: RequestInit = {}): Promise<Response> => {
      const headers: Record<string, string> = { ...((opts.headers as Record<string, string>) || {}) }
      if (admin) {
        return fetch(url, { ...opts, headers, credentials: 'same-origin' })
      }
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (token) headers['Authorization'] = `Bearer ${token}`
      return fetch(url, { ...opts, headers })
    },
    [admin]
  )

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`/api/lojas/${lojaId}/eventos`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Erro ao carregar eventos')
      } else {
        setLojaNome(json.loja?.nome || '')
        setEventos(json.eventos || [])
      }
    } catch {
      setError('Erro ao carregar eventos')
    } finally {
      setLoading(false)
    }
  }, [lojaId, authFetch])

  useEffect(() => { if (lojaId) carregar() }, [lojaId, carregar])

  function abrirNovo() {
    setFormErro(null)
    setForm({ ...FORM_VAZIO })
  }
  function abrirEdicao(ev: Evento) {
    setFormErro(null)
    setForm({
      id: ev.id,
      titulo: ev.titulo,
      tipo: ev.tipo,
      status: ev.status,
      data_inicio: isoParaInputDateTime(ev.data_inicio),
      data_fim: isoParaInputDateTime(ev.data_fim),
      recorrencia: ev.recorrencia,
      recorrencia_fim: isoParaInputDate(ev.recorrencia_fim),
      local: ev.local || '',
      link: ev.link || '',
      banner: ev.banner || '',
      descricao: ev.descricao || '',
    })
  }
  function fechar() { setForm(null); setFormErro(null) }

  function campo<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f))
  }

  async function salvar() {
    if (!form) return
    if (!form.titulo.trim()) { setFormErro('Título é obrigatório'); return }
    if (!form.data_inicio) { setFormErro('Data de início é obrigatória'); return }

    setSaving(true)
    setFormErro(null)
    const payload = {
      titulo: form.titulo,
      tipo: form.tipo,
      status: form.status,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || null,
      recorrencia: form.recorrencia,
      recorrencia_fim: form.recorrencia === 'nenhuma' ? null : (form.recorrencia_fim || null),
      local: form.local,
      link: form.link,
      banner: form.banner,
      descricao: form.descricao,
    }
    try {
      const url = form.id
        ? `/api/lojas/${lojaId}/eventos/${form.id}`
        : `/api/lojas/${lojaId}/eventos`
      const res = await authFetch(url, {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setFormErro(json.error || 'Erro ao salvar'); setSaving(false); return }
      fechar()
      await carregar()
    } catch {
      setFormErro('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function excluir(ev: Evento) {
    if (!confirm(`Excluir o evento "${ev.titulo}"? Esta ação não pode ser desfeita.`)) return
    try {
      const res = await authFetch(`/api/lojas/${lojaId}/eventos/${ev.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert(json.error || 'Erro ao excluir')
        return
      }
      await carregar()
    } catch {
      alert('Erro ao excluir')
    }
  }

  const tituloFull = mostrarNomeLoja && lojaNome ? `${titulo} · ${lojaNome}` : titulo

  return (
    <section style={S.card}>
      <div style={S.head}>
        <div style={S.headText}>
          <h2 style={S.h2}>{tituloFull}</h2>
          {sub && <p style={S.sub}>{sub}</p>}
          {nota && <p style={S.nota}>{nota}</p>}
        </div>
        <button onClick={abrirNovo} style={S.btnPrimary}>+ Adicionar evento</button>
      </div>

      {loading && <div style={S.muted}>Carregando eventos...</div>}
      {error && !loading && <div style={S.erro}>{error}</div>}

      {!loading && !error && eventos.length === 0 && (
        <div style={S.vazio}>
          Nenhum evento cadastrado ainda. Clique em <strong>“Adicionar evento”</strong> para criar o primeiro.
        </div>
      )}

      {!loading && !error && eventos.length > 0 && (
        <div style={S.lista}>
          {eventos.map((ev) => (
            <div key={ev.id} style={S.itemCard}>
              {ev.banner && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ev.banner} alt="" style={S.banner} />
              )}
              <div style={S.itemBody}>
                <div style={S.itemTopo}>
                  <span style={S.tipoBadge}>{TIPO_LABELS[ev.tipo] || ev.tipo}</span>
                  <span style={{ ...S.statusBadge, ...(ev.status === 'publicado' ? S.statusPub : S.statusRasc) }}>
                    {ev.status === 'publicado' ? 'Publicado' : 'Rascunho'}
                  </span>
                  {ev.recorrencia !== 'nenhuma' && (
                    <span style={S.recBadge}>{RECOR_LABELS[ev.recorrencia]}</span>
                  )}
                </div>
                <h3 style={S.itemTitulo}>{ev.titulo}</h3>
                <p style={S.itemQuando}>{rotuloQuando(ev)}</p>
                {ev.local && <p style={S.itemMeta}>📍 {ev.local}</p>}
                {ev.descricao && <p style={S.itemDesc}>{ev.descricao}</p>}
              </div>
              <div style={S.itemAcoes}>
                <button onClick={() => abrirEdicao(ev)} style={S.btnGhost}>Editar</button>
                <button onClick={() => excluir(ev)} style={S.btnDanger}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {form && (
        <div style={S.overlay} onClick={fechar}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={S.modalTitulo}>{form.id ? 'Editar evento' : 'Novo evento'}</h2>

            <label style={S.label}>Título *
              <input style={S.input} value={form.titulo} onChange={(e) => campo('titulo', e.target.value)} maxLength={160} />
            </label>

            <div style={S.linha}>
              <label style={S.label}>Tipo
                <select style={S.input} value={form.tipo} onChange={(e) => campo('tipo', e.target.value)}>
                  {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label style={S.label}>Status
                <select style={S.input} value={form.status} onChange={(e) => campo('status', e.target.value)}>
                  <option value="rascunho">Rascunho</option>
                  <option value="publicado">Publicado</option>
                </select>
              </label>
            </div>

            <div style={S.linha}>
              <label style={S.label}>Início *
                <input type="datetime-local" style={S.input} value={form.data_inicio} onChange={(e) => campo('data_inicio', e.target.value)} />
              </label>
              <label style={S.label}>Término (opcional)
                <input type="datetime-local" style={S.input} value={form.data_fim} onChange={(e) => campo('data_fim', e.target.value)} />
              </label>
            </div>

            <div style={S.linha}>
              <label style={S.label}>Recorrência
                <select style={S.input} value={form.recorrencia} onChange={(e) => campo('recorrencia', e.target.value)}>
                  {Object.entries(RECOR_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              {form.recorrencia !== 'nenhuma' && (
                <label style={S.label}>Repete até (opcional)
                  <input type="date" style={S.input} value={form.recorrencia_fim} onChange={(e) => campo('recorrencia_fim', e.target.value)} />
                </label>
              )}
            </div>

            <label style={S.label}>Local
              <input style={S.input} value={form.local} onChange={(e) => campo('local', e.target.value)} placeholder="Na loja, online, endereço..." />
            </label>

            <label style={S.label}>Link (inscrição/regras)
              <input style={S.input} value={form.link} onChange={(e) => campo('link', e.target.value)} placeholder="https://..." />
            </label>

            <label style={S.label}>Banner (URL da imagem)
              <input style={S.input} value={form.banner} onChange={(e) => campo('banner', e.target.value)} placeholder="https://..." />
            </label>

            <label style={S.label}>Descrição
              <textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' }} value={form.descricao} onChange={(e) => campo('descricao', e.target.value)} />
            </label>

            {formErro && <div style={S.erro}>{formErro}</div>}

            <div style={S.modalAcoes}>
              <button onClick={fechar} style={S.btnGhost} disabled={saving}>Cancelar</button>
              <button onClick={salvar} style={S.btnPrimary} disabled={saving}>
                {saving ? 'Salvando...' : (form.id ? 'Salvar alterações' : 'Criar evento')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  card: { background: '#0d0f14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20, color: '#f0f0f0' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 16 },
  headText: { minWidth: 0 },
  h2: { fontSize: 18, fontWeight: 800, margin: 0 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' },
  nota: { fontSize: 12, color: 'var(--ac-1)', margin: '6px 0 0' },

  muted: { padding: '24px 0', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  vazio: { padding: '32px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 14, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 14 },
  erro: { padding: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#ef4444', fontSize: 13, marginTop: 8 },

  lista: { display: 'flex', flexDirection: 'column', gap: 12 },
  itemCard: { display: 'flex', gap: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, alignItems: 'flex-start' },
  banner: { width: 88, height: 88, objectFit: 'cover', borderRadius: 10, flexShrink: 0 },
  itemBody: { flex: 1, minWidth: 0 },
  itemTopo: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
  tipoBadge: { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: 'rgba(var(--ac-1-rgb), 0.12)', color: 'var(--ac-1)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  statusBadge: { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.04em' },
  statusPub: { background: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  statusRasc: { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' },
  recBadge: { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: 'rgba(168,85,247,0.12)', color: '#a855f7' },
  itemTitulo: { fontSize: 16, fontWeight: 700, margin: '2px 0' },
  itemQuando: { fontSize: 13, color: 'var(--ac-1)', margin: '2px 0', textTransform: 'capitalize' },
  itemMeta: { fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: '2px 0' },
  itemDesc: { fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '6px 0 0', lineHeight: 1.4 },
  itemAcoes: { display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 },

  btnPrimary: { background: 'var(--ac-grad)', border: 'none', color: '#000', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  btnGhost: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnDanger: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto', zIndex: 1000 },
  modal: { background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 },
  modalTitulo: { fontSize: 18, fontWeight: 800, margin: 0 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', flex: 1 },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, padding: '9px 11px', color: '#f0f0f0', fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  linha: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  modalAcoes: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
}
