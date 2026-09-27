import { NextRequest, NextResponse } from 'next/server'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { podeCancelarPorAtraso, fmtPrazo, conferirRefund } from '@/lib/leilao-reclamacao'
import {
  SEM_CACHE, UUID_RE, sbServico, usuarioDoBearer, carregarPedido, ehPedidoDeLeilao, lotesDoPedido,
  estornarNaStripe, sino, emailSeguro, contato, nomeDaLoja,
} from '@/lib/reclamacaoServer'
import { renderCancelamentoAtrasoEmail } from '@/lib/email'

/**
 * POST /api/pedidos/[id]/cancelar-atraso
 *
 * Protecao Bynx: a loja tem 3 dias uteis depois do pagamento para enviar um
 * pedido de LEILAO. Passado o prazo sem envio, o COMPRADOR pode pedir o
 * cancelamento e recebe o estorno integral.
 *
 * Mesmo estorno do cancelamento pela loja (refund integral com reverse_transfer
 * + refund_application_fee), com duas diferencas:
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
    if (!pedido.stripe_payment_intent_id) return json(409, { error: 'Pedido sem pagamento associado. Fale com o suporte.' })

    // CAS antes da Stripe: so um lado ganha (este ou o "enviar" da loja).
    if (!retomando) {
      const { data: travou, error: tErr } = await sb
        .from('pedidos')
        .update({ status: 'cancelando', updated_at: new Date().toISOString() })
        .eq('id', pedido.id)
        .eq('status', 'pago')
        .select('id')
      if (tErr) {
        console.error('[cancelar-atraso] trava falhou:', tErr.message)
        return json(500, { error: 'Erro ao iniciar o cancelamento. Nada foi alterado.' })
      }
      if (!travou?.length) {
        return json(409, { error: 'O pedido mudou de situação (a loja pode ter acabado de enviar). Atualize a página.' })
      }
    }
    const destravar = async () => {
      const { error } = await sb.from('pedidos')
        .update({ status: 'pago', updated_at: new Date().toISOString() })
        .eq('id', pedido.id)
        .eq('status', 'cancelando')
      if (error) console.error('[cancelar-atraso] CRITICAL: pedido ficou em cancelando |', pedido.id, '|', error.message)
    }

    let refundId: string
    try {
      const r = await estornarNaStripe({
        paymentIntent: pedido.stripe_payment_intent_id,
        chave: `atraso-${pedido.id}`,
        amountCents: null,
        metadata: { pedido_id: pedido.id, origem: 'cancelamento_atraso' },
      })
      const conf = conferirRefund(r, null)
      if (!conf.ok) {
        console.error(`[cancelar-atraso] refund ${r.id} com status ${r.status} | ${pedido.id}`)
        await destravar()
        return json(502, { error: 'Não foi possível concluir o estorno agora. Nada foi alterado. Tente de novo em instantes.' })
      }
      refundId = r.id
    } catch (e) {
      console.error('[cancelar-atraso] refund falhou:', (e as Error)?.message)
      // Queda de rede: a Stripe pode ter estornado. Fica em 'cancelando' (a
      // loja nao envia) e o retry reaproveita o refund pela chave. Recusa
      // definitiva da Stripe: devolve o pedido para 'pago'.
      if ((e as { type?: string })?.type !== 'StripeConnectionError') await destravar()
      return json(502, { error: 'Não foi possível processar o estorno agora. Nada foi alterado. Tente de novo em instantes.' })
    }

    const agora = new Date().toISOString()
    const { data: mexeu, error: upErr } = await sb
      .from('pedidos')
      .update({
        status: 'reembolsado',
        cancelado_em: agora,
        cancelado_por: 'comprador',
        cancelamento_motivo: 'Loja não enviou em 3 dias úteis (Proteção Bynx)',
        stripe_refund_id: refundId,
        updated_at: agora,
      })
      .eq('id', pedido.id)
      .eq('status', 'cancelando')
      .select('id')
    if (upErr || !mexeu?.length) {
      // O webhook charge.refunded pode ter chegado antes e marcado o pedido.
      // Fora isso, o dinheiro JA voltou na Stripe: loga alto para reconciliar.
      const agoraPed = await carregarPedido(sb, pedido.id).catch(() => null)
      if (agoraPed?.status !== 'reembolsado') {
        console.error('[cancelar-atraso] CRITICAL: refund OK mas pedido nao atualizado |', pedido.id, '| refund', refundId, '|', upErr?.message || `status ${agoraPed?.status}`)
      }
    }

    for (const lote of await lotesDoPedido(sb, pedido)) {
      const { data: r, error } = await sb.rpc('leilao_marcar_reembolsado', { p_leilao: lote, p_pedido: pedido.id })
      if (error || (r !== 'cancelado' && r !== 'ja_cancelado' && r !== 'outro_pedido')) {
        console.error(`[cancelar-atraso] CRITICAL: lote ${lote} (pedido ${pedido.numero}):`, error?.message || r)
      }
    }

    try {
      const loja = await nomeDaLoja(sb, pedido.loja_id)
      const lojista = loja.owner || pedido.vendedor_user_id
      await sino(sb, userId, 'Pedido cancelado e estornado',
        `O pedido #${pedido.numero} foi cancelado por atraso no envio e o valor foi estornado.`, `/pedido/${pedido.id}`)
      await sino(sb, lojista, 'Pedido cancelado por atraso',
        `O comprador cancelou o pedido #${pedido.numero}: o envio não aconteceu em 3 dias úteis.`, `/minha-loja/${pedido.loja_id}/pedidos`)
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
