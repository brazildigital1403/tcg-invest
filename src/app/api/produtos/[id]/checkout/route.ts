import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { calcularCheckout, normalizarPrazo, ehMetodoValido, PIX_DISPONIVEL, type MetodoPagamento } from '@/lib/comissao'
import { cotarFrete, pacoteDeProduto } from '@/lib/melhor-envio'

/**
 * Checkout de PRODUTO da loja (selado/pelucia/funko/fichario/acessorio).
 *
 * Irma da /api/marketplace/[id]/checkout (que vende CARTA). O encanamento e
 * parecido, mas as regras diferem no que importa:
 *   - carta  -> `status='disponivel'`, 1 unidade, some ao vender
 *   - produto-> `ativo && estoque > 0`, N unidades, DECREMENTA ao vender
 * A matematica do dinheiro NAO e duplicada: vem de `@/lib/comissao`.
 *
 * FRETE: 'fixo' usa o valor da loja; 'calculado' RE-COTA no servidor (Melhor
 * Envio) com o CEP do comprador + o servico escolhido — o cliente nunca dita o
 * preco do frete. A dimensao vem do tipo do produto; o peso do `peso_g`.
 *
 * GET  -> dados pra tela
 * POST -> cria pedido + Session com split (application_fee + transfer_data)
 */

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

function digits(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '')
}

const SELECT_LOJA =
  'id, nome, slug, logo_url, verificada, status, owner_user_id, stripe_connect_account_id, connect_charges_enabled, repasse_prazo, frete_cents, frete_gratis_acima_cents, frete_modo, cep'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: produtoId } = await ctx.params
    const db = sb()

    const { data: ps } = await db
      .from('loja_produtos')
      .select('id, loja_id, tipo, nome, descricao, preco_cents, estoque, fotos, ativo')
      .eq('id', produtoId)
      .limit(1)

    const p = ps?.[0]
    if (!p) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })

    const { data: ls } = await db.from('lojas').select(SELECT_LOJA).eq('id', p.loja_id).eq('status', 'ativa').limit(1)
    const loja = ls?.[0] || null

    return NextResponse.json({
      item: {
        id: p.id,
        nome: p.nome,
        imagem: Array.isArray(p.fotos) && p.fotos.length ? p.fotos[0] : null,
        preco_cents: p.preco_cents,
        condicao: null,
        tipo: p.tipo,
        descricao: p.descricao,
        estoque: p.estoque,
        disponivel: !!p.ativo && p.estoque > 0,
        vendedor_user_id: loja?.owner_user_id || null,
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
            pode_vender: !!loja.connect_charges_enabled,
          }
        : null,
    })
  } catch (err) {
    console.error('[produto checkout GET] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: produtoId } = await ctx.params

    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Faça login para comprar.' }, { status: 401 })

    const db = sb()
    const { data: authData, error: authErr } = await db.auth.getUser(token)
    const compradorId = authData?.user?.id
    if (authErr || !compradorId) {
      return NextResponse.json({ error: 'Sessão expirada. Entre de novo.' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const metodo: MetodoPagamento = ehMetodoValido(body?.metodo) ? body.metodo : 'cartao'
    if (metodo === 'pix' && !PIX_DISPONIVEL) {
      return NextResponse.json({ error: 'O Pix ainda não está disponível na Bynx. Use cartão por enquanto.' }, { status: 409 })
    }

    const { data: ps } = await db
      .from('loja_produtos')
      .select('id, loja_id, tipo, nome, preco_cents, estoque, peso_g, fotos, ativo')
      .eq('id', produtoId)
      .limit(1)

    const p = ps?.[0]
    if (!p) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })
    if (!p.ativo || p.estoque <= 0) {
      return NextResponse.json({ error: 'Esse produto está esgotado.' }, { status: 409 })
    }

    const { data: ls } = await db.from('lojas').select(SELECT_LOJA).eq('id', p.loja_id).eq('status', 'ativa').limit(1)
    const loja = ls?.[0]
    if (!loja) return NextResponse.json({ error: 'Loja indisponível.' }, { status: 409 })
    if (loja.owner_user_id === compradorId) {
      return NextResponse.json({ error: 'Você não pode comprar o seu próprio produto.' }, { status: 400 })
    }
    if (!loja.stripe_connect_account_id || !loja.connect_charges_enabled) {
      return NextResponse.json({ error: 'Essa loja ainda está ativando os recebimentos.' }, { status: 409 })
    }

    const prazo = normalizarPrazo(loja.repasse_prazo)
    const c = calcularCheckout(p.preco_cents, prazo, metodo)

    // ── Frete: fixo (loja) OU calculado (re-cotacao no servidor) ──────────
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
        const opcoes = await cotarFrete(loja.cep, cepDest, [pacoteDeProduto(p.peso_g, p.tipo, p.preco_cents)])
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
        console.error('[produto checkout] cotacao falhou:', (e as Error)?.message)
        return NextResponse.json({ error: 'Não consegui calcular o frete agora. Tente de novo.' }, { status: 502 })
      }
    } else {
      const freteBase = Math.max(0, loja.frete_cents || 0)
      const limiteGratis = loja.frete_gratis_acima_cents
      freteCents = limiteGratis != null && p.preco_cents >= limiteGratis ? 0 : freteBase
    }

    const totalCompradorCents = c.totalCompradorCents + freteCents
    const liquidoLojaCents = c.liquidoLojaCents + freteCents

    const { data: pedidoIns, error: pedErr } = await db
      .from('pedidos')
      .insert({
        loja_id: loja.id,
        vendedor_user_id: loja.owner_user_id,
        comprador_user_id: compradorId,
        produto_id: p.id, // <- e produto, nao carta (a constraint garante o XOR)
        item_nome: p.nome,
        item_imagem: Array.isArray(p.fotos) && p.fotos.length ? p.fotos[0] : null,
        valor_item_cents: p.preco_cents,
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
      console.error('[produto checkout] falha criando pedido:', pedErr?.message)
      return NextResponse.json({ error: 'Erro ao iniciar a compra.' }, { status: 500 })
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Pagamentos indisponíveis no momento.' }, { status: 500 })
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' })
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'

    const brl = (unit: number, nome: string) => ({
      price_data: { currency: 'brl', unit_amount: unit, product_data: { name: nome } },
      quantity: 1,
    })

    const linhas: Stripe.Checkout.SessionCreateParams.LineItem[] = [brl(p.preco_cents, p.nome)]
    if (c.acrescimoCents > 0) {
      linhas.push(brl(c.acrescimoCents, metodo === 'pix' ? 'Taxa do Pix' : 'Acréscimo do cartão'))
    }
    if (freteCents > 0) linhas.push(brl(freteCents, freteLabel))

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: [metodo === 'pix' ? 'pix' : 'card'],
        line_items: linhas,
        shipping_address_collection: { allowed_countries: ['BR'] },
        phone_number_collection: { enabled: true },
        client_reference_id: String(pedidoIns.id),
        metadata: {
          bynx_pedido_id: String(pedidoIns.id),
          bynx_produto_id: String(p.id),
          bynx_loja_id: String(loja.id),
        },
        payment_intent_data: {
          application_fee_amount: c.taxaBynxCents,
          transfer_data: { destination: loja.stripe_connect_account_id },
          metadata: { bynx_pedido_id: String(pedidoIns.id) },
        },
        success_url: `${base}/pedido/${pedidoIns.id}?ok=1`,
        cancel_url: `${base}/produto/${p.id}?cancelado=1`,
      })

      await db
        .from('pedidos')
        .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
        .eq('id', pedidoIns.id)

      return NextResponse.json({ url: session.url, pedido_id: pedidoIns.id })
    } catch (e) {
      console.error('[produto checkout] Stripe recusou:', (e as Error)?.message)
      await db.from('pedidos').delete().eq('id', pedidoIns.id)
      return NextResponse.json({ error: 'Não foi possível iniciar o pagamento. Tente de novo.' }, { status: 502 })
    }
  } catch (err) {
    console.error('[produto checkout] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
