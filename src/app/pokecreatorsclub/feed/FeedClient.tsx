'use client'

// Feed do Club (wireframe v3 e UI v3 aprovados pelo Du em 26/11/2026; versao C da tela, "a sala da B
// com as cartas da A", aprovada em 27/11/2026). Uma URL, um painel; o que muda e quem esta olhando:
//   visitante: le "Recentes" (vem renderizado do servidor) e ve o convite na barra fixa;
//   conta da Bynx sem Club: le e denuncia; postar e apoiar abrem o EntrarClub;
//   membro: "Para ver" (o que ainda nao marcou), "Recentes", "Meus posts"; postar e apoiar;
//   papel 'feed': "Organizar".
// O gesto: abrir o post na rede (outra aba) e, na volta, a folha pergunta o que a pessoa fez.
// A volta e lembrada no navegador (sessionStorage), porque o iPhone costuma recarregar a aba.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import type { CadastroClub } from '@/lib/pcc/membro'
import { CLUB, FEED } from '@/lib/pcc/rotas'
import {
  CHAVE_IDEIAS, CHAVE_REGRAS, REDES, ROTULO_DIA, TEMAS, agruparPorDia, erroFeed, gravarMarca, gravarVisto, lerMarca, lerVistos, linhaViva, linkFeed,
  type Destaques, type Gesto, type GrupoDia, type ListaFeed, type MeuApoio, type MeuPost, type PostFeed, type QuemApoiou, type Rede,
} from '@/lib/pcc/feed'
import { Ico, LOGO_PCC } from '../amigo-secreto/estilo'
import { Casca } from '../agenda/comum'
import EntrarClub from '../EntrarClub'
import { Avatar, CartaEsqueleto, CartaPost, FD_CSS, JanelaCarta, tituloPost } from './comum'
import {
  FolhaApoio, FolhaDenunciar, FolhaFiltro, FolhaIdeias, FolhaPostado, FolhaPostar, FolhaQuemApoiou, FolhaRegras, FolhaRetorno,
  type Filtro,
} from './folhas'
import MeusPosts from './meus'
import Organizar from './organizar'

type Aba = 'para_ver' | 'recentes' | 'meus' | 'organizar'
type Folhas =
  | { t: 'apoio'; p: PostFeed; voltando: boolean }
  | { t: 'ideias'; p: PostFeed; abrir: boolean }
  | { t: 'retorno'; p: PostFeed }
  | { t: 'postar' }
  | { t: 'postado'; primeiro: boolean }
  | { t: 'regras'; depois?: 'postar' }
  | { t: 'denunciar'; p: PostFeed }
  | { t: 'quem'; id: string; rede: PostFeed['rede']; titulo: string }
  | { t: 'filtro' }
  | { t: 'entrar'; depois: 'postar' | null }
  | null

const CHAVE_PENDENTE = 'bynx.feed.abriu'

// A marca vence em 2 horas: quem volta no dia seguinte nao e perguntado sobre um post de ontem.
const PENDENTE_VALE_MS = 2 * 60 * 60 * 1000
function lerPendente(): { p: PostFeed; em: number } | null {
  try { const v = sessionStorage.getItem(CHAVE_PENDENTE); return v ? JSON.parse(v) as { p: PostFeed; em: number } : null } catch { return null }
}
function gravarPendente(p: PostFeed | null) {
  try { if (p) sessionStorage.setItem(CHAVE_PENDENTE, JSON.stringify({ p, em: Date.now() })); else sessionStorage.removeItem(CHAVE_PENDENTE) } catch { /* sem armazenamento: a folha so nao abre sozinha */ }
}

export default function FeedClient({ inicial, destaquesIniciais }: { inicial: ListaFeed | null; destaquesIniciais: Destaques | null }) {
  const { openLogin } = useAuthModal()
  // 0 no servidor e na hidratacao: o "ha X min" so aparece depois de montar, para o HTML nao divergir.
  const [agora, setAgora] = useState(0)
  const [logado, setLogado] = useState<boolean | undefined>(undefined)
  const [nome, setNome] = useState('')
  const [cadastro, setCadastro] = useState<CadastroClub | null | undefined>(undefined)
  const [organizador, setOrganizador] = useState(false)
  const [aba, setAba] = useState<Aba>('recentes')
  const [lista, setLista] = useState<ListaFeed | null>(inicial)
  // Quem chegou e a escolha da semana: funcao propria, fora do corte da pagina.
  const [destaques, setDestaques] = useState<Destaques | null>(destaquesIniciais)
  const [carregando, setCarregando] = useState(false)
  const [falhou, setFalhou] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>({ rede: null, tema: null })
  const [folha, setFolha] = useState<Folhas>(null)
  const [toast, setToast] = useState<{ texto: string; erro?: boolean; apoio?: true; proximo?: PostFeed | null } | null>(null)
  // Posts ja abertos (anel de "nao visto"), a carta que acabou de ligar a energia e o Postar flutuante.
  const [vistos, setVistos] = useState<Set<string>>(() => new Set())
  const [ligando, setLigando] = useState<string | null>(null)
  const [fabFora, setFabFora] = useState(false)
  const [meus, setMeus] = useState<MeuPost[] | null>(null)
  const [meuApoio, setMeuApoio] = useState<MeuApoio | null>(null)
  const [quem, setQuem] = useState<{ dados: QuemApoiou | null; falhou: boolean }>({ dados: null, falhou: false })
  const [temNovo, setTemNovo] = useState(false)
  const pedido = useRef(0)
  const cadastroNovo = useRef<CadastroClub | null>(null)
  const abaInicial = useRef(false)
  const quemId = useRef<string | null>(null)
  const folhaAberta = useRef(false)

  const membro = !!cadastro?.membro && !!cadastro.instagram && !cadastro.faltam.includes('instagram')
  const modo: 'visitante' | 'conta' | 'membro' = !logado ? 'visitante' : membro ? 'membro' : 'conta'
  const temaSemana = lista?.semana?.tema ?? null

  // Relogio do "ha 12 min".
  useEffect(() => {
    setAgora(Date.now())
    const t = setInterval(() => setAgora(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setLogado(!!data.session); setNome(String(data.session?.user.user_metadata?.name || '')) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setLogado(!!s); setNome(String(s?.user.user_metadata?.name || '')) })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Cadastro do Club e papeis: so com sessao.
  useEffect(() => {
    if (logado === undefined) return
    if (!logado) { setCadastro(null); setOrganizador(false); setAba('recentes'); setMeus(null); setMeuApoio(null); abaInicial.current = false; return }
    let vivo = true
    Promise.all([supabase.rpc('club_meu_cadastro'), supabase.rpc('club_meus_papeis')]).then(([c, p]) => {
      if (!vivo) return
      setCadastro(c.error ? null : (c.data as CadastroClub | null) ?? null)
      setOrganizador(!p.error && Array.isArray(p.data) && (p.data as string[]).includes('feed'))
    })
    return () => { vivo = false }
  }, [logado])

  // Aba inicial: membro abre em "Para ver"; os avisos do sino trazem ?aba=meus ou ?organizar=1.
  useEffect(() => {
    if (cadastro === undefined || abaInicial.current) return
    abaInicial.current = true
    const q = new URLSearchParams(window.location.search)
    if (q.get('organizar') === '1' && organizador) setAba('organizar')
    else if ((q.get('aba') === 'meus' || q.get('apoio') === '1') && membro) setAba('meus')
    else if (membro) setAba('para_ver')
    if (q.get('postar') === '1' && logado) abrirPostar()
    if (q.has('postar') || q.has('aba') || q.has('organizar') || q.has('apoio')) window.history.replaceState(null, '', FEED)
    // So na primeira resposta do cadastro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadastro, organizador])

  const carregar = useCallback(async (antes?: string) => {
    if (aba !== 'para_ver' && aba !== 'recentes') return
    const n = ++pedido.current
    setCarregando(true); if (!antes) setFalhou(false)
    const { data, error } = await supabase.rpc('club_feed_lista', {
      p_aba: aba, p_antes: antes ?? null, p_rede: filtro.rede, p_tema: filtro.tema, p_limite: 20,
    })
    if (n !== pedido.current) return
    setCarregando(false)
    if (error) { if (antes) setToast({ texto: 'Não deu para carregar mais posts agora.', erro: true }); else setFalhou(true); return }
    const nova = data as ListaFeed
    setLista(l => (antes && l ? { ...nova, itens: [...l.itens, ...nova.itens] } : nova))
  }, [aba, filtro])

  const carregarDestaques = useCallback(async () => {
    const { data, error } = await supabase.rpc('club_feed_destaques')
    if (!error) setDestaques(data as Destaques)
  }, [])
  useEffect(() => { if (logado) carregarDestaques() }, [logado, carregarDestaques])

  const carregarMeus = useCallback(async () => {
    const [m, a] = await Promise.all([supabase.rpc('club_feed_meus'), supabase.rpc('club_feed_meu_apoio')])
    setMeus(m.error ? [] : (m.data as MeuPost[]))
    setMeuApoio(a.error ? null : (a.data as MeuApoio))
  }, [])

  // Recarrega a lista quando a aba, o filtro ou a sessao mudam. O visitante ja chega com a lista do servidor.
  useEffect(() => {
    if (logado === undefined || cadastro === undefined) return
    if (aba === 'meus') { carregarMeus(); return }
    if (aba === 'organizar') return
    if (!logado && aba === 'recentes' && !filtro.rede && !filtro.tema && inicial) { pedido.current++; setCarregando(false); setFalhou(false); setLista(inicial); return }
    carregar()
  }, [aba, filtro, logado, cadastro, carregar, carregarMeus, inicial])

  // "Tem post novo" na aba Para ver, sem numero (nenhum contador de pendencia).
  useEffect(() => {
    if (!membro || aba === 'para_ver') return
    let vivo = true
    supabase.rpc('club_feed_lista', { p_aba: 'para_ver', p_limite: 1 }).then(({ data, error }) => {
      if (vivo && !error) setTemNovo(((data as ListaFeed).itens ?? []).length > 0)
    })
    return () => { vivo = false }
  }, [membro, aba, lista])

  // A volta do post: a aba volta a ficar visivel (ou a pagina recarregou) com um post aberto ha mais de 3 s.
  const verVolta = useCallback(() => {
    if (!membro || document.visibilityState !== 'visible') return
    const pend = lerPendente()
    if (!pend || Date.now() - pend.em < 3000) return
    if (Date.now() - pend.em > PENDENTE_VALE_MS) { gravarPendente(null); return }
    // Outra folha aberta: espera ela fechar (a marca fica guardada).
    if (folhaAberta.current) return
    gravarPendente(null)
    // O post da lista, se estiver nela (marca atualizada); senao o que foi guardado ao abrir.
    const p = lista?.itens.find(x => x.id === pend.p.id) ?? pend.p
    if (!p.meu) setFolha({ t: 'apoio', p, voltando: true })
  }, [membro, lista])
  useEffect(() => {
    verVolta()
    document.addEventListener('visibilitychange', verVolta)
    window.addEventListener('focus', verVolta)
    return () => { document.removeEventListener('visibilitychange', verVolta); window.removeEventListener('focus', verVolta) }
  }, [verVolta])

  useEffect(() => { folhaAberta.current = folha !== null; if (folha === null) verVolta() }, [folha, verVolta])

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), toast.apoio ? 6500 : 4000); return () => clearTimeout(t) }, [toast])

  // Vistos guardados no navegador; so depois de montar, para o HTML do servidor nao divergir.
  useEffect(() => { setVistos(lerVistos()) }, [])
  function marcarVisto(id: string) { gravarVisto(id); setVistos(v => (v.has(id) ? v : new Set(v).add(id))) }

  // O Postar flutuante some ao rolar para baixo e volta ao subir.
  useEffect(() => {
    let ultimo = window.scrollY
    const aoRolar = () => {
      const y = window.scrollY
      if (Math.abs(y - ultimo) < 8) return
      setFabFora(y > ultimo && y > 120)
      ultimo = y
    }
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => window.removeEventListener('scroll', aoRolar)
  }, [])

  useEffect(() => { if (!ligando) return; const t = setTimeout(() => setLigando(null), 900); return () => clearTimeout(t) }, [ligando])

  function abrirPostar() {
    if (!logado) { openLogin({ next: `${FEED}?postar=1`, cta: 'Entrar no Club' }); return }
    if (!membro) { setFolha({ t: 'entrar', depois: 'postar' }); return }
    if (!lerMarca(CHAVE_REGRAS)) { setFolha({ t: 'regras', depois: 'postar' }); return }
    setFolha({ t: 'postar' })
  }

  function entrar() {
    if (!logado) { openLogin({ next: FEED, cta: 'Entrar no Club' }); return }
    setFolha({ t: 'entrar', depois: null })
  }

  /** Clique em "Abrir no ...". Membro: lembra o post para perguntar na volta; na primeira vez, as ideias antes. */
  function aoAbrir(p: PostFeed, e?: { preventDefault: () => void }) {
    marcarVisto(p.id)
    if (modo !== 'membro' || p.meu) return
    if (!lerMarca(CHAVE_IDEIAS) && e) { e.preventDefault(); setFolha({ t: 'ideias', p, abrir: true }); return }
    gravarPendente(p)
  }

  function abrirPeloBotao(p: PostFeed) {
    const href = linkFeed(p.url)
    setFolha(null)
    if (!href) return
    marcarVisto(p.id)
    gravarPendente(p)
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  function aoApoiar(p: PostFeed) {
    if (modo === 'visitante') { entrar(); return }
    if (modo === 'conta') { setFolha({ t: 'entrar', depois: null }); return }
    setFolha({ t: 'apoio', p, voltando: false })
  }

  function aoMarcar(p: PostFeed, gestos: Gesto[] | null, depois?: 'retorno') {
    // A carta fica no lugar (numa grade, tirar uma carta faz todas trocarem de casa); na proxima carga
    // de "Para ver" ela nao volta.
    setLista(l => (l ? { ...l, itens: l.itens.map(x => (x.id === p.id ? { ...x, minha_marca: gestos, ja_sigo: x.ja_sigo || !!gestos?.includes('segui') } : x)) } : l))
    marcarVisto(p.id)
    setDestaques(d => d && {
      chegaram: d.chegaram.map(x => (x.id === p.id ? { ...x, marquei: gestos !== null } : x)),
      escolha: d.escolha && d.escolha.id === p.id ? { ...d.escolha, marquei: gestos !== null } : d.escolha,
    })
    if (gestos === null) { setToast({ texto: 'Marca desfeita. O post voltou para Para ver.' }); setFolha(null); if (aba === 'para_ver') carregar(); return }
    if (gestos.length === 0) { setToast({ texto: 'Ok, só vi.' }); setFolha(null); return }
    setLigando(p.id)
    if (depois === 'retorno') { setFolha({ t: 'retorno', p }); return }
    setFolha(null)
    // O proximo que a pessoa ainda nao marcou, de preferencia depois deste na lista.
    const lst = lista?.itens ?? []
    const k = lst.findIndex(x => x.id === p.id)
    const livre = (x: PostFeed) => x.id !== p.id && !x.meu && x.minha_marca === null && !!linkFeed(x.url)
    const proximo = lst.slice(k + 1).find(livre) ?? lst.slice(0, Math.max(k, 0)).find(livre) ?? null
    setToast({ texto: 'Apoio marcado.', apoio: true, proximo })
  }

  async function abrirQuem(id: string, rede: PostFeed['rede'], titulo: string) {
    quemId.current = id
    setQuem({ dados: null, falhou: false })
    setFolha({ t: 'quem', id, rede, titulo })
    const { data, error } = await supabase.rpc('club_feed_quem_apoiou', { p_id: id })
    if (quemId.current !== id) return
    setQuem({ dados: error ? null : (data as QuemApoiou), falhou: !!error })
  }

  async function confirmar(id: string, arroba: string): Promise<string | null> {
    const { error } = await supabase.rpc('club_feed_confirmar_comentario', { p_id: id, p_arroba: arroba })
    if (error) return erroFeed(error.message)
    if (quemId.current !== id) return null
    setQuem(q => (q.dados ? { ...q, dados: { ...q.dados, apoios: q.dados.apoios.map(a => (a.arroba === arroba ? { ...a, confirmado_em: new Date().toISOString() } : a)) } } : q))
    carregarMeus()
    return null
  }

  const itens = useMemo(() => lista?.itens ?? [], [lista])
  const filtrado = !!filtro.rede || !!filtro.tema
  const naLista = aba === 'para_ver' || aba === 'recentes'

  const abas = useMemo(() => {
    const a: { id: Aba; rotulo: string }[] = []
    if (modo === 'membro') a.push({ id: 'para_ver', rotulo: 'Para ver' })
    a.push({ id: 'recentes', rotulo: 'Recentes' })
    if (modo === 'membro') a.push({ id: 'meus', rotulo: 'Meus posts' })
    if (organizador) a.push({ id: 'organizar', rotulo: 'Organizar' })
    return a
  }, [modo, organizador])

  // Dias da lista (so depois de montar: o servidor nao sabe que horas sao no navegador).
  const grupos: { g: GrupoDia | null; itens: PostFeed[] }[] = useMemo(
    () => (agora ? agruparPorDia(itens, agora) : [{ g: null, itens }]), [itens, agora])
  const chegaram = destaques?.chegaram ?? []
  const escolha = destaques?.escolha && linkFeed(destaques.escolha.url) ? destaques.escolha : null

  /** Um destaque como post do feed: o da lista, se estiver carregado; senao montado com o que o destaque traz. */
  function comoPost(x: { id: string; arroba: string; rede: Rede; formato: PostFeed['formato']; tema: PostFeed['tema']; url: string; feed_em: string; capa?: string | null; meu?: boolean; marquei: boolean | null }): PostFeed {
    return itens.find(p => p.id === x.id) ?? {
      id: x.id, rede: x.rede, formato: x.formato, tema: x.tema, pergunta: null, url: x.url, capa: x.capa ?? null, arroba: x.arroba,
      feed_em: x.feed_em, retorno: false, primeiro: false, tema_semana: false, escolha: false, meu: !!x.meu,
      minha_marca: x.marquei ? [] : null, meu_retorno: false, ja_sigo: false, apoiaram: null,
    }
  }
  const gente = (grupos[0]?.g === 'hoje' ? grupos[0].itens : itens).map(p => p.arroba)
  const genteHoje = grupos[0]?.g === 'hoje'

  /** Quem chegou: rola ate a carta se ela esta na pagina; senao abre o post na rede. */
  function irPara(x: Destaques['chegaram'][number]) {
    const el = document.getElementById(`post-${x.id}`)
    if (el) { el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); return }
    abrirPeloBotao(comoPost(x))
  }

  const frase = (arrobas: string[], g: GrupoDia | null) => {
    const { partes } = linhaViva(arrobas, g ?? 'semana')
    const nomes = partes.a.map((a, k) => <b key={a}>{k > 0 ? (partes.a.length > 2 || partes.resto.startsWith('e mais') ? ', ' : ' e ') : ''}@{a}</b>)
    return <>{nomes} {partes.resto}</>
  }

  const postEscolha = escolha ? comoPost(escolha) : null
  const cartaEscolha = escolha && postEscolha && (
    <section className="fv-esc" aria-label="Escolha da semana">
      <a className="cp" href={linkFeed(escolha.url)!} target="_blank" rel="noopener noreferrer" onClick={e => aoAbrir(postEscolha, e)}
        aria-label={`Abrir o post escolhido de @${escolha.arroba}, em outra aba`}>
        <JanelaCarta p={escolha} /><span className="fv-fita">Escolha</span>
      </a>
      <div className="tx">
        <span className="eb">Escolha do Club</span>
        <span className="who"><Avatar arroba={escolha.arroba} t={28} /><span>@{escolha.arroba}</span></span>
        {escolha.frase ? <q className="tt">{escolha.frase}</q> : <p className="tt">{tituloPost(escolha)}</p>}
        <span className="por">{escolha.frase ? 'Por quem organiza o feed nesta semana' : 'Escolhido por quem organiza o feed nesta semana'}</span>
        <a className="as-btn sm" href={linkFeed(escolha.url)!} target="_blank" rel="noopener noreferrer" onClick={e => aoAbrir(postEscolha, e)}>
          <Ico n="ext" s={16} />Ver no {REDES[escolha.rede].nome}
        </a>
      </div>
    </section>
  )

  const filaChegaram = chegaram.length > 0 && (
    <section className="fv-cheg fd-so-cel" aria-label="Chegaram esta semana">
      <div className="fv-sec-h"><h2>Chegaram esta semana</h2><span>Diga oi no primeiro post</span></div>
      <div className="fv-row">
        {chegaram.map(p => {
          const novo = modo === 'membro' ? !p.marquei && !vistos.has(p.id) : true
          return (
            <button key={p.id} type="button" className={`fv-che${novo ? ' novo' : ''}`} onClick={() => irPara(p)} aria-label={`Ver o primeiro post de @${p.arroba}`}>
              <Avatar arroba={p.arroba} t={64} novo={novo} rede={p.rede} /><span className="nm">@{p.arroba}</span>
            </button>
          )
        })}
      </div>
    </section>
  )

  const topo = modo === 'membro'
    ? (
      <section className="fv-oi" aria-label="Postar">
        <h1 className="fd-sr">Feed do Poké Creators Club</h1>
        <div className="ola">Oi, @{cadastro?.instagram}. <span>Bom ver você por aqui.</span></div>
        <button type="button" className="fv-comp" onClick={abrirPostar}>
          <Avatar arroba={cadastro?.instagram || '?'} t={40} /><span className="ph-t">Mostre um post seu para o Club</span>
          <span className="mais"><Ico n="plus" s={20} /></span>
        </button>
        {temaSemana && (
          <button type="button" className="fv-tema" onClick={() => setFiltro({ rede: null, tema: 'semana' })}>
            <Ico n="star" s={18} /><span>Tema da semana: <b>{temaSemana}</b></span><Ico n="chev" s={16} />
          </button>
        )}
      </section>
    )
    : (
      <section className="fv-conv">
        <span className="eb"><Ico n="users" s={16} />Poké Creators Club</span>
        <h1>O que os creators do Club <em>postaram esta semana</em></h1>
        {gente.length > 0 && (
          <div className="gente">
            <span className="fv-pile">{Array.from(new Set(gente)).slice(0, 4).map(a => <Avatar key={a} arroba={a} t={28} novo />)}</span>
            <span>{frase(gente, genteHoje ? 'hoje' : 'semana')}</span>
          </div>
        )}
        <div className="acts">
          <button type="button" className="as-btn pri" onClick={entrar}>Entrar no Club</button>
          <button type="button" className="as-btn lnk" onClick={() => setFolha({ t: 'regras' })}>Como funciona</button>
        </div>
      </section>
    )

  const chips = naLista && (
    <div className="fv-chips" role="group" aria-label="Filtrar o feed">
      <button type="button" className={`fd-pk${!filtrado ? ' on' : ''}`} aria-pressed={!filtrado} onClick={() => setFiltro({ rede: null, tema: null })}>Tudo</button>
      {temaSemana && (
        <button type="button" className={`fd-pk${filtro.tema === 'semana' ? ' on' : ''}`} aria-pressed={filtro.tema === 'semana'}
          onClick={() => setFiltro(f => ({ ...f, tema: f.tema === 'semana' ? null : 'semana' }))}><Ico n="star" s={16} />{temaSemana}</button>
      )}
      {(Object.keys(REDES) as Rede[]).map(r => (
        <button key={r} type="button" className={`fd-pk${filtro.rede === r ? ' on' : ''}`} aria-pressed={filtro.rede === r}
          onClick={() => setFiltro(f => ({ ...f, rede: f.rede === r ? null : r }))}><Ico n={REDES[r].ico} s={16} />{REDES[r].nome}</button>
      ))}
      <button type="button" className={`fd-pk${filtro.tema && filtro.tema !== 'semana' ? ' on' : ''}`} onClick={() => setFolha({ t: 'filtro' })}>
        <Ico n="filtro" s={16} />{filtro.tema && filtro.tema !== 'semana' ? TEMAS[filtro.tema] : 'Mais filtros'}
      </button>
    </div>
  )

  const nav = (
    <div className="fv-nav">
      {abas.length > 1 && (
        <div className="fv-tabs" role="tablist" aria-label="Partes do feed">
          {abas.map(a => (
            <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={`fv-tab${aba === a.id ? ' on' : ''}`} onClick={() => setAba(a.id)}>
              {a.rotulo}{a.id === 'para_ver' && temNovo && aba !== 'para_ver' && <i className="dot" aria-label="tem post novo" />}
            </button>
          ))}
        </div>
      )}
      {chips}
    </div>
  )

  const pilha = (ok: boolean) => (
    <div className="fd-pilha" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {[0, 1, 2].map(k => <span key={k} className={`fd-verso${ok && k === 1 ? ' ok' : ''}`}><img src={LOGO_PCC} alt="" /></span>)}
    </div>
  )

  const carta = (p: PostFeed) => (
    <CartaPost key={p.id} p={p} modo={modo} agora={agora} visto={vistos.has(p.id)} ligando={ligando === p.id}
      onAbrir={(x, e) => aoAbrir(x, e)}
      onApoiar={aoApoiar}
      onMenu={logado ? x => setFolha({ t: 'denunciar', p: x }) : undefined}
      onQuemApoiou={x => abrirQuem(x.id, x.rede, tituloPost(x))} />
  )

  const conteudoLista = (
    <>
      {falhou && (
        <div className="as-note strong cl-falha" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>Não deu para carregar o feed agora.</span>
          <button type="button" className="as-btn sm" onClick={() => carregar()}>Tentar de novo</button>
        </div>
      )}
      {!falhou && itens.length === 0 && carregando && (
        <div className="fd-carregando" aria-busy="true" aria-label="Carregando o feed">
          <div className="fd-g">{[0, 1, 2, 3].map(k => <CartaEsqueleto key={k} />)}</div>
        </div>
      )}
      {!falhou && itens.length === 0 && !carregando && (
        filtrado
          ? (
            <div className="fd-vz">
              <h3>Nenhum post com esse filtro agora</h3>
              <div className="acts"><button type="button" className="as-btn" onClick={() => setFiltro({ rede: null, tema: null })}>Limpar o filtro</button></div>
            </div>
          )
          : aba === 'para_ver'
            ? (
              <div className="fd-vz">
                {pilha(true)}
                <h3>Você virou todas as cartas</h3>
                <p className="as-p">Obrigado por olhar o trabalho da turma. Quando entrar post novo, ele aparece aqui.</p>
                <div className="acts">
                  <button type="button" className="as-btn pri" onClick={() => setAba('recentes')}>Ver os recentes</button>
                  <button type="button" className="as-btn lnk" onClick={abrirPostar}>Postar o seu</button>
                </div>
              </div>
            )
            : (
              <div className="fd-vz">
                {pilha(false)}
                <h3>O feed ainda está vazio</h3>
                <p className="as-p">Seja o primeiro post da semana.</p>
                <div className="acts"><button type="button" className="as-btn pri" onClick={modo === 'membro' ? abrirPostar : entrar}>{modo === 'membro' ? 'Postar no feed' : 'Entrar no Club'}</button></div>
              </div>
            )
      )}
      {grupos.map((gr, gi) => gr.itens.length > 0 && (
        <section key={gr.g ?? 'todos'} className="fd-bd" aria-label={gr.g ? ROTULO_DIA[gr.g] : 'Posts'}>
          {gr.g && (
            <div className="fv-dia">
              <h2>{ROTULO_DIA[gr.g]}</h2>
              <div className="fv-vivo">
                <span className="fv-pile">{Array.from(new Set(gr.itens.map(p => p.arroba))).slice(0, 3).map(a => <Avatar key={a} arroba={a} t={24} />)}</span>
                <span>{frase(gr.itens.map(p => p.arroba), gr.g)}</span>
              </div>
            </div>
          )}
          <div className="fd-g">
            {gr.itens.map((p, k) => (
              <Fragment key={p.id}>
                {carta(p)}
                {/* Membro no celular: a escolha entra na grade do primeiro dia, depois da primeira fileira de quatro. */}
                {modo === 'membro' && gi === 0 && cartaEscolha && k === Math.min(3, gr.itens.length - 1) && <div className="fd-so-cel fd-g-linha">{cartaEscolha}</div>}
              </Fragment>
            ))}
          </div>
        </section>
      ))}
      {lista?.tem_mais && itens.length > 0 && (
        <button type="button" className="as-btn" style={{ alignSelf: 'center', width: 'auto' }} disabled={carregando} onClick={() => carregar(itens[itens.length - 1].feed_em)}>
          {carregando ? 'Carregando...' : 'Ver mais posts'}
        </button>
      )}
      {aba === 'para_ver' && !lista?.tem_mais && itens.length > 0 && !filtrado && (
        <section className="fv-fim" aria-label="Fim da fila">
          <span className="ok"><Ico n="check" s={30} /></span>
          <h3>Você chegou ao fim da fila</h3>
          <p>Obrigado por olhar o trabalho da turma. Quando entrar post novo, ele aparece aqui em cima.</p>
          <div className="acts">
            <button type="button" className="as-btn" onClick={() => setAba('recentes')}>Ver os recentes</button>
            <button type="button" className="as-btn lnk" onClick={abrirPostar}>Postar o seu</button>
          </div>
        </section>
      )}
    </>
  )

  const lateral = (
    <>
      {modo !== 'membro'
        ? (
          <div className="as-mis">
            <div className="as-h3">Poste e apoie com o Club</div>
            <p className="as-p" style={{ margin: 0 }}>Os posts dos creators do Club, para descobrir e apoiar. Para postar e apoiar, entre no Club.</p>
            <button type="button" className="as-btn pri" onClick={entrar}>Entrar no Club</button>
          </div>
        )
        : <button type="button" className="as-btn pri cta" onClick={abrirPostar}><Ico n="plus" s={18} />Postar no feed</button>}
      {cartaEscolha}
      {chegaram.length > 0 && (
        <div className="as-card" style={{ gap: 6 }}>
          <div className="fv-sec-h"><h2>Chegaram esta semana</h2></div>
          {chegaram.map(p => (
            <button key={p.id} type="button" className="fd-dk-che" onClick={() => irPara(p)}>
              <Avatar arroba={p.arroba} t={40} novo={modo === 'membro' ? !p.marquei && !vistos.has(p.id) : true} rede={p.rede} />
              <span className="tx"><b>@{p.arroba}</b><span>Primeiro post · {tituloPost(p)}</span></span>
              <Ico n="chev" s={16} />
            </button>
          ))}
        </div>
      )}
      <button type="button" className="as-btn lnk" onClick={() => setFolha({ t: 'regras' })}>Como o feed funciona</button>
    </>
  )

  return (
    <Casca logado={!!logado} onEntrar={() => openLogin({ next: FEED, cta: 'Entrar no Club' })} voltar={CLUB} titulo="Feed">
      <div className="fd">
        <div className="fd-layout">
          <div className="fd-bd">
            {topo}
            {filaChegaram}
            {cartaEscolha && (modo !== 'membro' || (naLista && !carregando && itens.length === 0)) && <div className="fd-so-cel">{cartaEscolha}</div>}
            {nav}
            {naLista && conteudoLista}
            {aba === 'meus' && <MeusPosts posts={meus} apoio={meuApoio} arroba={cadastro?.instagram ?? ''} agora={agora} onPostar={abrirPostar} onMudou={carregarMeus}
              onQuemApoiou={p => abrirQuem(p.id, p.rede, tituloPost(p))} />}
            {aba === 'organizar' && organizador && <Organizar agora={agora} onMudou={() => carregar()} />}
            <div className="fd-fim-espaco fd-so-cel" />
          </div>
          <aside className="fd-aside" aria-label="Postar, escolha da semana e quem chegou">{lateral}</aside>
        </div>

        {modo === 'membro'
          ? <button type="button" className={`fv-fab${fabFora ? ' fora' : ''}`} onClick={abrirPostar} tabIndex={fabFora ? -1 : 0}><Ico n="plus" s={20} />Postar</button>
          : (
            <div className="fd-fixa fd-so-cel">
              <div className="in">
                <span className="tx">{modo === 'visitante' ? 'Entre no Club para postar e apoiar.' : 'Entre no Club para postar e apoiar. Leva um minuto.'}</span>
                <button type="button" className="as-btn pri" onClick={entrar}>{modo === 'visitante' ? 'Entrar' : 'Entrar no Club'}</button>
              </div>
            </div>
          )}

        {toast && (toast.apoio
          ? (
            <div className="fv-toast" role="status">
              <Ico n="energia" s={18} />
              <span className="tx">{toast.proximo ? <><b>Apoio marcado.</b> Próximo: @{toast.proximo.arroba}</> : <><b>Apoio marcado.</b> Obrigado por ajudar.</>}</span>
              {toast.proximo && <button type="button" className="as-btn sm" onClick={() => { const x = toast.proximo!; setToast(null); abrirPeloBotao(x) }}>Abrir</button>}
            </div>
          )
          : (
            <div className={`fd-toast${toast.erro ? ' erro' : ''}`} role="status">
              <Ico n={toast.erro ? 'alert' : 'check'} s={16} /><span style={{ flex: 1 }}>{toast.texto}</span>
            </div>
          ))}
      </div>

      {folha?.t === 'ideias' && <FolhaIdeias p={folha.p} onFechar={() => setFolha(null)} onAbrir={folha.abrir ? () => abrirPeloBotao(folha.p) : undefined} />}
      {folha?.t === 'apoio' && <FolhaApoio p={folha.p} voltando={folha.voltando} onFechar={() => setFolha(null)} onMarcou={aoMarcar}
        onIdeias={p => setFolha({ t: 'ideias', p, abrir: false })} />}
      {folha?.t === 'retorno' && <FolhaRetorno p={folha.p} onFechar={() => setFolha(null)} onEnviou={p => {
        setLista(l => (l ? { ...l, itens: l.itens.map(x => (x.id === p.id ? { ...x, meu_retorno: true } : x)) } : l))
        setFolha(null); setToast({ texto: `Retorno enviado. Só @${p.arroba} vê.` })
      }} />}
      {folha?.t === 'regras' && <FolhaRegras onFechar={() => setFolha(null)} onAceitar={() => { gravarMarca(CHAVE_REGRAS); setFolha(folha.depois === 'postar' ? { t: 'postar' } : null) }} />}
      {folha?.t === 'postar' && cadastro?.instagram && <FolhaPostar arroba={cadastro.instagram} temaSemana={temaSemana} onFechar={() => setFolha(null)}
        onPostou={r => { setFolha({ t: 'postado', primeiro: r.primeiro }); setAba('recentes'); carregar(); carregarDestaques() }} />}
      {folha?.t === 'postado' && <FolhaPostado primeiro={folha.primeiro} onFechar={() => setFolha(null)} />}
      {folha?.t === 'denunciar' && <FolhaDenunciar p={folha.p} onFechar={() => setFolha(null)} onEnviou={() => { setFolha(null); setToast({ texto: 'Denúncia enviada. A organização vai olhar.' }) }} />}
      {folha?.t === 'quem' && <FolhaQuemApoiou post={{ id: folha.id, rede: folha.rede, titulo: folha.titulo }} dados={quem.dados} falhou={quem.falhou}
        onFechar={() => setFolha(null)} onConfirmar={a => confirmar(folha.id, a)} />}
      {folha?.t === 'filtro' && <FolhaFiltro filtro={filtro} temaSemana={temaSemana} onFechar={() => setFolha(null)} onAplicar={f => { setFiltro(f); setFolha(null) }} />}
      {folha?.t === 'entrar' && (
        <EntrarClub cadastro={cadastro ?? null} nome={nome}
          onEntrou={c => { cadastroNovo.current = c; setCadastro(c) }}
          onFechar={() => {
            // A folha do EntrarClub mostra o "pronto" (e a carta) antes de fechar; so depois segue para o postar.
            const c = cadastroNovo.current
            cadastroNovo.current = null
            if (folha.depois === 'postar' && c?.membro && c.instagram) setFolha(lerMarca(CHAVE_REGRAS) ? { t: 'postar' } : { t: 'regras', depois: 'postar' })
            else setFolha(null)
          }} />
      )}
      <style>{FD_CSS + `
@media (min-width:1024px){ .as:has(.fd) .as-wrap{max-width:1120px} }
`}</style>
    </Casca>
  )
}
