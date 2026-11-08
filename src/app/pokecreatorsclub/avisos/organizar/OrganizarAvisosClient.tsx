'use client'

// Area do organizador dos Avisos (wireframe de 08/11/2026, quadros O5 a O8).
// Conta normal da Bynx com o papel "avisos": lista, novo, editar, fixar,
// atualizacao datada, votos da enquete, duplicar, arquivar e restaurar.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { hojeBrasilia } from '@/lib/pcc/datas'
import { isoDia } from '@/lib/pcc/agenda'
import { chipPrazo, erroAviso, type AvisoOrg } from '@/lib/pcc/avisos'
import { AVISOS, AVISOS_ORGANIZAR, avisoUrl } from '@/lib/pcc/rotas'
import { Ico } from '../../amigo-secreto/estilo'
import { Folha } from '../../_comum/calendario'
import { Casca } from '../../agenda/comum'
import { AV_CSS, urlImagem } from '../comum'
import { FormAviso, avisoVazio, deAviso, duplicarAviso, payload, type AcaoAviso, type DadosAviso, type EventoOpcao } from './FormAviso'

const BUCKET = 'club-fotos'
type Filtro = 'publicados' | 'rascunhos' | 'arquivados'
type Modo = { tipo: 'lista' } | { tipo: 'form'; titulo: string; inicial: DadosAviso; a: AvisoOrg | null }

export default function OrganizarAvisosClient() {
  const { openLogin } = useAuthModal()
  const [uid, setUid] = useState<string | null | undefined>(undefined)
  const [papel, setPapel] = useState<boolean | null>(null)
  const [lista, setLista] = useState<AvisoOrg[] | null>(null)
  const [eventos, setEventos] = useState<EventoOpcao[]>([])
  const [falhou, setFalhou] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>('publicados')
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' })
  const [aberto, setAberto] = useState<AvisoOrg | null>(null)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const carregar = useCallback(async () => {
    setFalhou(false)
    const { data: p } = await supabase.rpc('club_meus_papeis')
    const tem = Array.isArray(p) && p.includes('avisos')
    setPapel(tem)
    if (!tem) return
    const hoje = hojeBrasilia()
    const ate = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + 398)).toISOString().slice(0, 10)
    const [r, ag] = await Promise.all([
      supabase.rpc('club_avisos_organizar_lista'),
      supabase.rpc('club_agenda_lista', { p_de: isoDia(hoje), p_ate: ate }),
    ])
    if (r.error) { setFalhou(true); return }
    const avs = r.data as AvisoOrg[]
    setLista(avs)
    const evs = (ag.data as { eventos?: { id: string; titulo: string; inicio_data: string; status: string }[] } | null)?.eventos || []
    setEventos(evs.filter(e => e.status !== 'cancelado').map(e => ({ id: e.id, titulo: e.titulo, inicio_data: e.inicio_data })))
    const id = new URLSearchParams(window.location.search).get('editar')
    const alvo = id ? avs.find(a => a.id === id) : null
    if (alvo && alvo.status !== 'arquivado') setModo({ tipo: 'form', titulo: 'Editar aviso', inicial: deAviso(alvo), a: alvo })
  }, [])

  // Busca quando a sessao aparece; os resets do inicio sao da propria tentativa.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (uid) carregar() }, [uid, carregar])

  const voltarLista = useCallback(() => {
    setModo({ tipo: 'lista' })
    window.history.replaceState(null, '', AVISOS_ORGANIZAR)
  }, [])

  const salvar = useCallback(async (d: DadosAviso, acao: AcaoAviso, a: AvisoOrg | null): Promise<string | null> => {
    const { data, error } = await supabase.rpc('club_aviso_salvar', { p_id: a?.id ?? null, p: payload(d), p_acao: acao })
    if (error) return erroAviso(error.message)
    // Imagem tirada do aviso: sai do armazenamento depois de salvar.
    const fora = (a?.imagens || []).filter(p => !d.imagens.includes(p))
    if (fora.length) await supabase.storage.from(BUCKET).remove(fora)
    setAviso(acao === 'publicar' ? `"${(data as AvisoOrg).titulo}" publicado.` : acao === 'rascunho' ? 'Rascunho salvo.' : 'Alterações salvas.')
    // Volta na aba onde o aviso ficou, senao a tela mostra uma lista sem ele.
    setFiltro(acao === 'rascunho' ? 'rascunhos' : 'publicados')
    voltarLista()
    await carregar()
    return null
  }, [carregar, voltarLista])

  const subirImagem = useCallback(async (f: File): Promise<string | null> => {
    const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[f.type]
    if (!ext) return null
    const path = `avisos/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type, cacheControl: '31536000' })
    return error ? null : path
  }, [])

  const casca = (filhos: React.ReactNode, logado = true) => (
    <Casca logado={logado} onEntrar={() => openLogin({ next: AVISOS_ORGANIZAR, cta: 'Entrar no Club' })} voltar={AVISOS} rotuloVoltar="Avisos" titulo="Organizar avisos">
      {filhos}
      <style>{AV_CSS + ORG_CSS}</style>
    </Casca>
  )

  if (uid === undefined) return casca(<div className="as-center"><span className="as-meta">Abrindo...</span></div>, false)
  if (uid === null) {
    return casca(<div className="as-center">
      <h1 className="as-h2">Organizar avisos</h1>
      <p className="as-p">Entre com a sua conta da Bynx.</p>
      <button type="button" className="as-btn pri" style={{ maxWidth: 320, width: '100%' }} onClick={() => openLogin({ next: AVISOS_ORGANIZAR, cta: 'Entrar no Club' })}>Entrar</button>
    </div>, false)
  }
  if (papel === false) {
    return casca(<>
      <h1 className="as-h2">Organizar avisos</h1>
      <div className="as-note">Só a organização do Club pode publicar avisos. Se você organiza, peça para incluírem a sua conta.</div>
      <Link href={AVISOS} className="as-btn">Ver os avisos</Link>
    </>)
  }
  if (falhou && !lista) {
    return casca(<>
      <div className="as-erro" role="alert">Não conseguimos carregar os avisos.</div>
      <button type="button" className="as-btn" onClick={carregar}>Tentar de novo</button>
    </>)
  }
  if (!lista) return casca(<div className="as-center"><span className="as-meta">Abrindo os avisos...</span></div>)

  if (modo.tipo === 'form') {
    const a = modo.a
    return casca(
      <FormAviso key={a?.id ?? modo.titulo} titulo={modo.titulo} inicial={modo.inicial} estado={a?.status ?? null}
        votos={a?.enquete?.total || 0} eventos={eventos} urlImagem={urlImagem} subirImagem={subirImagem}
        onVoltar={voltarLista} onSalvar={(d, acao) => salvar(d, acao, a)} />,
    )
  }

  const porFiltro: Record<Filtro, AvisoOrg[]> = {
    publicados: lista.filter(a => a.status === 'publicado'),
    rascunhos: lista.filter(a => a.status === 'rascunho'),
    arquivados: lista.filter(a => a.status === 'arquivado'),
  }

  return casca(<>
    <div className="ag-topo">
      <h1 className="as-h2">Organizar avisos</h1>
      <button type="button" className="as-btn pri sm" onClick={() => { setAviso(''); setModo({ tipo: 'form', titulo: 'Novo aviso', inicial: avisoVazio(), a: null }) }}><Ico n="plus" s={16} />Novo aviso</button>
    </div>
    {aviso && <div className="as-note strong" role="status">{aviso}</div>}
    <div className="as-chips" role="tablist">
      {([['publicados', 'Publicados'], ['rascunhos', 'Rascunhos'], ['arquivados', 'Arquivados']] as [Filtro, string][]).map(([f, r]) => (
        <button key={f} type="button" role="tab" aria-selected={filtro === f} className={`as-chip org-filtro${filtro === f ? ' fill' : ''}`} onClick={() => setFiltro(f)}>{r} ({porFiltro[f].length})</button>
      ))}
    </div>
    {porFiltro[filtro].length === 0
      ? <div className="ag-vazio"><span className="as-meta">{filtro === 'rascunhos' ? 'Nenhum rascunho.' : filtro === 'arquivados' ? 'Nenhum aviso arquivado.' : 'Nenhum aviso publicado.'}</span></div>
      : porFiltro[filtro].map(a => <LinhaOrg key={a.id} a={a} onAbrir={() => setAberto(a)} />)}

    {aberto && (
      <FolhaAcoes a={aberto} onFechar={() => setAberto(null)}
        onEditar={() => { setAberto(null); setAviso(''); setModo({ tipo: 'form', titulo: 'Editar aviso', inicial: deAviso(aberto), a: aberto }) }}
        onDuplicar={() => { setAberto(null); setAviso(''); setModo({ tipo: 'form', titulo: 'Novo aviso (cópia)', inicial: duplicarAviso(aberto), a: null }) }}
        onFeito={async msg => { setAberto(null); setAviso(msg); await carregar() }} />
    )}
  </>)
}

function LinhaOrg({ a, onAbrir }: { a: AvisoOrg; onAbrir: () => void }) {
  const prazo = chipPrazo(a)
  const partes = [
    a.status === 'rascunho' ? 'Rascunho' : a.status === 'arquivado' ? 'Arquivado' : 'Publicado',
    a.fixado ? 'Fixado' : null,
    prazo ? prazo.texto : null,
    a.enquete ? `Enquete, ${a.enquete.total} ${a.enquete.total === 1 ? 'voto' : 'votos'}` : null,
    a.tem_atualizacoes ? ((a.atualizacoes?.length || 0) === 1 ? '1 atualização' : `${a.atualizacoes?.length || 0} atualizações`) : null,
    a.autor ? `por @${a.autor}` : 'por Admin Bynx',
  ].filter(Boolean)
  return (
    <button type="button" className="org-linha" onClick={onAbrir}>
      <span className="org-ico" aria-hidden="true"><Ico n={a.fixado ? 'tachinha' : a.enquete ? 'enquete' : 'megafone'} s={20} /></span>
      <span className="pc-nm"><b>{a.titulo}</b><small>{partes.join(' · ')}</small></span>
      <Ico n="chev" className="arr" />
    </button>
  )
}

function FolhaAcoes({ a, onFechar, onEditar, onDuplicar, onFeito }: {
  a: AvisoOrg; onFechar: () => void; onEditar: () => void; onDuplicar: () => void; onFeito: (msg: string) => void
}) {
  const [passo, setPasso] = useState<'menu' | 'atualizar' | 'votos' | 'excluir'>('menu')
  const [texto, setTexto] = useState('')
  const [votos, setVotos] = useState<{ opcao: number; texto: string; contas: string[] }[] | null>(null)
  const [copiado, setCopiado] = useState<number | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  async function estado(acao: 'fixar' | 'desafixar' | 'arquivar' | 'restaurar' | 'excluir') {
    setOcupado(true); setErro('')
    const { data, error } = await supabase.rpc('club_aviso_estado', { p_id: a.id, p_acao: acao })
    if (error) { setOcupado(false); setErro(erroAviso(error.message)); return }
    const imgs = (data as { imagens?: string[] }).imagens
    if (acao === 'excluir' && imgs?.length) await supabase.storage.from(BUCKET).remove(imgs)
    setOcupado(false)
    onFeito({ fixar: 'Aviso fixado no topo.', desafixar: 'Aviso desafixado.', arquivar: 'Aviso arquivado.', restaurar: 'Aviso restaurado.', excluir: 'Rascunho excluído.' }[acao])
  }
  async function atualizar() {
    setOcupado(true); setErro('')
    const { error } = await supabase.rpc('club_aviso_atualizar', { p_id: a.id, p_texto: texto })
    setOcupado(false)
    if (error) { setErro(erroAviso(error.message)); return }
    onFeito('Atualização publicada no aviso.')
  }
  async function verVotos() {
    setPasso('votos'); setErro('')
    const { data, error } = await supabase.rpc('club_aviso_votos', { p_id: a.id })
    if (error) { setErro(erroAviso(error.message)); return }
    setVotos(data as { opcao: number; texto: string; contas: string[] }[])
  }
  async function copiar(i: number, contas: string[]) {
    try { await navigator.clipboard.writeText(contas.map(c => `@${c}`).join('\n')); setCopiado(i) } catch { setCopiado(null) }
  }

  if (passo === 'atualizar') {
    return (
      <Folha titulo="Adicionar atualização" onFechar={onFechar}>
        <p className="as-meta">Aparece no aviso, com data e hora, acima das anteriores. O texto do aviso não muda.</p>
        <textarea className="as-in" style={{ minHeight: 96 }} maxLength={500} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Já temos os voluntários. Valeu, turma!" />
        {erro && <div className="as-erro" role="alert">{erro}</div>}
        <button type="button" className="as-btn pri" disabled={ocupado || !texto.trim()} onClick={atualizar}>Publicar atualização</button>
        <button type="button" className="as-btn" disabled={ocupado} onClick={() => setPasso('menu')}>Voltar</button>
      </Folha>
    )
  }
  if (passo === 'votos') {
    return (
      <Folha titulo="Votos da enquete" onFechar={onFechar}>
        <p className="as-meta">{a.enquete?.pergunta} Só a organização vê quem votou.</p>
        {erro && <div className="as-erro" role="alert">{erro}</div>}
        {!votos && !erro && <span className="as-meta">Abrindo os votos...</span>}
        {votos?.map(v => (
          <div key={v.opcao} className="org-voto">
            <div className="org-voto-t"><b>{v.texto}</b><span className="as-meta">{v.contas.length} {v.contas.length === 1 ? 'voto' : 'votos'}</span></div>
            {v.contas.length > 0 && <p className="as-meta">{v.contas.map(c => `@${c}`).join(', ')}</p>}
            {v.contas.length > 0 && <button type="button" className="as-btn sm" onClick={() => copiar(v.opcao, v.contas)}><Ico n="copy" s={14} />{copiado === v.opcao ? 'Lista copiada.' : 'Copiar lista'}</button>}
          </div>
        ))}
        <button type="button" className="as-btn" onClick={() => setPasso('menu')}>Voltar</button>
      </Folha>
    )
  }
  if (passo === 'excluir') {
    return (
      <Folha titulo="Excluir rascunho" onFechar={onFechar}>
        <p className="as-meta">{a.titulo}. Isso não tem volta.</p>
        {erro && <div className="as-erro" role="alert">{erro}</div>}
        <button type="button" className="as-btn pri" disabled={ocupado} onClick={() => estado('excluir')}>Excluir</button>
        <button type="button" className="as-btn" disabled={ocupado} onClick={() => setPasso('menu')}>Voltar</button>
      </Folha>
    )
  }
  return (
    <Folha titulo={a.titulo} onFechar={onFechar}>
      {erro && <div className="as-erro" role="alert">{erro}</div>}
      {a.status !== 'arquivado' && <button type="button" className="as-btn pri" onClick={onEditar}>Editar</button>}
      {a.status === 'publicado' && <button type="button" className="as-btn" disabled={ocupado} onClick={() => estado(a.fixado ? 'desafixar' : 'fixar')}>{a.fixado ? 'Desafixar' : 'Fixar no topo'}</button>}
      {a.status === 'publicado' && <button type="button" className="as-btn" onClick={() => setPasso('atualizar')}>Adicionar atualização</button>}
      {a.enquete && <button type="button" className="as-btn" onClick={verVotos}>Ver votos ({a.enquete.total})</button>}
      <button type="button" className="as-btn" onClick={onDuplicar}>Duplicar</button>
      {a.status !== 'rascunho' && <Link href={avisoUrl(a.slug)} className="as-btn">Ver a página do aviso</Link>}
      {a.status === 'publicado' && <button type="button" className="as-btn" disabled={ocupado} onClick={() => estado('arquivar')}>Arquivar</button>}
      {a.status === 'arquivado' && <button type="button" className="as-btn" disabled={ocupado} onClick={() => estado('restaurar')}>Restaurar</button>}
      {a.status === 'rascunho' && <button type="button" className="as-btn" onClick={() => setPasso('excluir')}>Excluir rascunho</button>}
    </Folha>
  )
}

const ORG_CSS = `
.org-filtro{cursor:pointer;min-height:44px;height:auto;font:inherit;font-size:12.5px;font-weight:700}
.ag-topo .as-btn.pri{display:inline-flex;align-items:center;gap:6px}
.org-linha{display:flex;align-items:center;gap:12px;min-height:64px;width:100%;padding:8px 0;background:transparent;border:0;border-bottom:1px solid var(--bx-border);color:var(--bx-text);font:inherit;text-align:left;cursor:pointer;transition:background .15s ease}
.org-linha:hover{background:var(--bx-surface)}
.org-linha .arr{color:var(--bx-text-3)}
.org-ico{width:40px;height:40px;border-radius:10px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--ac-1);display:inline-flex;align-items:center;justify-content:center;flex:none}
.org-voto{display:flex;flex-direction:column;gap:6px;padding:10px 0;border-bottom:1px solid var(--bx-border)}
.org-voto-t{display:flex;justify-content:space-between;gap:8px}
.org-voto .as-btn{width:auto;align-self:flex-start;display:inline-flex;align-items:center;gap:6px}
`
