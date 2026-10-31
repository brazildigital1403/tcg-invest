import { NextRequest, NextResponse } from 'next/server'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { podeCancelarPorAtraso, fmtPrazo, DIAS_UTEIS_ENVIO } from '@/lib/leilao-reclamacao'
import {
  SEM_CACHE, UUID_RE, sbServico, usuarioDoBearer, carregarPedido, ehPedidoDeLeilao, cancelarPagoComEstorno,
  sino, emailSeguro, contato, nomeDaLoja,
} from '@/lib/reclamacaoServer'
import { renderCancelamentoAtrasoEmail } from '@/lib/email'

/**
 * POST /api/pedidos/[id]/cancelar-atraso
 *
 * Protecao Bynx: a loja tem DIAS_UTEIS_ENVIO dias uteis depois do pagamento para enviar um
 * pedido de LEILAO. Passado o prazo sem envio, o COMPRADOR pode pedir o
 * cancelamento e recebe o estorno integral.
 *
 * Mesmo estorno do cancelamento pela loja (refund integral com reverse_transfer;
 * a comissao volta para a loja menos a taxa da Stripe, lib/custoEstorno), com
 * duas diferencas:
 *   - idempotente pela chave 'atraso-<pedido>' (idempotencyKey + procura de
 *     refund com a mesma chave antes de criar);
 *   - o financeiro (lancamentos, comissao de parceiro) fica com o webhook
 *     charge.refunded, que ja cobre o estorno integral de qualquer origem.
 *     Fazer aqui tambem aplicaria a reversao duas vezes.
 * Provedor antes do banco: a Stripe estorna primeiro; o pedido so vira
 * 'reembolsado' depois.
 *
 * ★ CORRIDA COM O "ENVIAR" DA LOJA. Antes da Stripe, compare-and-set
 *   pago -> 'cancelando' (update com .eq('status','pago'), atomico no banco).
 *   O "enviar" (/api/lojas/[id]/pedidos) so vale de 'pago', entao a loja nao
 *   marca como enviado um pedido que ja esta sendo estornado -- e se ela
 *   enviou primeiro, o CAS pega 0 linhas e nada e estornado. Stripe recusou
 *   -> volta para 'pago'. Queda no meio deixa 'cancelando': o comprador pode
 *   repetir (o refund e reaproveitado pela chave).
 * O lote vai para 'cancelado' (leilao_marcar_reembolsado, idempotente -- o
 * webhook chama de novo sem efeito).
 * A sequencia (CAS, Stripe, pedido, lotes) mora em cancelarPagoComEstorno
 * (lib/reclamacaoServer), dividida com a desistencia antes do envio.
 */

export const dynamic = 'force-dynamic'

function json(status: number, corpo: Record<string, unknown>) {
  return NextResponse.json(corpo, { status, headers: SEM_CACHE })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  try {
    const { id: pedidoId } = await ctx.params
    if (!UUID_RE.test(pedidoId)) return json(404, { error: 'Pedido não encontrado.' })
    const sb = sbServico()
    const userId = await usuarioDoBearer(req, sb)
    if (!userId) return json(401, { error: 'Não autenticado.' })

    const pedido = await carregarPedido(sb, pedidoId)
    if (!pedido || pedido.comprador_user_id !== userId) return json(404, { error: 'Pedido não encontrado.' })
    const ehLeilao = await ehPedidoDeLeilao(sb, pedido)
    // 'cancelando' = tentativa anterior caiu no meio: segue como se fosse pago.
    const retomando = pedido.status === 'cancelando'
    const pode = podeCancelarPorAtraso({ ...pedido, status: retomando ? 'pago' : pedido.status, ehLeilao }, Date.now())
    if (!pode.pode) {
      if (pode.motivo === 'no_prazo') {
        return json(409, { error: `A loja ainda está no prazo de envio. Se não enviar, você pode cancelar a partir de ${fmtPrazo(pode.liberaEm)}.` })
      }
      return json(409, { error: 'Este pedido não pode ser cancelado por aqui.' })
    }
    // Trava, Stripe, pedido e lotes: cancelarPagoComEstorno (mesma sequencia
    // da desistencia antes do envio).
    const r = await cancelarPagoComEstorno(sb, pedido, {
      chave: `atraso-${pedido.id}`,
      origem: 'cancelamento_atraso',
      canceladoPor: 'comprador',
      motivoTexto: `Loja não enviou em ${DIAS_UTEIS_ENVIO} dias úteis (Proteção Bynx)`,
      log: 'cancelar-atraso',
    })
    if (!r.ok) return json(r.http, { error: r.erro })

    try {
      const loja = await nomeDaLoja(sb, pedido.loja_id)
      const lojista = loja.owner || pedido.vendedor_user_id
      await sino(sb, userId, 'Pedido cancelado e estornado',
        `O pedido #${pedido.numero} foi cancelado por atraso no envio e o valor foi estornado.`, `/pedido/${pedido.id}`)
      await sino(sb, lojista, 'Pedido cancelado por atraso',
        `O comprador cancelou o pedido #${pedido.numero}: o envio não aconteceu em ${DIAS_UTEIS_ENVIO} dias úteis.`, `/minha-loja/${pedido.loja_id}/pedidos`)
      const base = {
        pedidoId: pedido.id, pedidoNumero: pedido.numero, itemNome: pedido.item_nome,
        lojaNome: loja.nome, lojaId: pedido.loja_id, valorCents: pedido.total_comprador_cents,
      }
      const cc = await contato(sb, userId)
      if (cc.email) await emailSeguro(renderCancelamentoAtrasoEmail({ ...base, to: cc.email, nome: cc.nome, papel: 'comprador' }))
      const cl = await contato(sb, lojista)
      if (cl.email) await emailSeguro(renderCancelamentoAtrasoEmail({ ...base, to: cl.email, nome: cl.nome, papel: 'loja' }))
    } catch (err) {
      console.error('[cancelar-atraso] avisos:', (err as Error)?.message)
    }

    return json(200, { ok: true, reembolsado: true })
  } catch (err) {
    console.error('[cancelar-atraso] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
