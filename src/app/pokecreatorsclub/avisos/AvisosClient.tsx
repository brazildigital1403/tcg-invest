'use client'

// Avisos do Club na "Revista do Club + Vem ai" (mockup op6 aprovado em
// 09/11/2026). Stories no topo (o que pede resposta, fixados e novidades),
// materia de capa com o aviso mais urgente, fixado compacto, a fileira Vem ai
// com a Agenda, cartoes 16:9 e "Edicoes anteriores" para o que ja encerrou.
// So quem esta logado ve. "Novo" e guardado no navegador.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import {
  categoriaDe, chipPrazo, dataCurta, ehNovo, marcarVisita, palavraCapa, pedeAcao, pedeResposta, prazoPassou, ultimaVisita,
  type Aviso, type ListaAvisos,
} from '@/lib/pcc/avisos'
import { AVISOS, AVISOS_ORGANIZAR, CLUB, avisoUrl } from '@/lib/pcc/rotas'
import { Ico, SeloFrente } from '../amigo-secreto/estilo'
import { Casca } from '../agenda/comum'
import { AV_CSS } from './comum'
import { CapaAviso, VemAi, useVemAi } from './capa'

const ROTA = AVISOS
const DIA_EXTENSO = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' })

/** Aviso da materia de capa: o que pede acao com o prazo mais curto; senao o mais novo nao fixado. */
function escolherCapa(abertos: Aviso[]): Aviso | null {
  const acao = abertos.filter(pedeAcao).sort((a, b) => (a.prazo_em || '9').localeCompare(b.prazo_em || '9'))
  if (acao[0]) return acao[0]
  return abertos.find(a => !a.fixado && a.imagens.length > 0) || abertos.find(a => !a.fixado) || null
}

export default function AvisosClient() {
  const { openLogin } = useAuthModal()
  const [uid, setUid] = useState<string | null | undefined>(undefined)
  const [dados, setDados] = useState<ListaAvisos | null>(null)
  const [falhou, setFalhou] = useState(false)
  // Marca da visita anterior: o que veio depois dela e "Novo" nesta visita.
  const [visto, setVisto] = useState<number | null>(null)
  const eventos = useVemAi(!!uid)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const carregar = useCallback(async () => {
    setFalhou(false)
    const { data, error } = await supabase.rpc('club_avisos_lista')
    if (error) { setFalhou(true); return }
    const anterior = ultimaVisita()
    setVisto(anterior ?? Date.now())
    marcarVisita()
    setDados(data as ListaAvisos)
  }, [])

  // Busca quando a sessao aparece; o setFalhou(false) do inicio e o reset da tentativa.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (uid) carregar() }, [uid, carregar])

  const casca = (filhos: React.ReactNode, logado = true) => (
    <Casca logado={logado} onEntrar={() => openLogin({ next: ROTA, cta: 'Entrar no Club' })} voltar={CLUB} titulo="Avisos">
      {filhos}
      <style>{AV_CSS + REVISTA_CSS}</style>
    </Casca>
  )

  if (uid === undefined) return casca(<div className="as-center"><span className="as-meta">Abrindo...</span></div>, false)
  if (uid === null) {
    const entrar = () => openLogin({ next: ROTA, cta: 'Entrar no Club' })
    return casca(
      <div className="as-center">
        <SeloFrente frente="avisos" />
        <h1 className="as-h2">Avisos do Club</h1>
        <p className="as-p">Entre para ver os avisos.</p>
        <button type="button" className="as-btn pri cta" style={{ maxWidth: 320, width: '100%' }} onClick={entrar}>Entrar</button>
        <Link href={`/cadastro?next=${encodeURIComponent(ROTA)}`} className="as-btn" style={{ maxWidth: 320, width: '100%' }}>Criar conta</Link>
      </div>, false)
  }
  if (falhou && !dados) {
    return casca(<>
      <h1 className="as-h2">Avisos do Club</h1>
      <div className="as-erro" role="alert">Não conseguimos carregar os avisos.</div>
      <button type="button" className="as-btn" onClick={carregar}>Tentar de novo</button>
    </>)
  }
  if (!dados) return casca(<div className="as-center"><span className="as-meta">Abrindo os avisos...</span></div>)

  const organiza = dados.papeis.includes('avisos')
  const abertos = dados.avisos.filter(a => !prazoPassou(a))
  const encerrados = dados.avisos.filter(a => prazoPassou(a))
  const capa = escolherCapa(abertos)
  const fixados = abertos.filter(a => a.fixado && a.id !== capa?.id)
  const resto = abertos.filter(a => a.id !== capa?.id && !a.fixado)
  const novos = dados.avisos.filter(a => ehNovo(a, visto)).length
  // Stories: o que pede resposta, depois fixados, depois novidades e o resto.
  const stories = [...abertos].sort((a, b) => peso(b, visto) - peso(a, visto)).slice(0, 8)
  const hojeTxt = DIA_EXTENSO.format(new Date())

  return casca(<div className="rv">
    <div className="rv-mast">
      <div>
        <span className="rv-kicker">Revista do Club</span>
        <h1>Avisos</h1>
        <p className="rv-edicao">{hojeTxt.charAt(0).toUpperCase() + hojeTxt.slice(1)}{novos > 0 ? ` · ${novos} ${novos === 1 ? 'novidade' : 'novidades'}` : ''}</p>
      </div>
      {organiza && <Link href={AVISOS_ORGANIZAR} className="rv-org"><Ico n="menu" s={18} />Organizar</Link>}
    </div>

    {dados.avisos.length === 0 ? (
      <div className="ag-vazio"><span className="as-meta">Nenhum aviso por enquanto.</span><span className="as-meta">Quando a organização publicar, aparece aqui.</span></div>
    ) : (<>
      {stories.length > 1 && (
        <nav className="rv-stories" aria-label="Destaques">
          {stories.map(a => {
            const vota = pedeResposta(a)
            const novo = vota || ehNovo(a, visto)
            return (
              <Link key={a.id} href={avisoUrl(a.slug)} className={`rv-story${novo ? ' novo' : ''}`}>
                <span className={`ring${novo ? ' new' : ''}`}>
                  <span className="ring-in"><span className="ring-img"><CapaAviso a={a} sizes="80px" /></span></span>
                  {vota ? <span className="badge act">Votar</span> : a.fixado ? <span className="badge pin"><Ico n="tachinha" s={12} />Fixo</span> : null}
                </span>
                <span className="lb">{palavraCapa(a)}</span>
              </Link>
            )
          })}
        </nav>
      )}

      <div className="rv-lead">
        {capa && <MateriaCapa a={capa} visto={visto} />}
        {fixados.length > 0 && (
          <div className="rv-lado">
            {fixados.map(a => <Fixado key={a.id} a={a} />)}
          </div>
        )}
      </div>

      <VemAi eventos={eventos} />

      {resto.length > 0 && (
        <section aria-label="Recentes">
          <div className="av-sec"><h2>Recentes</h2></div>
          <div className="rv-grade">{resto.map(a => <CartaoEd key={a.id} a={a} visto={visto} />)}</div>
        </section>
      )}

      {encerrados.length > 0 && (
        <section className="rv-past" aria-label="Edições anteriores">
          <div className="av-sec"><h2>Edições anteriores</h2></div>
          {encerrados.map(a => (
            <Link key={a.id} href={avisoUrl(a.slug)} className="rv-past-l">
              <span className="th"><CapaAviso a={a} sizes="64px" /></span>
              <span className="tx">
                <span className="t">{a.titulo}</span>
                <span className="s"><span className="ended"><Ico n="check" s={13} />Encerrado</span>{a.publicado_em ? ` · ${dataCurta(a.publicado_em)}` : ''}</span>
              </span>
              <Ico n="chev" className="arr" />
            </Link>
          ))}
        </section>
      )}
    </>)}
  </div>)
}

function peso(a: Aviso, visto: number | null): number {
  return (pedeResposta(a) ? 8 : 0) + (a.fixado ? 4 : 0) + (ehNovo(a, visto) ? 2 : 0) + (a.prazo_em ? 1 : 0)
}

function Chips({ a, visto }: { a: Aviso; visto: number | null }) {
  const prazo = chipPrazo(a)
  return (
    <span className="rv-chips">
      {ehNovo(a, visto) && <span className="av-chip new">Novo</span>}
      {a.enquete ? <span className="av-chip glass"><Ico n="enquete" s={14} />Enquete</span> : <span className="av-chip glass"><Ico n={categoriaDe(a).ico} s={14} />{categoriaDe(a).rotulo}</span>}
      {prazo && <span className="av-chip deadline"><Ico n="clock" s={14} />{prazo.texto}</span>}
    </span>
  )
}

function Autor({ a }: { a: Aviso }) {
  const nome = a.autor ? `@${a.autor}` : 'Organização do Club'
  return (
    <span className="rv-byline">
      <span className="av" aria-hidden="true">{(a.autor || 'C').charAt(0).toUpperCase()}</span>
      {nome}{a.publicado_em ? ` · ${dataCurta(a.publicado_em)}` : ''}
    </span>
  )
}

function MateriaCapa({ a, visto }: { a: Aviso; visto: number | null }) {
  const vota = pedeResposta(a)
  return (
    <Link href={avisoUrl(a.slug)} className="rv-capa">
      <span className="media"><CapaAviso a={a} sizes="(min-width: 1024px) 720px, 100vw" prioridade /></span>
      <span className="top"><Chips a={a} visto={visto} /></span>
      <span className="body">
        <span className="rv-cat">{categoriaDe(a).rotulo}</span>
        <span className="h2">{a.titulo}</span>
        <span className="dek">{a.resumo}</span>
        <Autor a={a} />
        {vota && (
          <span className="cta">
            <span className="btn"><Ico n="enquete" s={18} />Responder enquete</span>
            {a.enquete && a.enquete.total > 0 && <span className="votos"><b>{a.enquete.total}</b>{a.enquete.total === 1 ? 'voto' : 'votos'}</span>}
          </span>
        )}
      </span>
    </Link>
  )
}

function Fixado({ a }: { a: Aviso }) {
  return (
    <Link href={avisoUrl(a.slug)} className="rv-fixado">
      <span className="th"><CapaAviso a={a} sizes="(min-width: 1024px) 360px, 80px" /></span>
      <span className="tx">
        <span className="pin"><Ico n="tachinha" s={13} />Fixado</span>
        <span className="t">{a.titulo}</span>
        <span className="s">{a.resumo}</span>
      </span>
    </Link>
  )
}

function CartaoEd({ a, visto }: { a: Aviso; visto: number | null }) {
  return (
    <Link href={avisoUrl(a.slug)} className="rv-ed">
      <span className="media"><CapaAviso a={a} sizes="(min-width: 1024px) 360px, 100vw" /><span className="ch"><Chips a={a} visto={visto} /></span></span>
      <span className="body">
        <span className="rv-cat">{categoriaDe(a).rotulo}{a.publicado_em && <><i className="dot" /><span className="m">{dataCurta(a.publicado_em)}</span></>}</span>
        <span className="h4">{a.titulo}</span>
        <span className="p">{a.resumo}</span>
        {(a.tem_atualizacoes || a.enquete) && (
          <span className="foot">
            {a.tem_atualizacoes && <span><Ico n="spark" s={14} />Atualizado</span>}
            {a.enquete && <span><Ico n="enquete" s={14} />{a.enquete.aberta ? 'Enquete aberta' : 'Enquete encerrada'} · {a.enquete.total} {a.enquete.total === 1 ? 'voto' : 'votos'}</span>}
          </span>
        )}
      </span>
    </Link>
  )
}

const REVISTA_CSS = `
.rv{display:flex;flex-direction:column;min-width:0}
.rv-mast{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding-top:4px}
.rv-kicker,.rv-cat{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ac-1)}
.rv-mast h1{margin:6px 0 0;font-size:30px;line-height:1.05;font-weight:800;letter-spacing:-.025em}
.rv-edicao{margin:6px 0 0;font-size:13px;color:var(--bx-text-2)}
.rv-org{flex:none;min-height:44px;display:inline-flex;align-items:center;gap:8px;padding:0 14px;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-surface);font-size:14px;font-weight:600;color:var(--bx-text);text-decoration:none;transition:background .15s ease,transform .15s ease}
.rv-org:hover{background:var(--bx-surface-2);transform:translateY(-2px)}

.rv-stories{display:flex;gap:14px;overflow-x:auto;margin:0 -16px;padding:16px 16px 6px;scrollbar-width:none}
.rv-stories::-webkit-scrollbar{display:none}
.rv-story{width:72px;flex:none;display:flex;flex-direction:column;align-items:center;gap:6px;text-decoration:none;color:var(--bx-text);transition:transform .15s ease}
.rv-story:hover{transform:translateY(-2px)}
.rv-story .ring{width:72px;height:72px;border-radius:50%;padding:3px;background:var(--bx-border-2);position:relative;display:block}
.rv-story .ring.new{background:var(--ac-grad)}
.rv-story .ring-in{display:block;width:100%;height:100%;border-radius:50%;padding:3px;background:var(--bx-bg)}
.rv-story .ring-img{display:block;width:100%;height:100%;border-radius:50%;overflow:hidden;position:relative;background:var(--bx-bg-elev)}
.rv-story .badge{position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);height:20px;padding:0 8px;border-radius:999px;font-size:12px;font-weight:800;line-height:20px;white-space:nowrap;border:2px solid var(--bx-bg);display:inline-flex;align-items:center;gap:2px}
.rv-story .badge.act{background:var(--ac-grad);color:var(--bx-bg)}
.rv-story .badge.pin{background:var(--bx-bg-elev);color:var(--bx-text-2);border-color:var(--bx-border-2);padding:0 6px}
.rv-story .lb{font-size:12px;font-weight:600;color:var(--bx-text-2);max-width:76px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:4px}
.rv-story.novo .lb{color:var(--bx-text)}
/* Na bolinha a capa automatica vira so o logo/selo. */
.rv-story .av-auto .word,.rv-story .av-auto .pcc,.rv-story .av-auto .sl{display:none}
.rv-story .av-auto .big{right:50%;top:50%;transform:translate(50%,-50%);width:auto;height:auto}
.rv-story .av-auto .big .as-ico{width:30px;height:30px}
.rv-story .av-auto .selo{width:70%;right:15%;top:15%}
.rv-story .av-auto-com .logo{width:86%}

.rv-chips{display:flex;gap:6px;flex-wrap:wrap}
.av-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
.av-chip.new{background:var(--ac-grad);color:var(--bx-bg)}
.av-chip.glass{background:var(--bx-scrim);color:var(--bx-text);border:1px solid var(--bx-border-2);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.av-chip.deadline{background:var(--bx-scrim);color:var(--ac-1);border:1px solid rgba(var(--ac-1-rgb),.45);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.av-chip.amber{background:rgba(var(--ac-1-rgb),.12);color:var(--ac-1);border:1px solid rgba(var(--ac-1-rgb),.3)}
.rv-byline{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--bx-text-3);margin-top:10px}
.rv-byline .av{width:24px;height:24px;border-radius:50%;background:var(--bx-surface-3);border:1px solid var(--bx-border-2);display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:var(--bx-text-2);flex:none}

.rv-lead{display:flex;flex-direction:column;gap:12px;margin-top:16px}
.rv-capa{position:relative;display:block;border-radius:20px;overflow:hidden;background:var(--bx-bg-elev);border:1px solid var(--bx-border);box-shadow:var(--bx-shadow);text-decoration:none;color:var(--bx-text);transition:transform .2s ease}
.rv-capa:hover{transform:translateY(-2px)}
.rv-capa .media{position:relative;display:block;height:440px}
.rv-capa .media::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,var(--bx-bg) 6%,var(--bx-scrim) 48%,transparent 78%)}
.rv-capa .top{position:absolute;top:12px;left:12px;right:12px;z-index:2}
.rv-capa .body{position:absolute;left:0;right:0;bottom:0;padding:16px;z-index:2;display:flex;flex-direction:column}
.rv-capa .h2{font-size:26px;line-height:1.1;font-weight:800;letter-spacing:-.02em;margin:8px 0;text-wrap:balance}
.rv-capa .dek{font-size:14px;line-height:1.45;color:var(--bx-text-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rv-capa .cta{display:flex;align-items:center;gap:12px;margin-top:14px}
.rv-capa .btn{height:48px;flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:14px;background:var(--ac-grad);color:var(--bx-bg);font-size:15px;font-weight:800}
.rv-capa .votos{display:flex;flex-direction:column;align-items:flex-end;font-size:12px;color:var(--bx-text-3);line-height:1.3;flex:none}
.rv-capa .votos b{font-size:18px;color:var(--bx-text);font-weight:800}

.rv-lado{display:flex;flex-direction:column;gap:12px}
.rv-fixado{display:flex;gap:12px;align-items:center;padding:12px;border-radius:16px;background:var(--bx-surface);border:1px solid var(--bx-border);text-decoration:none;color:var(--bx-text);transition:background .15s ease,transform .15s ease}
.rv-fixado:hover{background:var(--bx-surface-2);transform:translateY(-2px)}
.rv-fixado .th{position:relative;width:76px;height:76px;border-radius:12px;flex:none;overflow:hidden}
.rv-fixado .tx{display:flex;flex-direction:column;min-width:0}
.rv-fixado .pin{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:var(--bx-text-2)}
.rv-fixado .t{font-size:15px;font-weight:700;line-height:1.25;margin-top:4px}
.rv-fixado .s{font-size:12px;color:var(--bx-text-3);margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rv-fixado .av-auto .word,.rv-fixado .av-auto .pcc{display:none}

.rv-grade{display:flex;flex-direction:column;gap:16px}
.rv-ed{display:block;border-radius:18px;overflow:hidden;background:var(--bx-surface);border:1px solid var(--bx-border);text-decoration:none;color:var(--bx-text);transition:transform .2s ease,border-color .2s ease}
.rv-ed:hover{transform:translateY(-2px);border-color:var(--bx-border-2)}
.rv-ed .media{position:relative;display:block;aspect-ratio:16/9;overflow:hidden;background:var(--bx-bg-elev)}
.rv-ed .media .ch{position:absolute;top:10px;left:10px;right:10px;z-index:2}
.rv-ed .body{display:flex;flex-direction:column;padding:14px 14px 16px}
.rv-ed .h4{font-size:19px;line-height:1.2;font-weight:800;letter-spacing:-.015em;margin:6px 0}
.rv-ed .p{font-size:14px;line-height:1.45;color:var(--bx-text-2);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.rv-ed .foot{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:12px;color:var(--bx-text-3)}
.rv-ed .foot span{display:inline-flex;align-items:center;gap:6px}
.rv-cat{display:flex;align-items:center;gap:6px}
.rv-cat .dot{width:4px;height:4px;border-radius:50%;background:var(--bx-text-3)}
.rv-cat .m{color:var(--bx-text-3);letter-spacing:.04em;text-transform:none;font-weight:600}

.rv-past{display:flex;flex-direction:column}
.rv-past-l{display:flex;gap:12px;align-items:center;padding:10px;margin:0 -10px;border-radius:14px;text-decoration:none;color:var(--bx-text);transition:background .15s ease;min-height:44px}
.rv-past-l:hover{background:var(--bx-surface-2)}
.rv-past-l .th{position:relative;width:64px;height:64px;border-radius:10px;overflow:hidden;flex:none;filter:saturate(.55) brightness(.8)}
.rv-past-l .tx{display:flex;flex-direction:column;min-width:0}
.rv-past-l .t{font-size:14px;font-weight:700;line-height:1.3}
.rv-past-l .s{font-size:12px;color:var(--bx-text-3);margin-top:4px}
.rv-past-l .arr{margin-left:auto;color:var(--bx-text-3);flex:none}
.rv-past-l .av-auto .word,.rv-past-l .av-auto .pcc{display:none}
.ended{display:inline-flex;align-items:center;gap:4px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}

@media (min-width:1024px){
  .rv-mast h1{font-size:44px}
  .rv-edicao{font-size:15px}
  .rv-stories{margin:0;padding:20px 0 8px;gap:20px}
  .rv-story{width:84px}
  .rv-story .ring{width:84px;height:84px}
  .rv-lead{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:24px;margin-top:20px}
  .rv-lead>.rv-capa:only-child{grid-column:1/-1}
  .rv-capa .media{height:500px}
  .rv-capa .body{padding:28px;max-width:680px}
  .rv-capa .h2{font-size:42px}
  .rv-capa .dek{font-size:16px}
  .rv-capa .top{top:18px;left:18px;right:18px}
  .rv-capa .cta{max-width:460px}
  .rv-lado .rv-fixado{flex:1;flex-direction:column;align-items:stretch;padding:0;overflow:hidden;border-radius:18px}
  .rv-lado .rv-fixado .th{width:auto;height:auto;flex:1;min-height:200px;border-radius:0}
  .rv-lado .rv-fixado .tx{padding:14px 16px 16px}
  .rv-lado .rv-fixado .t{font-size:18px;font-weight:800}
  .rv-lado .rv-fixado .s{font-size:14px;color:var(--bx-text-2);-webkit-line-clamp:3}
  .rv-lado .rv-fixado .av-auto .word,.rv-lado .rv-fixado .av-auto .pcc{display:block}
  .rv-grade{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;align-items:start}
  .rv-ed .h4{font-size:21px}
  .rv-past{border-radius:18px;background:var(--bx-surface);border:1px solid var(--bx-border);padding:0 18px 8px;margin-top:40px}
  .rv-past-l{margin:0 -8px}
}
@media (prefers-reduced-motion:reduce){.rv-story,.rv-capa,.rv-fixado,.rv-ed,.rv-org{transition:none}}
`
