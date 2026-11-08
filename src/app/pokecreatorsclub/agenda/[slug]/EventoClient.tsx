'use client'

// Detalhe de um evento da Agenda (wireframe de 08/11/2026, quadros E05 a E10 e
// D6). Acao principal muda pelo tipo e pelo momento; adicionar a agenda e
// compartilhar abrem folhas. Evento cancelado so deixa compartilhar o aviso.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { authFetch } from '@/lib/authFetch'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { hojeBrasilia } from '@/lib/pcc/datas'
import {
  TIPOS, dataPorExtenso, dominio, erroAgenda, googleAgendaUrl, mapaUrl, momento, ondeTexto, rotuloLink, textoWhatsApp,
  type Evento,
} from '@/lib/pcc/agenda'
import { AGENDA, AGENDA_ORGANIZAR, agendaEvento } from '@/lib/pcc/rotas'
import { Ico } from '../../amigo-secreto/estilo'
import { Folha } from '../../_comum/calendario'
import { Casca, ChipEstado } from '../comum'

const BUCKET = 'club-fotos'
const urlImagem = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

export default function EventoClient({ slug }: { slug: string }) {
  const { openLogin } = useAuthModal()
  const [uid, setUid] = useState<string | null | undefined>(undefined)
  const [ev, setEv] = useState<Evento | null>(null)
  const [papeis, setPapeis] = useState<string[]>([])
  const [erro, setErro] = useState('')
  const [folha, setFolha] = useState<'agenda' | 'compartilhar' | null>(null)
  const hoje = useMemo(() => hojeBrasilia(), [])
  const rota = agendaEvento(slug)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const carregar = useCallback(async () => {
    setErro('')
    const { data, error } = await supabase.rpc('club_agenda_evento', { p_slug: slug })
    if (error) { setErro(error.message.includes('evento_nao_encontrado') ? 'nao_encontrado' : 'falha'); return }
    const d = data as { evento: Evento; papeis: string[] }
    setEv(d.evento)
    setPapeis(d.papeis)
  }, [slug])

  // Busca quando a sessao aparece; o setErro('') do inicio e o reset da tentativa.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (uid) carregar() }, [uid, carregar])
  const fechar = useCallback(() => setFolha(null), [])

  const casca = (filhos: React.ReactNode, logado = true) => (
    <Casca logado={logado} onEntrar={() => openLogin({ next: rota, cta: 'Entrar no Club' })} voltar={AGENDA} rotuloVoltar="Agenda" titulo="Evento">{filhos}</Casca>
  )

  if (uid === undefined) return casca(<div className="as-center"><span className="as-meta">Abrindo...</span></div>, false)

  if (uid === null) {
    const entrar = () => openLogin({ next: rota, cta: 'Entrar no Club' })
    return casca(
      <div className="as-center">
        <div className="as-verso tilt" aria-hidden="true"><Ico n="cal" s={28} /></div>
        <h1 className="as-h2">Agenda do Club</h1>
        <p className="as-p">Entre para ver a agenda.</p>
        <button type="button" className="as-btn pri cta" style={{ maxWidth: 320, width: '100%' }} onClick={entrar}>Entrar</button>
        <Link href={`/cadastro?next=${encodeURIComponent(rota)}`} className="as-btn" style={{ maxWidth: 320, width: '100%' }}>Criar conta</Link>
      </div>, false)
  }

  if (erro === 'nao_encontrado') {
    return casca(<>
      <h1 className="as-h2">Evento não encontrado</h1>
      <p className="as-meta">O link pode estar errado, ou o evento ainda não foi publicado.</p>
      <Link href={AGENDA} className="as-btn">Ver a agenda</Link>
    </>)
  }
  if (erro) {
    return casca(<>
      <div className="as-erro" role="alert">Não conseguimos carregar o evento.</div>
      <button type="button" className="as-btn" onClick={carregar}>Tentar de novo</button>
    </>)
  }
  if (!ev) return casca(<div className="as-center"><span className="as-meta">Abrindo o evento...</span></div>)

  const m = momento(ev, hoje)
  const passou = m === 'passado'
  const cancelado = ev.status === 'cancelado'
  const adiado = ev.status === 'adiado'
  const podeAgendar = !cancelado && !adiado && !passou
  const urlAbsoluta = typeof window !== 'undefined' ? `${window.location.origin}${rota}` : rota

  const acoes = (
    <div className="ev-acoes">
      {!cancelado && ev.formato === 'presencial' && !passou && (
        <a className="as-btn pri" href={mapaUrl(ev)} target="_blank" rel="noopener noreferrer">Ver no mapa</a>
      )}
      {!cancelado && ev.link_url && (
        <>
          <a className={`as-btn${ev.formato === 'online' ? ' pri' : ''}`} href={ev.link_url} target="_blank" rel="noopener noreferrer">{rotuloLink(ev, passou)}</a>
          <span className="as-meta ev-dom">Abre {dominio(ev.link_url)}</span>
        </>
      )}
      {podeAgendar && <button type="button" className="as-btn" onClick={() => setFolha('agenda')}><Ico n="cal" s={16} />Adicionar à agenda</button>}
      <button type="button" className="as-btn" onClick={() => setFolha('compartilhar')}><Ico n="share" s={16} />{cancelado ? 'Compartilhar o aviso' : 'Compartilhar'}</button>
      {papeis.includes('agenda') && !cancelado && <Link href={`${AGENDA_ORGANIZAR}?editar=${ev.id}`} className="as-btn lnk">Editar evento</Link>}
    </div>
  )

  return casca(<>
    <div className="ev-grade">
      <div className="ev-info">
        {ev.imagem_path && (
          <div className="ev-img"><Image src={urlImagem(ev.imagem_path)} alt="" fill sizes="(min-width: 1024px) 640px, 100vw" /></div>
        )}
        <div className="as-chips">
          <span className="as-chip"><Ico n={TIPOS[ev.tipo].ico} s={14} />{TIPOS[ev.tipo].rotulo}</span>
          <ChipEstado e={ev} hoje={hoje} />
        </div>
        <h1 className="as-h2 ev-tit">{ev.titulo}</h1>

        {cancelado && <div className="as-note strong" role="status">Cancelado.{ev.nota_status ? ` Motivo: ${ev.nota_status}` : ''}</div>}
        {adiado && <div className="as-note" role="status">Adiado. Nova data em breve.{ev.nota_status ? ` ${ev.nota_status}` : ''}</div>}

        <div className="ev-dl">
          <div><span className="as-k">{cancelado ? 'Seria' : adiado ? 'Era' : passou ? 'Foi' : 'Quando'}</span><span>{dataPorExtenso(ev)} <small>(horário de Brasília)</small></span></div>
          <div><span className="as-k">Onde</span><span>{ondeTexto(ev)}</span></div>
          {ev.participantes.length > 0 && (
            <div><span className="as-k">{ev.formato === 'presencial' ? 'Do Club vão' : 'Quem participa'}</span>
              <span className="ev-ats">{ev.participantes.map(p => <a key={p} href={`https://instagram.com/${p}`} target="_blank" rel="noopener noreferrer">@{p}</a>)}</span>
            </div>
          )}
        </div>
        {ev.descricao && <p className="as-p ev-desc">{ev.descricao}</p>}
      </div>
      <div className="ev-lado">{acoes}</div>
    </div>

    {folha === 'agenda' && <FolhaAgenda ev={ev} urlEvento={urlAbsoluta} onFechar={fechar} />}
    {folha === 'compartilhar' && <FolhaCompartilhar ev={ev} urlEvento={urlAbsoluta} onFechar={fechar} />}
    <style>{EV_CSS}</style>
  </>)
}

function FolhaAgenda({ ev, urlEvento, onFechar }: { ev: Evento; urlEvento: string; onFechar: () => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  // O arquivo .ics vem do servidor: gerado no navegador ele falha no Safari do
  // iPhone. A rota devolve um link assinado de 5 minutos, sem dado da pessoa.
  async function apple() {
    setOcupado(true); setErro('')
    const r = await authFetch('/api/pcc/agenda/ics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: ev.slug }) })
    const d = await r.json().catch(() => ({}))
    setOcupado(false)
    if (!r.ok || !d.url) { setErro(erroAgenda(d.error) === 'Não conseguimos salvar. Tente de novo.' ? 'Não conseguimos gerar o arquivo. Tente de novo.' : erroAgenda(d.error)); return }
    window.location.href = d.url
  }
  return (
    <Folha titulo="Adicionar à agenda" onFechar={onFechar}>
      <a className="as-btn" href={googleAgendaUrl(ev, urlEvento)} target="_blank" rel="noopener noreferrer">Google Agenda</a>
      <button type="button" className="as-btn" disabled={ocupado} onClick={apple}>{ocupado ? 'Gerando...' : 'iPhone e outras agendas'}</button>
      {erro && <div className="as-erro" role="alert">{erro}</div>}
      <span className="as-hint">Com lembrete 1 hora antes.</span>
    </Folha>
  )
}

function FolhaCompartilhar({ ev, urlEvento, onFechar }: { ev: Evento; urlEvento: string; onFechar: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const texto = textoWhatsApp(ev, urlEvento)
  async function copiar() {
    try { await navigator.clipboard.writeText(urlEvento); setCopiado(true) } catch { setCopiado(false) }
  }
  return (
    <Folha titulo="Compartilhar" onFechar={onFechar}>
      <pre className="ev-wa">{texto}</pre>
      <a className="as-btn pri" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer"><Ico n="send" s={16} />Enviar no WhatsApp</a>
      <button type="button" className="as-btn" onClick={copiar}><Ico n="copy" s={16} />{copiado ? 'Link copiado.' : 'Copiar link'}</button>
    </Folha>
  )
}

const EV_CSS = `
.ev-grade{display:flex;flex-direction:column;gap:16px;min-width:0}
.ev-info{display:flex;flex-direction:column;gap:12px;min-width:0}
.ev-img{position:relative;width:100%;aspect-ratio:16/9;border-radius:14px;overflow:hidden;border:1px solid var(--bx-border);background:var(--bx-surface-2)}
.ev-img img{object-fit:cover}
.ev-tit{word-break:break-word}
.ev-dl{display:flex;flex-direction:column}
.ev-dl>div{display:flex;flex-direction:column;gap:2px;padding:10px 0;border-bottom:1px solid var(--bx-border)}
.ev-dl>div:last-child{border-bottom:0}
.ev-dl>div>span:last-child{font-size:14.5px;color:var(--bx-text)}
.ev-dl small{color:var(--bx-text-3);font-size:12px}
.ev-ats{display:flex;flex-wrap:wrap;gap:4px 10px}
.ev-ats a{color:var(--ac-1);text-decoration:none;font-weight:600;min-height:32px;display:inline-flex;align-items:center}
.ev-desc{white-space:pre-line;margin:0}
.ev-acoes{display:flex;flex-direction:column;gap:8px}
.ev-acoes .as-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px}
.ev-dom{text-align:center;margin-top:-4px}
.ev-wa{margin:0;padding:12px;border-radius:10px;border:1px solid var(--bx-border);background:var(--bx-surface);font:inherit;font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:break-word;color:var(--bx-text-2)}
@media (min-width:1024px){
  .ev-grade{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:32px;align-items:start}
  .ev-lado{position:sticky;top:88px;border:1px solid var(--bx-border);border-radius:16px;padding:16px;background:var(--bx-surface)}
}
`
