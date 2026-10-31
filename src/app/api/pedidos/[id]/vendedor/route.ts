import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { identificarVendedor } from '@/lib/vendedorIdentificadoServer'

/**
 * GET /api/pedidos/[id]/vendedor -> { identificacao }
 *
 * O "Vendido por" do pedido (#470). E a UNICA tela em que o CPF de quem vende
 * aparece inteiro, e so para o comprador daquele pedido depois de pago (ou para
 * o proprio vendedor, que ve o dado dele). Antes de pagar, mascarado como nas
 * telas publicas. Qualquer outra pessoa: 403.
 *
 * Rota e nao leitura direta porque o CPF esta em `users`, que a RLS so libera
 * para a propria linha.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: pedidoId } = await ctx.params
    const sb = getServiceSupabase()
    if (!sb) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })

    const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!bearer) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    const { data: authData, error: authErr } = await sb.auth.getUser(bearer)
    if (authErr || !authData?.user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 })
    const userId = authData.user.id

    const { data: pedido } = await sb
      .from('pedidos')
      .select('status, loja_id, vendedor_user_id, comprador_user_id')
      .eq('id', pedidoId)
      .maybeSingle()
    if (!pedido) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

    const ehComprador = pedido.comprador_user_id === userId
    const ehVendedor = pedido.vendedor_user_id === userId
    if (!ehComprador && !ehVendedor) return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 })

    const completo = ehVendedor || pedido.status !== 'aguardando_pagamento'
    const identificacao = await identificarVendedor(pedido.loja_id, pedido.vendedor_user_id, completo)
    return NextResponse.json({ identificacao }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err) {
    console.error('[pedido vendedor] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
