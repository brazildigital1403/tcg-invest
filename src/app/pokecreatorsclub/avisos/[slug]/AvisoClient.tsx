'use client'

// Um aviso do Club na "Revista do Club" (mockups detalhe-a e detalhe-b
// aprovados em 09/11/2026). Capa como materia de revista, a ACAO logo depois
// do titulo (enquete, pagamento, Agenda) e nunca some: no celular uma barra no
// rodape aparece quando o bloco de acao sai da tela; no desktop a acao fica na
// coluna lateral. Texto longo ganha indice "Neste aviso". No fim, Vem ai e
// outros avisos para continuar.

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import {
  categoriaDe, chipPrazo, dataCurta, dominio, ehPagamento, pedeResposta, prazoPassou, prazoPorExtenso,
  type Aviso, type ListaAvisos,
} from '@/lib/pcc/avisos'
import { diasAte, horaCurta, isoDia, parseDia, type Evento } from '@/lib/pcc/agenda'
import { hojeBrasilia, MESES, MESES_CURTOS } from '@/lib/pcc/datas'
import { AGENDA, AVISOS, AVISOS_ORGANIZAR, agendaEvento, avisoUrl } from '@/lib/pcc/rotas'
import { Ico, SeloFrente } from '../../amigo-secreto/estilo'
import { Casca } from '../../agenda/comum'
import { AV_CSS, Enquete, TelaCheia, urlImagem } from '../comum'
import { CapaAuto, CapaAviso, VemAi, useVemAi } from '../capa'
import { TEXTO_CSS, TextoAviso, subtitulos } from '../Texto'

const HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export default function AvisoClient({ slug }: { slug: string }) {
  const { openLogin } = useAuthModal()
  const [uid, setUid] = useState<string | null | undefined>(undefined)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [papeis, setPapeis] = useState<string[]>([])
  const [estado, setEstado] = useState<'ok' | 'nao_encontrado' | 'arquivado' | 'falha'>('ok')
  const [cheia, setCheia] = useState<number | null>(null)
  const [outros, setOutros] = useState<Aviso[]>([])
  const [mes, setMes] = useState<Evento[] | null>(null)
  const [acaoVisivel, setAcaoVisivel] = useState(true)
  const acaoRef = useRef<HTMLDivElement | null>(null)
  const rota = avisoUrl(slug)
  const vemAi = useVemAi(!!aviso, 5)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const carregar = useCallback(async () => {
    setEstado('ok')
    const { data, error } = await supabase.rpc('club_aviso', { p_slug: slug })
    if (error) { setEstado(error.message.includes('aviso_nao_encontrado') ? 'nao_encontrado' : 'falha'); return }
    const d = data as { aviso?: Aviso; arquivado?: boolean; papeis: string[] }
    setPapeis(d.papeis)
    if (d.arquivado) { setEstado('arquivado'); return }
    setAviso(d.aviso || null)
  }, [slug])

  // Busca quando a sessao aparece; o setEstado do inicio e o reset da tentativa.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (uid) carregar() }, [uid, carregar])
  const fecharCheia = useCallback(() => setCheia(null), [])

  // "Outros avisos" no fim: falha aqui so esconde a secao.
  useEffect(() => {
    if (!aviso) return
    let vivo = true
    supabase.rpc('club_avisos_lista').then(({ data }) => {
      if (!vivo || !data) return
      setOutros((data as ListaAvisos).avisos.filter(a => a.id !== aviso.id && !prazoPassou(a)).slice(0, 3))
    })
    return () => { vivo = false }
  }, [aviso])

  // Aviso do calendario do mes: lista os eventos da Agenda daquele mes.
  useEffect(() => {
    if (!aviso?.agenda_mes) return
    let vivo = true
    const de = aviso.agenda_mes.slice(0, 10)
    const m = parseDia(de)
    const ate = isoDia({ ano: m.ano, mes: m.mes, dia: new Date(Date.UTC(m.ano, m.mes, 0)).getUTCDate() })
    supabase.rpc('club_agenda_lista', { p_de: de, p_ate: ate }).then(({ data, error }) => {
      if (!vivo) return
      setMes(error || !data ? [] : (data as { eventos: Evento[] }).eventos
        .filter(e => e.status !== 'rascunho')
        .sort((a, b) => a.inicio_data.localeCompare(b.inicio_data) || (a.hora_inicio || '').localeCompare(b.hora_inicio || '')))
    })
    return () => { vivo = false }
  }, [aviso?.agenda_mes])

  // Barra do rodape (celular): aparece so quando o bloco de acao sai da tela.
  useEffect(() => {
    const el = acaoRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setAcaoVisivel(e.isIntersecting || e.boundingClientRect.top > window.innerHeight), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [aviso])

  const casca = (filhos: React.ReactNode, logado = true) => (
    <Casca logado={logado} onEntrar={() => openLogin({ next: rota, cta: 'Entrar no Club' })} voltar={AVISOS} rotuloVoltar="Avisos" titulo="Aviso">
      {filhos}
      <style>{AV_CSS + TEXTO_CSS + DET_CSS}</style>
    </Casca>
  )

  if (uid === undefined) return casca(<div className="as-center"><span className="as-meta">Abrindo...</span></div>, false)
  if (uid === null) {
    const entrar = () => openLogin({ next: rota, cta: 'Entrar no Club' })
    return casca(
      <div className="as-center">
        <SeloFrente frente="avisos" />
        <h1 className="as-h2">Avisos do Club</h1>
        <p className="as-p">Entre para ver os avisos.</p>
        <button type="button" className="as-btn pri cta" style={{ maxWidth: 320, width: '100%' }} onClick={entrar}>Entrar</button>
        <Link href={`/cadastro?next=${encodeURIComponent(rota)}`} className="as-btn" style={{ maxWidth: 320, width: '100%' }}>Criar conta</Link>
      </div>, false)
  }
  if (estado === 'arquivado' || estado === 'nao_encontrado') {
    return casca(<>
      <h1 className="as-h2">{estado === 'arquivado' ? 'Este aviso foi arquivado' : 'Aviso não encontrado'}</h1>
      <p className="as-meta">{estado === 'arquivado' ? 'A organização tirou este aviso da lista.' : 'O link pode estar errado, ou o aviso ainda não foi publicado.'}</p>
      <Link href={AVISOS} className="as-btn">Ver os avisos</Link>
    </>)
  }
  if (estado === 'falha') {
    return casca(<>
      <div className="as-erro" role="alert">Não conseguimos carregar o aviso.</div>
      <button type="button" className="as-btn" onClick={carregar}>Tentar de novo</button>
    </>)
  }
  if (!aviso) return casca(<div className="as-center"><span className="as-meta">Abrindo o aviso...</span></div>)

  const organiza = papeis.includes('avisos')
  const evento = aviso.evento
  const encerrado = prazoPassou(aviso)
  const prazo = chipPrazo(aviso)
  const cat = categoriaDe(aviso)
  const vota = pedeResposta(aviso)
  const temAcao = !!aviso.enquete || aviso.links.length > 0 || !!evento || (!!aviso.prazo_em && !encerrado)
  const subs = aviso.corpo ? subtitulos(aviso.corpo) : []
  const indice = subs.length >= 2
  const linkPrincipal = aviso.links[0]
  const urlCompleta = typeof window !== 'undefined' ? `${window.location.origin}${rota}` : rota
  const whats = `https://wa.me/?text=${encodeURIComponent(`${aviso.titulo}\n${urlCompleta}`)}`

  // O bloco aparece duas vezes (celular no fluxo, desktop na lateral); so o do celular e observado.
  const blocoAcao = (mob: boolean) => temAcao && (
    <div ref={mob ? acaoRef : undefined} id={mob ? 'av-acao' : undefined} className={`dv-act${vota ? ' quente' : ''}${encerrado ? ' fim' : ''}`}>
      {aviso.prazo_em && (
        <div className="dv-act-top">
          <span className="k"><Ico n={encerrado ? 'check' : 'clock'} s={14} />{encerrado ? 'Encerrado' : vota ? 'Sua resposta' : 'Prazo'}</span>
          {prazo && !encerrado && <span className="av-chip amber">{prazo.texto}</span>}
        </div>
      )}
      {aviso.prazo_em && <p className="dv-when">{encerrado ? 'Encerrou' : 'Até'} {minuscula(prazoPorExtenso(aviso.prazo_em))}, horário de Brasília.</p>}
      {aviso.enquete && <Enquete key={aviso.enquete.meu_voto?.join(',') || 'novo'} avisoId={aviso.id} enquete={aviso.enquete} onAtualizar={a => setAviso(x => (x ? { ...x, ...a } : a))} />}
      {aviso.links.map((l, i) => {
        const pagamento = ehPagamento(l.url)
        return (
          <div key={i} className="dv-link">
            <a className={`as-btn${i === 0 && !vota ? ' pri' : ''}`} href={l.url} target="_blank" rel="noopener noreferrer nofollow ugc">
              <Ico n={pagamento ? 'ext' : 'link'} s={16} />{l.rotulo || 'Abrir o link'}
            </a>
            <span className="dv-dom">{pagamento ? `Abre ${dominio(l.url)} · Pagamento direto com a organização do Club, fora da Bynx.` : `Abre ${dominio(l.url)}`}</span>
          </div>
        )
      })}
      {evento && (
        <Link href={agendaEvento(evento.slug)} className="as-btn">
          <Ico n="cal" s={16} />Ver na Agenda: {evento.titulo}, {evento.inicio_data.slice(8, 10)}/{evento.inicio_data.slice(5, 7)}{evento.hora_inicio ? `, às ${horaCurta(evento.hora_inicio)}` : ''}{evento.status === 'cancelado' ? ' (cancelado)' : evento.status === 'adiado' ? ' (adiado)' : ''}
        </Link>
      )}
    </div>
  )

  const extras = (
    <div className="dv-extras">
      <a className="as-btn" href={whats} target="_blank" rel="noopener noreferrer"><Ico n="share" s={16} />Compartilhar no WhatsApp</a>
      {organiza && aviso.status !== 'arquivado' && <Link href={`${AVISOS_ORGANIZAR}?editar=${aviso.id}`} className="as-btn lnk">Editar aviso</Link>}
    </div>
  )

  // Rodape do celular: o que a pessoa faz neste aviso, sem precisar voltar ao topo.
  const doca = !acaoVisivel && !encerrado && (vota || linkPrincipal) && (
    <div className="dv-doca">
      {vota
        ? <a href="#av-acao" className="as-btn pri"><Ico n="enquete" s={18} />Responder enquete{prazo ? ` · ${prazo.texto.toLowerCase()}` : ''}</a>
        : <a href={linkPrincipal.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="as-btn pri"><Ico n={ehPagamento(linkPrincipal.url) ? 'ext' : 'link'} s={18} />{linkPrincipal.rotulo || 'Abrir o link'}</a>}
    </div>
  )

  return casca(<>
    <div className="dv">
      <div className="dv-grade">
        <article className="dv-info">
          {aviso.imagens.length > 0 ? (
            <button type="button" className={`dv-hero${encerrado ? ' fim' : ''}`} aria-label="Abrir imagem 1 em tela cheia" onClick={() => setCheia(0)}>
              <CapaAviso a={aviso} sizes="(min-width: 1024px) 680px, 100vw" prioridade enquadrar />
              {aviso.imagens.length > 1 && <span className="n"><Ico n="eye" s={14} />1 de {aviso.imagens.length}</span>}
            </button>
          ) : (
            <div className={`dv-hero auto${encerrado ? ' fim' : ''}`}><CapaAuto a={aviso} /></div>
          )}
          {aviso.imagens.length > 1 && (
            <div className="dv-thumbs">
              {aviso.imagens.slice(1).map((p, i) => (
                <button key={p} type="button" className="dv-thumb" aria-label={`Abrir imagem ${i + 2} em tela cheia`} onClick={() => setCheia(i + 1)}>
                  <Image src={urlImagem(p)} alt="" fill sizes="120px" />
                </button>
              ))}
            </div>
          )}

          <div className="dv-head">
            <span className="dv-cat">
              {aviso.fixado && <span className="pin"><Ico n="tachinha" s={13} />Fixado</span>}
              {cat.rotulo}
              {encerrado && <span className="fimtag"><Ico n="check" s={13} />Encerrado</span>}
            </span>
            <h1 className="dv-tit">{aviso.titulo}</h1>
            <p className="dv-by">
              <span className="av" aria-hidden="true">{(aviso.autor || 'C').charAt(0).toUpperCase()}</span>
              <span>{aviso.autor ? `@${aviso.autor}` : 'Organização do Club'}{aviso.publicado_em ? ` · ${dataCurta(aviso.publicado_em)}` : ''}{aviso.editado_em ? ` · editado ${dataCurta(aviso.editado_em)}` : ''}</span>
            </p>
          </div>

          <div className="dv-so-mob">{blocoAcao(true)}</div>

          {aviso.atualizacoes && aviso.atualizacoes.length > 0 && (
            <section className="dv-upds" aria-label="Atualizações">
              <div className="dv-k">Atualizações</div>
              {aviso.atualizacoes.map((u, i) => (
                <div key={i} className="dv-upd">
                  <span className="q">{i === 0 && <span className="av-chip new">Nova</span>}{dataCurta(u.em)}, {HORA.format(new Date(u.em))}</span>
                  <TextoAviso texto={u.texto} />
                </div>
              ))}
            </section>
          )}

          {indice && (
            <nav className="dv-toc" aria-label="Neste aviso">
              <div className="dv-k"><Ico n="menu" s={14} />Neste aviso</div>
              {subs.map((t, i) => (
                <a key={i} href={`#av-sub-${i}`}><span className="n">{String(i + 1).padStart(2, '0')}</span>{t.replace(/\*/g, '')}<Ico n="chev" s={16} className="arr" /></a>
              ))}
              {aviso.importante && <a href="#av-imp" className="imp"><span className="n">!</span>Importante<Ico n="chev" s={16} className="arr" /></a>}
            </nav>
          )}

          {aviso.corpo && <div className="dv-prosa"><TextoAviso texto={aviso.corpo} ancoras={indice} /></div>}
          {aviso.importante && (
            <div id="av-imp" className="dv-imp"><span className="l"><Ico n="alert" s={14} />Importante</span><p>{aviso.importante}</p></div>
          )}

          {aviso.agenda_mes && mes && mes.length > 0 && <AgendaDoMes eventos={mes} mesIso={aviso.agenda_mes} />}

          {extras}
        </article>
        <aside className="dv-lado">
          {blocoAcao(false)}
          <div className="dv-so-desk">{extras}</div>
        </aside>
      </div>

      <VemAi eventos={vemAi} />

      {outros.length > 0 && (
        <section aria-label="Outros avisos">
          <div className="av-sec"><h2>Outros avisos</h2><Link href={AVISOS}>Ver todos</Link></div>
          <div className="dv-outros">
            {outros.map(a => (
              <Link key={a.id} href={avisoUrl(a.slug)} className="dv-outro">
                <span className="th"><CapaAviso a={a} sizes="96px" /></span>
                <span className="tx"><span className="c">{categoriaDe(a).rotulo}</span><span className="t">{a.titulo}</span></span>
                <Ico n="chev" className="arr" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
    {doca}
    {cheia !== null && <TelaCheia imagens={aviso.imagens} inicio={cheia} onFechar={fecharCheia} />}
  </>)
}

function AgendaDoMes({ eventos, mesIso }: { eventos: Evento[]; mesIso: string }) {
  const hoje = hojeBrasilia()
  const m = parseDia(mesIso.slice(0, 10))
  const proximo = eventos.find(e => diasAte(e.fim_data, hoje) >= 0)
  return (
    <section className="dv-mes" aria-label={`Agenda de ${MESES[m.mes - 1]}`}>
      <div className="av-sec"><div><h2>Na Agenda de {MESES[m.mes - 1].toLowerCase()}</h2><p className="sub">Toque para abrir o evento</p></div><Link href={AGENDA}>Ver agenda</Link></div>
      <div className="dv-mes-l">
        {eventos.map(e => {
          const d = parseDia(e.inicio_data)
          const passou = diasAte(e.fim_data, hoje) < 0
          const em = diasAte(e.inicio_data, hoje)
          const sem = SEMANA[new Date(Date.UTC(d.ano, d.mes - 1, d.dia)).getUTCDay()]
          return (
            <Link key={e.id} href={agendaEvento(e.slug)} className={`dv-mes-e${passou ? ' passou' : ''}${e.id === proximo?.id ? ' prox' : ''}`}>
              <span className="dt"><b>{String(d.dia).padStart(2, '0')}</b><small>{MESES_CURTOS[d.mes - 1]} · {sem}</small></span>
              <span className="tx">
                <span className="t">{e.titulo}</span>
                <span className="s">{e.hora_inicio ? horaCurta(e.hora_inicio) : 'Dia todo'}{e.status === 'cancelado' ? ' · cancelado' : e.status === 'adiado' ? ' · adiado' : ''}</span>
              </span>
              {e.id === proximo?.id && <span className="av-chip amber">{em <= 0 ? 'Hoje' : em === 1 ? 'Amanhã' : 'Próximo'}</span>}
              {passou && <Ico n="check" s={16} className="ok" />}
            </Link>
          )
        })}
      </div>
    </section>
  )
}

const DET_CSS = `
.dv{display:flex;flex-direction:column;min-width:0}
.dv-grade{display:flex;flex-direction:column;gap:16px;min-width:0}
.dv-info{display:flex;flex-direction:column;gap:16px;min-width:0}
.dv-hero{position:relative;display:block;width:auto;height:260px;margin:0 -16px;border:0;padding:0;overflow:hidden;background:var(--bx-bg-elev);cursor:zoom-in}
.dv-hero.auto{cursor:default}
.dv-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,var(--bx-bg) 0%,transparent 30%);pointer-events:none}
.dv-hero.fim{filter:saturate(.55)}
.dv-hero .n{position:absolute;right:12px;bottom:12px;z-index:2;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;background:var(--bx-scrim);border:1px solid var(--bx-border-2);font-size:12px;font-weight:700;color:var(--bx-text)}
.dv-thumbs{display:flex;gap:8px;margin-top:-6px}
.dv-thumb{position:relative;width:88px;height:66px;border-radius:12px;overflow:hidden;border:1px solid var(--bx-border-2);padding:0;background:var(--bx-surface-2);cursor:zoom-in}
.dv-thumb img{object-fit:cover}
.dv-head{display:flex;flex-direction:column;gap:8px}
.dv-cat{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ac-1)}
.dv-cat .pin,.dv-cat .fimtag{display:inline-flex;align-items:center;gap:4px;color:var(--bx-text-2);letter-spacing:.08em}
.dv-tit{margin:0;font-size:28px;line-height:1.1;font-weight:800;letter-spacing:-.02em;text-wrap:balance;overflow-wrap:anywhere}
.dv-by{display:flex;align-items:center;gap:8px;margin:0;font-size:13px;color:var(--bx-text-3)}
.dv-by .av{width:24px;height:24px;border-radius:50%;background:var(--bx-surface-3);border:1px solid var(--bx-border-2);display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:var(--bx-text-2);flex:none}
.dv-k{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--bx-text-2)}

.dv-act{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:20px;border:1px solid var(--bx-border-2);background:var(--bx-surface);scroll-margin-top:80px}
.dv-act.quente{border-color:rgba(var(--ac-1-rgb),.40);background:linear-gradient(160deg,rgba(var(--ac-1-rgb),.10),var(--bx-surface) 55%)}
.dv-act.fim{opacity:.85}
.dv-act-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dv-act-top .k{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ac-1)}
.dv-act.fim .dv-act-top .k{color:var(--bx-text-2)}
.dv-when{margin:-4px 0 0;font-size:13px;line-height:1.45;color:var(--bx-text-2)}
.dv-act .av-enq{padding:0;border:0;background:transparent}
.dv-act .as-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-align:center}
.dv-link{display:flex;flex-direction:column;gap:6px}
.dv-dom{text-align:center;font-size:12px;line-height:1.4;color:var(--bx-text-3)}
.av-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
.av-chip.new{background:var(--ac-grad);color:var(--bx-bg);height:22px;padding:0 8px}
.av-chip.amber{background:rgba(var(--ac-1-rgb),.12);color:var(--ac-1);border:1px solid rgba(var(--ac-1-rgb),.3)}

.dv-upds{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:18px;background:var(--bx-surface);border:1px solid var(--bx-border)}
.dv-upd{border-left:3px solid var(--ac-1);padding:2px 0 2px 12px;display:flex;flex-direction:column;gap:6px}
.dv-upd+.dv-upd{border-left-color:var(--bx-border-2)}
.dv-upd .q{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--bx-text-3)}
.dv-upd .av-texto{font-size:15px}

.dv-toc{display:flex;flex-direction:column;padding:8px;border-radius:16px;background:var(--bx-surface);border:1px solid var(--bx-border)}
.dv-toc .dv-k{padding:8px 8px 4px}
.dv-toc a{display:flex;align-items:center;gap:12px;min-height:44px;padding:0 8px;border-radius:10px;font-size:15px;font-weight:600;color:var(--bx-text);text-decoration:none;transition:background .15s ease}
.dv-toc a:hover{background:var(--bx-surface-2)}
.dv-toc .n{font-size:12px;font-weight:800;color:var(--ac-1);width:20px;font-variant-numeric:tabular-nums}
.dv-toc .imp .n{color:var(--ac-2)}
.dv-toc .arr{margin-left:auto;color:var(--bx-text-3)}

.dv-prosa .av-texto{font-size:17px;line-height:1.68;max-width:66ch}
.dv-prosa .av-texto .av-sub{font-size:21px;line-height:1.2;letter-spacing:-.015em;margin:20px 0 -2px}
.dv-imp{position:relative;overflow:hidden;padding:16px 16px 16px 20px;border-radius:16px;background:rgba(var(--ac-2-rgb),.08);border:1px solid rgba(var(--ac-2-rgb),.30);scroll-margin-top:80px}
.dv-imp::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--ac-grad)}
.dv-imp .l{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--ac-2)}
.dv-imp p{margin:8px 0 0;font-size:16px;font-weight:700;line-height:1.5;color:var(--bx-text)}

.dv-mes .av-sec{padding-top:8px}
.dv-mes-l{display:flex;flex-direction:column;gap:8px}
.dv-mes-e{display:flex;align-items:center;gap:12px;min-height:60px;padding:10px 12px;border-radius:14px;background:var(--bx-surface);border:1px solid var(--bx-border);text-decoration:none;color:var(--bx-text);transition:background .15s ease,transform .15s ease}
.dv-mes-e:hover{background:var(--bx-surface-2);transform:translateY(-2px)}
.dv-mes-e .dt{display:flex;flex-direction:column;align-items:center;width:52px;flex:none}
.dv-mes-e .dt b{font-size:24px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
.dv-mes-e .dt small{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ac-1);margin-top:4px;white-space:nowrap}
.dv-mes-e .tx{display:flex;flex-direction:column;min-width:0;flex:1}
.dv-mes-e .t{font-size:15px;font-weight:700;line-height:1.3}
.dv-mes-e .s{font-size:12px;color:var(--bx-text-3);margin-top:2px}
.dv-mes-e.passou{opacity:.5}
.dv-mes-e.prox{border-color:rgba(var(--ac-1-rgb),.45);background:linear-gradient(160deg,rgba(var(--ac-1-rgb),.10),var(--bx-surface) 60%)}
.dv-mes-e .ok{color:var(--bx-text-3);flex:none}

.dv-extras{display:flex;flex-direction:column;gap:8px}
.dv-extras .as-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px}
.dv-so-desk{display:none}
.dv-lado{display:none}

.dv-outros{display:flex;flex-direction:column;gap:8px}
.dv-outro{display:flex;align-items:center;gap:12px;padding:10px;border-radius:14px;background:var(--bx-surface);border:1px solid var(--bx-border);text-decoration:none;color:var(--bx-text);transition:background .15s ease,transform .15s ease}
.dv-outro:hover{background:var(--bx-surface-2);transform:translateY(-2px)}
.dv-outro .th{position:relative;width:72px;height:54px;border-radius:10px;overflow:hidden;flex:none}
.dv-outro .th .word,.dv-outro .th .pcc{display:none}
.dv-outro .tx{display:flex;flex-direction:column;min-width:0}
.dv-outro .c{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ac-1)}
.dv-outro .t{font-size:14px;font-weight:700;line-height:1.3;margin-top:2px}
.dv-outro .arr{margin-left:auto;color:var(--bx-text-3);flex:none}

.dv-doca{position:fixed;left:0;right:0;bottom:0;z-index:40;padding:12px max(16px,env(safe-area-inset-right,0px)) calc(12px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));background:var(--bx-bg-elev);border-top:1px solid var(--bx-border-2);animation:dv-sobe .2s ease}
.dv-doca .as-btn{display:flex;align-items:center;justify-content:center;gap:8px;max-width:520px;margin:0 auto}
@keyframes dv-sobe{from{transform:translateY(100%)}to{transform:none}}

@media (min-width:1024px){
  .dv-grade{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:40px;align-items:start}
  .dv-hero{margin:0;height:420px;border-radius:20px;border:1px solid var(--bx-border)}
  .dv-tit{font-size:40px}
  .dv-so-mob{display:none}
  .dv-info>.dv-extras{display:none}
  .dv-lado{display:flex;flex-direction:column;gap:16px;position:sticky;top:88px}
  .dv-so-desk{display:block}
  .dv-doca{display:none}
  .dv-outros{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
}
@media (prefers-reduced-motion:reduce){.dv-doca{animation:none}.dv-toc a,.dv-mes-e,.dv-outro{transition:none}}
`
