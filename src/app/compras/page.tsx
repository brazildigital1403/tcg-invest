'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { fmtBRL } from '@/lib/comissao'

/**
 * /compras — as compras do usuario na Bynx.
 *
 * O outro lado do /minha-loja/[id]/pedidos. Antes disso, o comprador so tinha
 * o link do pedido que chegou por email: se perdesse o email, perdia o rastreio.
 *
 * Le direto do Supabase — a RLS de `pedidos` ja libera pro comprador e pro
 * vendedor, entao nao precisa de rota.
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
const ICONE: Record<string, string> = {
  aguardando_pagamento: '⏳', pago: '📋', enviado: '📦', entregue: '🏠',
  cancelado: '✕', reembolsado: '↩️',
}

export default function ComprasPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [lojas, setLojas] = useState<Record<string, string>>({})
  const [carregando, setCarregando] = useState(true)
  const [semLogin, setSemLogin] = useState(false)

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
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (carregando) return <Casca><div style={S.vazio}>Carregando…</div></Casca>

  if (semLogin) {
    return (
      <Casca>
        <div style={S.card}>
          <div style={{ textAlign: 'center', padding: '14px 0' }}>
            <div style={{ fontSize: 34 }}>🔒</div>
            <h2 style={S.h2}>Entre para ver suas compras</h2>
            <p style={S.txt}>Você precisa estar logado com a conta que fez a compra.</p>
          </div>
        </div>
      </Casca>
    )
  }

  if (pedidos.length === 0) {
    return (
      <Casca>
        <div style={S.card}>
          <div style={{ textAlign: 'center', padding: '28px 16px' }}>
            <div style={{ fontSize: 36 }}>🛍️</div>
            <h2 style={S.h2}>Você ainda não comprou nada</h2>
            <p style={S.txt}>Quando você comprar de uma loja na Bynx, o pedido aparece aqui com o status do envio e o código de rastreio.</p>
            <Link href="/lojas" style={{ ...S.cta, display: 'inline-block', textDecoration: 'none', marginTop: 14 }}>
              Ver lojas
            </Link>
          </div>
        </div>
      </Casca>
    )
  }

  const emAndamento = pedidos.filter(p => ['pago', 'enviado'].includes(p.status)).length

  return (
    <Casca>
      <h1 style={S.h1}>Minhas compras</h1>
      <p style={S.sub}>
        {emAndamento > 0
          ? `${emAndamento} pedido${emAndamento > 1 ? 's' : ''} a caminho · ${pedidos.length} no total`
          : `${pedidos.length} pedido${pedidos.length > 1 ? 's' : ''}`}
      </p>

      {pedidos.map(p => {
        const ativo = ['pago', 'enviado'].includes(p.status)
        const morto = ['cancelado', 'reembolsado'].includes(p.status)
        return (
          <Link key={p.id} href={`/pedido/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ ...S.card, marginBottom: 10, padding: 14, ...(morto ? S.opaco : {}), ...(ativo ? S.destaque : {}) }}>
              <div style={S.top}>
                <span style={S.num}>#{p.numero}</span>
                <span style={{ ...S.pill, ...(morto ? S.pillOff : ativo ? S.pillOn : S.pillOk) }}>
                  {ICONE[p.status]} {LABEL[p.status] || p.status}
                </span>
              </div>
              <div style={S.lin}>
                <div style={S.th}>
                  {p.item_imagem
                    ? <Image src={p.item_imagem} alt={p.item_nome} width={42} height={58} style={{ objectFit: 'contain', borderRadius: 5 }} unoptimized />
                    : <span style={{ fontSize: 18 }}>🎴</span>}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={S.ln}>{p.item_nome}</div>
                  <div style={S.ls}>
                    {lojas[p.loja_id] || 'Loja'} · {new Date(p.created_at).toLocaleDateString('pt-BR')}
                    {p.rastreio && <> · 📦 {p.rastreio}</>}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={S.lp}>{fmtBRL(p.total_comprador_cents)}</div>
                  <div style={S.lm}>{p.metodo === 'pix' ? '⚡ Pix' : '💳 Cartão'}</div>
                </div>
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
    <div style={S.page}>
      <div style={S.wrap}>{children}</div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#080a0f', color: '#f0f0f0', padding: '26px 18px 60px' },
  wrap: { maxWidth: 620, margin: '0 auto' },
  h1: { fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 18 },
  card: { background: '#0d0f14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20 },
  destaque: { borderColor: 'rgba(96,165,250,0.25)' },
  opaco: { opacity: 0.55 },
  top: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  num: { fontSize: 11.5, fontWeight: 800, color: 'rgba(255,255,255,0.4)' },
  pill: { fontSize: 10, fontWeight: 800, padding: '4px 9px', borderRadius: 20 },
  pillOn: { background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' },
  pillOk: { background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' },
  pillOff: { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' },
  lin: { display: 'flex', gap: 11, alignItems: 'center' },
  th: { width: 42, height: 58, borderRadius: 5, background: 'linear-gradient(135deg,#1a1030,#0f1628)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  ln: { fontSize: 13, fontWeight: 700, lineHeight: 1.3 },
  ls: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  lp: { fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap' },
  lm: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 },
  h2: { fontSize: 17, fontWeight: 800, margin: '10px 0 6px' },
  txt: { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55, maxWidth: 380, margin: '0 auto' },
  cta: { fontSize: 13.5, fontWeight: 800, padding: '11px 22px', borderRadius: 11, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#a855f7,#ec4899)', color: '#fff' },
  vazio: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 40, fontSize: 14 },
}
