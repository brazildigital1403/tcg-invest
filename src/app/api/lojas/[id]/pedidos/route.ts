import { NextRequest, NextResponse } from 'next/server'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'
import { sendPedidoEnviadoEmail } from '@/lib/email'

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

    if (!pedidoId || acao !== 'enviar') {
      return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
    }

    if (!rastreio || rastreio.length < 8) {
      return NextResponse.json({ error: 'Informe um código de rastreio válido (mínimo 8 caracteres) para marcar como enviado.' }, { status: 400 })
    }

    // O pedido TEM que ser desta loja (senao um lojista mexeria no pedido de outro).
    const { data: peds } = await sb
      .from('pedidos')
      .select('id, numero, status, loja_id, comprador_user_id, item_nome')
      .eq('id', pedidoId)
      .eq('loja_id', lojaId)
      .limit(1)

    const pedido = peds?.[0]
    if (!pedido) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    if (pedido.status !== 'pago') {
      return NextResponse.json(
        { error: `Só dá para enviar um pedido pago. Esse está como "${pedido.status}".` },
        { status: 409 }
      )
    }

    const { error: upErr } = await sb
      .from('pedidos')
      .update({
        status: 'enviado',
        rastreio,
        enviado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', pedido.id)

    if (upErr) {
      console.error('[pedidos PATCH]', upErr.message)
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

      const { data: comprador } = await sb
        .from('users')
        .select('email, name')
        .eq('id', pedido.comprador_user_id)
        .single()

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
      console.error('[pedidos PATCH] falha avisando comprador:', (err as Error)?.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[pedidos PATCH] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
