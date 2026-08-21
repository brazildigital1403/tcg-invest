import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * src/app/api/admin/users/[id]/atividades/route.ts
 *
 * Feed de atividades do usuário no admin (pedido do Du, 12/08/2026).
 *
 * Não existe log de eventos na Bynx hoje (PostHog é gateado por consentimento
 * LGPD, e cobre só quem aceitou cookie — não é fonte confiável pra "o que
 * TODOS os usuários fazem"). Este endpoint junta o que já tem timestamp
 * confiável em tabela própria: cartas adicionadas, pastas criadas, anúncios
 * no marketplace, compras/vendas on-site, tickets de suporte, indicações que
 * viraram cadastro e itens na watchlist. Scan não entra — não é logado
 * individualmente hoje, só o contador de créditos.
 */

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

type Evento = {
  tipo: string
  quando: string
  titulo: string
  detalhe?: string
}

// `user_cards`/`marketplace` guardam created_at como timestamp SEM timezone —
// o Supabase serializa sem 'Z', e o browser interpretaria como hora local
// (deslocamento de horas). Normaliza pra UTC explícito antes de mandar pro
// client, mesmo padrão que o Postgres já usa por baixo.
function toIsoUtc(raw: string | null): string | null {
  if (!raw) return null
  if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(raw)) return raw
  return raw.replace(' ', 'T') + 'Z'
}

function fmtBRL(cents: number | null): string {
  if (!cents) return 'R$ 0,00'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const sb = supabaseAdmin()

    const [
      cardsRes, pastasRes, anunciosRes, comprasRes, vendasRes, ticketsRes, refsRes, watchlistRes,
    ] = await Promise.all([
      sb.from('user_cards').select('id, card_id, pokemon_api_id, quantity, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(15),
      sb.from('pastas').select('id, nome, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
      sb.from('marketplace').select('id, card_id, price, status, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(15),
      sb.from('pedidos').select('id, item_nome, total_comprador_cents, status, created_at').eq('comprador_user_id', id).order('created_at', { ascending: false }).limit(10),
      sb.from('pedidos').select('id, item_nome, liquido_loja_cents, status, created_at').eq('vendedor_user_id', id).order('created_at', { ascending: false }).limit(10),
      sb.from('tickets').select('id, subject, status, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
      sb.from('referrals').select('id, cadastrou_at, status').eq('referrer_user_id', id).not('cadastrou_at', 'is', null).order('cadastrou_at', { ascending: false }).limit(10),
      sb.from('watchlist').select('id, card_id, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
    ])

    // Nomes de carta — 1 query batelada pros ids usados em cartas/anúncios/watchlist,
    // em vez de N+1.
    const cardIds = new Set<string>()
    for (const c of cardsRes.data || []) if (c.pokemon_api_id) cardIds.add(c.pokemon_api_id)
    for (const a of anunciosRes.data || []) if (a.card_id) cardIds.add(a.card_id)
    for (const w of watchlistRes.data || []) if (w.card_id) cardIds.add(w.card_id)

    const cardNameMap = new Map<string, string>()
    if (cardIds.size > 0) {
      const { data: cards } = await sb.from('pokemon_cards').select('id, name').in('id', Array.from(cardIds))
      for (const c of cards || []) cardNameMap.set(c.id, c.name)
    }

    const eventos: Evento[] = []

    for (const c of cardsRes.data || []) {
      const quando = toIsoUtc(c.created_at)
      if (!quando) continue
      const nome = (c.pokemon_api_id && cardNameMap.get(c.pokemon_api_id)) || c.card_id
      eventos.push({ tipo: 'carta', quando, titulo: 'Adicionou carta à coleção', detalhe: `${nome}${c.quantity > 1 ? ` ×${c.quantity}` : ''}` })
    }
    for (const p of pastasRes.data || []) {
      const quando = toIsoUtc(p.created_at)
      if (!quando) continue
      eventos.push({ tipo: 'pasta', quando, titulo: 'Criou uma pasta', detalhe: p.nome || undefined })
    }
    for (const a of anunciosRes.data || []) {
      const quando = toIsoUtc(a.created_at)
      if (!quando) continue
      const nome = (a.card_id && cardNameMap.get(a.card_id)) || a.card_id
      eventos.push({ tipo: 'anuncio', quando, titulo: 'Anunciou carta no marketplace', detalhe: `${nome} · ${fmtBRL(Math.round((a.price || 0) * 100))} · ${a.status}` })
    }
    for (const c of comprasRes.data || []) {
      const quando = toIsoUtc(c.created_at)
      if (!quando) continue
      eventos.push({ tipo: 'compra', quando, titulo: 'Comprou na Bynx', detalhe: `${c.item_nome} · ${fmtBRL(c.total_comprador_cents)} · ${c.status}` })
    }
    for (const v of vendasRes.data || []) {
      const quando = toIsoUtc(v.created_at)
      if (!quando) continue
      eventos.push({ tipo: 'venda', quando, titulo: 'Vendeu na Bynx', detalhe: `${v.item_nome} · ${fmtBRL(v.liquido_loja_cents)} · ${v.status}` })
    }
    for (const t of ticketsRes.data || []) {
      const quando = toIsoUtc(t.created_at)
      if (!quando) continue
      eventos.push({ tipo: 'ticket', quando, titulo: 'Abriu ticket de suporte', detalhe: `${t.subject || 'sem assunto'} · ${t.status}` })
    }
    for (const r of refsRes.data || []) {
      const quando = toIsoUtc(r.cadastrou_at)
      if (!quando) continue
      eventos.push({ tipo: 'indicacao', quando, titulo: 'Indicação virou cadastro', detalhe: r.status || undefined })
    }
    for (const w of watchlistRes.data || []) {
      const quando = toIsoUtc(w.created_at)
      if (!quando) continue
      const nome = (w.card_id && cardNameMap.get(w.card_id)) || w.card_id
      eventos.push({ tipo: 'watchlist', quando, titulo: 'Começou a acompanhar preço', detalhe: nome })
    }

    eventos.sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime())

    return NextResponse.json({ eventos: eventos.slice(0, 60) })
  } catch (err: any) {
    console.error('[admin/users/[id]/atividades GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
