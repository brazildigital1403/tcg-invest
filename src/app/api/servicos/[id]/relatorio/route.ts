// GET /api/servicos/[id]/relatorio -- o relatorio de bancada visto pelo DONO.
//
// Mesmo dado do painel (montarRelatorio: sem contato, ids da Stripe, path de
// bucket nem nota crua de evento), com duas travas a mais:
//   1. So o dono (carregarAutorizado sem permitirAdmin). O admin tem a rota dele.
//   2. ★ So com o pedido ENTREGUE (STATUS_RELATORIO_CLIENTE, decisao do Du): o
//      cliente recebe o documento fisico na caixa e, a partir dai, o digital.
//      Fora disso, 409 -- antes de qualquer leitura do relatorio.
// O 409 da trava de saida NAO repassa `pendencias` (texto interno de bancada).

import { NextRequest, NextResponse } from 'next/server'
import { sbAdmin, carregarAutorizado } from '@/lib/servicosServer'
import { montarRelatorio } from '@/lib/servicosRelatorioServer'
import { STATUS_RELATORIO_CLIENTE } from '@/lib/servicos'

export const dynamic = 'force-dynamic'

const SEM_CACHE = { 'Cache-Control': 'no-store' }
const falha = (status: number, error: string) => NextResponse.json({ error }, { status, headers: SEM_CACHE })

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const auth = await carregarAutorizado(req, id)
    if (!auth.ok) return auth.resposta
    if (auth.sol.status !== STATUS_RELATORIO_CLIENTE) {
      return falha(409, 'O relatório fica disponível quando a carta é entregue.')
    }
    const r = await montarRelatorio(sbAdmin(), id)
    if (!r.ok) {
      return falha(r.status, r.status === 409 ? 'O relatório deste pedido ainda está sendo fechado. Fale com a Bynx.' : r.erro)
    }
    return NextResponse.json(r.dados, { headers: SEM_CACHE })
  } catch (e) {
    console.error('[servicos/id/relatorio GET]', e instanceof Error ? e.message : e)
    return falha(500, 'Erro ao montar o relatório')
  }
}
