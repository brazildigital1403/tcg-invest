'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/ui/AppLayout'
import { fmtBRL } from '@/lib/comissao'
import { IconBox, IconStar, IconArrowRight, IconShield, IconMarketplace, IconBolt, IconCard, IconPokeball } from '@/components/ui/Icons'

/**
 * /compras — as compras do usuario na Bynx.
 *
 * O outro lado do /minha-loja/[id]/pedidos. Le direto do Supabase — a RLS de
 * `pedidos` ja libera pro comprador e pro vendedor, entao nao precisa de rota.
 *
 * LAYOUT (redesign): titulo + subtitulo, filtros (Todos / A caminho / Entregues
 * / Reembolsados) e cards ricos com mini-timeline do status + CTA por estado
 * (Acompanhar / Avaliar / Ver pedido). O card inteiro leva pro /pedido/[id],
 * onde ficam as acoes de verdade (confirmar recebimento, avaliar). Zero emoji.
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

type Filtro = 'todos' | 'andamento' | 'entregues' | 'reembolsados'

export default function ComprasPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
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
      .select('id, numero, status, item_nome, item_imagem, total_comprador_cents, metodo, rastreio, created_at, loja_id')
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

  if (pedidos.length === 0) {
    return (
      <Casca>
        <h1 style={S.h1}>Minhas compras</h1>
        <div style={S.empty}>
          <div style={S.emptyIco}><IconMarketplace size={34} color="rgba(255,255,255,0.4)" /></div>
          <div style={S.emptyH}>Você ainda não comprou nada</div>
          <p style={S.emptyT}>Explore o marketplace e as lojas verificadas da Bynx. Suas compras aparecem aqui pra você acompanhar até a entrega.</p>
          <Link href="/marketplace" style={{ ...S.cta, ...S.ctaAcc, padding: '11px 20px', display: 'inline-flex', textDecoration: 'none', marginTop: 16 }}>Explorar o marketplace <IconArrowRight size={15} color="#0a0a0a" /></Link>
        </div>
      </Casca>
    )
  }

  const nAndamento = pedidos.filter(p => ['pago', 'enviado'].includes(p.status)).length
  const nEntregues = pedidos.filter(p => p.status === 'entregue').length
  const nReemb = pedidos.filter(p => ['cancelado', 'reembolsado'].includes(p.status)).length

  const visiveis = pedidos.filter(p => {
    if (filtro === 'andamento') return ['pago', 'enviado', 'aguardando_pagamento'].includes(p.status)
    if (filtro === 'entregues') return p.status === 'entregue'
    if (filtro === 'reembolsados') return ['cancelado', 'reembolsado'].includes(p.status)
    return true
  })

  const TABS: { k: Filtro; label: string; n: number }[] = [
    { k: 'todos', label: 'Todos', n: pedidos.length },
    { k: 'andamento', label: 'A caminho', n: nAndamento },
    { k: 'entregues', label: 'Entregues', n: nEntregues },
    { k: 'reembolsados', label: 'Reembolsados', n: nReemb },
  ]

  return (
    <Casca>
      <h1 style={S.h1}>Minhas compras</h1>
      <p style={S.sub}>Acompanhe tudo que você comprou nas lojas da Bynx — do pagamento à entrega.</p>

      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setFiltro(t.k)} style={{ ...S.tab, ...(filtro === t.k ? S.tabOn : {}) }}>
            {t.label} · {t.n}
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <div style={S.semFiltro}>Nenhum pedido nesse filtro.</div>
      ) : visiveis.map(p => {
        const idx = ORDEM[p.status] ?? -1
        const morto = ['cancelado', 'reembolsado'].includes(p.status)
        const reembolsado = p.status === 'reembolsado'
        const avaliado = avaliados.has(p.id)

        // CTA por estado
        let ctaLabel = 'Acompanhar'
        let ctaAmber = false
        if (p.status === 'entregue' && !avaliado) { ctaLabel = 'Avaliar loja'; ctaAmber = true }
        else if (p.status === 'entregue' || morto) { ctaLabel = 'Ver pedido' }

        const pillStyle = morto ? S.pillRed
          : p.status === 'enviado' ? S.pillPurple
          : p.status === 'entregue' ? S.pillGreen
          : S.pillAmber

        return (
          <Link key={p.id} href={`/pedido/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ ...S.card, ...(morto ? S.opaco : {}) }}>
              <div style={S.thumb}>
                {p.item_imagem
                  ? <Image src={p.item_imagem} alt={p.item_nome} width={52} height={72} style={{ objectFit: 'contain', borderRadius: 6 }} unoptimized />
                  : <IconPokeball size={20} color="rgba(255,255,255,0.4)" />}
              </div>

              <div style={S.mid}>
                <div style={S.nm}>{p.item_nome}</div>
                <div style={S.meta}>{lojas[p.loja_id] || 'Loja'} · Pedido #{p.numero} · {fmtDia(p.created_at)}</div>
                {morto ? (
                  <div style={S.trackMorto}>
                    <IconArrowRight size={13} color="#f87171" />
                    <span>{reembolsado ? `Reembolsado · ${fmtBRL(p.total_comprador_cents)} estornado` : 'Pedido cancelado'}</span>
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
  thumb: { width: 52, height: 72, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#1a1030,#0f1628)', overflow: 'hidden' },
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
