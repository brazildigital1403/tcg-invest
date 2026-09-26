// POST /api/servicos/[id]/proposta -- o cliente decide a proposta de tratamento.
//
// Body: { termo_aceito: true, decisoes: { [procedimento_id]: 'aprovado' | 'recusado' } }.
// Precisa decidir TODOS os procedimentos pendentes (nada fica no limbo) e
// aceitar o termo especifico. So vale enquanto o pedido esta em 'proposta';
// a gravacao do aceite filtra pelo status e por proposta_aceita_em nulo, entao
// duas respostas simultaneas nao passam. A Bynx e avisada por e-mail.

import { NextRequest, NextResponse } from 'next/server'
import { sbAdmin, carregarAutorizado, erro, registrarEvento, notificarAdmin } from '@/lib/servicosServer'
import { TERMO_PROPOSTA_VERSAO } from '@/lib/servicos'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const auth = await carregarAutorizado(req, id)
    if (!auth.ok) return auth.resposta
    if (auth.sol.status !== 'proposta') return erro(409, 'Este pedido não está esperando a sua decisão')

    const body = await req.json().catch(() => null)
    if (body?.termo_aceito !== true) return erro(400, 'Aceite o termo da proposta para seguir')
    const decisoes = (body?.decisoes && typeof body.decisoes === 'object' ? body.decisoes : {}) as Record<string, unknown>

    const sb = sbAdmin()
    const { data: procs } = await sb.from('servico_procedimentos').select('id, decisao').eq('solicitacao_id', id)
    const pendentes = (procs || []).filter(p => p.decisao === 'pendente')
    if (!pendentes.length) return erro(409, 'Não há procedimentos esperando decisão')
    for (const p of pendentes) {
      if (decisoes[p.id] !== 'aprovado' && decisoes[p.id] !== 'recusado') return erro(400, 'Decida todos os procedimentos antes de enviar')
    }

    // Trava a proposta primeiro: so uma resposta passa.
    const agora = new Date().toISOString()
    const { data: travou, error } = await sb.from('servico_solicitacoes')
      .update({ proposta_aceita_em: agora, proposta_termo_versao: TERMO_PROPOSTA_VERSAO })
      .eq('id', id).eq('status', 'proposta').is('proposta_aceita_em', null).select('id')
    if (error) throw new Error(error.message)
    if (!travou?.length) return erro(409, 'Esta proposta já foi respondida. Atualize a página.')

    const aprovados = pendentes.filter(p => decisoes[p.id] === 'aprovado').map(p => p.id)
    const recusados = pendentes.filter(p => decisoes[p.id] === 'recusado').map(p => p.id)
    if (aprovados.length) await sb.from('servico_procedimentos').update({ decisao: 'aprovado', decidido_em: agora }).in('id', aprovados)
    if (recusados.length) await sb.from('servico_procedimentos').update({ decisao: 'recusado', decidido_em: agora }).in('id', recusados)

    const resumo = `${aprovados.length} ${aprovados.length === 1 ? 'procedimento aprovado' : 'procedimentos aprovados'}, ${recusados.length} ${recusados.length === 1 ? 'recusado' : 'recusados'}`
    await registrarEvento(id, 'proposta', `Proposta respondida pelo cliente: ${resumo}`)
    await notificarAdmin(id, 'Proposta respondida', [
      `O cliente respondeu a proposta de tratamento: ${resumo}.`,
      aprovados.length ? 'Já dá para levar as cartas para a bancada.' : 'Nada foi aprovado: a carta volta sem serviço.',
    ])
    return NextResponse.json({ ok: true, aprovados: aprovados.length, recusados: recusados.length })
  } catch (e) {
    console.error('[servicos/proposta]', e instanceof Error ? e.message : e)
    return erro(500, 'Erro interno')
  }
}
