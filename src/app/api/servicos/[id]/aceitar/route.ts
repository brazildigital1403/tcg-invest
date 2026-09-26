// POST /api/servicos/[id]/aceitar -- o cliente responde ao orcamento.
//
// Body: { termo_aceito: true, itens?: { [item_id]: boolean } } para aceitar
// (por carta: o que vier false fica de fora), ou { recusar: true } para
// recusar tudo. So vale na transicao orcado -> aceito | recusado_cliente; o
// update filtra pelo status atual, entao duas respostas simultaneas nao passam.

import { NextRequest, NextResponse } from 'next/server'
import { sbAdmin, carregarAutorizado, erro, registrarEvento, notificarCliente, TERMO_VERSAO_ATUAL } from '@/lib/servicosServer'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const auth = await carregarAutorizado(req, id)
    if (!auth.ok) return auth.resposta
    if (auth.sol.status !== 'orcado') return erro(409, 'Este pedido não está aguardando a sua resposta')

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return erro(400, 'Dados inválidos')
    const sb = sbAdmin()

    if (body.recusar === true) {
      const { data, error } = await sb.from('servico_solicitacoes')
        .update({ status: 'recusado_cliente' }).eq('id', id).eq('status', 'orcado').select('id')
      if (error) throw new Error(error.message)
      if (!data?.length) return erro(409, 'Este pedido mudou de estado. Atualize a página.')
      await registrarEvento(id, 'recusado_cliente', 'Orçamento recusado pelo cliente')
      return NextResponse.json({ ok: true, status: 'recusado_cliente' })
    }

    if (body.termo_aceito !== true) return erro(400, 'Aceite o termo de ciência de risco para seguir')

    const { data: itens } = await sb.from('servico_itens').select('id, aceito').eq('solicitacao_id', id)
    // Carta recusada pela Bynx no orcamento ja vem com aceito=false e fica assim.
    const escolha = (body.itens && typeof body.itens === 'object' ? body.itens : {}) as Record<string, unknown>
    const aceitos: string[] = []
    const recusados: string[] = []
    for (const it of itens || []) {
      if (it.aceito === false) continue
      if (escolha[it.id] === false) recusados.push(it.id)
      else aceitos.push(it.id)
    }
    if (!aceitos.length) return erro(400, 'Nenhuma carta aceita. Para desistir, recuse o orçamento.')

    const { data, error } = await sb.from('servico_solicitacoes')
      .update({ status: 'aceito', termo_versao: TERMO_VERSAO_ATUAL, termo_aceito_em: new Date().toISOString() })
      .eq('id', id).eq('status', 'orcado').select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) return erro(409, 'Este pedido mudou de estado. Atualize a página.')

    await sb.from('servico_itens').update({ aceito: true }).in('id', aceitos)
    if (recusados.length) await sb.from('servico_itens').update({ aceito: false, recusa_motivo: 'Recusada pelo cliente' }).in('id', recusados)

    await registrarEvento(id, 'aceito', `Orçamento aceito: ${aceitos.length} ${aceitos.length === 1 ? 'carta' : 'cartas'}`)
    await notificarCliente(id, 'aceito')
    return NextResponse.json({ ok: true, status: 'aceito', aceitos: aceitos.length })
  } catch (e) {
    console.error('[servicos/aceitar]', e instanceof Error ? e.message : e)
    return erro(500, 'Erro interno')
  }
}
