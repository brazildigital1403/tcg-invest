import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { lotePublicoDeLinha } from '@/lib/leilao'

/**
 * GET /api/leiloes/[id]/estado
 *
 * Estado vivo de um lote para o relogio e o placar da tela. Leitura por PK da
 * view `leiloes_publico` (sem o teto oculto do lider, apelido ja mascarado).
 * Sem login. Sem cache em nenhuma camada: o valor muda a cada lance, e o
 * `server_now` e o que a tela usa para acertar o proprio relogio.
 *
 * Service role no servidor porque a view e security_invoker; o que sai daqui
 * e so o que a view expoe. Rascunho nao e publico.
 */

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const semCache = { 'Cache-Control': 'no-store, max-age=0' }

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })

  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ erro: 'nao_encontrado' }, { status: 404, headers: semCache })
  }

  const db = getServiceSupabase()
  if (!db) return NextResponse.json({ erro: 'config' }, { status: 500, headers: semCache })

  const { data, error } = await db
    .from('leiloes_publico')
    .select('*')
    .eq('id', id)
    .neq('status', 'rascunho')
    .maybeSingle()

  const serverNow = new Date().toISOString()

  if (error) {
    console.error('[leilao/estado]', id, error.code, error.message)
    return NextResponse.json({ erro: 'falha', server_now: serverNow }, { status: 500, headers: semCache })
  }
  if (!data) {
    return NextResponse.json({ erro: 'nao_encontrado', server_now: serverNow }, { status: 404, headers: semCache })
  }

  return NextResponse.json(
    { lote: lotePublicoDeLinha(data as Record<string, unknown>), server_now: serverNow },
    { headers: semCache }
  )
}
