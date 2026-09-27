import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { lojaSemResposta, podeDecidir, type ReclamacaoEstado } from '@/lib/leilao-reclamacao'
import { SEM_CACHE, COLUNAS_RECLAMACAO, sbServico, assinarFotos } from '@/lib/reclamacaoServer'

/**
 * GET /api/admin/reclamacoes -> fila da Protecao Bynx (reclamacoes de pedido
 * de leilao), abertas primeiro. Cada linha traz o pedido (rastreio, datas,
 * valores), a loja, o comprador, a resposta da loja e as fotos em signed URL
 * de 10 min. `sem_resposta` = prazo da loja venceu sem resposta (decisao a
 * favor do comprador); `pode_decidir` libera os botoes.
 */

export const dynamic = 'force-dynamic'

type Linha = ReclamacaoEstado & Record<string, unknown> & {
  id: string; pedido_id: string; loja_id: string; comprador_user_id: string; fotos: string[]
}

export async function GET(req: NextRequest) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  try {
    const sb = sbServico()
    const { data, error } = await sb
      .from('pedido_reclamacoes')
      .select(COLUNAS_RECLAMACAO)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      console.error('[admin/reclamacoes]', error.message)
      return NextResponse.json({ error: 'Erro ao carregar.' }, { status: 500, headers: SEM_CACHE })
    }
    const linhas = (data || []) as unknown as Linha[]

    const idsPed = [...new Set(linhas.map(l => l.pedido_id))]
    const idsLoja = [...new Set(linhas.map(l => l.loja_id))]
    const idsUser = [...new Set(linhas.map(l => l.comprador_user_id))]
    const [peds, lojas, users, urls] = await Promise.all([
      idsPed.length
        ? sb.from('pedidos').select('id, numero, status, item_nome, item_imagem, rastreio, pago_em, enviado_em, entregue_em, recebido_automatico, total_comprador_cents, valor_reembolsado_cents').in('id', idsPed)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      idsLoja.length ? sb.from('lojas').select('id, nome, slug').in('id', idsLoja) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      idsUser.length ? sb.from('users').select('id, name, email').in('id', idsUser) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      assinarFotos(sb, linhas.flatMap(l => l.fotos || [])),
    ])
    const porId = (rows: Record<string, unknown>[] | null | undefined) =>
      Object.fromEntries((rows || []).map(r => [r.id as string, r]))
    const P = porId(peds.data), L = porId(lojas.data), U = porId(users.data)

    const agora = Date.now()
    const aberta = (s: string) => s === 'aguardando_loja' || s === 'em_analise' || s === 'aguardando_devolucao'
    const reclamacoes = linhas
      .map(l => {
        const p = P[l.pedido_id] as { total_comprador_cents?: number; valor_reembolsado_cents?: number } | undefined
        return {
          ...l,
          pedido: p || null,
          loja: L[l.loja_id] || null,
          comprador: U[l.comprador_user_id] || null,
          fotos_url: (l.fotos || []).map(f => urls[f]).filter(Boolean),
          sem_resposta: lojaSemResposta(l, agora),
          pode_decidir: podeDecidir(l, agora),
          restante_cents: Math.max(0, (p?.total_comprador_cents || 0) - (p?.valor_reembolsado_cents || 0)),
        }
      })
      .sort((a, b) => Number(aberta(String(b.status))) - Number(aberta(String(a.status))))

    return NextResponse.json({ reclamacoes }, { headers: SEM_CACHE })
  } catch (err) {
    console.error('[admin/reclamacoes] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500, headers: SEM_CACHE })
  }
}
