import { NextRequest, NextResponse } from 'next/server'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { lojaPodeResponder, lojaSemResposta, lojaPodeContestar, type ReclamacaoEstado, type DevolucaoEstado } from '@/lib/leilao-reclamacao'
import { SEM_CACHE, UUID_RE, COLUNAS_RECLAMACAO, assinarFotos } from '@/lib/reclamacaoServer'

/**
 * GET /api/lojas/[id]/reclamacoes -> reclamacoes dos pedidos de leilao da loja
 * (Protecao Bynx), as abertas primeiro, com as fotos em signed URL curta.
 *
 * Auth: dono da loja ou admin. Leitura pelo service role filtrando por
 * `loja_id` da URL ja validada (a RLS tambem deixaria o dono ler, mas as fotos
 * precisam de signed URL, que so o servidor emite).
 */

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  try {
    const { id: lojaId } = await ctx.params
    if (!UUID_RE.test(lojaId)) return NextResponse.json({ error: 'Loja não encontrada.' }, { status: 404, headers: SEM_CACHE })
    const auth = await autenticarOwnerOuAdmin(req, lojaId, 'id, owner_user_id, nome')
    if ('error' in auth) return auth.error
    const { sb } = auth

    const { data, error } = await sb
      .from('pedido_reclamacoes')
      .select(COLUNAS_RECLAMACAO)
      .eq('loja_id', lojaId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      console.error('[lojas/reclamacoes GET]', error.message)
      return NextResponse.json({ error: 'Erro ao carregar reclamações.' }, { status: 500, headers: SEM_CACHE })
    }
    const linhas = (data || []) as unknown as (ReclamacaoEstado & Record<string, unknown> & { pedido_id: string; fotos: string[] })[]

    const idsPedido = [...new Set(linhas.map(l => l.pedido_id))]
    const pedidos: Record<string, Record<string, unknown>> = {}
    if (idsPedido.length) {
      const { data: peds } = await sb
        .from('pedidos')
        .select('id, numero, item_nome, item_imagem, rastreio, enviado_em, entregue_em, total_comprador_cents, envio_fotos')
        .in('id', idsPedido)
      for (const p of peds || []) pedidos[p.id as string] = p
    }
    // Fotos do comprador (reclamacao) e da propria loja no envio (prova na desistencia).
    const urls = await assinarFotos(sb, [
      ...linhas.flatMap(l => l.fotos || []),
      ...Object.values(pedidos).flatMap(p => (p.envio_fotos as string[] | null) || []),
    ])

    const agora = Date.now()
    const ordem = (s: string) => (s === 'aguardando_loja' ? 0 : s === 'em_analise' || s === 'aguardando_devolucao' ? 1 : 2)
    const reclamacoes = linhas
      .map(l => ({
        ...l,
        pedido: pedidos[l.pedido_id] || null,
        fotos_url: (l.fotos || []).map(f => urls[f]).filter(Boolean),
        envio_fotos_url: (((pedidos[l.pedido_id]?.envio_fotos as string[] | null) || [])).map(f => urls[f]).filter(Boolean),
        pode_responder: lojaPodeResponder(l, agora),
        pode_contestar: lojaPodeContestar(l as unknown as DevolucaoEstado, agora),
        sem_resposta: lojaSemResposta(l, agora),
      }))
      .sort((a, b) => ordem(String(a.status)) - ordem(String(b.status)))

    return NextResponse.json({ reclamacoes }, { headers: SEM_CACHE })
  } catch (err) {
    console.error('[lojas/reclamacoes GET] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500, headers: SEM_CACHE })
  }
}
