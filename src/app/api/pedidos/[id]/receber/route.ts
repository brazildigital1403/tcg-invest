import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { adicionarAoComprador, baixarDoVendedor, COLUNAS_CARTA_VENDIDA, type CartaVendida } from '@/lib/transferirCartaServidor'

/**
 * POST /api/pedidos/[id]/receber
 *
 * O comprador confirma que recebeu o pedido -> status 'entregue'. So o comprador
 * do pedido, e so quando esta 'enviado'. Fecha a timeline (que hoje nunca chega
 * no fim) e da o empurrao pra avaliar a loja. Escrita via service_role porque
 * `pedidos` so aceita escrita por service_role.
 *
 * ★ #371 (22/09/2026): e aqui que a CARTA muda de colecao numa compra pelo
 * checkout -- entra na do comprador e sai da do vendedor, igual a compra
 * negociada faz no "confirmar recebimento". Nao no pagamento: a loja pode
 * cancelar ate enviar, e cada estorno teria que tirar a carta de volta. Depois
 * de 'entregue' nao existe cancelamento, entao o movimento e definitivo.
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

    // `.eq('status', 'enviado')` fecha a corrida: dois toques em "Recebi" so
    // deixam o primeiro passar -- e so ele move as cartas logo abaixo.
    const { data: mexeu, error: upErr } = await sb
      .from('pedidos')
      .update({
        status: 'entregue',
        entregue_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', pedido.id)
      .eq('status', 'enviado')
      .select('id, marketplace_id')

    if (upErr) {
      console.error('[pedidos receber]', upErr.message)
      return NextResponse.json({ error: 'Erro ao confirmar o recebimento.' }, { status: 500 })
    }
    if (!mexeu || mexeu.length === 0) {
      return NextResponse.json({ error: 'Este pedido ja foi confirmado.' }, { status: 409 })
    }

    // ── Carta muda de colecao (#371) ──────────────────────────────────────
    // A verdade de um pedido e `pedido_itens`; `marketplace_id` do pedido e
    // atalho de item unico (null em pedido de 2+ itens). Produto de loja
    // (selado, acessorio) nao e carta de colecao: fica de fora.
    // Falha aqui NAO desfaz a entrega -- o comprador ja recebeu. Loga como
    // CRITICAL para corrigir na mao.
    try {
      const { data: itens } = await sb.from('pedido_itens').select('marketplace_id').eq('pedido_id', pedido.id)
      const idsAnuncio = [...new Set(
        (itens && itens.length ? itens.map(i => i.marketplace_id) : [mexeu[0].marketplace_id]).filter(Boolean) as string[],
      )]
      if (idsAnuncio.length) {
        const { data: cartas } = await sb.from('marketplace').select(`id, ${COLUNAS_CARTA_VENDIDA}`).in('id', idsAnuncio)
        for (const c of (cartas || []) as (CartaVendida & { id: string })[]) {
          const entrou = await adicionarAoComprador(sb, c, userId)
          if (!entrou.ok) console.error(`[pedidos receber] CRITICAL: carta ${c.id} nao entrou na colecao do comprador (pedido ${pedido.numero}):`, entrou.erro)
          const saiu = await baixarDoVendedor(sb, c)
          if (!saiu.ok) console.error(`[pedidos receber] baixa do vendedor falhou (anuncio ${c.id}):`, saiu.erro)
        }
      }
    } catch (err) {
      console.error(`[pedidos receber] CRITICAL: movimento de cartas do pedido ${pedido.numero}:`, (err as Error)?.message)
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
