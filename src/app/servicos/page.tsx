'use client'

/**
 * /servicos -- "Meus servicos": os pedidos de restauracao e pre-grading.
 *
 * Ate 04/10/2026 esses pedidos eram um bloco solto no topo de /compras, fora
 * das abas e dos contadores. Um pedido de servico e outra coisa (a carta e do
 * proprio cliente, sai e volta, tem orcamento, proposta e dois pagamentos),
 * entao ganhou tela propria. A URL de cada pedido NAO mudou: /servico/[id],
 * que e para onde o sino e os e-mails apontam.
 *
 * Desenho aprovado pelo Du em 04/10/2026 (proposta "Meus servicos", fatias 1 a 3):
 * resumo de 3 numeros, filtro por servico (Completo so na aba Completo), secoes
 * por turno dentro de qualquer filtro, card com barra de 7 etapas, "Agora:",
 * faixa provavel (so com a carta pronta) e botao gradiente so na vez do cliente.
 * O card e um <article> com o TITULO como link esticado: os botoes ficam como
 * irmaos (link dentro de link e HTML invalido).
 *
 * ★ O PROXIMO PASSO DEPENDE DO PAGAMENTO, NAO SO DO STATUS. "aceito" cobre
 * tres situacoes (pagamento em aberto, ja pago, sem cobranca registrada), e
 * "recebida" ainda pode ter sinal em aberto -- que o `turnoServico` marca como
 * vez da Bynx. Por isso a lista le `servico_pagamentos` e o evento
 * `cobranca_servico` e usa o MESMO `etapaCobravel` do GET do pedido e do
 * checkout (src/lib/servicos.ts). "Sua vez" = existe acao do cliente agora
 * (o mesmo calculo do CTA); sem o pagamento uma cobranca ficaria escondida em
 * "Em andamento".
 *
 * ★ Relatorio do cliente so com o pedido ENTREGUE (STATUS_RELATORIO_CLIENTE).
 * A rota do dono aplica a mesma trava; aqui o botao simplesmente nao aparece.
 *
 * Le direto do Supabase: a RLS de servico_solicitacoes, _itens, _pagamentos e
 * _eventos libera SELECT so ao dono. Client-side e logada, como /compras. As
 * fotos vem de GET /api/servicos/capas (uma chamada para a lista toda); falha
 * nelas nunca derruba a lista.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { authFetch } from '@/lib/authFetch'
import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import {
  IconArrowRight, IconShield, IconRestauro, IconTarget, IconArticle, IconChevronRight, IconImage, IconTruck,
  IconCheck, IconWallet, IconClock,
} from '@/components/ui/Icons'
import {
  STATUS_SERVICO, SERVICOS, numeroServico, turnoServico, etapaCobravel, brl, lerFaixaNota, lerGraduadora,
  ETAPAS_SERVICO, indiceEtapa, rotuloEtapa, fraseAgora, STATUS_RELATORIO_CLIENTE,
  type LinhaPagamento, type ServicoId,
} from '@/lib/servicos'

type Pedido = {
  id: string; numero: number; servico: string; status: string; created_at: string
  proposta_aceita_em: string | null; rastreio_ida: string | null
}
type ItemLeve = {
  solicitacao_id: string; nome: string; custodia: string | null; aceito: boolean | null
  faixa: string | null; graduadora: string | null
}
type Capa = { oficial: string | null; cliente: string | null; antes: string | null; depois: string | null; entrada: boolean }

type Linha = {
  p: Pedido
  /** Vai na secao "Sua vez". */
  vez: boolean
  fim: boolean
  cta: string
  ancora: string
  devida: LinhaPagamento | null
  pagoCents: number
  /** Data (ISO) em que o pedido entrou no status atual. */
  desde: string | null
  cartas: ItemLeve[]
}

type Filtro = 'tudo' | ServicoId
const FILTROS: { id: Filtro; nome: string }[] = [
  { id: 'tudo', nome: 'Tudo' },
  { id: 'pre_grading', nome: 'Pré-grading' },
  { id: 'restauracao', nome: 'Restauração' },
  { id: 'completo', nome: 'Completo' },
]
const VAZIO_FILTRO: Record<ServicoId, { t: string; link: string; rotulo: string }> = {
  pre_grading: { t: 'Nenhum pré-grading por aqui', link: '/pre-grading', rotulo: 'Conhecer o pré-grading' },
  restauracao: { t: 'Nenhuma restauração por aqui', link: '/restauracao-de-cartas', rotulo: 'Conhecer a restauração' },
  completo: { t: 'Nenhum pedido completo por aqui', link: '/restauracao-de-cartas', rotulo: 'Conhecer o serviço completo' },
}
/** Faixa provavel so com a carta pronta (antes disso o laudo e rascunho de bancada). */
const STATUS_FAIXA = ['pronta', 'enviada', 'entregue']
/** As URLs assinadas valem 10 min: refaz a busca de fotos ao voltar para a aba depois de ~9. */
const RENOVAR_FOTOS_MS = 9 * 60 * 1000
/** Hosts do catalogo no remotePatterns do next.config.ts. Fora deles, <img> simples. */
const HOSTS_OTIMIZADOS = ['images.pokemontcg.io', 'images.scrydex.com', 'repositorio.sbrauble.com', 'pokecardex.b-cdn.net', 'hvkcwfcvizrvhkerupfc.supabase.co']

const fmtDiaMesBRT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
const diaMes = (iso: string | null) => (iso ? fmtDiaMesBRT.format(new Date(iso)) : null)

function filtroDaUrl(): Filtro {
  if (typeof window === 'undefined') return 'tudo'
  const t = new URLSearchParams(window.location.search).get('tipo')
  return t === 'pre_grading' || t === 'restauracao' || t === 'completo' ? t : 'tudo'
}

/**
 * O CTA do card, por status E por pagamento (tabela G da arquitetura).
 * ★ "Sua vez" = existe uma acao do cliente AGORA, e sai do MESMO calculo do
 * CTA -- nao do `turnoServico` puro. O turno diz 'cliente' para toda a
 * 'proposta' e todo o 'aceito', mas proposta ja aceita (servico sem cobranca
 * ou ja pago) e aceito ja pago com rastreio informado nao tem nada a fazer.
 */
function proximoPasso(p: Pedido, linhas: LinhaPagamento[], cobrancaEnviada: boolean) {
  const aceita = !!p.proposta_aceita_em
  const { devida } = etapaCobravel(p.status, aceita, linhas, cobrancaEnviada)
  const pagar = devida ? `Pagar · R$ ${brl(devida.valor_cents / 100)}` : ''
  let cta = 'Ver o pedido'
  let ancora = ''
  let acao = false
  if (p.status === 'orcado') { cta = 'Ver e aprovar orçamento'; ancora = 'orcamento'; acao = true }
  else if (p.status === 'aceito') {
    const temCobranca = linhas.some(l => l.etapa === 'integral' || l.etapa === 'sinal')
    if (devida) { cta = pagar; ancora = 'pagar'; acao = true }
    else if (!p.rastreio_ida) { cta = temCobranca ? 'Enviar a carta' : 'Ver como enviar'; ancora = 'envio'; acao = true }
  } else if (p.status === 'proposta') {
    if (!aceita) { cta = 'Decidir a proposta'; ancora = 'proposta'; acao = true }
    else if (devida) { cta = pagar; ancora = 'pagar'; acao = true }
  } else if (devida) { cta = pagar; ancora = 'pagar'; acao = true }
  return { vez: acao, fim: turnoServico(p.status) === 'fim', cta, ancora, devida }
}

export default function ServicosPage() {
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [semLogin, setSemLogin] = useState(false)
  const [erro, setErro] = useState(false)
  // Os chips so renderizam depois do carregamento, entao ler a URL no
  // inicializador nao gera diferenca de marcacao na hidratacao.
  const [filtro, setFiltro] = useState<Filtro>(filtroDaUrl)
  const [capas, setCapas] = useState<Record<string, Capa> | null>(null)
  const capasEm = useRef(0)

  const carregarCapas = useCallback(async () => {
    try {
      const r = await authFetch('/api/servicos/capas', { cache: 'no-store' })
      if (!r.ok) return
      const d = await r.json().catch(() => null)
      if (d?.capas) { setCapas(d.capas); capasEm.current = Date.now() }
    } catch { /* foto e bonus: a lista segue sem ela */ }
  }, [])

  const carregar = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { setSemLogin(true); setCarregando(false); return }

    const { data: sols, error } = await supabase
      .from('servico_solicitacoes')
      .select('id, numero, servico, status, created_at, proposta_aceita_em, rastreio_ida')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    // Falha de leitura nao pode virar "voce nao tem pedidos".
    if (error) { setErro(true); setCarregando(false); return }
    const pedidos = (sols || []) as Pedido[]

    const ids = pedidos.map(p => p.id)
    const pagPor = new Map<string, LinhaPagamento[]>()
    const evPor = new Map<string, { status: string; created_at: string }[]>()
    const itensPor = new Map<string, ItemLeve[]>()
    if (ids.length) {
      const [{ data: pags, error: e1 }, { data: evs, error: e2 }, { data: its, error: e3 }] = await Promise.all([
        supabase.from('servico_pagamentos')
          .select('id, solicitacao_id, etapa, valor_cents, metodo, pago_em, reembolsado_cents')
          .in('solicitacao_id', ids),
        supabase.from('servico_eventos')
          .select('solicitacao_id, status, created_at')
          .in('solicitacao_id', ids)
          .order('created_at'),
        // Do laudo so a faixa e a graduadora (o resto, como o caderno, fica no pedido).
        supabase.from('servico_itens')
          .select('solicitacao_id, nome, custodia, aceito, faixa:laudo->>faixa_nota, graduadora:laudo->>graduadora')
          .in('solicitacao_id', ids)
          .order('created_at'),
      ])
      // Sem os pagamentos o CTA mentiria ("Enviar a carta" com sinal em aberto).
      if (e1 || e2 || e3) { setErro(true); setCarregando(false); return }
      for (const pg of (pags || []) as (LinhaPagamento & { solicitacao_id: string })[]) {
        const l = pagPor.get(pg.solicitacao_id) || []
        l.push(pg)
        pagPor.set(pg.solicitacao_id, l)
      }
      for (const ev of (evs || []) as { solicitacao_id: string; status: string; created_at: string }[]) {
        const l = evPor.get(ev.solicitacao_id) || []
        l.push(ev)
        evPor.set(ev.solicitacao_id, l)
      }
      for (const it of (its || []) as unknown as ItemLeve[]) {
        const l = itensPor.get(it.solicitacao_id) || []
        l.push(it)
        itensPor.set(it.solicitacao_id, l)
      }
    }

    setLinhas(pedidos.map(p => {
      const pags = pagPor.get(p.id) || []
      const evs = evPor.get(p.id) || []
      const passo = proximoPasso(p, pags, evs.some(e => e.status === 'cobranca_servico'))
      const todas = itensPor.get(p.id) || []
      const aceitas = todas.filter(i => i.aceito !== false)
      return {
        p, ...passo,
        pagoCents: pags.filter(l => l.pago_em).reduce((s, l) => s + l.valor_cents - (l.reembolsado_cents || 0), 0),
        desde: [...evs].reverse().find(e => e.status === p.status)?.created_at || null,
        cartas: aceitas.length ? aceitas : todas,
      }
    }))
    setErro(false)
    setCarregando(false)
    if (ids.length) carregarCapas()
  }, [carregarCapas])

  // Todo setState de carregar() acontece depois do primeiro await; o lint nao enxerga isso.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [carregar])

  // URL assinada vence em 10 min: quem volta para a aba depois disso ganha links novos.
  useEffect(() => {
    const ver = () => {
      if (document.visibilityState === 'visible' && capasEm.current && Date.now() - capasEm.current > RENOVAR_FOTOS_MS) carregarCapas()
    }
    document.addEventListener('visibilitychange', ver)
    return () => document.removeEventListener('visibilitychange', ver)
  }, [carregarCapas])

  function escolher(f: Filtro) {
    setFiltro(f)
    const url = new URL(window.location.href)
    if (f === 'tudo') url.searchParams.delete('tipo')
    else url.searchParams.set('tipo', f)
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }

  const cabecalho = (
    <PageHeader
      trilha={[INICIO, { name: 'Meus serviços', href: '/servicos' }]}
      titulo="Meus serviços"
      descricao="Suas cartas na bancada da Bynx, do orçamento até voltarem para a sua mão."
    />
  )

  if (carregando) {
    return (
      <Casca>
        {cabecalho}
        <div className="sv-sk" aria-busy="true" aria-label="Carregando seus pedidos">
          <div className="sv-sk-bar" />
          {[0, 1].map(i => (
            <div key={i} className="sv-sk-card">
              <div className="sv-sk-th" />
              <div className="sv-sk-linhas"><i /><i /><i /><i /></div>
            </div>
          ))}
        </div>
      </Casca>
    )
  }

  if (semLogin) {
    return (
      <Casca>
        <div className="sv-msg">
          <IconShield size={26} color="var(--ac-1)" />
          <h2>Entre para ver seus serviços</h2>
          <p className="sv-muted">Você precisa estar logado com a conta que fez o pedido.</p>
        </div>
      </Casca>
    )
  }

  if (erro) {
    return (
      <Casca>
        {cabecalho}
        <div className="sv-msg">
          <p className="sv-muted">Não conseguimos carregar seus pedidos agora.</p>
          <button type="button" className="sv-bt" onClick={() => { setCarregando(true); carregar() }}>Tentar de novo</button>
        </div>
      </Casca>
    )
  }

  if (linhas.length === 0) {
    return (
      <Casca>
        {cabecalho}
        <div className="sv-vazio">
          <span className="sv-vazio-ic"><IconRestauro size={30} color="var(--bx-text-3)" /></span>
          <h2>Você ainda não pediu nenhum serviço</h2>
          <p className="sv-muted">Quando você pedir uma restauração ou um pré-grading, o pedido aparece aqui para você acompanhar do orçamento até a carta voltar.</p>
          <div className="sv-vazio-acoes">
            <Link className="sv-bt sv-bt-pri" href="/restauracao-de-cartas">Restauração de cartas</Link>
            <Link className="sv-bt" href="/pre-grading">Pré-grading</Link>
          </div>
        </div>
      </Casca>
    )
  }

  const suaVez = linhas.filter(l => l.vez)
  const andamento = linhas.filter(l => !l.vez && !l.fim)
  const encerrados = linhas.filter(l => !l.vez && l.fim)
  // Completo aparece SO na aba Completo (decisao do Du), nunca em Restauracao nem em Pre-grading.
  const doFiltro = (f: Filtro) => (f === 'tudo' ? linhas : linhas.filter(l => l.p.servico === f))
  const visiveis = new Set(doFiltro(filtro).map(l => l.p.id))
  const so = (ls: Linha[]) => ls.filter(l => visiveis.has(l.p.id))

  return (
    <Casca>
      {cabecalho}

      <div className="sv-resumo">
        <div><strong className={suaVez.length ? 'sv-ac' : ''}>{suaVez.length}</strong><span>esperando por você</span></div>
        <div><strong>{andamento.length}</strong><span>com a gente</span></div>
        <div><strong>{encerrados.length}</strong><span>{encerrados.length === 1 ? 'encerrado' : 'encerrados'}</span></div>
      </div>

      <div className="sv-chips" role="group" aria-label="Filtrar por serviço">
        {FILTROS.map(f => {
          const ls = doFiltro(f.id)
          const vez = f.id !== 'tudo' && ls.some(l => l.vez)
          const n = ls.filter(l => l.vez).length
          return (
            <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => escolher(f.id)}
              className={`sv-chip${filtro === f.id ? ' on' : ''}${ls.length ? '' : ' vazio'}`}
              aria-label={vez ? `${f.nome}, ${ls.length} ${ls.length === 1 ? 'pedido' : 'pedidos'}, ${n} esperando por você` : undefined}>
              {f.id === 'pre_grading' && <IconTarget size={15} />}
              {f.id === 'restauracao' && <IconRestauro size={15} />}
              {f.nome} <span className="n">{ls.length}</span>
              {vez && <span className="dot" aria-hidden />}
            </button>
          )
        })}
      </div>

      {visiveis.size === 0 && filtro !== 'tudo' ? (
        <div className="sv-vazio">
          <span className="sv-vazio-ic">{filtro === 'pre_grading' ? <IconTarget size={28} color="var(--bx-text-3)" /> : <IconRestauro size={28} color="var(--bx-text-3)" />}</span>
          <h2>{VAZIO_FILTRO[filtro].t}</h2>
          <p className="sv-muted">{SERVICOS.find(s => s.id === filtro)?.curto}. {SERVICOS.find(s => s.id === filtro)?.descricao}</p>
          <div className="sv-vazio-acoes">
            <Link className="sv-bt" href={VAZIO_FILTRO[filtro].link}>{VAZIO_FILTRO[filtro].rotulo}<IconChevronRight size={16} /></Link>
          </div>
        </div>
      ) : (
        <>
          <Secao titulo="Sua vez" vez itens={so(suaVez)} capas={capas} />
          <Secao titulo="Em andamento" dica="Com a gente agora." itens={so(andamento)} capas={capas} />
          <Secao titulo="Encerrados" itens={so(encerrados)} capas={capas} />
        </>
      )}

      <div className="sv-rodape">
        <p className="sv-confia"><IconShield size={18} /><span>Cada etapa com a sua carta deixa registro: vídeo da abertura, fotos na entrada e na saída e o número de custódia.</span></p>
        <div className="sv-outro">
          <Link className="sv-btn" href="/restauracao-de-cartas"><IconRestauro size={17} />Pedir restauração</Link>
          <Link className="sv-btn" href="/pre-grading"><IconTarget size={17} />Pedir pré-grading</Link>
        </div>
      </div>
    </Casca>
  )
}

function Secao({ titulo, dica, vez, itens, capas }: { titulo: string; dica?: string; vez?: boolean; itens: Linha[]; capas: Record<string, Capa> | null }) {
  if (!itens.length) return null
  return (
    <section className={`sv-secao${vez ? ' vez' : ''}`} aria-label={titulo}>
      <div className="sv-secao-t">
        <h2>{titulo}</h2><span className="c">{itens.length}</span>
        {dica && <span className="s">{dica}</span>}
      </div>
      <div className="sv-lista">
        {itens.map(l => <Card key={l.p.id} l={l} capa={capas ? capas[l.p.id] || null : undefined} />)}
      </div>
    </section>
  )
}

function SeloServico({ servico }: { servico: string }) {
  const nome = SERVICOS.find(x => x.id === servico)?.nome || 'Serviço'
  return (
    <span className="sv-selo">
      {servico !== 'pre_grading' && <IconRestauro size={13} />}
      {servico !== 'restauracao' && <IconTarget size={13} />}
      {nome}
    </span>
  )
}

/**
 * Miniatura 5:7. Ordem: imagem oficial do catalogo (next/image, URL estavel),
 * a foto de frente do cliente (<img>, URL assinada fora do otimizador), e o
 * marcador. Cada falha cai para a proxima.
 */
function Miniatura({ capa, nome, extras }: { capa: Capa | null | undefined; nome: string; extras: number }) {
  const fontes = [
    capa?.oficial ? { url: capa.oficial, oficial: true } : null,
    capa?.cliente ? { url: capa.cliente, oficial: false } : null,
  ].filter(Boolean) as { url: string; oficial: boolean }[]
  const [falhas, setFalhas] = useState<string[]>([])
  const f = fontes.find(x => !falhas.includes(x.url))
  const falhou = () => f && setFalhas(x => [...x, f.url])
  let otimizada = false
  if (f?.oficial) { try { otimizada = HOSTS_OTIMIZADOS.includes(new URL(f.url).hostname) } catch { /* url ruim cai no <img> */ } }

  return (
    <div className={`sv-th${extras ? ' pilha' : ''}${f ? '' : ' ph'}`}>
      {f ? (
        otimizada ? (
          <Image src={f.url} alt={`${nome}, imagem oficial`} width={88} height={123} sizes="88px" onError={falhou} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- foto assinada (10 min) fica fora do otimizador da Vercel
          <img src={f.url} alt={f.oficial ? `${nome}, imagem oficial` : `${nome}, sua foto de frente`} loading="lazy" decoding="async" onError={falhou} />
        )
      ) : (
        <span><IconImage size={22} />{capa === undefined ? '' : 'Sem foto'}</span>
      )}
      {f && !f.oficial && <span className="leg">Sua foto</span>}
      {extras > 0 && <span className="mais" aria-label={`e mais ${extras}`}>+{extras}</span>}
    </div>
  )
}

function AntesDepois({ antes, depois, nome }: { antes: string; depois: string; nome: string }) {
  const [quebrou, setQuebrou] = useState(false)
  if (quebrou) return null
  return (
    <div className="sv-dip">
      {/* eslint-disable-next-line @next/next/no-img-element -- foto assinada (10 min) fica fora do otimizador da Vercel */}
      <img src={antes} alt={`${nome}, frente na chegada`} loading="lazy" decoding="async" onError={() => setQuebrou(true)} />
      <span className="seta"><IconArrowRight size={16} /></span>
      {/* eslint-disable-next-line @next/next/no-img-element -- foto assinada (10 min) fica fora do otimizador da Vercel */}
      <img src={depois} alt={`${nome}, frente na saída`} loading="lazy" decoding="async" onError={() => setQuebrou(true)} />
      <span className="cap">Antes</span><span /><span className="cap">Depois</span>
    </div>
  )
}

function Card({ l, capa }: { l: Linha; capa: Capa | null | undefined }) {
  const { p, vez, fim, cta, ancora, devida, pagoCents, desde, cartas } = l
  const href = `/servico/${p.id}`
  const idx = indiceEtapa(p.status)
  const entregue = p.status === 'entregue'
  const apagado = fim && !entregue
  const principal = cartas[0]
  const nome = principal?.nome || SERVICOS.find(x => x.id === p.servico)?.nome || 'Serviço'
  const extras = Math.max(0, cartas.length - 1)
  const rotulo = idx >= 0 ? rotuloEtapa(p.servico, idx) : STATUS_SERVICO[p.status] || p.status
  const pillCls = vez ? ' vez' : (p.status === 'pronta' || entregue) ? ' ok' : ''
  const agora = fraseAgora(p, !!devida)

  const faixa = p.servico !== 'restauracao' && STATUS_FAIXA.includes(p.status)
    ? cartas.map(c => ({ c, f: lerFaixaNota(c.faixa) })).find(x => x.f) || null
    : null

  let icone: ReactNode = p.servico === 'pre_grading' ? <IconTarget size={16} /> : <IconRestauro size={16} />
  let tomAgora = ''
  if (vez) { tomAgora = ' vez'; icone = devida ? <IconWallet size={16} /> : p.status === 'aceito' ? <IconTruck size={16} /> : <IconArticle size={16} /> }
  else if (p.status === 'pronta') { tomAgora = ' ok'; icone = <IconCheck size={16} /> }
  else if (p.status === 'enviada' || (p.status === 'aceito' && p.rastreio_ida)) icone = <IconTruck size={16} />
  else if (p.status === 'aguardando_orcamento') icone = <IconClock size={16} />

  // Botoes secundarios (fora da vez do cliente), no maximo dois.
  const sec: { t: string; href: string; ic?: ReactNode; seta?: boolean }[] = []
  if (!vez) {
    if (p.status === STATUS_RELATORIO_CLIENTE) sec.push({ t: 'Abrir relatório', href: `${href}/relatorio`, ic: <IconArticle size={17} /> })
    if (p.status === 'enviada') sec.push({ t: 'Rastrear a entrega', href: `${href}#volta`, ic: <IconTruck size={17} /> })
    if (capa?.antes && capa.depois) sec.push({ t: 'Antes e depois', href: `${href}#cartas`, seta: true })
    else if (!fim && capa?.entrada) sec.push({ t: 'Fotos da entrada', href: `${href}#cartas`, ic: <IconImage size={17} /> })
    if (sec.length < 2) sec.push({ t: 'Ver o pedido', href, seta: true })
  }
  const botoes = sec.slice(0, 2)

  return (
    <article className={`sv-card${vez ? ' vez' : ''}${apagado ? ' fim' : ''}`}>
      <div className="sv-c-wrap">
        <div className="sv-c-top">
          <Miniatura capa={capa} nome={nome} extras={extras} />
          <div className="sv-info">
            <div className="sv-l1"><SeloServico servico={p.servico} /><span className={`sv-pill${pillCls}`}>{rotulo}</span></div>
            <h3 className="sv-t"><Link href={href}>{nome}</Link></h3>
            <div className="sv-cartas">
              <span className="num">{numeroServico(p.numero)}</span>
              {extras > 0 && <span>· e mais {extras} {extras === 1 ? 'carta' : 'cartas'}</span>}
              {extras === 0 && principal?.custodia && <span className="sv-cust" title="Número de custódia da sua carta">{principal.custodia}</span>}
            </div>
            {idx >= 0 && (
              <>
                <div className="sv-etapas" role="img" aria-label={entregue ? 'Todas as 7 etapas concluídas' : `Etapa ${idx + 1} de ${ETAPAS_SERVICO.length}`}>
                  {ETAPAS_SERVICO.map((e, i) => <i key={e.t} className={i < idx || entregue ? 'f' : i === idx ? 'a' : ''} />)}
                </div>
                <div className="sv-etapa-leg">
                  {entregue
                    ? <>Entregue{desde ? ` em ${diaMes(desde)}` : ''}</>
                    : <>Etapa {idx + 1} de {ETAPAS_SERVICO.length} · <b>{rotulo}</b>{desde ? ` · desde ${diaMes(desde)}` : ''}</>}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="sv-corpo">
          {faixa && (
            <div className="sv-faixa">
              <span className="r">Faixa provável{cartas.length > 1 ? ` · ${faixa.c.nome}` : ''}</span>
              <span className="v">{faixa.f!.texto}</span>
              {lerGraduadora(faixa.c.graduadora) && <span className="g">{lerGraduadora(faixa.c.graduadora)}</span>}
              <span className="m">Estimativa da nossa bancada. A nota oficial é da graduadora.</span>
            </div>
          )}
          {agora && (
            <p className={`sv-agora${tomAgora}`}><span className="bola">{icone}</span><span><b>Agora:</b> {agora}</span></p>
          )}
          {capa?.antes && capa.depois && <AntesDepois antes={capa.antes} depois={capa.depois} nome={nome} />}
          {devida
            ? <div className="sv-devida">R$ {brl(devida.valor_cents / 100)} em aberto</div>
            : !fim && pagoCents > 0 && <div className="sv-pago">Pago: R$ {brl(pagoCents / 100)}</div>}
          <div className="sv-acoes">
            {vez ? (
              <Link className="sv-btn pri" href={ancora ? `${href}#${ancora}` : href}>{cta}<IconArrowRight size={17} /></Link>
            ) : (
              botoes.map(b => (
                <Link key={b.t} className={`sv-btn${botoes.length === 1 ? ' full' : ''}`} href={b.href}>
                  {b.ic}{b.t}{b.seta && <IconChevronRight size={17} />}
                </Link>
              ))
            )}
            {!vez && p.status === STATUS_RELATORIO_CLIENTE && <span className="sv-dica">Para salvar em PDF: Compartilhar e depois Imprimir.</span>}
          </div>
        </div>
      </div>
    </article>
  )
}

function Casca({ children }: { children: ReactNode }) {
  return (
    <AppLayout>
      <style>{CSS}</style>
      <div className="sv-wrap">{children}</div>
    </AppLayout>
  )
}

const CSS = `
.sv-wrap{max-width:720px;margin:0 auto;padding:4px 0 40px;color:var(--bx-text)}
.sv-muted{font-size:14px;line-height:1.55;color:var(--bx-text-2);margin:0}
.sv-msg{max-width:460px;margin:10px auto 0;display:grid;justify-items:center;gap:10px;text-align:center;padding:28px 20px;border-radius:16px;border:1px solid var(--bx-border);background:var(--bx-surface)}
.sv-msg h2{font-size:17px;font-weight:800;margin:0}

.sv-resumo{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-radius:12px;background:var(--bx-hero-wash),var(--bx-surface);border:1px solid var(--bx-border);margin:-10px 0 14px}
.sv-resumo div{padding:12px 12px 11px;min-width:0}
.sv-resumo div+div{border-left:1px solid var(--bx-border)}
.sv-resumo strong{display:block;font-size:20px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1}
.sv-resumo strong.sv-ac{color:var(--ac-1)}
.sv-resumo span{display:block;font-size:12px;color:var(--bx-text-3);margin-top:2px;line-height:1.3}

.sv-chips{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 -16px 18px;padding:2px 16px;scroll-snap-type:x mandatory;scroll-padding-inline:16px}
.sv-chips::-webkit-scrollbar{display:none}
.sv-chip{scroll-snap-align:start;flex:none;min-height:44px;padding:0 15px;border-radius:999px;border:1px solid var(--bx-border);background:var(--bx-surface);color:var(--bx-text-2);font:inherit;font-size:13.5px;font-weight:700;display:inline-flex;align-items:center;gap:7px;position:relative;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease}
.sv-chip:hover{background:var(--bx-surface-2);border-color:var(--bx-border-2)}
.sv-chip:focus-visible{outline:2px solid var(--ac-1);outline-offset:2px}
.sv-chip .n{color:var(--bx-text-3);font-variant-numeric:tabular-nums}
.sv-chip.vazio{color:var(--bx-text-3)}
.sv-chip.on{background:rgba(var(--ac-1-rgb),.12);color:var(--ac-1);border-color:rgba(var(--ac-1-rgb),.4)}
.sv-chip.on .n{color:var(--ac-1)}
.sv-chip .dot{width:7px;height:7px;border-radius:50%;background:var(--ac-1);position:absolute;top:8px;right:8px}

.sv-secao{margin-bottom:22px}
.sv-secao-t{display:flex;align-items:baseline;gap:8px;margin:0 0 10px}
.sv-secao-t h2{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin:0;color:var(--bx-text-2)}
.sv-secao-t .c{font-size:12px;color:var(--bx-text-3);font-variant-numeric:tabular-nums}
.sv-secao-t .s{font-size:12.5px;color:var(--bx-text-3);margin-left:auto}
.sv-secao.vez .sv-secao-t h2{color:var(--ac-1)}
.sv-lista{display:flex;flex-direction:column;gap:10px}

.sv-card{position:relative;border-radius:14px;background:var(--bx-surface);border:1px solid var(--bx-border);padding:14px;overflow:hidden;transition:background .15s ease,border-color .15s ease}
.sv-card:hover{background:var(--bx-surface-2);border-color:var(--bx-border-2)}
.sv-card:has(.sv-t a:focus-visible){outline:2px solid var(--ac-1);outline-offset:2px}
.sv-card.vez{border-color:rgba(var(--ac-1-rgb),.4)}
.sv-card.vez::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--ac-grad)}
.sv-card.fim{opacity:.75}
.sv-c-top{display:grid;grid-template-columns:72px minmax(0,1fr);gap:12px}

.sv-th{position:relative;isolation:isolate;width:100%;aspect-ratio:5/7;border-radius:6px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);align-self:start}
.sv-th img{width:100%;height:100%;object-fit:cover;border-radius:5px;display:block}
.sv-th .leg{position:absolute;left:4px;bottom:4px;font-size:9.5px;font-weight:700;padding:2px 5px;border-radius:4px;background:var(--bx-bg-elev);color:var(--bx-text-2)}
.sv-th .mais{position:absolute;right:-6px;bottom:-6px;font-size:11px;font-weight:800;padding:3px 6px;border-radius:999px;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);color:var(--bx-text)}
.sv-th.pilha::after{content:"";position:absolute;inset:0;border-radius:6px;border:1px solid var(--bx-border-2);background:var(--bx-surface-3);transform:translate(6px,-4px) rotate(4deg);z-index:-1}
.sv-th.ph{display:grid;place-items:center;border-style:dashed;color:var(--bx-text-3);text-align:center;font-size:10px;font-weight:700;line-height:1.25;padding:6px}
.sv-th.ph svg{display:block;margin:0 auto 4px}

.sv-info{min-width:0}
.sv-l1{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px}
.sv-selo{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--bx-surface-2);color:var(--bx-text-2);min-width:0}
.sv-selo svg{flex:none}
.sv-pill{margin-left:auto;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px;border:1px solid var(--bx-border-2);color:var(--bx-text-2);white-space:nowrap}
.sv-pill.vez{border-color:rgba(var(--ac-1-rgb),.4);color:var(--ac-1);background:rgba(var(--ac-1-rgb),.08)}
.sv-pill.ok{border-color:color-mix(in srgb,var(--bx-green) 40%,transparent);color:var(--bx-green)}
.sv-t{font-size:16px;font-weight:700;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sv-t a{color:inherit;text-decoration:none;outline:none}
.sv-t a::after{content:"";position:absolute;inset:0;z-index:0}
.sv-cartas{font-size:12.5px;color:var(--bx-text-3);margin:2px 0 8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.sv-cartas .num{font-variant-numeric:tabular-nums}
.sv-cust{font-size:11.5px;font-weight:700;font-variant-numeric:tabular-nums;padding:2px 7px;border-radius:6px;background:var(--bx-surface-2);color:var(--bx-text-2);letter-spacing:.02em}
.sv-etapas{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px;margin:2px 0 6px}
.sv-etapas i{height:4px;border-radius:999px;background:var(--bx-surface-3)}
.sv-etapas i.f{background:color-mix(in srgb,var(--bx-green) 70%,transparent)}
.sv-etapas i.a{background:var(--ac-grad)}
.sv-etapa-leg{font-size:12px;color:var(--bx-text-3)}
.sv-etapa-leg b{color:var(--bx-text-2)}

.sv-agora{display:flex;gap:10px;align-items:flex-start;margin:12px 0 0;font-size:13px;line-height:1.45;color:var(--bx-text-2)}
.sv-agora .bola{width:28px;height:28px;border-radius:50%;background:var(--bx-surface-2);display:grid;place-items:center;color:var(--bx-text-3);flex:none}
.sv-agora.vez .bola{background:rgba(var(--ac-1-rgb),.12);color:var(--ac-1)}
.sv-agora.ok .bola{color:var(--bx-green)}
.sv-agora b{color:var(--bx-text)}

.sv-faixa{margin-top:12px;border-radius:10px;background:var(--bx-surface-2);padding:10px 12px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;align-items:center}
.sv-faixa .r{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sv-faixa .v{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.15}
.sv-faixa .g{grid-row:1 / span 2;grid-column:2;font-size:12px;font-weight:800;padding:4px 10px;border-radius:999px;background:var(--bx-surface-3);color:var(--bx-text-2)}
.sv-faixa .m{grid-column:1 / -1;font-size:11.5px;color:var(--bx-text-3);margin-top:4px}

.sv-dip{margin-top:12px;display:grid;grid-template-columns:minmax(0,107px) 16px minmax(0,107px);justify-content:center;gap:4px 8px;align-items:center}
.sv-dip img{width:100%;aspect-ratio:5/7;object-fit:cover;border-radius:6px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);display:block}
.sv-dip .seta{color:var(--bx-text-3);display:grid;place-items:center}
.sv-dip .cap{font-size:11px;color:var(--bx-text-3);text-align:center}

.sv-devida{margin-top:12px;font-size:13px;font-weight:700;color:var(--ac-1);font-variant-numeric:tabular-nums}
.sv-pago{margin-top:10px;font-size:12px;color:var(--bx-text-3);font-variant-numeric:tabular-nums}
.sv-acoes{position:relative;z-index:1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
.sv-btn{min-height:44px;min-width:0;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:13.5px;font-weight:700;text-decoration:none;padding:4px 12px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text);transition:transform .15s ease,background .15s ease;text-align:center;line-height:1.2}
.sv-btn svg{flex:none}
.sv-btn:hover{transform:translateY(-2px);background:var(--bx-surface-3)}
.sv-btn:focus-visible{outline:2px solid var(--ac-1);outline-offset:2px}
.sv-btn.pri{grid-column:1 / -1;min-height:48px;border:0;background:var(--ac-grad);color:var(--bx-brand-ink);font-size:14.5px;font-weight:800}
.sv-btn.full{grid-column:1 / -1}
.sv-dica{grid-column:1 / -1;font-size:11.5px;color:var(--bx-text-3);text-align:center;margin-top:-2px}

.sv-rodape{border-top:1px solid var(--bx-border);padding-top:16px;margin-top:6px;display:grid;gap:12px}
.sv-confia{display:flex;gap:10px;margin:0;font-size:12.5px;line-height:1.5;color:var(--bx-text-3)}
.sv-confia svg{flex:none;margin-top:1px}
.sv-outro{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}

.sv-bt{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:48px;padding:0 18px;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text);font:inherit;font-size:14.5px;font-weight:700;cursor:pointer;text-decoration:none;transition:transform .15s ease}
.sv-bt-pri{background:var(--ac-grad);color:var(--bx-brand-ink);border-color:transparent}
.sv-bt:hover{transform:translateY(-2px)}
.sv-vazio{display:grid;justify-items:center;gap:10px;text-align:center;padding:36px 20px;border-radius:16px;border:1px dashed var(--bx-border-2);margin-bottom:22px}
.sv-vazio h2{font-size:16px;font-weight:700;margin:0}
.sv-vazio .sv-muted{max-width:380px}
.sv-vazio-ic{width:60px;height:60px;border-radius:50%;display:grid;place-items:center;background:var(--bx-surface)}
.sv-vazio-acoes{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:6px}

.sv-sk{display:grid;gap:10px}
.sv-sk-bar,.sv-sk-card,.sv-sk-th,.sv-sk-linhas i{background:var(--bx-surface);border-radius:12px;animation:sv-pulso 1.2s ease-in-out infinite alternate}
.sv-sk-bar{height:64px;margin:-10px 0 4px;border:1px solid var(--bx-border)}
.sv-sk-card{display:grid;grid-template-columns:72px minmax(0,1fr);gap:12px;padding:14px;border:1px solid var(--bx-border);border-radius:14px}
.sv-sk-th{aspect-ratio:5/7;border-radius:6px;background:var(--bx-surface-2)}
.sv-sk-linhas{display:grid;gap:10px;align-content:start}
.sv-sk-linhas i{display:block;height:12px;border-radius:999px;background:var(--bx-surface-2)}
.sv-sk-linhas i:nth-child(1){width:45%}.sv-sk-linhas i:nth-child(2){width:70%}.sv-sk-linhas i:nth-child(3){width:100%}.sv-sk-linhas i:nth-child(4){width:60%}
@keyframes sv-pulso{from{opacity:1}to{opacity:.55}}

@media (min-width:769px){
  .sv-chips{margin:0 0 20px;padding:2px 0;scroll-padding-inline:0}
  .sv-card{padding:16px 18px}
  .sv-c-wrap{display:grid;grid-template-columns:88px minmax(0,1fr);column-gap:16px}
  .sv-c-top{display:contents}
  .sv-c-top>.sv-th{grid-row:1 / span 2}
  .sv-c-top>.sv-info,.sv-corpo{grid-column:2}
  .sv-dip{justify-content:start}
  .sv-acoes{display:flex;justify-content:flex-end;flex-wrap:wrap}
  .sv-btn.pri{min-width:240px}
  .sv-dica{flex-basis:100%;text-align:right}
  .sv-outro{display:flex}
  .sv-sk-card{grid-template-columns:88px minmax(0,1fr)}
}
@media (max-width:480px){
  .sv-vazio-acoes{width:100%}
  .sv-vazio-acoes .sv-bt{flex:1 1 100%}
}
@media (max-width:359px){
  .sv-btn{font-size:12.5px;padding:0 8px;gap:6px}
}
@media (prefers-reduced-motion:reduce){
  .sv-card,.sv-bt,.sv-btn,.sv-chip{transition:none}
  .sv-bt:hover,.sv-btn:hover{transform:none}
  .sv-sk-bar,.sv-sk-card,.sv-sk-th,.sv-sk-linhas i{animation:none}
}
`
