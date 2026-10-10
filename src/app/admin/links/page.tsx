'use client'

// /admin/links -- links curtos: bynx.gg/<slug> -> destino com UTM.
//
// Toda escrita passa por /api/admin/links (service key). A validacao e a de
// src/lib/linksCurtos.ts, a mesma que a API repete antes de gravar. Sem
// excluir: desligar preserva o contador e nao quebra link ja impresso em video.
//
// Molde visual = /admin/promocoes: a casca do admin (.adm-content) NAO da
// padding, cada pagina poe o seu; tokens --bx-*/--ac-*; botao 44px, input 48px
// com fonte 16 (Safari iOS da zoom abaixo disso); tabela no desktop e cartoes
// no celular, sem rolagem lateral.

import { useCallback, useEffect, useState } from 'react'
import { IconPlus, IconClose, IconEdit, IconCopy, IconCheck, IconLink, IconWarning } from '@/components/ui/Icons'
import { validarDestino, validarSlug, urlCurta, sugerirSlug, type LinkCurto } from '@/lib/linksCurtos'

const FORM_VAZIO = { slug: '', destino: '', descricao: '' }
type Form = typeof FORM_VAZIO

function fmtData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

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
  // Slug sugerido pelas UTMs do destino ate a pessoa digitar um por conta propria.
  const [slugAuto, setSlugAuto] = useState(true)

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
    setEditSlug(null); setForm({ ...FORM_VAZIO }); setFormErro(null); setSlugAuto(true); setFormAberto(true)
  }
  function abrirEdicao(l: LinkCurto) {
    setEditSlug(l.slug); setForm({ slug: l.slug, destino: l.destino, descricao: l.descricao || '' }); setFormErro(null); setFormAberto(true)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
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
    } catch { /* sem clipboard: o link esta visivel na lista */ }
  }

  const slugPreview = editSlug ?? form.slug.trim().toLowerCase()
  const slugErro = !editSlug && form.slug.trim() ? validarSlug(form.slug) : null

  return (
    <div className="lnk-page" style={{ maxWidth: 1100, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Cabecalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 4px', color: 'var(--bx-text)' }}>Links curtos</h1>
          <p style={{ fontSize: 13, color: 'var(--bx-text-3)', margin: 0, lineHeight: 1.5 }}>
            bynx.gg/<b style={{ color: 'var(--bx-text-2)', fontWeight: 700 }}>slug</b> redireciona para o destino com as UTMs. Para descrição de vídeo, bio e posts.
          </p>
        </div>
        <button type="button" className="lnk-btn-principal" onClick={abrirNovo}>
          <IconPlus size={16} color="currentColor" /> Novo link
        </button>
      </div>

      {erro && <Faixa tom="erro" onFechar={() => setErro(null)}>{erro}</Faixa>}

      {/* Formulario */}
      {formAberto && (
        <div className="lnk-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--bx-text)', margin: 0, flex: 1 }}>
              {editSlug ? `Editar bynx.gg/${editSlug}` : 'Novo link curto'}
            </h2>
            <BotaoIcone rotulo="Fechar" onClick={() => setFormAberto(false)}><IconClose size={16} color="currentColor" /></BotaoIcone>
          </div>

          <div className="lnk-form">
            <div>
              <span className="lnk-rotulo">Slug</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, color: 'var(--bx-text-3)', whiteSpace: 'nowrap' }}>bynx.gg/</span>
                <input
                  className={`lnk-input${slugErro ? (slugErro.ok ? ' valido' : ' invalido') : ''}`}
                  value={form.slug}
                  disabled={!!editSlug}
                  onChange={e => { const v = e.target.value; setSlugAuto(v.trim() === ''); setForm(f => ({ ...f, slug: v })) }}
                  placeholder="canal-campanha"
                  autoCapitalize="none" autoCorrect="off" spellCheck={false}
                />
              </div>
              <p className="lnk-ajuda">
                {!editSlug && slugAuto && form.slug
                  ? 'Sugerido pelas UTMs do destino (canal-campanha). Pode trocar.'
                  : 'Regra: canal-campanha (yt-o-que-e-a-bynx, ig-caixa). Minúsculas, números e hífen; não pode ser nome de página da Bynx.'}
              </p>
            </div>
            <div className="lnk-form-larga">
              <span className="lnk-rotulo">Destino (URL completa, com as UTMs)</span>
              <input
                className="lnk-input"
                value={form.destino}
                onChange={e => {
                  const v = e.target.value
                  setForm(f => ({ ...f, destino: v, slug: !editSlug && slugAuto ? sugerirSlug(v) : f.slug }))
                }}
                placeholder="https://bynx.gg/?utm_source=youtube&utm_medium=video&utm_campaign=..."
                inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              />
            </div>
            <div className="lnk-form-larga">
              <span className="lnk-rotulo">Descrição (só para você)</span>
              <input className="lnk-input" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Onde esse link é usado" maxLength={200} />
            </div>
          </div>

          {slugPreview && (
            <p style={{ fontSize: 13, color: 'var(--bx-text-3)', marginTop: 14 }}>
              Link final: <span style={{ color: 'var(--ac-1)', fontWeight: 800 }}>{urlCurta(slugPreview)}</span>
            </p>
          )}
          {formErro && (
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--bx-red)', marginTop: 10 }}>
              <IconWarning size={14} color="currentColor" /> {formErro}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="button" className="lnk-btn-principal" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : editSlug ? 'Salvar alterações' : 'Criar link'}
            </button>
            <button type="button" className="lnk-btn-sec" onClick={() => setFormAberto(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista: tabela no desktop, cartoes no celular */}
      {loading && <p style={{ fontSize: 13, color: 'var(--bx-text-3)' }}>Carregando...</p>}
      {!loading && links.length === 0 && (
        <div className="lnk-card" style={{ textAlign: 'center', color: 'var(--bx-text-3)', fontSize: 13 }}>Nenhum link ainda. Crie o primeiro.</div>
      )}

      {!loading && links.length > 0 && (
        <>
          <div className="lnk-card lnk-tabela-wrap">
            <table className="lnk-tabela">
              <thead>
                <tr>
                  {['Link', 'Destino', 'Descrição', 'Cliques', 'Criado', 'Status', ''].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {links.map(l => (
                  <tr key={l.slug} className={l.ativo ? '' : 'desligado'}>
                    <td>
                      {/* Copiar vem PRIMEIRO e fixo: um embaixo do outro em toda linha,
                          independente do tamanho do slug. O link corta com reticencias. */}
                      <span className="lnk-linkcell">
                        <BotaoIcone rotulo={copiado === l.slug ? 'Copiado' : 'Copiar link'} onClick={() => copiar(l.slug)}>
                          {copiado === l.slug ? <IconCheck size={15} color="var(--bx-green)" /> : <IconCopy size={15} color="currentColor" />}
                        </BotaoIcone>
                        <IconLink size={14} color="var(--ac-1)" style={{ flexShrink: 0 }} />
                        <a href={`/${l.slug}`} target="_blank" rel="noreferrer" className="lnk-url lnk-url-corta" title={`bynx.gg/${l.slug}`}>bynx.gg/{l.slug}</a>
                      </span>
                    </td>
                    <td className="lnk-destino"><span title={l.destino}>{l.destino}</span></td>
                    <td style={{ color: 'var(--bx-text-2)' }}>{l.descricao || '—'}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{l.cliques}</td>
                    <td style={{ color: 'var(--bx-text-3)', whiteSpace: 'nowrap' }}>{fmtData(l.criado_em)}</td>
                    <td><Status ativo={l.ativo} ocupado={ocupado === l.slug} onClick={() => alternarAtivo(l)} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <BotaoIcone rotulo="Editar" onClick={() => abrirEdicao(l)}><IconEdit size={16} color="currentColor" /></BotaoIcone>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lnk-lista">
            {links.map(l => (
              <div key={l.slug} className={`lnk-card lnk-item${l.ativo ? '' : ' desligado'}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconLink size={15} color="var(--ac-1)" />
                  <a href={`/${l.slug}`} target="_blank" rel="noreferrer" className="lnk-url" style={{ fontSize: 16 }}>bynx.gg/{l.slug}</a>
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 2 }}>
                    <BotaoIcone rotulo={copiado === l.slug ? 'Copiado' : 'Copiar link'} onClick={() => copiar(l.slug)}>
                      {copiado === l.slug ? <IconCheck size={16} color="var(--bx-green)" /> : <IconCopy size={16} color="currentColor" />}
                    </BotaoIcone>
                    <BotaoIcone rotulo="Editar" onClick={() => abrirEdicao(l)}><IconEdit size={16} color="currentColor" /></BotaoIcone>
                  </span>
                </div>
                <p className="lnk-destino" style={{ margin: '8px 0 0' }}><span title={l.destino}>{l.destino}</span></p>
                {l.descricao && <p style={{ fontSize: 13, color: 'var(--bx-text-2)', margin: '6px 0 0' }}>{l.descricao}</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: 'var(--bx-text-3)' }}><b style={{ color: 'var(--bx-text)', fontWeight: 800 }}>{l.cliques}</b> cliques</span>
                  <span style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>{fmtData(l.criado_em)}</span>
                  <span style={{ marginLeft: 'auto' }}><Status ativo={l.ativo} ocupado={ocupado === l.slug} onClick={() => alternarAtivo(l)} /></span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`
        .lnk-page { padding: 24px 16px; }
        @media (min-width: 768px) { .lnk-page { padding: 32px 24px; } }

        .lnk-btn-principal {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          min-height: 44px; padding: 0 20px; border-radius: 12px; border: 1px solid transparent;
          background: var(--ac-grad); color: var(--bx-brand-ink, #0a0a0a);
          font-size: 15px; font-weight: 800; font-family: inherit; cursor: pointer;
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .lnk-btn-principal:hover { transform: translateY(-2px); }
        .lnk-btn-principal:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .lnk-btn-sec {
          display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px;
          border-radius: 12px; border: 1px solid var(--bx-border-2); background: var(--bx-surface-2);
          color: var(--bx-text); font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .lnk-btn-sec:hover { background: var(--bx-surface-3); }
        .lnk-btn-icone {
          display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px;
          border-radius: 10px; border: none; background: transparent; color: var(--bx-text-3); cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .lnk-btn-icone:hover { background: var(--bx-surface-2); color: var(--bx-text); }
        .lnk-btn-icone:focus-visible, .lnk-btn-principal:focus-visible, .lnk-btn-sec:focus-visible, .lnk-status:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }

        .lnk-card { background: var(--bx-surface); border: 1px solid var(--bx-border); border-radius: 12px; padding: 16px; }
        .lnk-rotulo { display: block; font-size: 11px; font-weight: 700; color: var(--bx-text-3); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
        .lnk-ajuda { font-size: 12px; color: var(--bx-text-3); margin: 6px 0 0; line-height: 1.4; }
        .lnk-form { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
        @media (min-width: 768px) {
          .lnk-form { grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); }
          .lnk-form-larga { grid-column: 1 / -1; }
        }
        .lnk-input {
          width: 100%; min-width: 0; min-height: 48px; padding: 0 14px; border-radius: 10px;
          border: 1px solid var(--bx-border); background: var(--bx-surface-2); color: var(--bx-text);
          font-size: 16px; font-family: inherit; outline: none; transition: border-color 0.15s ease;
        }
        .lnk-input:focus { border-color: var(--bx-border-2); }
        .lnk-input:disabled { opacity: 0.6; }
        .lnk-input.valido { border-color: var(--bx-green); }
        .lnk-input.invalido { border-color: var(--bx-red); }

        .lnk-url { color: var(--bx-text); font-weight: 800; text-decoration: none; }
        .lnk-linkcell { display: flex; align-items: center; gap: 4px; min-width: 0; }
        .lnk-url-corta { display: block; min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lnk-url:hover { color: var(--ac-1); }
        .lnk-destino { font-size: 13px; color: var(--bx-text-3); max-width: 100%; }
        .lnk-destino span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lnk-status {
          display: inline-flex; align-items: center; min-height: 36px; padding: 0 12px; border-radius: 999px;
          border: 1px solid var(--bx-border); font-size: 12px; font-weight: 800; font-family: inherit; cursor: pointer;
          background: var(--bx-surface-2); color: var(--bx-text-3); transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .lnk-status.ativo { background: rgba(34,197,94,0.12); color: var(--bx-green); border-color: rgba(34,197,94,0.35); }
        .lnk-status:disabled { opacity: 0.6; cursor: wait; }
        .desligado .lnk-url { color: var(--bx-text-3); }

        .lnk-tabela-wrap { padding: 0; overflow: hidden; }
        .lnk-tabela { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
        .lnk-tabela th {
          text-align: left; padding: 12px 14px; color: var(--bx-text-3); font-weight: 700; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid var(--bx-border); white-space: nowrap;
        }
        .lnk-tabela td { padding: 8px 14px; border-bottom: 1px solid var(--bx-border); vertical-align: middle; color: var(--bx-text); min-width: 0; }
        .lnk-tabela tr:last-child td { border-bottom: none; }
        .lnk-tabela th:nth-child(1), .lnk-tabela td:nth-child(1) { width: 27%; }
        .lnk-tabela th:nth-child(2), .lnk-tabela td:nth-child(2) { width: 26%; }
        .lnk-tabela th:nth-child(4), .lnk-tabela td:nth-child(4) { width: 8%; }
        .lnk-tabela th:nth-child(5), .lnk-tabela td:nth-child(5) { width: 12%; }
        .lnk-tabela th:nth-child(6), .lnk-tabela td:nth-child(6) { width: 11%; }
        .lnk-tabela th:nth-child(7), .lnk-tabela td:nth-child(7) { width: 60px; }
        .lnk-tabela tr.desligado td { opacity: 0.6; }

        .lnk-lista { display: none; }
        @media (max-width: 899px) {
          .lnk-tabela-wrap { display: none; }
          .lnk-lista { display: grid; gap: 12px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .lnk-btn-principal, .lnk-btn-principal:hover { transition: none; transform: none; }
        }
      `}</style>
    </div>
  )
}

// ─── Auxiliares ──────────────────────────────────────────────────────────

function BotaoIcone({ rotulo, onClick, children }: { rotulo: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="lnk-btn-icone" onClick={onClick} aria-label={rotulo} title={rotulo}>{children}</button>
  )
}

function Status({ ativo, ocupado, onClick }: { ativo: boolean; ocupado: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`lnk-status${ativo ? ' ativo' : ''}`} onClick={onClick} disabled={ocupado} title={ativo ? 'Clique para desligar' : 'Clique para ligar'}>
      {ativo ? 'Ativo' : 'Desligado'}
    </button>
  )
}

function Faixa({ tom, onFechar, children }: { tom: 'info' | 'erro'; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, padding: '10px 6px 10px 14px',
      borderRadius: 12, background: 'var(--bx-surface)',
      border: `1px solid ${tom === 'erro' ? 'var(--bx-red)' : 'var(--bx-border-2)'}`,
    }}>
      <IconWarning size={16} color={tom === 'erro' ? 'var(--bx-red)' : 'var(--ac-1)'} style={{ flexShrink: 0, marginTop: 13 }} />
      <p style={{ flex: 1, fontSize: 13, lineHeight: 1.5, color: 'var(--bx-text-2)', margin: '12px 0' }}>{children}</p>
      <BotaoIcone rotulo="Fechar aviso" onClick={onFechar}><IconClose size={14} color="currentColor" /></BotaoIcone>
    </div>
  )
}
