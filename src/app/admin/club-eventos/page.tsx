'use client'

// Agenda do Club no /admin (wireframe de 08/11/2026, quadros AD1 a AD3). Visao
// de dono: todos os eventos, de qualquer organizador, com quem criou. O
// formulario e o mesmo do organizador; aqui ele fala com /api/admin/club-eventos.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { AdminFaixa, AdminPage, AdminVazio } from '@/components/admin/AdminPage'
import { hojeBrasilia } from '@/lib/pcc/datas'
import { TIPOS, erroAgenda, horaCurta, linhaMeta, momento, type Evento } from '@/lib/pcc/agenda'
import { agendaEvento } from '@/lib/pcc/rotas'
import { AS_CSS } from '@/app/pokecreatorsclub/amigo-secreto/estilo'
import { CAL_CSS } from '@/app/pokecreatorsclub/_comum/calendario'
import { AG_CSS } from '@/app/pokecreatorsclub/agenda/comum'
import { FormEvento, deEvento, duplicar, vazio, type AcaoSalvar, type DadosEvento } from '@/app/pokecreatorsclub/agenda/organizar/FormEvento'

type EventoAdm = Evento & { criado_por: string | null; editado_por: string | null; updated_at: string }
type Filtro = 'proximos' | 'rascunhos' | 'passados'
type Modo = { tipo: 'lista' } | { tipo: 'form'; titulo: string; inicial: DadosEvento; ev: EventoAdm | null }

const urlImagem = (path: string) => supabase.storage.from('club-fotos').getPublicUrl(path).data.publicUrl
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const rotuloEstado = (e: Evento) => (e.status === 'rascunho' ? 'Rascunho' : e.status === 'adiado' ? 'Adiado' : e.status === 'cancelado' ? 'Cancelado' : 'Publicado')

export default function AdminClubEventosPage() {
  const [lista, setLista] = useState<EventoAdm[] | null>(null)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('proximos')
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' })
  const [ocupado, setOcupado] = useState(false)
  const hoje = useMemo(() => hojeBrasilia(), [])

  const load = useCallback(async () => {
    setErro('')
    const res = await fetch('/api/admin/club-eventos')
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setErro(d.error || `Erro ${res.status}`); return }
    setLista(d.lista || [])
  }, [])
  // Busca ao abrir; o setErro('') do inicio e o reset da tentativa.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const salvar = useCallback(async (dados: DadosEvento, como: AcaoSalvar, ev: EventoAdm | null): Promise<string | null> => {
    const res = await fetch('/api/admin/club-eventos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'salvar', id: ev?.id ?? null, dados, como }) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return erroAgenda(d.error)
    setOk(como === 'publicar' ? `"${d.evento.titulo}" publicado.` : como === 'rascunho' ? 'Rascunho salvo.' : 'Alterações salvas.')
    setModo({ tipo: 'lista' })
    await load()
    return null
  }, [load])

  const subirImagem = useCallback(async (arquivo: File): Promise<string | null> => {
    const fd = new FormData()
    fd.append('imagem', arquivo)
    const res = await fetch('/api/admin/club-eventos', { method: 'POST', body: fd })
    const d = await res.json().catch(() => ({}))
    return res.ok ? d.path : null
  }, [])

  async function estado(ev: EventoAdm, como: 'adiar' | 'cancelar' | 'excluir') {
    let nota: string | null = null
    if (como === 'cancelar') {
      nota = window.prompt(`Motivo do cancelamento de "${ev.titulo}" (aparece para o grupo):`)
      if (nota === null) return
    } else if (como === 'adiar') {
      if (!window.confirm(`Adiar "${ev.titulo}" sem data? A agenda mostra "Nova data em breve".`)) return
    } else if (!window.confirm(`Excluir o rascunho "${ev.titulo}"? Isso não tem volta.`)) return
    setOcupado(true); setErro(''); setOk('')
    const res = await fetch('/api/admin/club-eventos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'estado', id: ev.id, como, nota }) })
    const d = await res.json().catch(() => ({}))
    setOcupado(false)
    if (!res.ok) { setErro(erroAgenda(d.error)); return }
    setOk(como === 'cancelar' ? 'Evento cancelado.' : como === 'adiar' ? 'Evento adiado.' : 'Rascunho excluído.')
    await load()
  }

  if (modo.tipo === 'form') {
    const ev = modo.ev
    return (
      <AdminPage titulo="Agenda do Club" largura="media">
        <div className="as fe-admin">
          <FormEvento key={ev?.id ?? modo.titulo} titulo={modo.titulo} inicial={modo.inicial} estado={ev?.status ?? null}
            urlImagem={urlImagem} subirImagem={subirImagem} onVoltar={() => setModo({ tipo: 'lista' })}
            onSalvar={(d, como) => salvar(d, como, ev)} />
        </div>
        <style>{AS_CSS + CAL_CSS + AG_CSS + ADM_FORM_CSS}</style>
      </AdminPage>
    )
  }

  const passou = (e: Evento) => e.status !== 'rascunho' && momento(e, hoje) === 'passado'
  const porFiltro: Record<Filtro, EventoAdm[]> = {
    proximos: (lista || []).filter(e => e.status !== 'rascunho' && !passou(e)).sort((a, b) => a.inicio_data.localeCompare(b.inicio_data)),
    rascunhos: (lista || []).filter(e => e.status === 'rascunho'),
    passados: (lista || []).filter(passou),
  }

  return (
    <AdminPage titulo="Agenda do Club" largura="media"
      subtitulo="Poké Creators Club. Todos os eventos, de qualquer organizador. Quem tem conta na Bynx vê os publicados, adiados e cancelados."
      acao={<button type="button" className="ce-btn pri" onClick={() => { setOk(''); setModo({ tipo: 'form', titulo: 'Novo evento', inicial: vazio(), ev: null }) }}>Novo evento</button>}>
      {erro && <AdminFaixa tom="erro">{erro}</AdminFaixa>}
      {ok && <AdminFaixa tom="ok">{ok}</AdminFaixa>}
      <div className="ce-filtros">
        {([['proximos', 'Próximos'], ['rascunhos', 'Rascunhos'], ['passados', 'Passados']] as [Filtro, string][]).map(([f, r]) => (
          <button key={f} type="button" className={`ce-chip${filtro === f ? ' on' : ''}`} onClick={() => setFiltro(f)}>{r} ({porFiltro[f].length})</button>
        ))}
      </div>
      {lista === null && !erro && <AdminVazio>Carregando...</AdminVazio>}
      {lista && porFiltro[filtro].length === 0 && <AdminVazio>Nada aqui.</AdminVazio>}
      {lista && porFiltro[filtro].length > 0 && (
        <div className="ce-box">
          <table className="ce-tbl">
            <thead><tr><th>Data</th><th>Evento</th><th>Tipo</th><th>Estado</th><th>Criado por</th><th /></tr></thead>
            <tbody>
              {porFiltro[filtro].map(e => (
                <tr key={e.id}>
                  <td className="ce-data">{e.fim_data !== e.inicio_data ? `${dm(e.inicio_data)} a ${dm(e.fim_data)}` : dm(e.inicio_data)}{e.hora_inicio ? ` ${horaCurta(e.hora_inicio)}` : ''}</td>
                  <td><b>{e.titulo}</b><small>{linhaMeta(e)}</small></td>
                  <td>{TIPOS[e.tipo].rotulo}</td>
                  <td><span className={`ce-est ${e.status}`}>{rotuloEstado(e)}</span></td>
                  <td>{e.criado_por ? `@${e.criado_por}` : 'Admin Bynx'}</td>
                  <td className="ce-acoes">
                    {e.status !== 'cancelado' && <button type="button" disabled={ocupado} onClick={() => { setOk(''); setModo({ tipo: 'form', titulo: 'Editar evento', inicial: deEvento(e), ev: e }) }}>Editar</button>}
                    <button type="button" disabled={ocupado} onClick={() => { setOk(''); setModo({ tipo: 'form', titulo: 'Novo evento (cópia)', inicial: duplicar(e), ev: null }) }}>Duplicar</button>
                    {e.status !== 'rascunho' && <a href={agendaEvento(e.slug)} target="_blank" rel="noopener noreferrer">Ver</a>}
                    {e.status === 'publicado' && <button type="button" disabled={ocupado} onClick={() => estado(e, 'adiar')}>Adiar</button>}
                    {(e.status === 'publicado' || e.status === 'adiado') && <button type="button" className="red" disabled={ocupado} onClick={() => estado(e, 'cancelar')}>Cancelar</button>}
                    {e.status === 'rascunho' && <button type="button" className="red" disabled={ocupado} onClick={() => estado(e, 'excluir')}>Excluir</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <style>{`
        .ce-btn{min-height:44px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.14);background:transparent;color:#f0f0f0;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
        .ce-btn.pri{background:linear-gradient(135deg,#f59e0b,#ef4444);border-color:transparent;color:#0d0d0d}
        .ce-filtros{display:flex;gap:8px;flex-wrap:wrap}
        .ce-chip{min-height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,0.14);background:transparent;color:rgba(255,255,255,0.7);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
        .ce-chip.on{background:rgba(245,158,11,0.12);border-color:rgba(245,158,11,0.45);color:#f59e0b}
        .ce-box{border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(255,255,255,0.02);overflow-x:auto}
        .ce-tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:760px}
        .ce-tbl th{text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,0.45);padding:11px 10px;border-bottom:1px solid rgba(255,255,255,0.08)}
        .ce-tbl td{padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);vertical-align:middle;color:#f0f0f0}
        .ce-tbl td b{display:block;font-weight:700}
        .ce-tbl td small{color:rgba(255,255,255,0.45);font-size:12px}
        .ce-data{white-space:nowrap;font-variant-numeric:tabular-nums}
        .ce-est{display:inline-block;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;border:1px solid rgba(255,255,255,0.14);color:rgba(255,255,255,0.7)}
        .ce-est.publicado{color:#22c55e;border-color:rgba(34,197,94,0.35)}
        .ce-est.cancelado{color:#ef4444;border-color:rgba(239,68,68,0.35)}
        .ce-est.adiado{color:#f59e0b;border-color:rgba(245,158,11,0.35)}
        .ce-acoes{white-space:nowrap;text-align:right}
        .ce-acoes button,.ce-acoes a{min-height:36px;padding:0 10px;margin-left:4px;border-radius:10px;border:1px solid rgba(255,255,255,0.14);background:transparent;color:#f0f0f0;font:inherit;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;text-decoration:none}
        .ce-acoes .red{color:#ef4444;border-color:rgba(239,68,68,0.3)}
        .ce-acoes button:disabled{opacity:.45;cursor:default}
        @media (max-width:640px){
          .ce-tbl{min-width:0}
          .ce-tbl thead{display:none}
          .ce-tbl,.ce-tbl tbody,.ce-tbl tr,.ce-tbl td{display:block}
          .ce-tbl tr{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.06)}
          .ce-tbl td{border:0;padding:2px 0}
          .ce-tbl td:nth-child(3),.ce-tbl td:nth-child(5){display:inline;color:rgba(255,255,255,0.55);font-size:12px}
          .ce-tbl td:nth-child(3):after{content:" · "}
          .ce-tbl td:nth-child(4){display:block;margin:6px 0 2px}
          .ce-acoes{text-align:left;white-space:normal;padding-top:6px !important}
          .ce-acoes button,.ce-acoes a{margin:6px 6px 0 0;min-height:44px}
        }
      `}</style>
    </AdminPage>
  )
}

const ADM_FORM_CSS = `
.as.fe-admin{min-height:0;background:transparent;padding-bottom:0}
`
