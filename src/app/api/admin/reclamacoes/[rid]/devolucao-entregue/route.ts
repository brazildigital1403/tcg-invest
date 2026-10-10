import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { prazoContestacao, fmtPrazo } from '@/lib/leilao-reclamacao'
import { SEM_CACHE, UUID_RE, sbServico, carregarPedido, sino, emailSeguro, contato, nomeDaLoja } from '@/lib/reclamacaoServer'
import { renderArrependimentoEmail } from '@/lib/email'

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

    const agora = new Date()
    const contestarAte = prazoContestacao(agora)!
    const { data: mexeu, error } = await sb
      .from('pedido_reclamacoes')
      .update({ devolucao_entregue_em: agora.toISOString(), contestar_ate: contestarAte.toISOString(), updated_at: agora.toISOString() })
      .eq('id', rid)
      .eq('motivo', 'arrependimento')
      .eq('status', 'aguardando_devolucao')
      .not('devolucao_postada_em', 'is', null)
      .is('devolucao_entregue_em', null)
      .select('id, pedido_id, loja_id, vendedor_user_id')
    if (error) {
      console.error('[devolucao-entregue]', error.message)
      return json(500, { error: 'Erro ao marcar a entrega.' })
    }
    const rec = mexeu?.[0]
    if (!rec) return json(409, { error: 'Só dá para marcar uma desistência postada e ainda não entregue.' })

    try {
      const pedido = await carregarPedido(sb, rec.pedido_id)
      const loja = await nomeDaLoja(sb, rec.loja_id)
      const lojista = loja.owner || rec.vendedor_user_id
      const prazo = fmtPrazo(contestarAte)
      await sino(sb, lojista, 'A devolução chegou na loja',
        `Confira a carta do pedido #${pedido?.numero ?? ''}. Se voltou diferente, conteste até ${prazo}.`, `/minha-loja/${rec.loja_id}/pedidos`)
      const cl = await contato(sb, lojista)
      if (cl.email && pedido) {
        await emailSeguro(renderArrependimentoEmail({
          to: cl.email, nome: cl.nome, papel: 'loja', etapa: 'entregue', prazo,
          pedidoId: pedido.id, pedidoNumero: pedido.numero, itemNome: pedido.item_nome, lojaNome: loja.nome, lojaId: rec.loja_id,
        }))
      }
    } catch (err) {
      console.error('[devolucao-entregue] avisos:', (err as Error)?.message)
    }

    return json(200, { ok: true, contestar_ate: contestarAte.toISOString() })
  } catch (err) {
    console.error('[devolucao-entregue] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
