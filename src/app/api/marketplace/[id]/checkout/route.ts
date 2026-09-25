import { NextRequest, NextResponse } from 'next/server'
import { badgesDaCarta } from '@/lib/badgesCarta'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { calcularCheckout, normalizarPrazo, ehMetodoValido, PIX_DISPONIVEL, type MetodoPagamento } from '@/lib/comissao'
import { cotarFrete, pacoteDeCarta } from '@/lib/melhor-envio'
import { resolverRecebedor, podeReceber, motivoSemCompra } from '@/lib/vendedorRecebimento'

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
 * Auth: comprador logado (Bearer). Guards: anuncio disponivel, vendedor com
 * recebimentos liberados, e ninguem compra do proprio anuncio.
 *
 * ★ QUEM RECEBE NAO E MAIS "A LOJA" (24/09/2026, Quadro #389). Esta rota exigia
 * loja ativa com Connect, e 70 dos 100 anuncios sao de pessoa fisica sem loja --
 * para eles o 409 era permanente. Agora quem responde e o `resolverRecebedor`:
 * conta da loja quando ela tem uma, conta do dono quando nao tem. O resto do
 * fluxo (split, comissao, frete integral) nao mudou uma linha.
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
      .select('id, user_id, card_id, card_name, card_image, price, status, condicao, variante, idioma, fotos, graduada, graduadora, nota, black_label, removido_em')
      .eq('id', anuncioId)
      .limit(1)

    const anuncio = anuncios?.[0]
    if (!anuncio) return NextResponse.json({ error: 'Anúncio não encontrado.' }, { status: 404 })

    const r = await resolverRecebedor(db, anuncio.user_id)
    // Frete calculado sem CEP de origem nao fecha: melhor nao oferecer o botao
    // do que oferecer e quebrar na hora de cotar.
    const podeVender = podeReceber(r) && (r!.freteModo !== 'calculado' || !!r!.cepOrigem)
    const fotosVend: string[] = Array.isArray(anuncio.fotos)
      ? anuncio.fotos.filter((u: unknown): u is string => typeof u === 'string' && !!u)
      : []

    return NextResponse.json({
      item: {
        id: anuncio.id,
        nome: anuncio.card_name,
        // ★ A FOTO REAL VEM PRIMEIRO (04/09/2026). Antes o `card_image` (arte
        // do catalogo) sempre ganhava, e quem tinha subido foto da propria
        // carta — inclusive do slab graduado — via a arte generica no
        // checkout. Quem paga por um slab precisa ver o slab.
        imagem: fotosVend[0] || anuncio.card_image || null,
        fotos: fotosVend,
        preco_cents: Math.round(Number(anuncio.price) * 100),
        condicao: anuncio.condicao,
        variante: anuncio.variante,
        idioma: anuncio.idioma,
        // Descricao pronta, na MESMA regra da vitrine (`badgesCarta.ts`).
        badges: badgesDaCarta(anuncio),
        graduada: anuncio.graduada,
        graduadora: anuncio.graduadora,
        nota: anuncio.nota,
        disponivel: anuncio.status === 'disponivel' && !anuncio.removido_em,
        vendedor_user_id: anuncio.user_id,
      },
      // `vendedor` e o campo novo; quem vende pode nao ter loja nenhuma.
      vendedor: r
        ? {
            tipo: r.tipo,
            nome: r.nome,
            slug: r.slug,
            logo_url: r.logoUrl,
            verificada: r.verificada,
            frete_cents: r.freteCents,
            frete_gratis_acima_cents: r.freteGratisAcimaCents,
            frete_modo: r.freteModo,
            repasse_prazo: normalizarPrazo(r.repassePrazo),
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
      .select('id, user_id, card_id, card_name, card_image, price, status, condicao, fotos, removido_em')
      .eq('id', anuncioId)
      .limit(1)

    const anuncio = anuncios?.[0]
    if (!anuncio) return NextResponse.json({ error: 'Anúncio não encontrado.' }, { status: 404 })
    // ★ `removido_em` e o sinal da MODERACAO: o admin remove um anuncio setando
    // so este campo, sem mexer no `status`. Sem checar aqui, um anuncio moderado
    // seguia COMPRAVEL pela URL direta — com Stripe, split e tudo. A checagem de
    // status sozinha nunca pegou isso.
    if (anuncio.status !== 'disponivel' || anuncio.removido_em) {
      return NextResponse.json({ error: 'Esse anúncio não está mais disponível.' }, { status: 409 })
    }
    if (anuncio.user_id === compradorId) {
      return NextResponse.json({ error: 'Você não pode comprar o seu próprio anúncio.' }, { status: 400 })
    }

    // ── Quem recebe: a loja do vendedor, ou ele mesmo ────────────────────
    const r = await resolverRecebedor(db, anuncio.user_id)
    if (!podeReceber(r)) {
      return NextResponse.json({ error: motivoSemCompra(r) }, { status: 409 })
    }
    const recebedor = r!

    // ── Dinheiro ────────────────────────────────────────────────────────
    const valorCents = Math.round(Number(anuncio.price) * 100)
    if (!Number.isFinite(valorCents) || valorCents <= 0) {
      return NextResponse.json({ error: 'Preço inválido no anúncio.' }, { status: 400 })
    }

    const prazo = normalizarPrazo(recebedor.repassePrazo)
    const c = calcularCheckout(valorCents, prazo, metodo)

    // ── Frete: fixo (loja) OU calculado (re-cotacao no servidor) ──────────
    // Vai INTEGRAL pra loja (nao entra na comissao).
    let freteCents = 0
    let freteLabel = `Frete — ${recebedor.nome}`

    if (recebedor.freteModo === 'calculado') {
      const cepDest = digits(body?.cep)
      const servicoId = Number(body?.servico)
      if (cepDest.length !== 8) {
        return NextResponse.json({ error: 'Informe um CEP de entrega válido.' }, { status: 400 })
      }
      if (!servicoId) {
        return NextResponse.json({ error: 'Escolha uma opção de frete.' }, { status: 400 })
      }
      if (!recebedor.cepOrigem) {
        // Pessoa fisica sem CEP no cadastro cai aqui. A mensagem fala do
        // VENDEDOR: quem le e o comprador, e "a loja" nao existe nesse caso.
        return NextResponse.json({ error: 'Esse vendedor ainda não informou o CEP de envio.' }, { status: 409 })
      }
      try {
        const opcoes = await cotarFrete(recebedor.cepOrigem, cepDest, [pacoteDeCarta(valorCents)])
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
      const freteBase = Math.max(0, recebedor.freteCents)
      const limiteGratis = recebedor.freteGratisAcimaCents
      freteCents = limiteGratis != null && valorCents >= limiteGratis ? 0 : freteBase
    }

    const totalCompradorCents = c.totalCompradorCents + freteCents
    const liquidoLojaCents = c.liquidoLojaCents + freteCents

    // ── Pedido (aguardando pagamento) ───────────────────────────────────
    const { data: pedidoIns, error: pedErr } = await db
      .from('pedidos')
      .insert({
        // Null quando quem vende e a pessoa: `vendedor_user_id` e que responde
        // por quem vendeu, e ele nunca e nulo.
        loja_id: recebedor.lojaId,
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
        stripe_connect_account_id: recebedor.connectAccountId,
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
          bynx_vendedor_user_id: String(anuncio.user_id),
          ...(recebedor.lojaId ? { bynx_loja_id: String(recebedor.lojaId) } : {}),
        },
        payment_intent_data: {
          application_fee_amount: c.taxaBynxCents,
          transfer_data: { destination: recebedor.connectAccountId! },
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
