import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'

/**
 * POST /api/pedidos/[id]/avaliar
 *
 * O comprador avalia a loja depois da compra. So o comprador do pedido pode
 * avaliar, e so quando o pedido ja saiu (enviado ou entregue). A avaliacao cai
 * na MESMA tabela `avaliacoes` do marketplace, com `avaliado_id = dono da loja`,
 * entao a nota entra automaticamente na reputacao ja existente (/lojas,
 * /perfil, ReputacaoCard). O `pedido_id` marca a review como "compra verificada".
 *
 * Escrita via service_role: `avaliacoes` tem RLS de insert permissiva, mas quem
 * garante que quem avalia e mesmo o comprador daquele pedido (e no status certo)
 * e este servidor. O indice unico `uq_avaliacoes_pedido` impede avaliar 2x.
 */

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: pedidoId } = await ctx.params

    const sb = getServiceSupabase()
    if (!sb) return NextResponse.json({ error: 'Servico indisponivel.' }, { status: 503 })

    // ─── Autentica o comprador (Bearer) ─────────────────────────
    const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!bearer) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    const { data: authData, error: authErr } = await sb.auth.getUser(bearer)
    if (authErr || !authData?.user) return NextResponse.json({ error: 'Token invalido.' }, { status: 401 })
    const userId = authData.user.id

    // ─── Valida o corpo ─────────────────────────────────────────
    const body = await req.json().catch(() => null)
    const estrelas = Number(body?.estrelas)
    const comentario = typeof body?.comentario === 'string' ? body.comentario.trim().slice(0, 200) : null
    if (!Number.isInteger(estrelas) || estrelas < 1 || estrelas > 5) {
      return NextResponse.json({ error: 'Selecione de 1 a 5 estrelas.' }, { status: 400 })
    }

    // ─── Busca o pedido e valida ────────────────────────────────
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
    if (pedido.status !== 'enviado' && pedido.status !== 'entregue') {
      return NextResponse.json({ error: 'So da pra avaliar depois que o pedido e enviado.' }, { status: 409 })
    }

    // ─── Insere a avaliacao (pedido_id => compra verificada) ─────
    const { error: insErr } = await sb.from('avaliacoes').insert({
      pedido_id: pedido.id,
      loja_id: pedido.loja_id,
      avaliador_id: userId,
      avaliado_id: pedido.vendedor_user_id,
      papel: 'comprador',
      estrelas,
      comentario,
    })

    if (insErr) {
      // 23505 = unique_violation (indice uq_avaliacoes_pedido)
      if ((insErr as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'Voce ja avaliou esse pedido.' }, { status: 409 })
      }
      console.error('[pedidos avaliar]', insErr.message)
      return NextResponse.json({ error: 'Erro ao salvar a avaliacao.' }, { status: 500 })
    }

    // ─── Avisa o lojista (sino). Falha aqui nao desfaz a review. ─
    try {
      const { data: loja } = await sb.from('lojas').select('slug').eq('id', pedido.loja_id).single()
      await sb.from('notifications').insert({
        user_id: pedido.vendedor_user_id,
        type: 'avaliacao',
        title: 'Voce recebeu uma avaliacao!',
        message: `${estrelas} estrela${estrelas > 1 ? 's' : ''} pela venda de "${pedido.item_nome}".`,
        data: { link: loja?.slug ? `/lojas/${loja.slug}` : `/minha-loja/${pedido.loja_id}/pedidos` },
      })
    } catch (err) {
      console.error('[pedidos avaliar] falha no sino:', (err as Error)?.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[pedidos avaliar] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
