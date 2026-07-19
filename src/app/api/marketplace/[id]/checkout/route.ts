import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { calcularCheckout, normalizarPrazo, ehMetodoValido, PIX_DISPONIVEL, type MetodoPagamento } from '@/lib/comissao'
import { cotarFrete, pacoteDeCarta } from '@/lib/melhor-envio'

/**
 * POST /api/marketplace/[id]/checkout
 * body: { metodo: 'pix' | 'cartao', cep?, servico? }
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
 * FRETE: 'fixo' usa o valor da loja; 'calculado' RE-COTA no servidor (Melhor
 * Envio) com o CEP do comprador + o servico escolhido — nunca confiamos no preco
 * que veio do cliente.
 *
 * Auth: comprador logado (Bearer). Guards: anuncio disponivel, loja ativa com
 * recebimentos liberados, e ninguem compra do proprio anuncio.
 */

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

function digits(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '')
}

/**
 * GET /api/marketplace/[id]/checkout
 * Dados pra montar a tela: item + regras da loja (frete, prazo).
 * A pagina calcula os totais com a MESMA lib (@/lib/comissao) — nao duplicamos
 * a regra de preco no cliente.
 * Nao exige login: o visitante pode ver o preco antes de entrar.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: anuncioId } = await ctx.params
    const db = sb()

    const { data: anuncios } = await db
      .from('marketplace')
      .select('id, user_id, card_id, card_name, card_image, price, status, condicao, fotos, graduada, graduadora, nota')
      .eq('id', anuncioId)
      .limit(1)

    const anuncio = anuncios?.[0]
    if (!anuncio) return NextResponse.json({ error: 'Anúncio não encontrado.' }, { status: 404 })

    const { data: lojas } = await db
      .from('lojas')
      .select('id, nome, slug, logo_url, verificada, connect_charges_enabled, repasse_prazo, frete_cents, frete_gratis_acima_cents, frete_modo, cep')
      .eq('owner_user_id', anuncio.user_id)
      .eq('status', 'ativa')
      .limit(1)

    const loja = lojas?.[0] || null
    const podeVender = !!loja?.connect_charges_enabled

    return NextResponse.json({
      item: {
        id: anuncio.id,
        nome: anuncio.card_name,
        imagem: anuncio.card_image || (Array.isArray(anuncio.fotos) ? anuncio.fotos[0] : null),
        preco_cents: Math.round(Number(anuncio.price) * 100),
        condicao: anuncio.condicao,
        graduada: anuncio.graduada,
        graduadora: anuncio.graduadora,
        nota: anuncio.nota,
        disponivel: anuncio.status === 'disponivel',
        vendedor_user_id: anuncio.user_id,
      },
      loja: loja
        ? {
            nome: loja.nome,
            slug: loja.slug,
            logo_url: loja.logo_url,
            verificada: loja.verificada,
            frete_cents: loja.frete_cents || 0,
            frete_gratis_acima_cents: loja.frete_gratis_acima_cents,
            frete_modo: loja.frete_modo || 'fixo',
            repasse_prazo: normalizarPrazo(loja.repasse_prazo),
            pode_vender: podeVender,
          }
        : null,
    })
  } catch (err) {
    console.error('[checkout GET] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
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

    // Trava de seguranca: a UI ja esconde o Pix, mas alguem pode postar direto.
    // Melhor recusar aqui do que deixar a Stripe estourar depois de criar o pedido.
    if (metodo === 'pix' && !PIX_DISPONIVEL) {
      return NextResponse.json(
        { error: 'O Pix ainda não está disponível na Bynx. Use cartão por enquanto.' },
        { status: 409 }
      )
    }

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
      .select('id, nome, slug, status, owner_user_id, stripe_connect_account_id, stripe_connect_status, connect_charges_enabled, repasse_prazo, frete_cents, frete_gratis_acima_cents, frete_modo, cep')
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

    // ── Frete: fixo (loja) OU calculado (re-cotacao no servidor) ──────────
    // Vai INTEGRAL pra loja (nao entra na comissao).
    let freteCents = 0
    let freteLabel = `Frete — ${loja.nome}`

    if (loja.frete_modo === 'calculado') {
      const cepDest = digits(body?.cep)
      const servicoId = Number(body?.servico)
      if (cepDest.length !== 8) {
        return NextResponse.json({ error: 'Informe um CEP de entrega válido.' }, { status: 400 })
      }
      if (!servicoId) {
        return NextResponse.json({ error: 'Escolha uma opção de frete.' }, { status: 400 })
      }
      if (digits(loja.cep).length !== 8) {
        return NextResponse.json({ error: 'A loja ainda não configurou o CEP de origem.' }, { status: 409 })
      }
      try {
        const opcoes = await cotarFrete(loja.cep, cepDest, [pacoteDeCarta(valorCents)])
        const escolhido = opcoes.find(o => o.id === servicoId)
        if (!escolhido) {
          return NextResponse.json(
            { error: 'Essa opção de frete não está mais disponível. Calcule o frete de novo.' },
            { status: 409 }
          )
        }
        freteCents = escolhido.precoCents
        freteLabel = `Frete — ${escolhido.empresa} ${escolhido.nome}`.trim()
      } catch (e) {
        console.error('[checkout] cotacao falhou:', (e as Error)?.message)
        return NextResponse.json({ error: 'Não consegui calcular o frete agora. Tente de novo.' }, { status: 502 })
      }
    } else {
      const freteBase = Math.max(0, loja.frete_cents || 0)
      const limiteGratis = loja.frete_gratis_acima_cents
      freteCents = limiteGratis != null && valorCents >= limiteGratis ? 0 : freteBase
    }

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
    if (freteCents > 0) linhas.push(brl(freteCents, freteLabel))

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        // Fixo no metodo escolhido: o preco ja embute o acrescimo dele.
        payment_method_types: [metodo === 'pix' ? 'pix' : 'card'],
        line_items: linhas,
        // A loja precisa saber pra onde enviar. A Stripe coleta e devolve em
        // session.customer_details / collected_information — o webhook grava no pedido.
        shipping_address_collection: { allowed_countries: ['BR'] },
        phone_number_collection: { enabled: true },
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
