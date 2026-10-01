import { NextRequest, NextResponse } from 'next/server'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'
import { marcarEnviado, cancelarEReembolsar, SELECT_POS_VENDA, type PedidoPosVenda } from '@/lib/pedidoVendedor'

/**
 * GET   /api/lojas/[id]/pedidos           -> pedidos da loja (o painel)
 * PATCH /api/lojas/[id]/pedidos           -> { pedido_id, acao: 'enviar', rastreio? }
 *
 * Auth: owner da loja OU admin (`autenticarOwnerOuAdmin`).
 *
 * Por que a escrita passa aqui e nao pelo cliente: `pedidos` so aceita escrita
 * por service_role (o dinheiro nao pode depender de RLS de cliente). Alem disso
 * a mudanca pra 'enviado' dispara email/sino pro comprador — isso e servidor.
 *
 * ★ A LOGICA DAS DUAS ACOES SAIU DAQUI (01/10/2026, F5). Ela agora vive em
 * `src/lib/pedidoVendedor.ts`, porque quem vende SEM LOJA precisa das mesmas
 * duas acoes e nao tem `loja_id` para pôr nesta URL. Esta rota ficou com o que
 * e dela: autenticar o dono da loja, garantir que o pedido e DESTA loja, e
 * dizer quem esta vendendo. O refund, o estorno do lancamento, o inventario e
 * os avisos sao identicos nos dois caminhos -- de proposito: quem vende sem
 * loja nao tem politica de estorno propria.
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
      .select(SELECT_POS_VENDA)
      .eq('id', pedidoId)
      .eq('loja_id', lojaId)
      .limit(1)

    const pedido = peds?.[0]
    if (!pedido) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

    // ★ Quem esta vendendo, do ponto de vista do comprador e do sino. E a
    //   UNICA coisa que difere do caminho da pessoa fisica.
    const ctxVend = {
      // Nome PURO: ele vai tanto no sino ("X cancelou o pedido") quanto no
      // e-mail, que o encaixa em "na <strong>X</strong>". Com artigo colado
      // aqui, o e-mail sairia "na A Mais Que Geek".
      nomeExibido: loja.nome as string,
      linkPainel: `/minha-loja/${lojaId}/pedidos`,
      vendedorUserId: loja.owner_user_id as string,
      canceladoPor: 'loja' as const,
    }

    const r = acao === 'enviar'
      ? await marcarEnviado(sb, pedido as PedidoPosVenda, rastreio || '', ctxVend)
      : await cancelarEReembolsar(sb, pedido as PedidoPosVenda, motivo, ctxVend)

    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.status })
    return NextResponse.json({ ok: true, ...(r.extra || {}) })
  } catch (err) {
    console.error('[pedidos PATCH] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
