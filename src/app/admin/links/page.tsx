'use client'

// /admin/links -- links curtos: bynx.gg/<slug> -> destino com UTM.
//
// Toda escrita passa por /api/admin/links (service key). A validacao e a de
// src/lib/linksCurtos.ts, a mesma que a API repete antes de gravar. Sem
// excluir: desligar preserva o contador e nao quebra link ja impresso em video.

import { useCallback, useEffect, useState } from 'react'
import { IconPlus, IconClose, IconEdit, IconCopy, IconCheck, IconLink } from '@/components/ui/Icons'
import { validarDestino, validarSlug, urlCurta, type LinkCurto } from '@/lib/linksCurtos'

const GOLD = '#f59e0b'
const MUTED = 'rgba(255,255,255,0.45)'
const BORDER = '1px solid rgba(255,255,255,0.08)'

const FORM_VAZIO = { slug: '', destino: '', descricao: '' }
type Form = typeof FORM_VAZIO

function fmtData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f0f0',
  borderRadius: 9, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
}
const labelStyle: React.CSSProperties = { fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block' }

export default function AdminLinksPage() {
  const [links, setLinks] = useState<LinkCurto[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [formAberto, setFormAberto] = useState(false)
  const [editSlug, setEditSlug] = useState<string | null>(null)
  const [form, setForm] = useState<Form>({ ...FORM_VAZIO })
  const [formErro, setFormErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null)
    try {
      const r = await fetch('/api/admin/links', { credentials: 'include' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro ao carregar')
      setLinks(j.links || [])
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() {
    setEditSlug(null); setForm({ ...FORM_VAZIO }); setFormErro(null); setFormAberto(true)
  }
  function abrirEdicao(l: LinkCurto) {
    setEditSlug(l.slug); setForm({ slug: l.slug, destino: l.destino, descricao: l.descricao || '' }); setFormErro(null); setFormAberto(true)
  }

  async function salvar() {
    setFormErro(null)
    const d = validarDestino(form.destino)
    if (!d.ok) { setFormErro(d.erro); return }
    let payload: Record<string, unknown>
    let method: 'POST' | 'PATCH'
    if (editSlug) {
      method = 'PATCH'
      payload = { slug: editSlug, destino: d.destino, descricao: form.descricao }
    } else {
      const s = validarSlug(form.slug)
      if (!s.ok) { setFormErro(s.erro); return }
      method = 'POST'
      payload = { slug: s.slug, destino: d.destino, descricao: form.descricao }
    }
    setSalvando(true)
    try {
      const r = await fetch('/api/admin/links', { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro ao salvar')
      setFormAberto(false)
      await carregar()
    } catch (e) {
      setFormErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  async function alternarAtivo(l: LinkCurto) {
    setOcupado(l.slug)
    try {
      const r = await fetch('/api/admin/links', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: l.slug, ativo: !l.ativo }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro ao salvar')
      setLinks(prev => prev.map(x => x.slug === l.slug ? j.link : x))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  async function copiar(slug: string) {
    try {
      await navigator.clipboard.writeText(urlCurta(slug))
      setCopiado(slug)
      setTimeout(() => setCopiado(c => (c === slug ? null : c)), 1500)
    } catch { /* sem clipboard: o link esta visivel na tabela */ }
  }

  const slugPreview = editSlug ?? form.slug.trim().toLowerCase()

  return (
    <div style={{ padding: '0 0 40px', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f0f0f0', margin: 0 }}>Links curtos</h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>bynx.gg/<b style={{ color: '#f0f0f0' }}>slug</b> redireciona para o destino com as UTMs. Use nas descrições de vídeo, bio e posts.</p>
        </div>
        <button onClick={abrirNovo} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '9px 16px', borderRadius: 8, cursor: 'pointer', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#000', border: 'none', whiteSpace: 'nowrap' }}>
          <IconPlus size={14} color="#000" /> Novo link
        </button>
      </div>

      {erro && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{erro}</div>}

      {formAberto && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: BORDER, borderRadius: 14, padding: 18, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0', margin: 0 }}>{editSlug ? `Editar bynx.gg/${editSlug}` : 'Novo link curto'}</h2>
            <button onClick={() => setFormAberto(false)} aria-label="Fechar" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}><IconClose size={16} color={MUTED} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: 14 }}>
            <div>
              <label style={labelStyle}>Slug</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: MUTED, whiteSpace: 'nowrap' }}>bynx.gg/</span>
                <input value={form.slug} disabled={!!editSlug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="yt" style={{ ...inputStyle, opacity: editSlug ? 0.6 : 1 }} />
              </div>
              <p style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>Minúsculas, números e hífen. Não pode ser nome de página da Bynx.</p>
            </div>
            <div>
              <label style={labelStyle}>Destino (URL completa, com UTM)</label>
              <input value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))} placeholder="https://bynx.gg/?utm_source=youtube&utm_medium=video&utm_campaign=..." style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Descrição (só para você)</label>
              <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Onde esse link é usado" style={inputStyle} maxLength={200} />
            </div>
          </div>
          {slugPreview && <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>Link final: <span style={{ color: GOLD, fontWeight: 700 }}>{urlCurta(slugPreview)}</span></p>}
          {formErro && <p style={{ fontSize: 12, color: '#fca5a5', marginTop: 10 }}>{formErro}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={salvar} disabled={salvando} style={{ fontSize: 12, fontWeight: 700, padding: '9px 16px', borderRadius: 8, cursor: salvando ? 'default' : 'pointer', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#000', border: 'none', opacity: salvando ? 0.6 : 1 }}>
              {salvando ? 'Salvando...' : editSlug ? 'Salvar alterações' : 'Criar link'}
            </button>
            <button onClick={() => setFormAberto(false)} style={{ fontSize: 12, fontWeight: 600, padding: '9px 14px', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: '#f0f0f0', border: BORDER }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto', border: BORDER, borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 820 }}>
          <thead>
            <tr>
              {['Link', 'Destino', 'Descrição', 'Cliques', 'Criado', 'Ativo', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: MUTED, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: BORDER, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 18, color: MUTED }}>Carregando...</td></tr>}
            {!loading && links.length === 0 && <tr><td colSpan={7} style={{ padding: 18, color: MUTED }}>Nenhum link ainda. Crie o primeiro.</td></tr>}
            {links.map(l => (
              <tr key={l.slug} style={{ borderBottom: BORDER, opacity: l.ativo ? 1 : 0.55 }}>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <IconLink size={14} color={GOLD} />
                    <a href={`/${l.slug}`} target="_blank" rel="noreferrer" style={{ color: '#f0f0f0', fontWeight: 700, textDecoration: 'none' }}>bynx.gg/{l.slug}</a>
                    <button onClick={() => copiar(l.slug)} title="Copiar" aria-label="Copiar link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'inline-flex' }}>
                      {copiado === l.slug ? <IconCheck size={14} color="#22c55e" /> : <IconCopy size={14} color={MUTED} />}
                    </button>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', maxWidth: 360 }}>
                  <span title={l.destino} style={{ display: 'block', color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.destino}</span>
                </td>
                <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.7)' }}>{l.descricao || '—'}</td>
                <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{l.cliques}</td>
                <td style={{ padding: '10px 12px', color: MUTED, whiteSpace: 'nowrap' }}>{fmtData(l.criado_em)}</td>
                <td style={{ padding: '10px 12px' }}>
                  <button onClick={() => alternarAtivo(l)} disabled={ocupado === l.slug} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', border: BORDER, background: l.ativo ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)', color: l.ativo ? '#22c55e' : MUTED }}>
                    {l.ativo ? 'Ativo' : 'Desligado'}
                  </button>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <button onClick={() => abrirEdicao(l)} aria-label="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'inline-flex' }}><IconEdit size={15} color={MUTED} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
