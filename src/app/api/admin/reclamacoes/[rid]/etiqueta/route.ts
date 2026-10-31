import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { SEM_CACHE, UUID_RE, sbServico } from '@/lib/reclamacaoServer'
import { emitirEtiquetaReversa, sincronizarEtiqueta } from '@/lib/etiquetaReversaServer'

/**
 * POST /api/admin/reclamacoes/[rid]/etiqueta
 *   { acao: 'gerar' }        tenta de novo a etiqueta reversa (ignora o teto
 *                            de tentativas do cron; nunca compra duas: os
 *                            passos ja feitos sao reaproveitados)
 *   { acao: 'sincronizar' }  le o rastreio agora no Melhor Envio
 * Desistencia com etiqueta (#500). lib/etiquetaReversaServer.
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
    const body = await req.json().catch(() => null)
    const sb = sbServico()
    if (body?.acao === 'sincronizar') {
      const r = await sincronizarEtiqueta(sb, rid)
      return json(r === 'erro' ? 502 : 200, { ok: r !== 'erro', resultado: r })
    }
    if (body?.acao !== 'gerar') return json(400, { error: 'Ação inválida.' })
    const r = await emitirEtiquetaReversa(sb, rid, { forcar: true })
    return json(200, r.ok ? { ok: true, codigo: r.codigo } : { ok: false, error: r.erro })
  } catch (err) {
    console.error('[admin etiqueta] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
