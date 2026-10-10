// Relatorio de bancada de UMA solicitacao (admin).
//
// GET -> o dado do documento A4 (RelatorioDados), ja limpo: sem e-mail,
//        WhatsApp, endereco, ids da Stripe, paths do bucket nem nota crua de
//        evento. So com status pronta/enviada/entregue/devolvida_sem_servico,
//        e 409 com a lista quando a trava de saida (recalculada aqui, sem olhar
//        status) ainda tem pendencia.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { sbAdmin, erro } from '@/lib/servicosServer'
import { montarRelatorio } from '@/lib/servicosRelatorioServer'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  try {
    const { id } = await ctx.params
    const r = await montarRelatorio(sbAdmin(), id)
    if (!r.ok) {
      return NextResponse.json(
        { error: r.erro, ...(r.pendencias ? { pendencias: r.pendencias } : {}) },
        { status: r.status, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    return NextResponse.json(r.dados, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[admin/servicos/id/relatorio GET]', e instanceof Error ? e.message : e)
    return erro(500, 'Erro ao montar o relatório')
  }
}
