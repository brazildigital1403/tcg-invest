import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { lerCentralLeilao } from '@/lib/leilaoAdmin'
import { SEM_CACHE, sbServico } from '@/lib/reclamacaoServer'

/**
 * GET /api/admin/leiloes -> central do leilao no Admin. So leitura e sem cache.
 * Leitura que falha volta null e entra em `falhas` (ver lib/leilaoAdmin).
 */

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  try {
    return NextResponse.json(await lerCentralLeilao(sbServico()), { headers: SEM_CACHE })
  } catch (err) {
    console.error('[admin/leiloes]', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro ao carregar.' }, { status: 500, headers: SEM_CACHE })
  }
}
