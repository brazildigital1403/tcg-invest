import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { calcularCheckout, normalizarPrazo, ehMetodoValido, type MetodoPagamento } from '@/lib/comissao'

/**
 * POST /api/marketplace/[id]/checkout
 * body: { metodo: 'pix' | 'cartao' }
 *
 * Cria o pedido + a Stripe Checkout Session com SPLIT (destination charge):
 *   - application_fee_amount -> comissao da Bynx (comissao do vendedor + acrescimo do comprador)
 *   - transfer_data.destination -> conta Connect da loja (fica com o item + o frete)
 *
 * O metodo importa no PRECO: Pix +R$0,99 / cartao +4,8% (modelo "Liga nos dois
 * lados"). Por isso `payment_method_types` e FIXO no metodo escolhido — deixar a
 * Stripe oferecer os dois deixaria o comprador pagar o acrescimo de um e usar o
 * outro.
 *
 * Auth: comprador logado (Bearer). Guards: anuncio disponivel, loja ativa com
 * recebimentos liberados, e ninguem compra do proprio anuncio.
 */

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: anuncioId } = await ctx.params

    // ── Auth do comprador ───────────────────────────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Faça login para comprar.' }, { status: 401 })

    const db = sb()
    const { data: authData, error: authErr } = await db.auth.getUser(token)
    const compradorId = authData?.user?.id
    if (authErr || !compradorId) {
      return NextResponse.json({ error: 'Sessão expirada. Entre de novo.' }, { status: 401 })
    }

    // ── Metodo ──────────────────────────────────────────────────────────
    const body = await req.json().catch(() => null)
    const metodo: MetodoPagamento = ehMetodoValido(body?.metodo) ? body.metodo : 'cartao'

    // ── Anuncio ─────────────────────────────────────────────────────────
    const { data: anuncios } = await db
      .from('marketplace')
      .select('id, user_id, card_id, card_name, card_image, price, status, condicao, fotos')
      .eq('id', anuncioId)
      .limit(1)

    const anuncio = anuncios?.[0]
    if (!anuncio) return NextResponse.json({ error: 'Anúncio não encontrado.' }, { status: 404 })
    if (anuncio.status !== 'disponivel') {
      return NextResponse.json({ error: 'Esse anúncio não está mais disponível.' }, { status: 409 })
    }
    if (anuncio.user_id === compradorId) {
      return NextResponse.json({ error: 'Você não pode comprar o seu próprio anúncio.' }, { status: 400 })
    }

    // ── Loja do vendedor (o vinculo e por owner_user_id) ─────────────────
    const { data: lojas } = await db
      .from('lojas')
      .select('id, nome, slug, status, owner_user_id, stripe_connect_account_id, stripe_connect_status, connect_charges_enabled, repasse_prazo, frete_cents, frete_gratis_acima_cents')
      .eq('owner_user_id', anuncio.user_id)
      .eq('status', 'ativa')
      .limit(1)

    const loja = lojas?.[0]
    if (!loja) {
      return NextResponse.json(
        { error: 'Esse vendedor ainda não vende pela Bynx. Use "Tenho interesse" para negociar.' },
        { status: 409 }
      )
    }
    if (!loja.stripe_connect_account_id || !loja.connect_charges_enabled) {
      return NextResponse.json(
        { error: 'Essa loja ainda está ativando os recebimentos. Tente de novo em breve.' },
        { status: 409 }
      )
    }

    // ── Dinheiro ────────────────────────────────────────────────────────
    const valorCents = Math.round(Number(anuncio.price) * 100)
    if (!Number.isFinite(valorCents) || valorCents <= 0) {
      return NextResponse.json({ error: 'Preço inválido no anúncio.' }, { status: 400 })
    }

    const prazo = normalizarPrazo(loja.repasse_prazo)
    const c = calcularCheckout(valorCents, prazo, metodo)

    // Frete: fixo da loja, com regra opcional de gratis acima de X.
    // Vai INTEGRAL pra loja (nao entra na comissao).
    const freteBase = Math.max(0, loja.frete_cents || 0)
    const limiteGratis = loja.frete_gratis_acima_cents
    const freteCents = limiteGratis != null && valorCents >= limiteGratis ? 0 : freteBase

    const totalCompradorCents = c.totalCompradorCents + freteCents
    const liquidoLojaCents = c.liquidoLojaCents + freteCents

    // ── Pedido (aguardando pagamento) ───────────────────────────────────
    const { data: pedidoIns, error: pedErr } = await db
      .from('pedidos')
      .insert({
        loja_id: loja.id,
        vendedor_user_id: anuncio.user_id,
        comprador_user_id: compradorId,
        marketplace_id: anuncio.id,
        item_nome: anuncio.card_name,
        item_imagem: anuncio.card_image || (Array.isArray(anuncio.fotos) ? anuncio.fotos[0] : null),
        item_card_id: anuncio.card_id,
        valor_item_cents: valorCents,
        frete_cents: freteCents,
        acrescimo_cents: c.acrescimoCents,
        total_comprador_cents: totalCompradorCents,
        comissao_bynx_cents: c.taxaBynxCents,
        liquido_loja_cents: liquidoLojaCents,
        metodo,
        repasse_prazo: prazo,
        stripe_connect_account_id: loja.stripe_connect_account_id,
        status: 'aguardando_pagamento',
      })
      .select('id, numero')
      .single()

    if (pedErr || !pedidoIns) {
      console.error('[checkout] falha criando pedido:', pedErr?.message)
      return NextResponse.json({ error: 'Erro ao iniciar a compra.' }, { status: 500 })
    }

    // ── Stripe Checkout Session ─────────────────────────────────────────
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Pagamentos indisponíveis no momento.' }, { status: 500 })
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' })
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'

    const brl = (unit: number, nome: string) => ({
      price_data: { currency: 'brl', unit_amount: unit, product_data: { name: nome } },
      quantity: 1,
    })

    const linhas: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      brl(valorCents, `${anuncio.card_name}${anuncio.condicao ? ` (${anuncio.condicao})` : ''}`),
    ]
    if (c.acrescimoCents > 0) {
      linhas.push(brl(c.acrescimoCents, metodo === 'pix' ? 'Taxa do Pix' : 'Acréscimo do cartão'))
    }
    if (freteCents > 0) linhas.push(brl(freteCents, `Frete — ${loja.nome}`))

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        // Fixo no metodo escolhido: o preco ja embute o acrescimo dele.
        payment_method_types: [metodo === 'pix' ? 'pix' : 'card'],
        line_items: linhas,
        client_reference_id: String(pedidoIns.id),
        metadata: {
          bynx_pedido_id: String(pedidoIns.id),
          bynx_anuncio_id: String(anuncio.id),
          bynx_loja_id: String(loja.id),
        },
        payment_intent_data: {
          application_fee_amount: c.taxaBynxCents,
          transfer_data: { destination: loja.stripe_connect_account_id },
          metadata: { bynx_pedido_id: String(pedidoIns.id) },
        },
        success_url: `${base}/pedido/${pedidoIns.id}?ok=1`,
        cancel_url: `${base}/checkout/${anuncio.id}?cancelado=1`,
      })

      await db
        .from('pedidos')
        .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
        .eq('id', pedidoIns.id)

      return NextResponse.json({ url: session.url, pedido_id: pedidoIns.id })
    } catch (e) {
      const msg = (e as Error)?.message || ''
      console.error('[checkout] Stripe recusou:', msg)
      // Some o pedido orfao pra nao poluir a lista do lojista.
      await db.from('pedidos').delete().eq('id', pedidoIns.id)

      const pixIndisponivel = metodo === 'pix' && /pix/i.test(msg) && /(not activated|invalid|payment_method_types)/i.test(msg)
      return NextResponse.json(
        {
          error: pixIndisponivel
            ? 'O Pix ainda não está disponível na Bynx. Escolha cartão por enquanto.'
            : 'Não foi possível iniciar o pagamento. Tente de novo.',
        },
        { status: 502 }
      )
    }
  } catch (err) {
    console.error('[checkout] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
