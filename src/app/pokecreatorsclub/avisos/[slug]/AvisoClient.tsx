'use client'

// Um aviso do Club (wireframe aprovado em 08/11/2026, quadros V03 a V09 e D9):
// imagens (tela cheia ao tocar), texto na sintaxe do WhatsApp, destaque, enquete,
// botoes de link (pagamento de terceiro avisa que e fora da Bynx), evento da
// Agenda vinculado e atualizacoes datadas.

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { dataCurta, dominio, ehPagamento, prazoPassou, prazoPorExtenso, type Aviso } from '@/lib/pcc/avisos'
import { horaCurta } from '@/lib/pcc/agenda'
import { AVISOS, AVISOS_ORGANIZAR, agendaEvento, avisoUrl } from '@/lib/pcc/rotas'
import { Ico } from '../../amigo-secreto/estilo'
import { Casca } from '../../agenda/comum'
import { AV_CSS, ChipsAviso, Enquete, TelaCheia, urlImagem } from '../comum'
import { TEXTO_CSS, TextoAviso } from '../Texto'

export default function AvisoClient({ slug }: { slug: string }) {
  const { openLogin } = useAuthModal()
  const [uid, setUid] = useState<string | null | undefined>(undefined)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [papeis, setPapeis] = useState<string[]>([])
  const [estado, setEstado] = useState<'ok' | 'nao_encontrado' | 'arquivado' | 'falha'>('ok')
  const [cheia, setCheia] = useState<number | null>(null)
  const rota = avisoUrl(slug)

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
        <div className="as-verso tilt" aria-hidden="true"><Ico n="megafone" s={28} /></div>
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

  const lado = (
    <div className="dv-acoes">
      {aviso.prazo_em && (
        <div className="dv-prazo">
          <span className="as-k">{prazoPassou(aviso) ? 'Encerrou' : 'Prazo'}</span>
          <span>{prazoPorExtenso(aviso.prazo_em)} <small>(horário de Brasília)</small></span>
        </div>
      )}
      {aviso.enquete && <Enquete key={aviso.enquete.meu_voto?.join(',') || 'novo'} avisoId={aviso.id} enquete={aviso.enquete} onAtualizar={a => setAviso(x => (x ? { ...x, ...a } : a))} />}
      {aviso.links.map((l, i) => {
        const pagamento = ehPagamento(l.url)
        return (
          <div key={i} className="dv-link">
            <a className={`as-btn${i === 0 ? ' pri' : ''}`} href={l.url} target="_blank" rel="noopener noreferrer nofollow ugc">
              <Ico n={pagamento ? 'ext' : 'link'} s={16} />{l.rotulo || 'Abrir o link'}
            </a>
            <span className="as-meta dv-dom">{pagamento ? `Abre ${dominio(l.url)} · Pagamento direto com a organização do Club, fora da Bynx.` : `Abre ${dominio(l.url)}`}</span>
          </div>
        )
      })}
      {evento && (
        <Link href={agendaEvento(evento.slug)} className="as-btn">
          <Ico n="cal" s={16} />Ver na Agenda: {evento.titulo}, {evento.inicio_data.slice(8, 10)}/{evento.inicio_data.slice(5, 7)}{evento.hora_inicio ? `, às ${horaCurta(evento.hora_inicio)}` : ''}
        </Link>
      )}
      {organiza && aviso.status !== 'arquivado' && <Link href={`${AVISOS_ORGANIZAR}?editar=${aviso.id}`} className="as-btn lnk">Editar aviso</Link>}
    </div>
  )

  return casca(<>
    <div className="dv-grade">
      <article className="dv-info">
        {aviso.imagens.length > 0 && (
          <div className={`dv-imgs n${aviso.imagens.length}`}>
            {aviso.imagens.map((p, i) => (
              <button key={p} type="button" className="dv-img" aria-label={`Abrir imagem ${i + 1} em tela cheia`} onClick={() => setCheia(i)}>
                <Image src={urlImagem(p)} alt="" fill sizes="(min-width: 1024px) 640px, 100vw" />
              </button>
            ))}
          </div>
        )}
        <div className="av-topo-chips"><ChipsAviso a={aviso} visto={null} comFixado /></div>
        <h1 className="as-h2 dv-tit">{aviso.titulo}</h1>
        <p className="as-meta dv-meta">
          {aviso.autor ? `por @${aviso.autor}` : 'Organização do Club'}
          {aviso.publicado_em ? ` · ${dataCurta(aviso.publicado_em)}` : ''}
          {aviso.editado_em ? ` · editado ${dataCurta(aviso.editado_em)}` : ''}
        </p>
        {aviso.corpo && <TextoAviso texto={aviso.corpo} />}
        {aviso.importante && <div className="as-note strong dv-imp"><b>Importante:</b> {aviso.importante}</div>}
        {aviso.atualizacoes && aviso.atualizacoes.length > 0 && (
          <section className="dv-upds" aria-label="Atualizações">
            <div className="as-k">Atualizações</div>
            {aviso.atualizacoes.map((u, i) => (
              <div key={i} className="dv-upd"><span>{dataCurta(u.em)}, {new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(u.em))}</span><TextoAviso texto={u.texto} /></div>
            ))}
          </section>
        )}
      </article>
      <div className="dv-lado">{lado}</div>
    </div>
    {cheia !== null && <TelaCheia imagens={aviso.imagens} inicio={cheia} onFechar={fecharCheia} />}
  </>)
}

const DET_CSS = `
.dv-grade{display:flex;flex-direction:column;gap:16px;min-width:0}
.dv-info{display:flex;flex-direction:column;gap:12px;min-width:0}
.dv-imgs{display:grid;gap:8px;grid-template-columns:1fr}
.dv-imgs.n2,.dv-imgs.n3{grid-template-columns:1fr 1fr}
.dv-imgs.n3 .dv-img:first-child{grid-column:1/-1}
.dv-img{position:relative;width:100%;aspect-ratio:4/3;border-radius:14px;overflow:hidden;border:1px solid var(--bx-border);background:var(--bx-surface-2);padding:0;cursor:zoom-in}
.dv-imgs.n1 .dv-img{aspect-ratio:16/10}
.dv-img img{object-fit:cover}
.dv-tit{word-break:break-word}
.dv-meta{margin:-4px 0 0}
.dv-imp b{color:var(--bx-text)}
.dv-upds{display:flex;flex-direction:column;gap:10px;margin-top:4px}
.dv-upd{border-left:3px solid var(--ac-1);padding:2px 0 2px 12px;display:flex;flex-direction:column;gap:2px}
.dv-upd>span{font-size:12px;color:var(--bx-text-3)}
.dv-upd .av-texto{font-size:14px}
.dv-acoes{display:flex;flex-direction:column;gap:10px}
.dv-acoes .as-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-align:center}
.dv-prazo{display:flex;flex-direction:column;gap:2px;padding:10px 0;border-bottom:1px solid var(--bx-border)}
.dv-prazo small{color:var(--bx-text-3);font-size:12px}
.dv-link{display:flex;flex-direction:column;gap:4px}
.dv-dom{text-align:center;font-size:12px}
@media (min-width:1024px){
  .dv-grade{display:grid;grid-template-columns:minmax(0,640px) minmax(0,1fr);gap:40px;align-items:start}
  .dv-lado{position:sticky;top:88px}
}
`
