import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'

/**
 * POST /api/pedidos/[id]/receber
 *
 * O comprador confirma que recebeu o pedido -> status 'entregue'. So o comprador
 * do pedido, e so quando esta 'enviado'. Fecha a timeline (que hoje nunca chega
 * no fim) e da o empurrao pra avaliar a loja. Escrita via service_role porque
 * `pedidos` so aceita escrita por service_role.
 */

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: pedidoId } = await ctx.params

    const sb = getServiceSupabase()
    if (!sb) return NextResponse.json({ error: 'Servico indisponivel.' }, { status: 503 })

    const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!bearer) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    const { data: authData, error: authErr } = await sb.auth.getUser(bearer)
    if (authErr || !authData?.user) return NextResponse.json({ error: 'Token invalido.' }, { status: 401 })
    const userId = authData.user.id

    const { data: peds } = await sb
      .from('pedidos')
      .select('id, numero, status, loja_id, vendedor_user_id, comprador_user_id, item_nome')
      .eq('id', pedidoId)
      .limit(1)

    const pedido = peds?.[0]
    if (!pedido) return NextResponse.json({ error: 'Pedido nao encontrado.' }, { status: 404 })
    if (pedido.comprador_user_id !== userId) {
      return NextResponse.json({ error: 'Voce nao e o comprador deste pedido.' }, { status: 403 })
    }
    if (pedido.status !== 'enviado') {
      return NextResponse.json({ error: 'So da pra confirmar o recebimento de um pedido enviado.' }, { status: 409 })
    }

    const { error: upErr } = await sb
      .from('pedidos')
      .update({
        status: 'entregue',
        entregue_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', pedido.id)

    if (upErr) {
      console.error('[pedidos receber]', upErr.message)
      return NextResponse.json({ error: 'Erro ao confirmar o recebimento.' }, { status: 500 })
    }

    // Avisa o lojista (sino).
    try {
      await sb.from('notifications').insert({
        user_id: pedido.vendedor_user_id,
        type: 'recebido',
        title: 'Pedido recebido pelo comprador',
        message: `O comprador confirmou que recebeu "${pedido.item_nome}".`,
        data: { link: `/minha-loja/${pedido.loja_id}/pedidos` },
      })
    } catch (err) {
      console.error('[pedidos receber] falha no sino:', (err as Error)?.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[pedidos receber] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
