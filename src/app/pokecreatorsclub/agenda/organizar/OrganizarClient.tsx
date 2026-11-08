'use client'

// Area do organizador da Agenda (wireframe de 08/11/2026, quadros O2 e O3).
// Conta normal da Bynx com o papel "agenda": lista com filtros, criar, editar,
// duplicar, adiar, cancelar e excluir rascunho. O banco confere o papel em cada
// acao; esta tela so esconde o que a conta nao pode.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { MESES_CURTOS, hojeBrasilia } from '@/lib/pcc/datas'
import { TIPOS, erroAgenda, linhaMeta, momento, parseDia, type Evento } from '@/lib/pcc/agenda'
import { AGENDA, AGENDA_ORGANIZAR, agendaEvento } from '@/lib/pcc/rotas'
import { Ico } from '../../amigo-secreto/estilo'
import { BlocoData, Folha } from '../../_comum/calendario'
import { Casca, TipoQuad } from '../comum'
import { FormEvento, deEvento, duplicar, vazio, type AcaoSalvar, type DadosEvento } from './FormEvento'

const BUCKET = 'club-fotos'
const urlImagem = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

export type EventoOrg = Evento & { criado_por: string | null; editado_por: string | null; updated_at: string }
type Filtro = 'proximos' | 'rascunhos' | 'passados'
type Modo = { tipo: 'lista' } | { tipo: 'form'; titulo: string; inicial: DadosEvento; ev: EventoOrg | null }

export default function OrganizarClient() {
  const { openLogin } = useAuthModal()
  const [uid, setUid] = useState<string | null | undefined>(undefined)
  const [papel, setPapel] = useState<boolean | null>(null)
  const [lista, setLista] = useState<EventoOrg[] | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>('proximos')
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' })
  const [aberto, setAberto] = useState<EventoOrg | null>(null)
  const [aviso, setAviso] = useState('')
  const hoje = useMemo(() => hojeBrasilia(), [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const carregar = useCallback(async () => {
    setFalhou(false)
    const { data: p } = await supabase.rpc('club_meus_papeis')
    const tem = Array.isArray(p) && p.includes('agenda')
    setPapel(tem)
    if (!tem) return
    const { data, error } = await supabase.rpc('club_agenda_organizar_lista')
    if (error) { setFalhou(true); return }
    const evs = data as EventoOrg[]
    setLista(evs)
    // Vindo de "Editar evento" na pagina do evento: abre direto o formulario.
    const id = new URLSearchParams(window.location.search).get('editar')
    const alvo = id ? evs.find(e => e.id === id) : null
    if (alvo && alvo.status !== 'cancelado') setModo({ tipo: 'form', titulo: 'Editar evento', inicial: deEvento(alvo), ev: alvo })
  }, [])

  // Busca quando a sessao aparece; os resets do inicio sao da propria tentativa.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (uid) carregar() }, [uid, carregar])

  const voltarLista = useCallback(() => {
    setModo({ tipo: 'lista' })
    window.history.replaceState(null, '', AGENDA_ORGANIZAR)
  }, [])

  const salvar = useCallback(async (d: DadosEvento, acao: AcaoSalvar, ev: EventoOrg | null): Promise<string | null> => {
    const { data, error } = await supabase.rpc('club_agenda_salvar', { p_id: ev?.id ?? null, p: d, p_acao: acao })
    if (error) return erroAgenda(error.message)
    // Imagem trocada ou tirada: a antiga sai do armazenamento depois de salvar.
    if (ev?.imagem_path && ev.imagem_path !== d.imagem_path) await supabase.storage.from(BUCKET).remove([ev.imagem_path])
    const salvo = data as Evento
    setAviso(acao === 'publicar' ? `"${salvo.titulo}" publicado.` : acao === 'rascunho' ? 'Rascunho salvo.' : 'Alterações salvas.')
    voltarLista()
    await carregar()
    return null
  }, [carregar, voltarLista])

  const subirImagem = useCallback(async (arquivo: File): Promise<string | null> => {
    // So os tipos que o bucket aceita; outro (HEIC que nao converteu) cai no aviso de erro.
    const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[arquivo.type]
    if (!ext) return null
    const path = `eventos/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, arquivo, { contentType: arquivo.type, cacheControl: '31536000' })
    return error ? null : path
  }, [])

  const casca = (filhos: React.ReactNode, logado = true) => (
    <Casca logado={logado} onEntrar={() => openLogin({ next: AGENDA_ORGANIZAR, cta: 'Entrar no Club' })} voltar={AGENDA} rotuloVoltar="Agenda" titulo="Organizar agenda">{filhos}</Casca>
  )

  if (uid === undefined) return casca(<div className="as-center"><span className="as-meta">Abrindo...</span></div>, false)
  if (uid === null) {
    return casca(<div className="as-center">
      <h1 className="as-h2">Organizar agenda</h1>
      <p className="as-p">Entre com a sua conta da Bynx.</p>
      <button type="button" className="as-btn pri" style={{ maxWidth: 320, width: '100%' }} onClick={() => openLogin({ next: AGENDA_ORGANIZAR, cta: 'Entrar no Club' })}>Entrar</button>
    </div>, false)
  }
  if (papel === false) {
    return casca(<>
      <h1 className="as-h2">Organizar agenda</h1>
      <div className="as-note">Só a organização do Club pode editar a agenda. Se você organiza, peça para incluírem a sua conta.</div>
      <Link href={AGENDA} className="as-btn">Ver a agenda</Link>
    </>)
  }
  if (falhou && !lista) {
    return casca(<>
      <div className="as-erro" role="alert">Não conseguimos carregar os eventos.</div>
      <button type="button" className="as-btn" onClick={carregar}>Tentar de novo</button>
    </>)
  }
  if (!lista) return casca(<div className="as-center"><span className="as-meta">Abrindo os eventos...</span></div>)

  if (modo.tipo === 'form') {
    const ev = modo.ev
    return casca(
      <FormEvento key={ev?.id ?? modo.titulo} titulo={modo.titulo} inicial={modo.inicial} estado={ev?.status ?? null}
        urlImagem={urlImagem} subirImagem={subirImagem} onVoltar={voltarLista}
        onSalvar={(d, acao) => salvar(d, acao, ev)} />,
    )
  }

  const passou = (e: Evento) => e.status !== 'rascunho' && momento(e, hoje) === 'passado'
  const porFiltro: Record<Filtro, EventoOrg[]> = {
    proximos: lista.filter(e => e.status !== 'rascunho' && !passou(e)).sort((a, b) => a.inicio_data.localeCompare(b.inicio_data)),
    rascunhos: lista.filter(e => e.status === 'rascunho').sort((a, b) => a.inicio_data.localeCompare(b.inicio_data)),
    passados: lista.filter(passou),
  }
  const visiveis = porFiltro[filtro]

  return casca(<>
    <div className="ag-topo">
      <h1 className="as-h2">Organizar agenda</h1>
      <button type="button" className="as-btn pri sm" onClick={() => { setAviso(''); setModo({ tipo: 'form', titulo: 'Novo evento', inicial: vazio(), ev: null }) }}><Ico n="plus" s={16} />Novo evento</button>
    </div>
    {aviso && <div className="as-note strong" role="status">{aviso}</div>}
    <div className="as-chips" role="tablist">
      {([['proximos', 'Próximos'], ['rascunhos', 'Rascunhos'], ['passados', 'Passados']] as [Filtro, string][]).map(([f, r]) => (
        <button key={f} type="button" role="tab" aria-selected={filtro === f} className={`as-chip org-filtro${filtro === f ? ' fill' : ''}`} onClick={() => setFiltro(f)}>{r} ({porFiltro[f].length})</button>
      ))}
    </div>
    {visiveis.length === 0
      ? <div className="ag-vazio"><span className="as-meta">{filtro === 'rascunhos' ? 'Nenhum rascunho.' : filtro === 'passados' ? 'Nenhum evento passado.' : 'Nenhum evento marcado.'}</span></div>
      : visiveis.map(e => {
          const ini = parseDia(e.inicio_data)
          return (
            <button key={e.id} type="button" className="pc-linha ag-linha" onClick={() => setAberto(e)}>
              <BlocoData dia={String(ini.dia).padStart(2, '0')} mes={MESES_CURTOS[ini.mes - 1]} />
              <TipoQuad e={e} />
              <span className="pc-nm">
                <b>{e.titulo}</b>
                <small>{rotuloEstado(e)} · {TIPOS[e.tipo].rotulo} · por {e.criado_por ? `@${e.criado_por}` : 'Admin Bynx'}</small>
              </span>
              <Ico n="chev" className="arr" />
            </button>
          )
        })}
    <style>{ORG_CSS}</style>

    {aberto && (
      <FolhaAcoes ev={aberto} onFechar={() => setAberto(null)}
        onEditar={() => { setAberto(null); setAviso(''); setModo({ tipo: 'form', titulo: 'Editar evento', inicial: deEvento(aberto), ev: aberto }) }}
        onDuplicar={() => { setAberto(null); setAviso(''); setModo({ tipo: 'form', titulo: 'Novo evento (cópia)', inicial: duplicar(aberto), ev: null }) }}
        onFeito={async msg => { setAberto(null); setAviso(msg); await carregar() }} />
    )}
  </>)
}

const rotuloEstado = (e: Evento) => (e.status === 'rascunho' ? 'Rascunho' : e.status === 'adiado' ? 'Adiado' : e.status === 'cancelado' ? 'Cancelado' : 'Publicado')

function FolhaAcoes({ ev, onFechar, onEditar, onDuplicar, onFeito }: {
  ev: EventoOrg; onFechar: () => void; onEditar: () => void; onDuplicar: () => void; onFeito: (msg: string) => void
}) {
  const [passo, setPasso] = useState<'menu' | 'cancelar' | 'adiar' | 'excluir'>('menu')
  const [nota, setNota] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  async function mudar(acao: 'adiar' | 'cancelar' | 'excluir') {
    setOcupado(true); setErro('')
    const { data, error } = await supabase.rpc('club_agenda_estado', { p_id: ev.id, p_acao: acao, p_nota: nota })
    if (error) { setOcupado(false); setErro(erroAgenda(error.message)); return }
    const r = data as { imagem_path?: string | null }
    if (acao === 'excluir' && r.imagem_path) await supabase.storage.from(BUCKET).remove([r.imagem_path])
    setOcupado(false)
    onFeito(acao === 'cancelar' ? 'Evento cancelado.' : acao === 'adiar' ? 'Evento adiado.' : 'Rascunho excluído.')
  }

  if (passo === 'cancelar') {
    return (
      <Folha titulo="Cancelar evento" onFechar={onFechar}>
        <p className="as-meta">{ev.titulo}. O evento continua na agenda, com o motivo, até a data.</p>
        <label className="as-f"><span className="as-lb">Motivo (aparece para o grupo)</span>
          <textarea className="as-in" style={{ minHeight: 80 }} maxLength={200} value={nota} onChange={e => setNota(e.target.value)} /></label>
        {erro && <div className="as-erro" role="alert">{erro}</div>}
        <button type="button" className="as-btn pri" disabled={ocupado || nota.trim().length < 3} onClick={() => mudar('cancelar')}>Cancelar evento</button>
        <button type="button" className="as-btn" disabled={ocupado} onClick={() => setPasso('menu')}>Voltar</button>
      </Folha>
    )
  }
  if (passo === 'adiar') {
    return (
      <Folha titulo="Adiar sem data" onFechar={onFechar}>
        <p className="as-meta">A agenda mostra &quot;Nova data em breve&quot;. Se já sabe a nova data, use Editar.</p>
        <label className="as-f"><span className="as-lb">Recado (opcional)</span>
          <input className="as-in" maxLength={200} value={nota} onChange={e => setNota(e.target.value)} /></label>
        {erro && <div className="as-erro" role="alert">{erro}</div>}
        <button type="button" className="as-btn pri" disabled={ocupado} onClick={() => mudar('adiar')}>Adiar</button>
        <button type="button" className="as-btn" disabled={ocupado} onClick={() => setPasso('menu')}>Voltar</button>
      </Folha>
    )
  }
  if (passo === 'excluir') {
    return (
      <Folha titulo="Excluir rascunho" onFechar={onFechar}>
        <p className="as-meta">{ev.titulo}. Isso não tem volta.</p>
        {erro && <div className="as-erro" role="alert">{erro}</div>}
        <button type="button" className="as-btn pri" disabled={ocupado} onClick={() => mudar('excluir')}>Excluir</button>
        <button type="button" className="as-btn" disabled={ocupado} onClick={() => setPasso('menu')}>Voltar</button>
      </Folha>
    )
  }
  return (
    <Folha titulo={ev.titulo} onFechar={onFechar}>
      <p className="as-meta">{rotuloEstado(ev)} · {linhaMeta(ev)}{ev.editado_por && ev.editado_por !== ev.criado_por ? ` · editado por @${ev.editado_por}` : ''}</p>
      {ev.status !== 'cancelado' && <button type="button" className="as-btn pri" onClick={onEditar}>Editar</button>}
      <button type="button" className="as-btn" onClick={onDuplicar}>Duplicar</button>
      {ev.status !== 'rascunho' && <Link href={agendaEvento(ev.slug)} className="as-btn">Ver a página do evento</Link>}
      {ev.status === 'publicado' && <button type="button" className="as-btn" onClick={() => setPasso('adiar')}>Adiar sem data</button>}
      {(ev.status === 'publicado' || ev.status === 'adiado') && <button type="button" className="as-btn" onClick={() => setPasso('cancelar')}>Cancelar evento</button>}
      {ev.status === 'rascunho' && <button type="button" className="as-btn" onClick={() => setPasso('excluir')}>Excluir rascunho</button>}
    </Folha>
  )
}

const ORG_CSS = `
.org-filtro{cursor:pointer;min-height:44px;height:auto;font:inherit;font-size:12.5px;font-weight:700}
.ag-topo .as-btn.pri{display:inline-flex;align-items:center;gap:6px}
button.ag-linha{cursor:pointer}
`
