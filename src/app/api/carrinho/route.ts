import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { comissaoVendedorCents, acrescimoCompradorCents, normalizarPrazo, ehMetodoValido, PIX_DISPONIVEL, type MetodoPagamento } from '@/lib/comissao'

/**
 * Carrinho por loja.
 *
 * POST /api/carrinho/resumo   -> { loja_id, itens:[{id,tipo}], metodo } -> conta completa
 * POST /api/carrinho/checkout -> idem + auth -> cria pedido (N itens) + Session
 *
 * ★ O cliente manda SO IDs. ★ Preco, nome, imagem e disponibilidade sao lidos
 * daqui do servidor. Se aceitassemos preco do cliente, editar o localStorage
 * compraria um Charizard por R$ 1.
 *
 * A comissao e por ITEM (a regra do vendedor tem taxa fixa a partir de R$20);
 * o acrescimo do comprador e sobre o SUBTOTAL (uma transacao, um acrescimo).
 */

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

const SELECT_LOJA =
  'id, nome, slug, status, owner_user_id, stripe_connect_account_id, connect_charges_enabled, repasse_prazo, frete_cents, frete_gratis_acima_cents'

interface Entrada { id: string; tipo: 'carta' | 'produto' }
interface ItemResolvido {
  id: string
  tipo: 'carta' | 'produto'
  nome: string
  imagem: string | null
  preco_cents: number
  disponivel: boolean
  motivo?: string
}

/** Le os itens do banco e diz quais ainda estao a venda NESTA loja. */
async function resolverItens(db: ReturnType<typeof sb>, loja: { id: string; owner_user_id: string }, entradas: Entrada[]) {
  const idsCarta = entradas.filter(e => e.tipo === 'carta').map(e => e.id)
  const idsProd = entradas.filter(e => e.tipo === 'produto').map(e => e.id)
  const out: ItemResolvido[] = []

  if (idsCarta.length) {
    const { data } = await db
      .from('marketplace')
      .select('id, card_name, card_image, price, status, user_id')
      .in('id', idsCarta)
    for (const id of idsCarta) {
      const c = data?.find(x => x.id === id)
      if (!c || c.user_id !== loja.owner_user_id) {
        out.push({ id, tipo: 'carta', nome: 'Item removido', imagem: null, preco_cents: 0, disponivel: false, motivo: 'não está mais nesta loja' })
        continue
      }
      out.push({
        id,
        tipo: 'carta',
        nome: c.card_name || 'Carta',
        imagem: c.card_image,
        preco_cents: Math.round(Number(c.price) * 100),
        disponivel: c.status === 'disponivel',
        motivo: c.status !== 'disponivel' ? 'já foi vendida' : undefined,
      })
    }
  }

  if (idsProd.length) {
    const { data } = await db
      .from('loja_produtos')
      .select('id, nome, fotos, preco_cents, estoque, ativo, loja_id, tipo')
      .in('id', idsProd)
    for (const id of idsProd) {
      const p = data?.find(x => x.id === id)
      if (!p || p.loja_id !== loja.id) {
        out.push({ id, tipo: 'produto', nome: 'Item removido', imagem: null, preco_cents: 0, disponivel: false, motivo: 'não está mais nesta loja' })
        continue
      }
      out.push({
        id,
        tipo: 'produto',
        nome: p.nome,
        imagem: Array.isArray(p.fotos) && p.fotos.length ? p.fotos[0] : null,
        preco_cents: p.preco_cents,
        disponivel: !!p.ativo && p.estoque > 0,
        motivo: !p.ativo || p.estoque <= 0 ? 'esgotou' : undefined,
      })
    }
  }

  // devolve na ordem que o cliente mandou (a ordem do carrinho dele)
  return entradas.map(e => out.find(o => o.id === e.id)).filter((x): x is ItemResolvido => !!x)
}

/** A conta do carrinho. Fonte unica pro resumo e pro checkout. */
function montarConta(itens: ItemResolvido[], prazo: 14 | 30, metodo: MetodoPagamento, loja: { frete_cents: number | null; frete_gratis_acima_cents: number | null }) {
  const validos = itens.filter(i => i.disponivel)
  const subtotal = validos.reduce((s, i) => s + i.preco_cents, 0)

  // Comissao POR ITEM: a taxa fixa (R$0,40 acima de R$20) e por venda de item.
  const comissao = validos.reduce((s, i) => s + comissaoVendedorCents(i.preco_cents, prazo), 0)
  // Acrescimo sobre o subtotal: e UMA transacao no cartao/Pix.
  const acrescimo = subtotal > 0 ? acrescimoCompradorCents(subtotal, metodo) : 0

  const freteBase = Math.max(0, loja.frete_cents || 0)
  const limite = loja.frete_gratis_acima_cents
  const frete = subtotal === 0 ? 0 : limite != null && subtotal >= limite ? 0 : freteBase

  return {
    subtotal_cents: subtotal,
    acrescimo_cents: acrescimo,
    frete_cents: frete,
    total_comprador_cents: subtotal + acrescimo + frete,
    comissao_bynx_cents: comissao + acrescimo,
    liquido_loja_cents: subtotal - comissao + frete,
    validos,
  }
}

async function carregar(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const lojaId = body?.loja_id
  const entradas: Entrada[] = Array.isArray(body?.itens)
    ? body.itens
        .filter((i: unknown): i is Entrada => !!i && typeof (i as Entrada).id === 'string' && ((i as Entrada).tipo === 'carta' || (i as Entrada).tipo === 'produto'))
        .slice(0, 50)
    : []
  const metodo: MetodoPagamento = ehMetodoValido(body?.metodo) ? body.metodo : 'cartao'
  return { lojaId, entradas, metodo, body }
}

export async function POST(req: NextRequest) {
  // Rota unica: /api/carrinho?acao=resumo|checkout
  const acao = new URL(req.url).searchParams.get('acao') || 'resumo'
  try {
    const { lojaId, entradas, metodo } = await carregar(req)
    if (!lojaId || entradas.length === 0) {
      return NextResponse.json({ error: 'Carrinho vazio.' }, { status: 400 })
    }
    if (metodo === 'pix' && !PIX_DISPONIVEL) {
      return NextResponse.json({ error: 'O Pix ainda não está disponível na Bynx. Use cartão por enquanto.' }, { status: 409 })
    }

    const db = sb()
    const { data: ls } = await db.from('lojas').select(SELECT_LOJA).eq('id', lojaId).eq('status', 'ativa').limit(1)
    const loja = ls?.[0]
    if (!loja) return NextResponse.json({ error: 'Loja indisponível.' }, { status: 409 })

    const prazo = normalizarPrazo(loja.repasse_prazo)
    const itens = await resolverItens(db, loja, entradas)
    const conta = montarConta(itens, prazo, metodo, loja)

    // ── Resumo (a pagina do carrinho) ────────────────────────────────────
    if (acao === 'resumo') {
      return NextResponse.json({
        loja: { id: loja.id, nome: loja.nome, slug: loja.slug, pode_vender: !!loja.connect_charges_enabled },
        itens,
        ...conta,
        validos: undefined,
        qtd_validos: conta.validos.length,
      })
    }

    // ── Checkout ─────────────────────────────────────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Faça login para comprar.' }, { status: 401 })
    const { data: authData } = await db.auth.getUser(token)
    const compradorId = authData?.user?.id
    if (!compradorId) return NextResponse.json({ error: 'Sessão expirada. Entre de novo.' }, { status: 401 })

    if (loja.owner_user_id === compradorId) {
      return NextResponse.json({ error: 'Você não pode comprar da sua própria loja.' }, { status: 400 })
    }
    if (!loja.stripe_connect_account_id || !loja.connect_charges_enabled) {
      return NextResponse.json({ error: 'Essa loja ainda está ativando os recebimentos.' }, { status: 409 })
    }
    if (conta.validos.length === 0) {
      return NextResponse.json({ error: 'Nenhum item do seu carrinho está disponível.' }, { status: 409 })
    }

    const primeiro = conta.validos[0]
    const resto = conta.validos.length - 1
    const resumoNome = resto > 0 ? `${primeiro.nome} + ${resto} ${resto === 1 ? 'item' : 'itens'}` : primeiro.nome

    const { data: pedidoIns, error: pedErr } = await db
      .from('pedidos')
      .insert({
        loja_id: loja.id,
        vendedor_user_id: loja.owner_user_id,
        comprador_user_id: compradorId,
        // Atalho so quando e 1 item; com N, a verdade esta em pedido_itens.
        marketplace_id: conta.validos.length === 1 && primeiro.tipo === 'carta' ? primeiro.id : null,
        produto_id: conta.validos.length === 1 && primeiro.tipo === 'produto' ? primeiro.id : null,
        item_nome: resumoNome,
        item_imagem: primeiro.imagem,
        valor_item_cents: conta.subtotal_cents,
        frete_cents: conta.frete_cents,
        acrescimo_cents: conta.acrescimo_cents,
        total_comprador_cents: conta.total_comprador_cents,
        comissao_bynx_cents: conta.comissao_bynx_cents,
        liquido_loja_cents: conta.liquido_loja_cents,
        metodo,
        repasse_prazo: prazo,
        stripe_connect_account_id: loja.stripe_connect_account_id,
        status: 'aguardando_pagamento',
      })
      .select('id, numero')
      .single()

    if (pedErr || !pedidoIns) {
      console.error('[carrinho checkout] falha criando pedido:', pedErr?.message)
      return NextResponse.json({ error: 'Erro ao iniciar a compra.' }, { status: 500 })
    }

    const { error: itErr } = await db.from('pedido_itens').insert(
      conta.validos.map(i => ({
        pedido_id: pedidoIns.id,
        marketplace_id: i.tipo === 'carta' ? i.id : null,
        produto_id: i.tipo === 'produto' ? i.id : null,
        nome: i.nome,
        imagem: i.imagem,
        tipo: i.tipo,
        preco_cents: i.preco_cents,
        quantidade: 1,
      }))
    )
    if (itErr) {
      console.error('[carrinho checkout] falha nos itens:', itErr.message)
      await db.from('pedidos').delete().eq('id', pedidoIns.id)
      return NextResponse.json({ error: 'Erro ao montar o pedido.' }, { status: 500 })
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Pagamentos indisponíveis no momento.' }, { status: 500 })
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' })
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'

    const brl = (unit: number, nome: string) => ({
      price_data: { currency: 'brl' as const, unit_amount: unit, product_data: { name: nome } },
      quantity: 1,
    })
    const linhas: Stripe.Checkout.SessionCreateParams.LineItem[] = conta.validos.map(i => brl(i.preco_cents, i.nome))
    if (conta.acrescimo_cents > 0) {
      linhas.push(brl(conta.acrescimo_cents, metodo === 'pix' ? 'Taxa do Pix' : 'Acréscimo do cartão'))
    }
    if (conta.frete_cents > 0) linhas.push(brl(conta.frete_cents, `Frete — ${loja.nome}`))

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: [metodo === 'pix' ? 'pix' : 'card'],
        line_items: linhas,
        shipping_address_collection: { allowed_countries: ['BR'] },
        phone_number_collection: { enabled: true },
        client_reference_id: String(pedidoIns.id),
        metadata: { bynx_pedido_id: String(pedidoIns.id), bynx_loja_id: String(loja.id) },
        payment_intent_data: {
          application_fee_amount: conta.comissao_bynx_cents,
          transfer_data: { destination: loja.stripe_connect_account_id },
          metadata: { bynx_pedido_id: String(pedidoIns.id) },
        },
        success_url: `${base}/pedido/${pedidoIns.id}?ok=1`,
        cancel_url: `${base}/carrinho?cancelado=1`,
      })

      await db.from('pedidos').update({ stripe_session_id: session.id, updated_at: new Date().toISOString() }).eq('id', pedidoIns.id)
      return NextResponse.json({ url: session.url, pedido_id: pedidoIns.id })
    } catch (e) {
      console.error('[carrinho checkout] Stripe recusou:', (e as Error)?.message)
      await db.from('pedidos').delete().eq('id', pedidoIns.id) // cascade limpa os itens
      return NextResponse.json({ error: 'Não foi possível iniciar o pagamento. Tente de novo.' }, { status: 502 })
    }
  } catch (err) {
    console.error('[carrinho] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
