import { NextResponse, connection } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { lerLancesDoLote } from '@/app/leiloes/rodada/_dados-rodada'

/**
 * GET /api/leiloes/[id]/lances: ultimos lances do lote, com apelido mascarado.
 * Publico e igual para todos: 5 s na CDN so na resposta 200.
 */
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  await connection()
  const { id } = await ctx.params
  const db = getServiceSupabase()
  if (!db || !RE_UUID.test(id)) return NextResponse.json({ erro: 'invalido' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  const lances = await lerLancesDoLote(db, id)
  if (!lances) return NextResponse.json({ erro: 'falha' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json({ lances }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=5' } })
}
