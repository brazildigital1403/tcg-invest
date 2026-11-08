'use client'

// Casa do Club (wireframe aprovado em 05/11/2026, quadros C01 a C10 e D1/D2).
// Uma tarefa por vez no topo e as frentes logo abaixo. A casa nunca mostra o par
// do sorteio, porque criador grava a tela: o @ so existe dentro da sala.
//
// Nova frente entra como mais um cartao, sem "em breve".

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import {
  AMIGO_SECRETO_SLUG, dataCurta, dataHora, type EdicaoPublica, type MinhaSala,
} from '@/lib/amigoSecreto'
import { instagramUrl, ordenarProximos, quandoTexto, type ListaAniversarios } from '@/lib/pcc/aniversarios'
import { AGENDA, AMIGO_SECRETO, AMIGO_SECRETO_SALA, ANIVERSARIANTES, CLUB, agendaEvento } from '@/lib/pcc/rotas'
import { TIPOS, horaCurta, momento, type Evento, type ListaAgenda } from '@/lib/pcc/agenda'
import { hojeBrasilia } from '@/lib/pcc/datas'
import { proximos as proximosEventos } from './agenda/comum'
import { AS_CSS, Ico, LOGO_PCC } from './amigo-secreto/estilo'
import { Rosto } from './aniversariantes/AniversariantesClient'

type Tarefa = { titulo: string; texto: string; botao: string; href: string }

/** Tarefas da pessoa no Amigo Secreto, da mais urgente para a menos urgente. */
function tarefasDe(sala: MinhaSala | null): Tarefa[] {
  if (!sala || !sala.inscrito) return []
  const { eu, tirou, recebo, estado } = sala
  if (estado === 'inscricoes') {
    if (eu.perfil_completo) return []
    const temEndereco = !!(eu.cep && eu.numero)
    const temDica = eu.me_surpreenda || !!(eu.desejo && eu.desejo.trim())
    const faltam = [temEndereco, temDica].filter(ok => !ok).length
    return [{ titulo: 'Falta completar seu perfil', texto: `Amigo Secreto: ${faltam === 1 ? 'falta 1' : `faltam ${faltam}`} de 3 itens.`, botao: 'Completar', href: AMIGO_SECRETO_SALA }]
  }
  if (estado === 'encerrado') return []
  const lista: Tarefa[] = []
  if (tirou && !eu.postado_em) lista.push({ titulo: 'Você tem um presente para enviar', texto: `Entrega até ${dataCurta(sala.postar_ate)}.`, botao: 'Ver', href: AMIGO_SECRETO_SALA })
  if (recebo?.postado_em && !eu.recebido_em) lista.push({ titulo: 'Seu presente chegou?', texto: 'Confirme só com o presente na mão.', botao: 'Confirmar', href: AMIGO_SECRETO_SALA })
  return lista
}

export default function CasaClub() {
  const { openLogin } = useAuthModal()
  const [logado, setLogado] = useState<boolean | undefined>(undefined)
  const [edicao, setEdicao] = useState<EdicaoPublica | null | undefined>(undefined)
  const [sala, setSala] = useState<MinhaSala | null>(null)
  const [aniv, setAniv] = useState<ListaAniversarios | null>(null)
  const [agenda, setAgenda] = useState<ListaAgenda | null>(null)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLogado(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setLogado(!!s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const carregar = useCallback(async () => {
    if (logado === undefined) return
    setFalhou(false)
    // Agenda: de hoje ate 400 dias (o teto do banco). Se falhar, o cartao fica
    // sem a linha "Proximo" e a casa nao acusa falha: nao e tarefa da pessoa.
    const hoje = hojeBrasilia()
    const ate = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + 398)).toISOString().slice(0, 10)
    const [e, m, a, g] = await Promise.all([
      supabase.rpc('amigo_secreto_edicao_publica', { p_slug: AMIGO_SECRETO_SLUG }),
      logado ? supabase.rpc('amigo_secreto_meu', { p_slug: AMIGO_SECRETO_SLUG }) : Promise.resolve({ data: null, error: null }),
      logado ? supabase.rpc('club_aniversarios_lista') : Promise.resolve({ data: null, error: null }),
      // Comeca ontem: a live que vira o dia ainda esta "agora" depois da meia-noite.
      logado ? supabase.rpc('club_agenda_lista', { p_de: new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia - 1)).toISOString().slice(0, 10), p_ate: ate }) : Promise.resolve({ data: null, error: null }),
    ])
    setAgenda(g.error ? null : (g.data as ListaAgenda | null) ?? null)
    if (e.error) { setFalhou(true); setEdicao(null) } else setEdicao((e.data as EdicaoPublica | null) ?? null)
    if (m.error) { setFalhou(true); setSala(null) } else setSala((m.data as MinhaSala | null) ?? null)
    if (a.error) { setFalhou(true); setAniv(null) } else setAniv((a.data as ListaAniversarios | null) ?? null)
  }, [logado])

  useEffect(() => { carregar() }, [carregar])

  const inscrito = !!sala?.inscrito
  const proximos = ordenarProximos(aniv?.lista || [])
  const naLista = !!aniv?.lista.some(p => p.eu)
  const tarefas = tarefasDe(sala)
  if (aniv && !naLista) tarefas.push({ titulo: 'Coloque sua data', texto: 'Aniversariantes: só dia e mês.', botao: 'Entrar na lista', href: ANIVERSARIANTES })
  const tarefa = tarefas[0]
  const aniversarioHoje = proximos.filter(p => p.emDias === 0 && !p.eu)
  const proximoAniv = proximos.find(p => p.emDias > 0 && !p.eu)
  const encerrada = edicao?.estado === 'encerrado'
  const aberta = !!edicao && edicao.estado === 'inscricoes' && Date.parse(edicao.inscricoes_ate) > Date.now()
  const destino = inscrito ? AMIGO_SECRETO_SALA : AMIGO_SECRETO
  const membro = inscrito || naLista
  const hojeBr = hojeBrasilia()
  const eventos = proximosEventos(agenda?.eventos || [], hojeBr).filter(e => e.status === 'publicado')
  // Cartas "Hoje": evento antes do aniversario, no maximo duas no total (wireframe C12).
  const eventosHoje = eventos.filter(e => ['hoje', 'agora'].includes(momento(e, hojeBr))).slice(0, 2)
  const anivHojeVisiveis = aniversarioHoje.slice(0, Math.max(0, 2 - eventosHoje.length))
  const proximoEvento = eventos.find(e => !eventosHoje.includes(e)) || null

  return (
    <div className="as cl">
      <header className="as-top bx-gutter">
        <div className="as-wrap">
          <Link href={CLUB} className="as-logo-a" aria-label="Poké Creators Club"><Image src={LOGO_PCC} alt="" width={438} height={218} className="as-logo cl-logo" priority /></Link>
          {logado
            ? <Link href="/minha-conta" className="as-ib" aria-label="Minha conta"><Ico n="user" s={22} /></Link>
            : <button type="button" className="as-btn lnk sm cl-entrar" disabled={logado === undefined} onClick={() => openLogin({ next: CLUB, cta: 'Entrar no Club' })}>Entrar</button>}
        </div>
      </header>

      <main className="bx-gutter as-main-hero">
        <div className="as-wrap as-bd">
          {falhou && (
            <div className="as-note strong cl-falha" role="alert">
              <span>Não conseguimos carregar suas tarefas.</span>
              <button type="button" className="as-btn lnk sm" onClick={carregar}>Tentar de novo</button>
            </div>
          )}

          {tarefa && (
            <section className="as-mis" aria-label="Sua missão agora">
              <div className="as-eye"><Ico n="star" s={14} />Sua missão agora</div>
              <h2 className="as-h3">{tarefa.titulo}</h2>
              <p className="as-meta">{tarefa.texto}</p>
              <Link href={tarefa.href} className="as-btn pri">{tarefa.botao}</Link>
              {tarefas.length > 1 && <Link href={tarefas[1].href} className="as-btn lnk">{tarefas.length === 2 ? 'Ver mais 1 tarefa' : `Ver mais ${tarefas.length - 1} tarefas`}</Link>}
            </section>
          )}

          {eventosHoje.map(e => (
            <section key={e.id} className="as-frente cl-hoje">
              <span className="as-chip fill">{momento(e, hojeBr) === 'agora' ? 'Acontecendo agora' : 'Hoje'}</span>
              <div className="as-meta">{TIPOS[e.tipo].rotulo}{e.hora_inicio ? ` · ${horaCurta(e.hora_inicio)}` : ''}{e.formato === 'online' ? ' · Online' : e.cidade ? ` · ${e.cidade}` : ''}</div>
              <div className="at cl-hoje-ev">{e.titulo}</div>
              <Link href={agendaEvento(e.slug)} className="as-btn pri">Ver evento</Link>
            </section>
          ))}

          {anivHojeVisiveis.map(p => (
            <section key={p.instagram} className="as-frente cl-hoje">
              <Rosto p={p} tam={64} />
              <div className="as-meta">Hoje é dia de</div>
              <div className="at">@{p.instagram}</div>
              <a className="as-btn pri" href={instagramUrl(p.instagram)} target="_blank" rel="noopener noreferrer">Dar parabéns</a>
              <div className="as-meta">Abre o Instagram</div>
            </section>
          ))}

          {/* Hero para todo mundo, membro tambem (pedido do Du, 05/11). */}
          <section className="cl-hero">
            <div className="cl-hero-tx">
              <Image src={LOGO_PCC} alt="Poké Creators Club" width={438} height={218} className="cl-marca" priority />
              <h1 className="as-h1">A casa do <em>Club</em></h1>
              <p className="as-p">O que o grupo faz junto, em um lugar só.</p>
            </div>
            <div className="cl-leque" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CARTA_AMIGO_SECRETO} alt="" width={400} height={600} className="cl-carta" />
              <div className="as-verso"><Image src={LOGO_PCC} alt="" width={438} height={218} className="cl-verso-logo" /></div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CARTA_ANIVERSARIANTES} alt="" width={400} height={600} className="cl-carta" />
            </div>
          </section>

          {edicao === undefined && <div className="as-card" aria-busy="true"><div className="as-k">Carregando o Club...</div></div>}

          {/* Frentes: uma embaixo da outra no celular, 3 colunas no computador largo. */}
          {edicao !== undefined && !encerrada && (
            <div className="cl-frentes tres">
              <CartaoAmigoSecreto edicao={edicao} inscrito={inscrito} aberta={aberta} destaque={!tarefa} destino={destino} sala={sala} logado={!!logado} />
              <CartaoAniversariantes logado={!!logado} proximo={proximoAniv ? `Próximo: @${proximoAniv.instagram}, ${quandoTexto(proximoAniv.emDias)}.` : null} />
              <CartaoAgenda logado={!!logado} carregou={!!agenda} hoje={eventosHoje[0] || null} proximo={proximoEvento} />
            </div>
          )}

          {encerrada && edicao && (
            <>
              <div className="cl-frentes">
                <CartaoAniversariantes logado={!!logado} proximo={proximoAniv ? `Próximo: @${proximoAniv.instagram}, ${quandoTexto(proximoAniv.emDias)}.` : null} />
                <CartaoAgenda logado={!!logado} carregou={!!agenda} hoje={eventosHoje[0] || null} proximo={proximoEvento} />
              </div>
              <div className="as-k">Edições passadas</div>
              <div className="as-card cl-passadas">
                <Link href={destino} className="as-row">
                  <span className="l"><span className="as-verso cl-verso-mini" aria-hidden="true" /><span>Amigo Secreto<small>Edição encerrada · {dataCurta(edicao.revelacao_em)}</small></span></span>
                  <Ico n="chev" className="arr" />
                </Link>
              </div>
            </>
          )}

          {!membro && logado !== undefined && <div className="as-note">O Club vive no grupo de WhatsApp. Para entrar, fale com quem administra.</div>}

          <footer className="as-foot">
            <span>Poké Creators Club</span>
            <span><Link href="/termos">Termos</Link>·<Link href="/privacidade">Privacidade</Link></span>
          </footer>
        </div>
      </main>
      <style>{AS_CSS + CL_CSS}</style>
    </div>
  )
}

// Selos ilustrados das frentes (06/11, pedido do Du: "cara de Pokemon").
// Decorativos: o titulo do cartao ja diz o que e, por isso alt vazio.
const SELO_AMIGO_SECRETO = '/pokecreatorsclub/selo-amigo-secreto.webp'
const SELO_ANIVERSARIANTES = '/pokecreatorsclub/selo-aniversariantes.webp'
const SELO_AGENDA = '/pokecreatorsclub/selo-agenda.webp'
// Cartas ilustradas do leque do hero (06/11), proporcao 2:3.
const CARTA_AMIGO_SECRETO = '/pokecreatorsclub/carta-amigo-secreto.webp'
const CARTA_ANIVERSARIANTES = '/pokecreatorsclub/carta-aniversariantes.webp'

function Selo({ src, grande = false }: { src: string; grande?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={256} height={256} className={`cl-selo${grande ? ' g' : ''}`} />
}

// Agenda do Club (08/11/2026, wireframe C11 a C13). Selos das tres frentes
// trocados pelo Du em 08/11 (so os de baixo; as cartas do topo ficaram).
function CartaoAgenda({ logado, carregou, hoje, proximo }: { logado: boolean; carregou: boolean; hoje: Evento | null; proximo: Evento | null }) {
  const quando = (e: Evento) => {
    const [, mm, dd] = e.inicio_data.split('-')
    const fim = e.fim_data !== e.inicio_data ? ` a ${e.fim_data.slice(8, 10)}/${e.fim_data.slice(5, 7)}` : ''
    return `${dd}/${mm}${fim}${e.hora_inicio ? `, às ${horaCurta(e.hora_inicio)}` : ''}`
  }
  const linha = !logado || !carregou
    ? 'Lives, collabs, feiras e as datas do grupo.'
    : hoje ? `Hoje: ${hoje.titulo}${hoje.hora_inicio ? `, às ${horaCurta(hoje.hora_inicio)}` : ''}.`
    : proximo ? `Próximo: ${proximo.titulo}, ${quando(proximo)}.`
    : 'Nenhum evento marcado.'
  return (
    <section className="as-card cl-frente">
      <div className="cl-frente-g">
        <Selo src={SELO_AGENDA} />
        <div className="cl-frente-tx">
          <h2 className="as-h3">Agenda</h2>
          <p className="as-meta">{linha}</p>
        </div>
      </div>
      <Link href={AGENDA} className="as-btn">Ver agenda</Link>
    </section>
  )
}

function CartaoAniversariantes({ logado, proximo }: { logado: boolean; proximo: string | null }) {
  return (
    <section className="as-card cl-frente">
      <div className="cl-frente-g">
        <Selo src={SELO_ANIVERSARIANTES} />
        <div className="cl-frente-tx">
          <h2 className="as-h3">Aniversariantes</h2>
          <p className="as-meta">{logado && proximo ? proximo : 'Quem faz aniversário no Club.'}</p>
        </div>
      </div>
      <Link href={ANIVERSARIANTES} className="as-btn">Ver calendário</Link>
    </section>
  )
}

function CartaoAmigoSecreto({ edicao, inscrito, aberta, destaque, destino, sala, logado }: {
  edicao: EdicaoPublica | null; inscrito: boolean; aberta: boolean; destaque: boolean; destino: string; sala: MinhaSala | null; logado: boolean
}) {
  // Sem edicao (falha ao ler o banco): o cartao continua, so sem o estado.
  if (!edicao) {
    return (
      <section className="as-card cl-frente">
        <div className="cl-frente-g">
          <Selo src={SELO_AMIGO_SECRETO} />
          <div className="cl-frente-tx"><h2 className="as-h3">Amigo Secreto</h2><p className="as-meta">Troca de presentes em segredo.</p></div>
        </div>
        <Link href={destino} className="as-btn">Abrir</Link>
      </section>
    )
  }
  const completo = sala?.inscrito ? sala.eu.perfil_completo : false
  const chip = edicao.estado === 'inscricoes'
    ? (inscrito && completo ? 'Perfil pronto' : aberta ? 'Inscrições abertas' : 'Inscrições encerradas')
    : edicao.estado === 'sorteado' ? 'Sorteio feito' : 'Entregas'
  const linhaData = edicao.estado === 'inscricoes' ? `Sorteio em ${dataHora(edicao.sorteio_em)}.` : `Entrega até ${dataCurta(edicao.postar_ate)}.`
  const linha = inscrito ? linhaData : `Troca de presentes em segredo. ${linhaData}`
  const botao = inscrito ? 'Abrir a sala' : aberta ? (logado ? 'Abrir' : 'Participar') : 'Ver'
  const principal = destaque && !inscrito && aberta
  return (
    <section className={principal ? 'as-mis cl-frente' : 'as-card cl-frente'}>
      <div className="cl-frente-g">
        <Selo src={SELO_AMIGO_SECRETO} grande={principal} />
        <div className="cl-frente-tx">
          <span className={`as-chip${principal ? ' fill' : completo ? ' ok' : ''}`}>{chip}</span>
          <h2 className="as-h3">Amigo Secreto</h2>
          <p className="as-meta">{linha}</p>
        </div>
      </div>
      {inscrito ? (
        // Quem ja participa tambem volta para a landing (regras e datas), pedido do Du em 05/11.
        <div className="cl-acoes">
          <Link href={destino} className="as-btn pri">{botao}</Link>
          <Link href={AMIGO_SECRETO} className="as-btn">Regras e datas</Link>
        </div>
      ) : <Link href={destino} className={`as-btn${principal ? ' pri' : ''}`}>{botao}</Link>}
    </section>
  )
}

const CL_CSS = `
.cl-selo{width:88px;height:88px;flex:none;object-fit:contain;display:block}
.cl-selo.g{width:104px;height:104px}
.cl .as-logo.cl-logo{height:36px}
.cl-entrar{min-height:44px;padding:0 8px;margin-right:-4px}
.cl-falha{display:flex;align-items:center;justify-content:space-between;gap:8px}
.cl-falha .as-btn{flex:none}
.cl-hero{display:flex;flex-direction:column;gap:10px;padding:8px 0 4px}
.cl-hero-tx{display:flex;flex-direction:column;gap:10px;min-width:0}
.cl-marca{width:176px;height:auto;display:block;margin-left:-6px}
.cl-leque{display:none}
.cl-frente .as-verso{cursor:default}
.cl-frente .as-verso:hover{transform:none}
.cl-frente-g{display:flex;gap:14px;align-items:flex-start}
.cl-frente-tx{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:6px}
.cl-frente .as-verso{width:84px}
.cl-frente .as-verso.sm{width:56px}
.cl-hoje{gap:8px;padding:18px 16px}
.cl-frentes{display:flex;flex-direction:column;gap:12px;min-width:0}
.cl-hoje-ev{font-size:20px;word-break:normal}
.cl-acoes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.cl-hoje .at{margin-top:0}
.cl-hoje .as-btn{width:100%}
.cl-passadas{padding:0 12px}
.cl-passadas .as-row{text-decoration:none;min-height:64px}
.cl-passadas .as-verso.cl-verso-mini{width:28px;border-radius:6px}
.cl-passadas .cl-verso-mini:before,.cl-passadas .cl-verso-mini:after{display:none}
.cl-verso-logo{position:relative;width:76%;height:auto;display:block}
@media (min-width:1024px){
  .cl .as-logo.cl-logo{height:40px}
  .cl-hero{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);column-gap:24px;align-items:center;padding:24px 0}
  .cl-marca{display:none}
  .cl-leque{display:flex;justify-content:center;align-items:center;padding:12px 0}
  .cl-leque > *{width:clamp(128px,13.4vw,172px);margin:0 -6px;flex:none}
  .cl-leque .as-verso{aspect-ratio:2/3}
  .cl-leque .cl-carta{height:auto;display:block}
  .cl-leque > :nth-child(1){transform:rotate(-10deg)}
  .cl-leque > :nth-child(2){position:relative;z-index:1}
  .cl-leque > :nth-child(3){transform:rotate(10deg)}
  .cl-frente{padding:24px}
  .cl-frente-g{gap:20px;align-items:center}
  .cl-frentes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;align-items:stretch}
  .cl-frentes.tres>:last-child{grid-column:1/-1}
  .cl-frente .as-btn{width:auto;align-self:flex-start;min-width:220px;margin-top:auto}
  .cl-acoes{display:flex;flex-wrap:wrap;margin-top:auto}
  .cl-acoes .as-btn{min-width:180px;margin-top:0}
  .cl-hoje{max-width:520px;width:100%;margin:0 auto}
}
@media (min-width:1200px){
  .cl-frentes.tres{grid-template-columns:repeat(3,minmax(0,1fr))}
  .cl-frentes.tres>:last-child{grid-column:auto}
}
`
