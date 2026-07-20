import { NextRequest, NextResponse } from 'next/server'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'
import Stripe from 'stripe'
import { sendPedidoEnviadoEmail, sendReembolsoCompradorEmail } from '@/lib/email'

/**
 * GET   /api/lojas/[id]/pedidos           -> pedidos da loja (o painel)
 * PATCH /api/lojas/[id]/pedidos           -> { pedido_id, acao: 'enviar', rastreio? }
 *
 * Auth: owner da loja OU admin (`autenticarOwnerOuAdmin`).
 *
 * Por que a escrita passa aqui e nao pelo cliente: `pedidos` so aceita escrita
 * por service_role (o dinheiro nao pode depender de RLS de cliente). Alem disso
 * a mudanca pra 'enviado' dispara email/sino pro comprador — isso e servidor.
 */

const SELECT_LOJA = 'id, owner_user_id, nome, status'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params
    const auth = await autenticarOwnerOuAdmin(req, lojaId, SELECT_LOJA)
    if ('error' in auth) return auth.error
    const { sb } = auth

    const { searchParams } = new URL(req.url)
    const filtro = searchParams.get('status')

    let q = sb
      .from('pedidos')
      .select('id, numero, status, item_nome, item_imagem, valor_item_cents, frete_cents, liquido_loja_cents, total_comprador_cents, metodo, repasse_prazo, endereco, rastreio, created_at, pago_em, enviado_em')
      .eq('loja_id', lojaId)
      .neq('status', 'aguardando_pagamento') // pedido nao pago nao interessa ao lojista
      .order('created_at', { ascending: false })
      .limit(100)

    if (filtro && filtro !== 'todos') q = q.eq('status', filtro)

    const { data, error } = await q
    if (error) {
      console.error('[pedidos GET]', error.message)
      return NextResponse.json({ error: 'Erro ao carregar pedidos.' }, { status: 500 })
    }

    const pedidos = data || []
    return NextResponse.json({
      pedidos,
      resumo: {
        a_enviar: pedidos.filter(p => p.status === 'pago').length,
        enviados: pedidos.filter(p => p.status === 'enviado').length,
        total: pedidos.length,
        faturado_cents: pedidos
          .filter(p => p.status !== 'cancelado' && p.status !== 'reembolsado')
          .reduce((s, p) => s + (p.liquido_loja_cents || 0), 0),
      },
    })
  } catch (err) {
    console.error('[pedidos GET] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params
    const auth = await autenticarOwnerOuAdmin(req, lojaId, SELECT_LOJA)
    if ('error' in auth) return auth.error
    const { loja, sb } = auth

    const body = await req.json().catch(() => null)
    const pedidoId = body?.pedido_id
    const acao = body?.acao
    const rastreio = typeof body?.rastreio === 'string' ? body.rastreio.trim().slice(0, 60) : null
    const motivo = typeof body?.motivo === 'string' ? body.motivo.trim().slice(0, 300) : null

    if (!pedidoId || (acao !== 'enviar' && acao !== 'cancelar')) {
      return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
    }

    // O pedido TEM que ser desta loja (senao um lojista mexeria no pedido de outro).
    const { data: peds } = await sb
      .from('pedidos')
      .select('id, numero, status, loja_id, comprador_user_id, item_nome, produto_id, marketplace_id, total_comprador_cents, stripe_payment_intent_id')
      .eq('id', pedidoId)
      .eq('loja_id', lojaId)
      .limit(1)

    const pedido = peds?.[0]
    if (!pedido) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

    // ==================== ENVIAR ====================
    if (acao === 'enviar') {
      if (!rastreio || rastreio.length < 8) {
        return NextResponse.json({ error: 'Informe um código de rastreio válido (mínimo 8 caracteres) para marcar como enviado.' }, { status: 400 })
      }
      if (pedido.status !== 'pago') {
        return NextResponse.json({ error: `Só dá para enviar um pedido pago. Esse está como "${pedido.status}".` }, { status: 409 })
      }

      const { error: upErr } = await sb
        .from('pedidos')
        .update({ status: 'enviado', rastreio, enviado_em: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', pedido.id)

      if (upErr) {
        console.error('[pedidos PATCH enviar]', upErr.message)
        return NextResponse.json({ error: 'Erro ao marcar como enviado.' }, { status: 500 })
      }

      // Avisa o comprador (sino + email). Falha aqui nao desfaz o envio.
      try {
        await sb.from('notifications').insert({
          user_id: pedido.comprador_user_id,
          type: 'aviso',
          title: 'Seu pedido foi enviado!',
          message: `${pedido.item_nome} está a caminho${rastreio ? ` · rastreio ${rastreio}` : ''}.`,
          data: { link: `/pedido/${pedido.id}` },
        })

        const { data: comprador } = await sb.from('users').select('email, name').eq('id', pedido.comprador_user_id).single()
        if (comprador?.email) {
          await sendPedidoEnviadoEmail({
            to: comprador.email,
            nomeUser: comprador.name || '',
            pedidoId: pedido.id,
            pedidoNumero: pedido.numero,
            itemNome: pedido.item_nome,
            nomeLoja: loja.nome,
            rastreio,
          })
        }
      } catch (err) {
        console.error('[pedidos PATCH enviar] falha avisando comprador:', (err as Error)?.message)
      }

      return NextResponse.json({ ok: true })
    }

    // ==================== CANCELAR + REEMBOLSAR ====================
    // So a loja (owner/admin, ja checado). So ANTES de enviar — depois de despachado nao faz sentido.
    if (pedido.status !== 'pago') {
      return NextResponse.json({ error: `Só dá para cancelar um pedido que ainda não foi enviado. Esse está como "${pedido.status}".` }, { status: 409 })
    }
    if (!pedido.stripe_payment_intent_id) {
      return NextResponse.json({ error: 'Pedido sem pagamento associado. Não há o que reembolsar.' }, { status: 409 })
    }

    // Estorna na Stripe: devolve ao comprador, reverte o transfer da loja e a taxa da Bynx (reembolso integral).
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2025-03-31.basil' })
    let refundId: string
    try {
      const refund = await stripe.refunds.create({
        payment_intent: pedido.stripe_payment_intent_id,
        reverse_transfer: true,
        refund_application_fee: true,
      })
      refundId = refund.id
    } catch (e) {
      console.error('[pedidos PATCH cancelar] refund falhou:', (e as Error)?.message)
      return NextResponse.json({ error: 'Não foi possível processar o reembolso na Stripe. Nada foi alterado — tente de novo em instantes.' }, { status: 502 })
    }

    const { error: upErr } = await sb
      .from('pedidos')
      .update({
        status: 'reembolsado',
        cancelado_em: new Date().toISOString(),
        cancelamento_motivo: motivo,
        cancelado_por: 'loja',
        stripe_refund_id: refundId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pedido.id)

    if (upErr) {
      // O dinheiro JA foi estornado na Stripe. Loga alto pra reconciliar.
      console.error('[pedidos PATCH cancelar] refund OK mas update falhou:', upErr.message, '| pedido', pedido.id, '| refund', refundId)
      return NextResponse.json({ error: 'O reembolso foi feito na Stripe, mas houve um erro ao atualizar o pedido. Fale com o suporte com o número do pedido.' }, { status: 500 })
    }

    // Restaura o inventario (produto: estoque+1; carta: volta pra disponivel).
    try {
      if (pedido.produto_id) {
        await sb.rpc('restaurar_estoque_produto', { p_id: pedido.produto_id })
      } else if (pedido.marketplace_id) {
        await sb.from('marketplace').update({ status: 'disponivel', buyer_id: null }).eq('id', pedido.marketplace_id)
      }
    } catch (err) {
      console.error('[pedidos PATCH cancelar] falha restaurando inventario:', (err as Error)?.message)
    }

    // Avisa os dois lados (sino) + email pro comprador.
    try {
      const valor = (pedido.total_comprador_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      await sb.from('notifications').insert([
        {
          user_id: pedido.comprador_user_id,
          type: 'aviso',
          title: 'Pedido reembolsado',
          message: `A ${loja.nome} cancelou o pedido de ${pedido.item_nome}. ${valor} foi estornado no seu cartão.`,
          data: { link: `/pedido/${pedido.id}` },
        },
        {
          user_id: loja.owner_user_id,
          type: 'aviso',
          title: 'Pedido cancelado',
          message: `Você cancelou e reembolsou o pedido de ${pedido.item_nome}.`,
          data: { link: `/minha-loja/${lojaId}/pedidos` },
        },
      ])

      const { data: comprador } = await sb.from('users').select('email, name').eq('id', pedido.comprador_user_id).single()
      if (comprador?.email) {
        await sendReembolsoCompradorEmail({
          to: comprador.email,
          nomeUser: comprador.name || '',
          pedidoId: pedido.id,
          pedidoNumero: pedido.numero,
          itemNome: pedido.item_nome,
          nomeLoja: loja.nome,
          valorCents: pedido.total_comprador_cents,
          motivo,
        })
      }
    } catch (err) {
      console.error('[pedidos PATCH cancelar] falha avisando:', (err as Error)?.message)
    }

    return NextResponse.json({ ok: true, reembolsado: true })
  } catch (err) {
    console.error('[pedidos PATCH] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
