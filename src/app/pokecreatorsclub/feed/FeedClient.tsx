'use client'

// Feed do Club (wireframe v3 e UI v3 aprovados pelo Du em 26/11/2026). Uma URL, um painel; o que
// muda e quem esta olhando:
//   visitante: le "Recentes" (vem renderizado do servidor) e ve o convite na barra fixa;
//   conta da Bynx sem Club: le e denuncia; postar e apoiar abrem o EntrarClub;
//   membro: "Para ver" (o que ainda nao marcou), "Recentes", "Meus posts"; postar e apoiar;
//   papel 'feed': "Organizar".
// O gesto: abrir o post na rede (outra aba) e, na volta, a folha pergunta o que a pessoa fez.
// A volta e lembrada no navegador (sessionStorage), porque o iPhone costuma recarregar a aba.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import type { CadastroClub } from '@/lib/pcc/membro'
import { CLUB, FEED } from '@/lib/pcc/rotas'
import {
  CHAVE_IDEIAS, CHAVE_REGRAS, REDES, TEMAS, erroFeed, gravarMarca, lerMarca, linkFeed,
  type Gesto, type ListaFeed, type MeuApoio, type MeuPost, type PostFeed, type QuemApoiou,
} from '@/lib/pcc/feed'
import { Ico } from '../amigo-secreto/estilo'
import { Casca } from '../agenda/comum'
import EntrarClub from '../EntrarClub'
import { CardPost, FD_CSS, tituloPost } from './comum'
import {
  FolhaApoio, FolhaDenunciar, FolhaFiltro, FolhaIdeias, FolhaPostado, FolhaPostar, FolhaProximo, FolhaQuemApoiou, FolhaRegras, FolhaRetorno,
  type Filtro,
} from './folhas'
import MeusPosts from './meus'
import Organizar from './organizar'

type Aba = 'para_ver' | 'recentes' | 'meus' | 'organizar'
type Folhas =
  | { t: 'apoio'; p: PostFeed; voltando: boolean }
  | { t: 'ideias'; p: PostFeed; abrir: boolean }
  | { t: 'retorno'; p: PostFeed }
  | { t: 'proximo'; p: PostFeed | null }
  | { t: 'postar' }
  | { t: 'postado'; primeiro: boolean }
  | { t: 'regras'; depois?: 'postar' }
  | { t: 'denunciar'; p: PostFeed }
  | { t: 'quem'; id: string; rede: PostFeed['rede']; titulo: string }
  | { t: 'filtro' }
  | { t: 'entrar'; depois: 'postar' | null }
  | null

const CHAVE_PENDENTE = 'bynx.feed.abriu'

function lerPendente(): { id: string; em: number } | null {
  try { const v = sessionStorage.getItem(CHAVE_PENDENTE); return v ? JSON.parse(v) as { id: string; em: number } : null } catch { return null }
}
function gravarPendente(id: string | null) {
  try { if (id) sessionStorage.setItem(CHAVE_PENDENTE, JSON.stringify({ id, em: Date.now() })); else sessionStorage.removeItem(CHAVE_PENDENTE) } catch { /* sem armazenamento: a folha so nao abre sozinha */ }
}

export default function FeedClient({ inicial }: { inicial: ListaFeed | null }) {
  const { openLogin } = useAuthModal()
  const [agora, setAgora] = useState(() => Date.now())
  const [logado, setLogado] = useState<boolean | undefined>(undefined)
  const [nome, setNome] = useState('')
  const [cadastro, setCadastro] = useState<CadastroClub | null | undefined>(undefined)
  const [organizador, setOrganizador] = useState(false)
  const [aba, setAba] = useState<Aba>('recentes')
  const [lista, setLista] = useState<ListaFeed | null>(inicial)
  const [carregando, setCarregando] = useState(false)
  const [falhou, setFalhou] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>({ rede: null, tema: null })
  const [folha, setFolha] = useState<Folhas>(null)
  const [toast, setToast] = useState<{ texto: string; erro?: boolean } | null>(null)
  const [meus, setMeus] = useState<MeuPost[] | null>(null)
  const [meuApoio, setMeuApoio] = useState<MeuApoio | null>(null)
  const [quem, setQuem] = useState<{ dados: QuemApoiou | null; falhou: boolean }>({ dados: null, falhou: false })
  const [temNovo, setTemNovo] = useState(false)
  const pedido = useRef(0)
  const cadastroNovo = useRef<CadastroClub | null>(null)

  const membro = !!cadastro?.membro && !!cadastro.instagram && !cadastro.faltam.includes('instagram')
  const modo: 'visitante' | 'conta' | 'membro' = !logado ? 'visitante' : membro ? 'membro' : 'conta'
  const temaSemana = lista?.semana?.tema ?? null

  // Relogio do "ha 12 min".
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 60000); return () => clearInterval(t) }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setLogado(!!data.session); setNome(String(data.session?.user.user_metadata?.name || '')) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setLogado(!!s); setNome(String(s?.user.user_metadata?.name || '')) })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Cadastro do Club e papeis: so com sessao.
  useEffect(() => {
    if (logado === undefined) return
    if (!logado) { setCadastro(null); setOrganizador(false); return }
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
    if (cadastro === undefined) return
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
    if (!logado && aba === 'recentes' && !filtro.rede && !filtro.tema && inicial) { setLista(inicial); return }
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
    const p = lista?.itens.find(x => x.id === pend.id)
    gravarPendente(null)
    if (p && !p.meu) setFolha(f => (f ? f : { t: 'apoio', p, voltando: true }))
  }, [membro, lista])
  useEffect(() => {
    verVolta()
    document.addEventListener('visibilitychange', verVolta)
    window.addEventListener('focus', verVolta)
    return () => { document.removeEventListener('visibilitychange', verVolta); window.removeEventListener('focus', verVolta) }
  }, [verVolta])

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t) }, [toast])

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
    if (modo !== 'membro' || p.meu) return
    if (!lerMarca(CHAVE_IDEIAS) && e) { e.preventDefault(); setFolha({ t: 'ideias', p, abrir: true }); return }
    gravarPendente(p.id)
  }

  function abrirPeloBotao(p: PostFeed) {
    const href = linkFeed(p.url)
    setFolha(null)
    if (!href) return
    gravarPendente(p.id)
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  function aoApoiar(p: PostFeed) {
    if (modo === 'visitante') { entrar(); return }
    if (modo === 'conta') { setFolha({ t: 'entrar', depois: null }); return }
    setFolha({ t: 'apoio', p, voltando: false })
  }

  function aoMarcar(p: PostFeed, gestos: Gesto[] | null) {
    setLista(l => {
      if (!l) return l
      if (aba === 'para_ver' && gestos !== null) return { ...l, itens: l.itens.filter(x => x.id !== p.id) }
      return { ...l, itens: l.itens.map(x => (x.id === p.id ? { ...x, minha_marca: gestos, ja_sigo: x.ja_sigo || !!gestos?.includes('segui') } : x)) }
    })
    if (gestos === null) { setToast({ texto: 'Marca desfeita. O post voltou para Para ver.' }); setFolha(null); if (aba === 'para_ver') carregar(); return }
    if (gestos.length === 0) { setToast({ texto: 'Ok, só vi. O post saiu da sua fila.' }); setFolha(null); return }
    const proximo = (lista?.itens ?? []).find(x => x.id !== p.id && !x.meu && x.minha_marca === null) ?? null
    setFolha({ t: 'proximo', p: proximo })
  }

  async function abrirQuem(id: string, rede: PostFeed['rede'], titulo: string) {
    setQuem({ dados: null, falhou: false })
    setFolha({ t: 'quem', id, rede, titulo })
    const { data, error } = await supabase.rpc('club_feed_quem_apoiou', { p_id: id })
    setQuem({ dados: error ? null : (data as QuemApoiou), falhou: !!error })
  }

  async function confirmar(id: string, arroba: string): Promise<string | null> {
    const { error } = await supabase.rpc('club_feed_confirmar_comentario', { p_id: id, p_arroba: arroba })
    if (error) return erroFeed(error.message)
    setQuem(q => (q.dados ? { ...q, dados: { ...q.dados, apoios: q.dados.apoios.map(a => (a.arroba === arroba ? { ...a, confirmado_em: new Date().toISOString() } : a)) } } : q))
    carregarMeus()
    return null
  }

  const itens = lista?.itens ?? []
  const filtrado = !!filtro.rede || !!filtro.tema
  const rotuloFiltro = [filtro.rede && REDES[filtro.rede].nome, filtro.tema && (filtro.tema === 'semana' ? temaSemana : TEMAS[filtro.tema])].filter(Boolean).join(' · ')

  const abas = useMemo(() => {
    const a: { id: Aba; rotulo: string }[] = []
    if (modo === 'membro') a.push({ id: 'para_ver', rotulo: 'Para ver' })
    a.push({ id: 'recentes', rotulo: 'Recentes' })
    if (modo === 'membro') a.push({ id: 'meus', rotulo: 'Meus posts' })
    if (organizador) a.push({ id: 'organizar', rotulo: 'Organizar' })
    return a
  }, [modo, organizador])

  const lateral = (
    <>
      {temaSemana && (
        <div className="as-card fd-tema">
          <span className="as-ri"><Ico n="star" s={18} /></span>
          <span className="tx"><span className="as-k">Tema da semana</span><b>{temaSemana}</b></span>
          {modo === 'membro' && <button type="button" className="as-btn sm" onClick={abrirPostar}>Postar no tema</button>}
        </div>
      )}
      {modo !== 'membro'
        ? (
          <div className="as-mis">
            <div className="as-h3">Poste e apoie com o Club</div>
            <p className="as-p" style={{ margin: 0 }}>Os posts dos creators do Club, para descobrir e apoiar. Para postar e apoiar, entre no Club.</p>
            <button type="button" className="as-btn pri" onClick={entrar}>Entrar no Club</button>
          </div>
        )
        : <button type="button" className="as-btn pri cta" onClick={abrirPostar}><Ico n="plus" s={18} />Postar no feed</button>}
      <button type="button" className="as-btn lnk" onClick={() => setFolha({ t: 'regras' })}>Regras do feed</button>
    </>
  )

  const conteudoLista = (
    <>
      {falhou && (
        <div className="as-note strong cl-falha" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>Não deu para carregar o feed agora.</span>
          <button type="button" className="as-btn sm" onClick={() => carregar()}>Tentar de novo</button>
        </div>
      )}
      {!falhou && itens.length === 0 && !carregando && (
        <div className="fd-vazio">
          <span className="as-ri"><Ico n={aba === 'para_ver' && !filtrado ? 'check' : 'spark'} s={26} /></span>
          <p className="as-p">{filtrado
            ? 'Nenhum post com esse filtro agora.'
            : aba === 'para_ver'
              ? 'Você passou por tudo o que está no feed. Quando entrar post novo, ele aparece aqui.'
              : 'O feed ainda está vazio. Seja o primeiro post da semana.'}</p>
          {filtrado
            ? <button type="button" className="as-btn" onClick={() => setFiltro({ rede: null, tema: null })}>Limpar o filtro</button>
            : <button type="button" className="as-btn pri" onClick={aba === 'para_ver' ? () => setAba('recentes') : abrirPostar}>{aba === 'para_ver' ? 'Ver os recentes' : 'Postar no feed'}</button>}
        </div>
      )}
      <div className="fd-lista duas">
        {itens.map(p => (
          <CardPost key={p.id} p={p} modo={modo} agora={agora}
            onAbrir={(x, e) => aoAbrir(x, e)}
            onApoiar={aoApoiar}
            onRetorno={x => setFolha({ t: 'retorno', p: x })}
            onMenu={logado ? x => setFolha({ t: 'denunciar', p: x }) : undefined}
            onQuemApoiou={x => abrirQuem(x.id, x.rede, tituloPost(x))} />
        ))}
      </div>
      {lista?.tem_mais && itens.length > 0 && (
        <button type="button" className="as-btn fd-mais-btn" disabled={carregando} onClick={() => carregar(itens[itens.length - 1].feed_em)}>
          {carregando ? 'Carregando...' : 'Ver mais posts'}
        </button>
      )}
    </>
  )

  return (
    <Casca logado={!!logado} onEntrar={() => openLogin({ next: FEED, cta: 'Entrar no Club' })} voltar={CLUB} titulo="Feed">
      <div className="fd">
        <div className="fd-layout">
          <div className="fd-cab" style={{ gap: 12 }}>
            <div className="fd-cab">
              <h1 className="as-h2">Feed do Club</h1>
              <p className="as-p" style={{ margin: 0 }}>Os posts dos creators do Club, para descobrir e apoiar. Ninguém pede nem troca curtida. <button type="button" className="lnk" onClick={() => setFolha({ t: 'regras' })}>Regras</button></p>
            </div>
            {temaSemana && (
              <div className="as-card fd-tema fd-so-cel">
                <span className="as-ri"><Ico n="star" s={18} /></span>
                <span className="tx"><span className="as-k">Tema da semana</span><b>{temaSemana}</b></span>
                {modo === 'membro' && <button type="button" className="as-btn sm" onClick={abrirPostar}>Postar no tema</button>}
              </div>
            )}

            {abas.length > 1 && (
              <div className="fd-seg" role="tablist" aria-label="Partes do feed" style={{ gridTemplateColumns: `repeat(${abas.length},minmax(0,1fr))` }}>
                {abas.map(a => (
                  <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={aba === a.id ? 'on' : ''} onClick={() => setAba(a.id)}>
                    {a.rotulo}{a.id === 'para_ver' && temNovo && aba !== 'para_ver' && <i className="fd-dot" aria-label="tem post novo" />}
                  </button>
                ))}
              </div>
            )}

            {(aba === 'para_ver' || aba === 'recentes') && (
              <div className="fd-bar">
                <span className="as-meta">{filtrado ? rotuloFiltro : aba === 'para_ver' ? 'O que você ainda não marcou' : 'Mais novos primeiro'}</span>
                <button type="button" className="as-btn sm" onClick={() => setFolha({ t: 'filtro' })}><Ico n="filtro" s={16} />Filtrar</button>
              </div>
            )}

            {(aba === 'para_ver' || aba === 'recentes') && conteudoLista}
            {aba === 'meus' && <MeusPosts posts={meus} apoio={meuApoio} agora={agora} onPostar={abrirPostar} onMudou={carregarMeus}
              onQuemApoiou={p => abrirQuem(p.id, p.rede, tituloPost(p))} />}
            {aba === 'organizar' && organizador && <Organizar agora={agora} onMudou={() => carregar()} />}
            <div className="fd-espaco fd-so-cel" />
          </div>
          <aside className="fd-aside" aria-label="Postar e regras">{lateral}</aside>
        </div>

        <div className="fd-fixa fd-so-cel">
          <div className="in">
            {modo === 'membro'
              ? <button type="button" className="as-btn pri cta" style={{ width: '100%' }} onClick={abrirPostar}><Ico n="plus" s={18} />Postar no feed</button>
              : (
                <>
                  <span className="tx">{modo === 'visitante' ? 'Entre no Club para postar e apoiar.' : 'Entre no Club para postar e apoiar. Leva um minuto.'}</span>
                  <button type="button" className="as-btn pri" onClick={entrar}>{modo === 'visitante' ? 'Entrar' : 'Entrar no Club'}</button>
                </>
              )}
          </div>
        </div>

        {toast && (
          <div className={`fd-toast${toast.erro ? ' erro' : ''}`} role="status">
            <Ico n={toast.erro ? 'alert' : 'check'} s={16} /><span style={{ flex: 1 }}>{toast.texto}</span>
          </div>
        )}
      </div>

      {folha?.t === 'ideias' && <FolhaIdeias p={folha.p} onFechar={() => setFolha(null)} onAbrir={folha.abrir ? () => abrirPeloBotao(folha.p) : undefined} />}
      {folha?.t === 'apoio' && <FolhaApoio p={folha.p} voltando={folha.voltando} onFechar={() => setFolha(null)} onMarcou={aoMarcar}
        onRetorno={p => setFolha({ t: 'retorno', p })} onIdeias={p => setFolha({ t: 'ideias', p, abrir: false })} />}
      {folha?.t === 'proximo' && <FolhaProximo proximo={folha.p} onFechar={() => setFolha(null)} onAbrir={abrirPeloBotao} />}
      {folha?.t === 'retorno' && <FolhaRetorno p={folha.p} onFechar={() => setFolha(null)} onEnviou={p => {
        setLista(l => (l ? { ...l, itens: l.itens.map(x => (x.id === p.id ? { ...x, meu_retorno: true } : x)) } : l))
        setFolha(null); setToast({ texto: `Retorno enviado. Só @${p.arroba} vê.` })
      }} />}
      {folha?.t === 'regras' && <FolhaRegras onFechar={() => setFolha(null)} onAceitar={() => { gravarMarca(CHAVE_REGRAS); setFolha(folha.depois === 'postar' ? { t: 'postar' } : null) }} />}
      {folha?.t === 'postar' && cadastro?.instagram && <FolhaPostar arroba={cadastro.instagram} temaSemana={temaSemana} onFechar={() => setFolha(null)}
        onPostou={r => { setFolha({ t: 'postado', primeiro: r.primeiro }); setAba('recentes'); carregar() }} />}
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
