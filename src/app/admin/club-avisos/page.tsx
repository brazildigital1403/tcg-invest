'use client'

// Avisos do Club no /admin (wireframe de 08/11/2026, quadro AD8). Visao de dono:
// todos os avisos, de qualquer organizador, com quem publicou. O formulario e o
// mesmo do organizador; aqui ele fala com /api/admin/club-avisos.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { AdminFaixa, AdminPage, AdminVazio } from '@/components/admin/AdminPage'
import { chipPrazo, erroAviso, type AvisoOrg } from '@/lib/pcc/avisos'
import { avisoUrl } from '@/lib/pcc/rotas'
import { AS_CSS } from '@/app/pokecreatorsclub/amigo-secreto/estilo'
import { CAL_CSS } from '@/app/pokecreatorsclub/_comum/calendario'
import { AG_CSS } from '@/app/pokecreatorsclub/agenda/comum'
import { FormAviso, avisoVazio, deAviso, duplicarAviso, payload, type AcaoAviso, type DadosAviso, type EventoOpcao } from '@/app/pokecreatorsclub/avisos/organizar/FormAviso'

type Filtro = 'publicados' | 'rascunhos' | 'arquivados'
type Modo = { tipo: 'lista' } | { tipo: 'form'; titulo: string; inicial: DadosAviso; a: AvisoOrg | null }
type Votos = { titulo: string; lista: { opcao: number; texto: string; contas: string[] }[] }

const urlImagem = (path: string) => supabase.storage.from('club-fotos').getPublicUrl(path).data.publicUrl
const dm = (iso: string | null) => (iso ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date(iso)) : '-')

export default function AdminClubAvisosPage() {
  const [lista, setLista] = useState<AvisoOrg[] | null>(null)
  const [eventos, setEventos] = useState<EventoOpcao[]>([])
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('publicados')
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' })
  const [votos, setVotos] = useState<Votos | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const load = useCallback(async () => {
    setErro('')
    const res = await fetch('/api/admin/club-avisos')
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setErro(d.error || `Erro ${res.status}`); return }
    setLista(d.lista || [])
    setEventos(d.eventos || [])
  }, [])
  // Busca ao abrir; o setErro('') do inicio e o reset da tentativa.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function post(corpo: object) {
    const res = await fetch('/api/admin/club-avisos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    const d = await res.json().catch(() => ({}))
    return { ok: res.ok, d }
  }

  const salvar = useCallback(async (dados: DadosAviso, como: AcaoAviso, a: AvisoOrg | null): Promise<string | null> => {
    const { ok: certo, d } = await post({ acao: 'salvar', id: a?.id ?? null, dados: payload(dados), como })
    if (!certo) return erroAviso(d.error)
    setOk(como === 'publicar' ? `"${d.aviso.titulo}" publicado.` : como === 'rascunho' ? 'Rascunho salvo.' : 'Alterações salvas.')
    setModo({ tipo: 'lista' })
    await load()
    return null
  }, [load])

  const subirImagem = useCallback(async (f: File): Promise<string | null> => {
    const fd = new FormData()
    fd.append('imagem', f)
    const res = await fetch('/api/admin/club-avisos', { method: 'POST', body: fd })
    const d = await res.json().catch(() => ({}))
    return res.ok ? d.path : null
  }, [])

  async function estado(a: AvisoOrg, como: 'fixar' | 'desafixar' | 'arquivar' | 'restaurar' | 'excluir') {
    if (como === 'excluir' && !window.confirm(`Excluir o rascunho "${a.titulo}"? Isso não tem volta.`)) return
    if (como === 'arquivar' && !window.confirm(`Arquivar "${a.titulo}"? Sai da lista do Club, mas não é apagado.`)) return
    setOcupado(true); setErro(''); setOk('')
    const { ok: certo, d } = await post({ acao: 'estado', id: a.id, como })
    setOcupado(false)
    if (!certo) { setErro(erroAviso(d.error)); return }
    setOk({ fixar: 'Aviso fixado.', desafixar: 'Aviso desafixado.', arquivar: 'Aviso arquivado.', restaurar: 'Aviso restaurado.', excluir: 'Rascunho excluído.' }[como])
    await load()
  }

  async function atualizar(a: AvisoOrg) {
    const texto = window.prompt(`Atualização para "${a.titulo}" (aparece com data e hora no aviso):`)
    if (!texto) return
    setOcupado(true); setErro(''); setOk('')
    const { ok: certo, d } = await post({ acao: 'atualizar', id: a.id, texto })
    setOcupado(false)
    if (!certo) { setErro(erroAviso(d.error)); return }
    setOk('Atualização publicada.')
    await load()
  }

  async function verVotos(a: AvisoOrg) {
    setErro('')
    const { ok: certo, d } = await post({ acao: 'votos', id: a.id })
    if (!certo) { setErro(erroAviso(d.error)); return }
    setVotos({ titulo: a.titulo, lista: d.votos })
  }

  if (modo.tipo === 'form') {
    const a = modo.a
    return (
      <AdminPage titulo="Avisos do Club" largura="media">
        <div className="as fe-admin">
          <FormAviso key={a?.id ?? modo.titulo} titulo={modo.titulo} inicial={modo.inicial} estado={a?.status ?? null}
            votos={a?.enquete?.total || 0} eventos={eventos} urlImagem={urlImagem} subirImagem={subirImagem}
            onVoltar={() => setModo({ tipo: 'lista' })} onSalvar={(d, como) => salvar(d, como, a)} />
        </div>
        <style>{AS_CSS + CAL_CSS + AG_CSS + '.as.fe-admin{min-height:0;background:transparent;padding-bottom:0}'}</style>
      </AdminPage>
    )
  }

  const porFiltro: Record<Filtro, AvisoOrg[]> = {
    publicados: (lista || []).filter(a => a.status === 'publicado'),
    rascunhos: (lista || []).filter(a => a.status === 'rascunho'),
    arquivados: (lista || []).filter(a => a.status === 'arquivado'),
  }

  return (
    <AdminPage titulo="Avisos do Club" largura="media"
      subtitulo="Poké Creators Club. Todos os avisos, de qualquer organizador. Quem tem conta na Bynx vê os publicados."
      acao={<button type="button" className="ca-btn pri" onClick={() => { setOk(''); setModo({ tipo: 'form', titulo: 'Novo aviso', inicial: avisoVazio(), a: null }) }}>Novo aviso</button>}>
      {erro && <AdminFaixa tom="erro">{erro}</AdminFaixa>}
      {ok && <AdminFaixa tom="ok">{ok}</AdminFaixa>}
      <div className="ca-filtros">
        {([['publicados', 'Publicados'], ['rascunhos', 'Rascunhos'], ['arquivados', 'Arquivados']] as [Filtro, string][]).map(([f, r]) => (
          <button key={f} type="button" className={`ca-chip${filtro === f ? ' on' : ''}`} onClick={() => setFiltro(f)}>{r} ({porFiltro[f].length})</button>
        ))}
      </div>
      {votos && (
        <div className="ca-box ca-votos">
          <div className="ca-votos-t"><b>Votos: {votos.titulo}</b><button type="button" className="ca-btn" onClick={() => setVotos(null)}>Fechar</button></div>
          {votos.lista.map(v => <div key={v.opcao}><b>{v.texto}</b> ({v.contas.length}): {v.contas.length ? v.contas.map(c => `@${c}`).join(', ') : 'ninguém'}</div>)}
        </div>
      )}
      {lista === null && !erro && <AdminVazio>Carregando...</AdminVazio>}
      {lista && porFiltro[filtro].length === 0 && <AdminVazio>Nada aqui.</AdminVazio>}
      {lista && porFiltro[filtro].length > 0 && (
        <div className="ca-box">
          <table className="ca-tbl">
            <thead><tr><th>Publicado</th><th>Aviso</th><th>Estado</th><th>Por</th><th /></tr></thead>
            <tbody>
              {porFiltro[filtro].map(a => {
                const prazo = chipPrazo(a)
                return (
                  <tr key={a.id}>
                    <td className="ca-data">{dm(a.publicado_em)}</td>
                    <td><b>{a.titulo}</b><small>{[a.fixado ? 'Fixado' : null, prazo?.texto, a.enquete ? `enquete, ${a.enquete.total} ${a.enquete.total === 1 ? 'voto' : 'votos'}` : null, a.tem_atualizacoes ? 'com atualizações' : null].filter(Boolean).join(' · ')}</small></td>
                    <td><span className={`ca-est ${a.status}`}>{a.status === 'publicado' ? 'Publicado' : a.status === 'rascunho' ? 'Rascunho' : 'Arquivado'}</span></td>
                    <td>{a.autor ? `@${a.autor}` : 'Admin Bynx'}</td>
                    <td className="ca-acoes">
                      {a.status !== 'arquivado' && <button type="button" disabled={ocupado} onClick={() => { setOk(''); setModo({ tipo: 'form', titulo: 'Editar aviso', inicial: deAviso(a), a }) }}>Editar</button>}
                      {a.status === 'publicado' && <button type="button" disabled={ocupado} onClick={() => estado(a, a.fixado ? 'desafixar' : 'fixar')}>{a.fixado ? 'Desafixar' : 'Fixar'}</button>}
                      {a.status === 'publicado' && <button type="button" disabled={ocupado} onClick={() => atualizar(a)}>Atualizar</button>}
                      {a.enquete && <button type="button" disabled={ocupado} onClick={() => verVotos(a)}>Votos</button>}
                      <button type="button" disabled={ocupado} onClick={() => { setOk(''); setModo({ tipo: 'form', titulo: 'Novo aviso (cópia)', inicial: duplicarAviso(a), a: null }) }}>Duplicar</button>
                      {a.status !== 'rascunho' && <a href={avisoUrl(a.slug)} target="_blank" rel="noopener noreferrer">Ver</a>}
                      {a.status === 'publicado' && <button type="button" className="red" disabled={ocupado} onClick={() => estado(a, 'arquivar')}>Arquivar</button>}
                      {a.status === 'arquivado' && <button type="button" disabled={ocupado} onClick={() => estado(a, 'restaurar')}>Restaurar</button>}
                      {a.status === 'rascunho' && <button type="button" className="red" disabled={ocupado} onClick={() => estado(a, 'excluir')}>Excluir</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <style>{`
        .ca-btn{min-height:44px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.14);background:transparent;color:#f0f0f0;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
        .ca-btn.pri{background:linear-gradient(135deg,#f59e0b,#ef4444);border-color:transparent;color:#0d0d0d}
        .ca-filtros{display:flex;gap:8px;flex-wrap:wrap}
        .ca-chip{min-height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,0.14);background:transparent;color:rgba(255,255,255,0.7);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
        .ca-chip.on{background:rgba(245,158,11,0.12);border-color:rgba(245,158,11,0.45);color:#f59e0b}
        .ca-box{border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(255,255,255,0.02);overflow-x:auto}
        .ca-votos{padding:14px 16px;display:flex;flex-direction:column;gap:8px;font-size:13px;color:#f0f0f0}
        .ca-votos-t{display:flex;justify-content:space-between;align-items:center;gap:8px}
        .ca-tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:760px}
        .ca-tbl th{text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,0.45);padding:11px 10px;border-bottom:1px solid rgba(255,255,255,0.08)}
        .ca-tbl td{padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);vertical-align:middle;color:#f0f0f0}
        .ca-tbl td b{display:block;font-weight:700}
        .ca-tbl td small{color:rgba(255,255,255,0.45);font-size:12px}
        .ca-data{white-space:nowrap;font-variant-numeric:tabular-nums}
        .ca-est{display:inline-block;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;border:1px solid rgba(255,255,255,0.14);color:rgba(255,255,255,0.7)}
        .ca-est.publicado{color:#22c55e;border-color:rgba(34,197,94,0.35)}
        .ca-est.arquivado{color:rgba(255,255,255,0.45)}
        .ca-acoes{white-space:nowrap;text-align:right}
        .ca-acoes button,.ca-acoes a{min-height:36px;padding:0 10px;margin-left:4px;border-radius:10px;border:1px solid rgba(255,255,255,0.14);background:transparent;color:#f0f0f0;font:inherit;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;text-decoration:none}
        .ca-acoes .red{color:#ef4444;border-color:rgba(239,68,68,0.3)}
        .ca-acoes button:disabled{opacity:.45;cursor:default}
        @media (max-width:640px){
          .ca-tbl{min-width:0}
          .ca-tbl thead{display:none}
          .ca-tbl,.ca-tbl tbody,.ca-tbl tr,.ca-tbl td{display:block}
          .ca-tbl tr{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.06)}
          .ca-tbl td{border:0;padding:2px 0}
          .ca-acoes{text-align:left;white-space:normal;padding-top:6px !important}
          .ca-acoes button,.ca-acoes a{margin:6px 6px 0 0;min-height:44px}
        }
      `}</style>
    </AdminPage>
  )
}
