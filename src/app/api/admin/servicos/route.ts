// GET /api/admin/servicos -- fila do servico de bancada para o painel.
// Ultimas 200 solicitacoes, com cliente, quantidade de cartas, valor declarado
// e se as fotos ja chegaram (pedido sem fotos completas ainda nao e orcavel).

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { sbAdmin } from '@/lib/servicosServer'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  try {
    const sb = sbAdmin()
    const { data: sols, error } = await sb
      .from('servico_solicitacoes')
      .select('id, numero, user_id, servico, prazo, status, valor_declarado_cents, total_cents, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(200)
    if (error) throw new Error(error.message)

    const ids = (sols || []).map(s => s.id)
    const userIds = [...new Set((sols || []).map(s => s.user_id))]
    const [{ data: itens }, { data: users }, { data: completas }] = await Promise.all([
      ids.length ? sb.from('servico_itens').select('solicitacao_id').in('solicitacao_id', ids) : Promise.resolve({ data: [] as { solicitacao_id: string }[] }),
      userIds.length ? sb.from('users').select('id, name, email').in('id', userIds) : Promise.resolve({ data: [] as { id: string; name: string; email: string }[] }),
      ids.length ? sb.from('servico_eventos').select('solicitacao_id').eq('status', 'fotos_completas').in('solicitacao_id', ids) : Promise.resolve({ data: [] as { solicitacao_id: string }[] }),
    ])

    const nCartas = new Map<string, number>()
    for (const i of itens || []) nCartas.set(i.solicitacao_id, (nCartas.get(i.solicitacao_id) || 0) + 1)
    const userMap = new Map((users || []).map(u => [u.id, u]))
    const comFotos = new Set((completas || []).map(e => e.solicitacao_id))

    return NextResponse.json({
      solicitacoes: (sols || []).map(s => ({
        ...s,
        cartas: nCartas.get(s.id) || 0,
        fotos_completas: comFotos.has(s.id),
        user_name: userMap.get(s.user_id)?.name || null,
        user_email: userMap.get(s.user_id)?.email || null,
      })),
    })
  } catch (e) {
    console.error('[admin/servicos GET]', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Erro ao carregar' }, { status: 500 })
  }
}
