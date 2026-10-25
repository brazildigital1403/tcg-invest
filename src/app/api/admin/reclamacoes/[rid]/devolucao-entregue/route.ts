import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { SEM_CACHE, UUID_RE, sbServico, marcarDevolucaoEntregue } from '@/lib/reclamacaoServer'

/**
 * POST /api/admin/reclamacoes/[rid]/devolucao-entregue
 *
 * A Bynx confere o rastreio da devolucao e marca que ela chegou na loja.
 * Abre a janela de contestacao: contestar_ate = agora + DIAS_UTEIS_CONTESTAR
 * dias uteis. Passada a janela sem contestacao, o cron estorna sozinho
 * (acaoDevolucao). Compare-and-set: so desistencia postada e ainda nao
 * marcada como entregue.
 *
 * ★ Etapa 1 (#469). Na etapa 2 o rastreio da etiqueta do Melhor Envio marca
 *   a entrega sozinho e este botao vira so o plano B.
 */

export const dynamic = 'force-dynamic'

function json(status: number, corpo: Record<string, unknown>) {
  return NextResponse.json(corpo, { status, headers: SEM_CACHE })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ rid: string }> }) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  try {
    const { rid } = await ctx.params
    if (!UUID_RE.test(rid)) return json(404, { error: 'Desistência não encontrada.' })
    const sb = sbServico()

    let r: { contestarAte: Date } | null
    try {
      r = await marcarDevolucaoEntregue(sb, rid, new Date())
    } catch (e) {
      console.error('[devolucao-entregue]', (e as Error)?.message)
      return json(500, { error: 'Erro ao marcar a entrega.' })
    }
    if (!r) return json(409, { error: 'Só dá para marcar uma desistência postada e ainda não entregue.' })
    const contestarAte = r.contestarAte

    return json(200, { ok: true, contestar_ate: contestarAte.toISOString() })
  } catch (err) {
    console.error('[devolucao-entregue] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
