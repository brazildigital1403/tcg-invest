import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  sendNovaNegociacaoEmail,
  sendCartaEnviadaEmail,
  sendNegociacaoConcluidaEmail,
} from '@/lib/email'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  )
}

type Tipo = 'interesse' | 'enviado' | 'concluido'
const TIPOS: Tipo[] = ['interesse', 'enviado', 'concluido']

/**
 * POST /api/marketplace/[id]/marco  body: { tipo }
 *
 * Dispara o email transacional do marco para a contraparte:
 *  - interesse  -> comprador abriu negociacao  -> email para o VENDEDOR
 *  - enviado    -> vendedor confirmou envio     -> email para o COMPRADOR
 *  - concluido  -> comprador confirmou recebido  -> email para o VENDEDOR
 *
 * Auth: Bearer <access_token> do usuario logado (Supabase).
 * O servidor valida que o autor tem o papel correto para aquele marco.
 * Falhas de email nunca derrubam a acao do usuario (fire-and-forget no client).
 *
 * Item 2 (sino): aqui tambem entra o notify() para a contraparte.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({} as any))
    const tipo = body?.tipo as Tipo
    if (!TIPOS.includes(tipo)) {
      return NextResponse.json({ error: 'tipo invalido' }, { status: 400 })
    }

    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const sb = supabaseAdmin()
    const { data: authData, error: authErr } = await sb.auth.getUser(token)
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: 'Token invalido' }, { status: 401 })
    }
    const uid = authData.user.id

    const { data: anuncio } = await sb
      .from('marketplace')
      .select('id, user_id, buyer_id, card_name, price, status')
      .eq('id', id)
      .single()
    if (!anuncio) return NextResponse.json({ error: 'Anuncio nao encontrado' }, { status: 404 })

    const sellerId = anuncio.user_id as string
    const buyerId = (anuncio.buyer_id as string | null) || null

    // valida papel x tipo + define destinatario do email
    let destinatarioId: string | null = null
    if (tipo === 'interesse') {
      if (uid !== buyerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      destinatarioId = sellerId
    } else if (tipo === 'enviado') {
      if (uid !== sellerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      destinatarioId = buyerId
    } else if (tipo === 'concluido') {
      if (uid !== buyerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      destinatarioId = sellerId
    }
    if (!destinatarioId) return NextResponse.json({ error: 'sem destinatario' }, { status: 400 })

    const ids = [sellerId, buyerId].filter(Boolean) as string[]
    const { data: usrs } = await sb.from('users').select('id, name, email').in('id', ids)
    const byId = new Map((usrs || []).map((u) => [u.id, u]))
    const seller = byId.get(sellerId)
    const buyer = buyerId ? byId.get(buyerId) : null
    const dest = byId.get(destinatarioId)

    if (!dest?.email) {
      return NextResponse.json({ ok: true, emailed: false, reason: 'sem email' })
    }

    const card = anuncio.card_name || 'sua carta'
    const price = (anuncio.price ?? null) as number | null

    if (tipo === 'interesse') {
      await sendNovaNegociacaoEmail({
        to: dest.email, sellerName: seller?.name || '', buyerName: buyer?.name || '',
        cardName: card, price, anuncioId: anuncio.id,
      }).catch(() => {})
    } else if (tipo === 'enviado') {
      await sendCartaEnviadaEmail({
        to: dest.email, buyerName: buyer?.name || '', sellerName: seller?.name || '',
        cardName: card, anuncioId: anuncio.id,
      }).catch(() => {})
    } else if (tipo === 'concluido') {
      await sendNegociacaoConcluidaEmail({
        to: dest.email, sellerName: seller?.name || '', buyerName: buyer?.name || '',
        cardName: card, price, anuncioId: anuncio.id,
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, emailed: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'erro' }, { status: 500 })
  }
}
