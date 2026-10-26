import { NextRequest, NextResponse } from 'next/server'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { SEM_CACHE, UUID_RE, sbServico, usuarioDoBearer } from '@/lib/reclamacaoServer'
import { urlDeclaracao } from '@/lib/etiquetaReversaServer'

/**
 * GET /api/pedidos/[id]/desistir/declaracao -> { url } do PDF da declaracao
 * de conteudo (DACE) da etiqueta reversa (#500), para o comprador imprimir e
 * colocar junto da carta. So o proprio comprador, com a etiqueta pronta e a
 * devolucao ainda nao postada. O Melhor Envio prepara o PDF em segundo plano:
 * enquanto isso devolve 202 { pendente: true }.
 */

export const dynamic = 'force-dynamic'

function json(status: number, corpo: Record<string, unknown>) {
  return NextResponse.json(corpo, { status, headers: SEM_CACHE })
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  try {
    const { id: pedidoId } = await ctx.params
    if (!UUID_RE.test(pedidoId)) return json(404, { error: 'Pedido não encontrado.' })
    const sb = sbServico()
    const userId = await usuarioDoBearer(req, sb)
    if (!userId) return json(401, { error: 'Não autenticado.' })

    const { data: recs } = await sb
      .from('pedido_reclamacoes')
      .select('etiqueta_me_id, etiqueta_status, devolucao_postada_em')
      .eq('pedido_id', pedidoId)
      .eq('comprador_user_id', userId)
      .eq('motivo', 'arrependimento')
      .eq('status', 'aguardando_devolucao')
      .limit(1)
    const rec = recs?.[0]
    if (!rec || rec.etiqueta_status !== 'pronta' || !rec.etiqueta_me_id) return json(404, { error: 'Nenhuma etiqueta de devolução pronta neste pedido.' })

    const r = await urlDeclaracao(rec.etiqueta_me_id)
    if ('pendente' in r) return json(202, { pendente: true, error: 'A declaração ainda está sendo preparada. Tente de novo em alguns minutos.' })
    if ('erro' in r) {
      console.error('[declaracao]', r.erro)
      return json(502, { error: 'Não deu para buscar a declaração agora. Tente de novo em instantes.' })
    }
    return json(200, { url: r.url })
  } catch (err) {
    console.error('[declaracao] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
