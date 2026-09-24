'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import { fmtBRL } from '@/lib/comissao'
import { IconBox, IconStar, IconArrowRight, IconShield, IconMarketplace, IconBolt, IconCard, IconPokeball, IconChat } from '@/components/ui/Icons'
import { pedidoEncerrado, canceladoSemCobranca, pedidoEmAndamento } from '@/lib/pedidoStatus'
import { useRouter } from 'next/navigation'

/**
 * /compras — as compras do usuario na Bynx.
 *
 * O outro lado do /minha-loja/[id]/pedidos. Le direto do Supabase — a RLS de
 * `pedidos` ja libera pro comprador e pro vendedor, entao nao precisa de rota.
 *
 * LAYOUT (redesign): titulo + subtitulo, filtros e cards ricos com
 * mini-timeline do status + CTA por estado. Zero emoji.
 *
 * ★ DUAS ORIGENS DESDE 24/09/2026 (Quadro #379, achado do Du). A pagina lia so
 * `pedidos`, que e alimentada pelo checkout da Stripe -- entao quem comprava
 * NEGOCIANDO PELO CHAT nao tinha historico nenhum. A compra negociada vive no
 * proprio anuncio (`marketplace.buyer_id` + status) e sumia da vista quando a
 * negociacao terminava. Medido no dia: 9 negociacoes com comprador definido no
 * banco e so 1 virou pedido; uma delas esta reservada desde maio, e a pessoa
 * nao tinha onde ver isso.
 *
 * ★ O QUE A NEGOCIADA NAO TEM: frete, metodo de pagamento, rastreio e numero
 * de pedido -- nada disso passou pela plataforma. O valor mostrado e o do
 * ANUNCIO, que pode nao ser o combinado no chat, e por isso nunca e chamado de
 * total pago. A linha do tempo so afirma o que a plataforma sabe.
 *
 * ★ A RLS JA PERMITE: a policy de leitura do marketplace libera a linha para
 * `auth.uid() = buyer_id`, inclusive removida. Nao precisou de rota nova.
 */

interface Pedido {
  id: string
  numero: number
  status: string
  item_nome: string
  item_imagem: string | null
  total_comprador_cents: number
  metodo: string
  rastreio: string | null
  created_at: string
  loja_id: string
  /** Null = nunca foi pago. Decide se o cancelado e checkout abandonado. */
  pago_em: string | null
}

const LABEL: Record<string, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Preparando envio',
  enviado: 'A caminho',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  reembolsado: 'Reembolsado',
}
const ORDEM: Record<string, number> = { aguardando_pagamento: -1, pago: 0, enviado: 1, entregue: 2 }
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function fmtDia(iso: string): string {
  try { const d = new Date(iso); return `${d.getDate()} ${MES[d.getMonth()]}` } catch { return '' }
}

/** Uma compra negociada pelo chat: a fonte e o proprio anuncio. */
interface Negociada {
  id: string
  slug: string | null
  card_name: string
  card_image: string | null
  price: number
  status: string
  status_em: string | null
  created_at: string
  user_id: string
}

/** O que a lista mostra, venha de onde vier. */
type Compra =
  | { tipo: 'pedido'; quando: string; p: Pedido }
  | { tipo: 'negociada'; quando: string; n: Negociada }

const LABEL_NEG: Record<string, string> = {
  em_negociacao: 'Em negociação',
  reservado: 'Reservada',
  enviado: 'A caminho',
  vendido: 'Concluída',
  concluido: 'Concluída',
}
/** O que a plataforma REALMENTE sabe sobre cada estado -- sem inventar rastreio. */
const TRILHA_NEG: Record<string, string> = {
  em_negociacao: 'Em negociação pelo chat',
  reservado: 'Reservada para você',
  enviado: 'Vendedor marcou como enviada',
  vendido: 'Negócio concluído',
  concluido: 'Negócio concluído',
}
const ORDEM_NEG: Record<string, number> = { em_negociacao: -1, reservado: 0, enviado: 1, vendido: 2, concluido: 2 }
const NEG_ANDAMENTO = ['em_negociacao', 'reservado', 'enviado']
const NEG_CONCLUIDA = ['vendido', 'concluido']
/** Os cinco estados que entram na lista (decisao do Du, 24/09). */
const NEG_STATUS = [...NEG_ANDAMENTO, ...NEG_CONCLUIDA]

type Filtro = 'todos' | 'andamento' | 'entregues' | 'cancelados'

export default function ComprasPage() {
  const router = useRouter()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [negociadas, setNegociadas] = useState<Negociada[]>([])
  const [vendedores, setVendedores] = useState<Record<string, string>>({})
  const [lojas, setLojas] = useState<Record<string, string>>({})
  const [avaliados, setAvaliados] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)
  const [semLogin, setSemLogin] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const carregar = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { setSemLogin(true); setCarregando(false); return }

    const { data } = await supabase
      .from('pedidos')
      .select('id, numero, status, item_nome, item_imagem, total_comprador_cents, metodo, rastreio, created_at, loja_id, pago_em')
      .eq('comprador_user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    const lista = (data as Pedido[]) || []
    setPedidos(lista)

    // nome das lojas (o pedido guarda so o id)
    const ids = [...new Set(lista.map(p => p.loja_id))]
    if (ids.length) {
      const { data: ls } = await supabase.from('lojas').select('id, nome').in('id', ids)
      const mapa: Record<string, string> = {}
      for (const l of ls || []) mapa[l.id] = l.nome
      setLojas(mapa)
    }

    // quais pedidos ja avaliei (pra trocar o CTA "Avaliar" -> "Ver pedido")
    const pids = lista.map(p => p.id)
    if (pids.length) {
      const { data: avs } = await supabase.from('avaliacoes').select('pedido_id').eq('avaliador_id', auth.user.id).in('pedido_id', pids)
      setAvaliados(new Set((avs || []).map(a => a.pedido_id as string)))
    }

    // ── Compras negociadas pelo chat (#379) ────────────────────────────────
    // A RLS do marketplace ja libera a linha pra quem e o buyer_id, inclusive
    // removida -- nao precisa de rota nem de service role.
    const { data: negs } = await supabase
      .from('marketplace')
      .select('id, slug, card_name, card_image, price, status, status_em, created_at, user_id')
      .eq('buyer_id', auth.user.id)
      .in('status', NEG_STATUS)
      .order('status_em', { ascending: false })
      .limit(100)
    const listaNeg = (negs || []) as Negociada[]
    setNegociadas(listaNeg)

    // Quem vendeu: o nome da loja quando existe, senao o da pessoa.
    const donos = [...new Set(listaNeg.map(n => n.user_id).filter(Boolean))]
    if (donos.length > 0) {
      const [lj, us] = await Promise.all([
        supabase.from('lojas').select('owner_user_id, nome').in('owner_user_id', donos).eq('status', 'ativa'),
        supabase.from('public_users').select('id, name').in('id', donos),
      ])
      const mapa: Record<string, string> = {}
      for (const u of us.data || []) mapa[u.id as string] = (u.name as string) || 'Vendedor'
      for (const l of lj.data || []) mapa[l.owner_user_id as string] = (l.nome as string) || mapa[l.owner_user_id as string]
      setVendedores(mapa)
    }

    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (carregando) return <Casca><div style={S.vazio}>Carregando…</div></Casca>

  if (semLogin) {
    return (
      <Casca>
        <div style={S.msgCard}>
          <div style={S.msgIco}><IconShield size={26} color="#f59e0b" /></div>
          <h2 style={S.h2}>Entre para ver suas compras</h2>
          <p style={S.txt}>Você precisa estar logado com a conta que fez a compra.</p>
        </div>
      </Casca>
    )
  }

  if (pedidos.length === 0 && negociadas.length === 0) {
    return (
      <Casca>
        <PageHeader
          trilha={[INICIO, { name: 'Compras', href: '/compras' }]}
          titulo="Minhas compras"
          descricao="Seus pedidos e o rastreio de cada um."
        />
        <div style={S.empty}>
          <div style={S.emptyIco}><IconMarketplace size={34} color="rgba(255,255,255,0.4)" /></div>
          <div style={S.emptyH}>Você ainda não comprou nada</div>
          <p style={S.emptyT}>Explore o marketplace e as lojas verificadas da Bynx. Suas compras aparecem aqui pra você acompanhar até a entrega.</p>
          <Link href="/marketplace" style={{ ...S.cta, ...S.ctaAcc, padding: '11px 20px', display: 'inline-flex', textDecoration: 'none', marginTop: 16 }}>Explorar o marketplace <IconArrowRight size={15} color="#0a0a0a" /></Link>
        </div>
      </Casca>
    )
  }

  // O numero da aba e o filtro da lista usam o MESMO predicado. Eram duas
  // listas a mao e divergiam: "A caminho" contava pago+enviado, mas a lista
  // tambem mostrava aguardando_pagamento.
  // ★ AS DUAS ORIGENS NUMA LISTA SO, em ordem de data. A negociada nao tem
  // `created_at` util (o anuncio nasceu antes da compra), entao a data que
  // vale e a do ultimo movimento de status.
  const compras: Compra[] = [
    ...pedidos.map(p => ({ tipo: 'pedido' as const, quando: p.created_at, p })),
    ...negociadas.map(n => ({ tipo: 'negociada' as const, quando: n.status_em || n.created_at, n })),
  ].sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime())

  // Um predicado so para a aba e para a lista -- eram dois e divergiam.
  const emAndamento = (c: Compra) => c.tipo === 'pedido'
    ? pedidoEmAndamento(c.p)
    : NEG_ANDAMENTO.includes(c.n.status)
  const concluida = (c: Compra) => c.tipo === 'pedido'
    ? c.p.status === 'entregue'
    : NEG_CONCLUIDA.includes(c.n.status)
  // Negociada nunca cai aqui: os cinco estados que entram na lista nao incluem
  // cancelado nem removido.
  const encerrada = (c: Compra) => c.tipo === 'pedido' && pedidoEncerrado(c.p)

  const nAndamento = compras.filter(emAndamento).length
  const nEntregues = compras.filter(concluida).length
  const nCancel = compras.filter(encerrada).length

  const visiveis = compras.filter(c => {
    if (filtro === 'andamento') return emAndamento(c)
    if (filtro === 'entregues') return concluida(c)
    if (filtro === 'cancelados') return encerrada(c)
    return true
  })

  // ★ "Em andamento" e "Concluidas" no lugar de "A caminho" e "Entregues": o
  // vocabulario de encomenda nao cabe numa compra que foi combinada no chat e
  // pode ter sido entregue em maos.
  const TABS: { k: Filtro; label: string; n: number }[] = [
    { k: 'todos', label: 'Todos', n: compras.length },
    { k: 'andamento', label: 'Em andamento', n: nAndamento },
    { k: 'entregues', label: 'Concluídas', n: nEntregues },
    // "Cancelados" e nao "Reembolsados": checkout abandonado tambem cai aqui,
    // e nele ninguem foi cobrado -- nao houve reembolso nenhum.
    { k: 'cancelados', label: 'Cancelados', n: nCancel },
  ]

  return (
    <Casca>
      <PageHeader
        trilha={[INICIO, { name: 'Compras', href: '/compras' }]}
        titulo="Minhas compras"
        descricao="Seus pedidos e as cartas que você negociou pelo chat."
        stat={negociadas.length > 0
          ? `${compras.length} ${compras.length === 1 ? 'compra' : 'compras'} · ${pedidos.length} pelo checkout, ${negociadas.length} negociada${negociadas.length !== 1 ? 's' : ''}`
          : `${pedidos.length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'} · do pagamento à entrega`}
      />

      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setFiltro(t.k)} style={{ ...S.tab, ...(filtro === t.k ? S.tabOn : {}) }}>
            {t.label} · {t.n}
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <div style={S.semFiltro}>Nenhuma compra nesse filtro.</div>
      ) : visiveis.map(c => {
        /* ── Compra negociada pelo chat ─────────────────────────────────── */
        if (c.tipo === 'negociada') {
          const n = c.n
          const idx = ORDEM_NEG[n.status] ?? -1
          const fim = NEG_CONCLUIDA.includes(n.status)
          const pill = fim ? S.pillGreen : n.status === 'enviado' ? S.pillPurple : n.status === 'reservado' ? S.pillAmber : S.pillBlue
          return (
            <div
              key={`n-${n.id}`}
              role="button"
              tabIndex={0}
              /* O ChatDock e global (AppLayout) e abre com ?conversa=<id do
                 anuncio>. Empurrar a query abre a conversa SEM sair da pagina;
                 mandar pro /marketplace tiraria a pessoa do historico dela. */
              onClick={() => router.replace(`/compras?conversa=${n.id}`, { scroll: false })}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.replace(`/compras?conversa=${n.id}`, { scroll: false }) } }}
              style={{ ...S.card, cursor: 'pointer' }}
            >
              <div style={S.thumb}>
                {n.card_image
                  ? <Image src={n.card_image} alt={n.card_name} width={72} height={100} style={{ objectFit: 'contain', borderRadius: 6 }} unoptimized />
                  : <IconPokeball size={24} color="rgba(255,255,255,0.4)" />}
              </div>

              <div style={S.mid}>
                <div style={S.nm}>
                  {n.card_name}
                  {/* Etiqueta so na negociada: sem ela, card sem etiqueta e pedido. */}
                  <span style={S.selo}><IconChat size={11} color="#93c5fd" />Negociada</span>
                </div>
                <div style={S.meta}>{vendedores[n.user_id] || 'Vendedor'} · {fmtDia(c.quando)}</div>
                <div style={S.track}>
                  {[0, 1, 2].map(i => {
                    const done = idx >= i
                    const cur = i === idx + 1
                    return (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <span style={{ ...S.dot, ...(done ? S.dotOn : cur ? S.dotCur : S.dotOff) }} />
                        {i < 2 && <span style={{ ...S.seg, background: idx > i ? '#22c55e' : 'rgba(255,255,255,0.12)' }} />}
                      </span>
                    )
                  })}
                  <span style={S.trackLbl}>{TRILHA_NEG[n.status] || LABEL_NEG[n.status] || n.status}</span>
                </div>
              </div>

              <div style={S.right}>
                <span style={{ ...S.pill, ...pill }}>{LABEL_NEG[n.status] || n.status}</span>
                {/* Valor do ANUNCIO, nao total pago: o combinado no chat pode
                    ter sido outro, e a plataforma nao viu o pagamento. */}
                <div style={S.price}>{fmtBRL(Math.round((n.price || 0) * 100))}</div>
                <span style={S.precoNota}>valor do anúncio</span>
                <span style={{ ...S.cta, ...S.ctaGhost }}>Abrir conversa</span>
              </div>
            </div>
          )
        }

        /* ── Pedido pelo checkout ───────────────────────────────────────── */
        const p = c.p
        const idx = ORDEM[p.status] ?? -1
        const morto = pedidoEncerrado(p)
        const reembolsado = p.status === 'reembolsado'
        const avaliado = avaliados.has(p.id)

        let ctaLabel = 'Acompanhar'
        let ctaAmber = false
        if (p.status === 'entregue' && !avaliado) { ctaLabel = 'Avaliar loja'; ctaAmber = true }
        else if (p.status === 'entregue' || morto) { ctaLabel = 'Ver pedido' }

        const pillStyle = morto ? S.pillRed
          : p.status === 'enviado' ? S.pillPurple
          : p.status === 'entregue' ? S.pillGreen
          : S.pillAmber

        return (
          <Link key={`p-${p.id}`} href={`/pedido/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ ...S.card, ...(morto ? S.opaco : {}) }}>
              <div style={S.thumb}>
                {p.item_imagem
                  ? <Image src={p.item_imagem} alt={p.item_nome} width={72} height={100} style={{ objectFit: 'contain', borderRadius: 6 }} unoptimized />
                  : <IconPokeball size={24} color="rgba(255,255,255,0.4)" />}
              </div>

              <div style={S.mid}>
                <div style={S.nm}>{p.item_nome}</div>
                <div style={S.meta}>{lojas[p.loja_id] || 'Loja'} · Pedido #{p.numero} · {fmtDia(p.created_at)}</div>
                {morto ? (
                  <div style={S.trackMorto}>
                    <IconArrowRight size={13} color="#f87171" />
                    <span>{reembolsado
                      ? `Reembolsado · ${fmtBRL(p.total_comprador_cents)} estornado`
                      : canceladoSemCobranca(p) ? 'Pagamento não concluído · nada foi cobrado' : 'Pedido cancelado'}</span>
                  </div>
                ) : (
                  <div style={S.track}>
                    {[0, 1, 2].map(i => {
                      const done = idx >= i
                      const cur = i === idx + 1
                      return (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <span style={{ ...S.dot, ...(done ? S.dotOn : cur ? S.dotCur : S.dotOff) }} />
                          {i < 2 && <span style={{ ...S.seg, background: idx > i ? '#22c55e' : 'rgba(255,255,255,0.12)' }} />}
                        </span>
                      )
                    })}
                    <span style={S.trackLbl}>
                      {p.status === 'enviado' && p.rastreio ? `A caminho · ${p.rastreio}` : LABEL[p.status] || p.status}
                    </span>
                  </div>
                )}
              </div>

              <div style={S.right}>
                <span style={{ ...S.pill, ...pillStyle }}>{LABEL[p.status] || p.status}</span>
                <div style={{ ...S.price, ...(morto ? { color: 'rgba(255,255,255,0.5)' } : {}) }}>{fmtBRL(p.total_comprador_cents)}</div>
                <span style={{ ...S.cta, ...(ctaAmber ? S.ctaAcc : S.ctaGhost) }}>
                  {ctaAmber && <IconStar size={13} color="#0a0a0a" />}{ctaLabel}
                </span>
              </div>
            </div>
          </Link>
        )
      })}
    </Casca>
  )
}

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout>
      <div style={S.wrap}>{children}</div>
    </AppLayout>
  )
}

const S: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 720, margin: '0 auto', padding: '4px 0 40px' },
  h1: { fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 18 },

  tabs: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  tab: { fontSize: 12.5, padding: '7px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontFamily: 'inherit' },
  tabOn: { background: 'rgba(255,255,255,0.06)', color: '#f0f0f0', border: '1px solid transparent' },

  card: { border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, background: 'rgba(255,255,255,0.02)', padding: 15, display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 },
  opaco: { opacity: 0.75 },
  thumb: { width: 72, height: 100, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#1a1030,#0f1628)', overflow: 'hidden' },
  mid: { flex: 1, minWidth: 0 },
  nm: { fontSize: 15, fontWeight: 600, lineHeight: 1.3 },
  meta: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  track: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, flexWrap: 'wrap' },
  dot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' },
  dotOn: { background: '#22c55e' },
  dotCur: { background: '#f59e0b', boxShadow: '0 0 0 3px rgba(245,158,11,0.2)' },
  dotOff: { background: 'rgba(255,255,255,0.15)' },
  seg: { width: 22, height: 2, borderRadius: 2, display: 'inline-block', margin: '0 1px' },
  trackLbl: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 },
  trackMorto: { display: 'flex', alignItems: 'center', gap: 5, marginTop: 9, fontSize: 11, color: 'rgba(255,255,255,0.55)' },

  right: { textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 },
  pill: { fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' },
  pillAmber: { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' },
  pillPurple: { background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' },
  pillGreen: { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' },
  pillRed: { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' },
  price: { fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap' },
  precoNota: { fontSize: 10.5, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', marginTop: -6 },
  selo: {
    display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle', marginLeft: 8,
    fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
    padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap',
    background: 'rgba(96,165,250,0.13)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.3)',
  },
  pillBlue: { background: 'rgba(96,165,250,0.12)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.3)' },
  cta: { borderRadius: 9, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' },
  ctaAcc: { background: 'linear-gradient(90deg,#f59e0b,#ef4444)', color: '#0a0a0a' },
  ctaGhost: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)' },

  semFiltro: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 30, fontSize: 13 },

  empty: { border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 16, padding: '36px 20px', textAlign: 'center', marginTop: 18 },
  emptyIco: { width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
  emptyH: { fontSize: 16, fontWeight: 600 },
  emptyT: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4, maxWidth: 340, marginInline: 'auto', lineHeight: 1.5 },

  msgCard: { maxWidth: 460, margin: '10px auto 0', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '28px 24px', textAlign: 'center' },
  msgIco: { width: 52, height: 52, borderRadius: '50%', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' },
  h2: { fontSize: 17, fontWeight: 800, margin: '10px 0 6px' },
  txt: { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55, maxWidth: 380, margin: '0 auto' },

  vazio: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 40, fontSize: 14 },
}
