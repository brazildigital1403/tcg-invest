import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { planejarDecisao, restanteEstornavel, conferirRefund } from '@/lib/leilao-reclamacao'
import {
  SEM_CACHE, UUID_RE, sbServico, carregarPedido, lotesDoPedido, estornarNaStripe, situacaoNaStripe, sino, emailSeguro, contato, nomeDaLoja,
} from '@/lib/reclamacaoServer'
import { renderReclamacaoDecisaoEmail } from '@/lib/email'

/**
 * POST /api/admin/reclamacoes/[rid]/decidir
 *   { decisao: 'estorno_total' | 'estorno_parcial' | 'devolucao' | 'improcedente',
 *     valor_cents?: number (so no parcial), nota?: string }
 *
 * A Bynx decide (Protecao Bynx). Regras e travas em planejarDecisao
 * (lib/leilao-reclamacao, com autoteste):
 *   - so decide com a loja fora do prazo ou depois da resposta dela;
 *   - devolucao em DOIS passos: o primeiro so muda para 'aguardando_devolucao'
 *     (a trava do fechamento automatico continua); o segundo, com a carta de
 *     volta, estorna o restante. Frete de volta e combinado fora do sistema
 *     (por conta de quem errou) -- nao ha cobranca aqui.
 *
 * ★ PROVEDOR ANTES DO BANCO. Com dinheiro, a Stripe estorna primeiro
 *   (reverse_transfer + refund_application_fee, proporcional no parcial) com
 *   idempotencyKey 'reclamacao-<rid>' e procura previa pela mesma chave; so
 *   depois pedido_reclamacao_resolver grava (idempotente pelo refund). Se o
 *   banco falhar com o refund feito, repetir o clique reaproveita o refund.
 *   Refund reaproveitado com valor DIFERENTE do plano atual -> 409 sem gravar
 *   (ex.: 1a tentativa parcial caiu no banco, agora o admin pede total).
 *   Refund fora de succeeded/pending (failed, canceled) -> 502 sem gravar.
 * ★ RESTANTE vem da STRIPE (amount - amount_refunded da charge, que pega
 *   estorno manual no dashboard) e do banco, o menor dos dois; o refund desta
 *   propria chave volta para o restante (retry). Ver restanteEstornavel.
 * ★ FINANCEIRO: lancamentos e comissao de parceiro ficam com o webhook
 *   charge.refunded (proporcional ao devolvido). Nao duplicar aqui.
 * ★ LOTE: so no estorno do restante inteiro (estorno_total ou devolucao
 *   concluida) o lote vai para 'cancelado' (leilao_marcar_reembolsado,
 *   idempotente). Parcial nao cancela a venda.
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
    if (!UUID_RE.test(rid)) return json(404, { error: 'Reclamação não encontrada.' })
    const sb = sbServico()

    const body = await req.json().catch(() => null)
    const decisao = String(body?.decisao || '')
    const nota = typeof body?.nota === 'string' ? body.nota.trim().slice(0, 2000) || null : null

    const { data: recs } = await sb
      .from('pedido_reclamacoes')
      .select('id, pedido_id, status, prazo_loja_ate, comprador_user_id')
      .eq('id', rid)
      .limit(1)
    const rec = recs?.[0]
    if (!rec) return json(404, { error: 'Reclamação não encontrada.' })
    const pedido = await carregarPedido(sb, rec.pedido_id)
    if (!pedido) return json(404, { error: 'Pedido não encontrado.' })

    const chave = `reclamacao-${rid}`
    let charge: { amount: number; amountRefunded: number } | null = null
    let refundDestaChaveCents = 0
    if (pedido.stripe_payment_intent_id && decisao !== 'improcedente') {
      try {
        const sit = await situacaoNaStripe(pedido.stripe_payment_intent_id, chave)
        charge = sit.charge
        refundDestaChaveCents = sit.refundDestaChaveCents
      } catch (e) {
        console.error('[reclamacao decidir] leitura da Stripe falhou:', (e as Error)?.message)
        return json(502, { error: 'Não foi possível consultar o pagamento na Stripe. Nada foi alterado. Tente de novo em instantes.' })
      }
    }
    const restante = restanteEstornavel({
      totalCents: pedido.total_comprador_cents,
      reembolsadoBancoCents: pedido.valor_reembolsado_cents || 0,
      charge,
      refundDestaChaveCents,
    })
    const plano = planejarDecisao({ r: rec, decisao, valorCents: body?.valor_cents, restanteCents: restante, agora: Date.now() })
    if (!plano.ok) return json(409, { error: plano.erro })
    // Sem trava por pedidos.status aqui de proposito: no retry depois de uma
    // falha do banco, o webhook pode ja ter marcado o pedido 'reembolsado' e o
    // retry PRECISA passar para reaproveitar o refund e gravar a decisao. Quem
    // barra estorno acima do pago e a propria Stripe (recusa -> 502).

    // 1. Stripe (so quando ha dinheiro)
    let refundId: string | null = null
    let valor = 0
    if (plano.valorCents > 0) {
      if (!pedido.stripe_payment_intent_id) return json(409, { error: 'Pedido sem pagamento associado.' })
      try {
        const r = await estornarNaStripe({
          paymentIntent: pedido.stripe_payment_intent_id,
          chave,
          amountCents: plano.valorCents,
          metadata: { pedido_id: pedido.id, reclamacao_id: rid, decisao },
        })
        const conf = conferirRefund(r, plano.valorCents)
        if (!conf.ok) {
          console.error(`[reclamacao decidir] refund ${r.id} recusado (${r.reaproveitado ? 'reaproveitado' : 'novo'}, ${r.amount}/${plano.valorCents}, ${r.status}) | ${rid}`)
          return json(conf.http, { error: conf.erro, refund: r.id })
        }
        refundId = r.id
        valor = r.amount
      } catch (e) {
        console.error('[reclamacao decidir] refund falhou:', (e as Error)?.message)
        return json(502, { error: 'A Stripe não aceitou o estorno. Nada foi alterado. Tente de novo em instantes.' })
      }
    }

    // 2. Banco
    const { data: res, error } = await sb.rpc('pedido_reclamacao_resolver', {
      p_reclamacao: rid,
      p_status: plano.status,
      p_decisao: decisao,
      p_valor_cents: valor,
      p_refund: refundId,
      p_por: 'admin',
      p_nota: nota,
    })
    if (error) {
      console.error('[reclamacao decidir] CRITICAL: resolver falhou |', rid, '| refund', refundId, '|', error.message)
      return json(500, {
        error: refundId
          ? 'O estorno foi feito na Stripe, mas a reclamação não foi atualizada. Clique de novo: o mesmo estorno é reaproveitado.'
          : 'Erro ao registrar a decisão.',
      })
    }

    // 3. Lote do leilao: so quando o pedido foi estornado por inteiro.
    const total = plano.status === 'resolvida' && (decisao === 'estorno_total' || decisao === 'devolucao')
    if (total) {
      for (const lote of await lotesDoPedido(sb, pedido)) {
        const { data: r, error: e } = await sb.rpc('leilao_marcar_reembolsado', { p_leilao: lote, p_pedido: pedido.id })
        if (e || (r !== 'cancelado' && r !== 'ja_cancelado' && r !== 'outro_pedido')) {
          console.error(`[reclamacao decidir] CRITICAL: lote ${lote} (pedido ${pedido.numero}):`, e?.message || r)
        }
      }
    }

    // 4. Avisos (so na primeira vez: resultado idempotente nao repete).
    if (res !== 'ja_resolvida' && res !== 'ja_aguardando_devolucao') {
      try {
        const loja = await nomeDaLoja(sb, pedido.loja_id)
        const lojista = loja.owner || pedido.vendedor_user_id
        const chave = plano.status === 'aguardando_devolucao' ? 'devolucao_iniciada' : decisao
        const base = {
          pedidoId: pedido.id, pedidoNumero: pedido.numero, itemNome: pedido.item_nome, lojaNome: loja.nome,
          lojaId: pedido.loja_id, decisao: chave, valorCents: valor, nota,
        }
        const titulo = chave === 'improcedente' ? 'Reclamação encerrada'
          : chave === 'devolucao_iniciada' ? 'Decisão: devolução da carta'
          : 'Reclamação resolvida com estorno'
        await sino(sb, pedido.comprador_user_id, titulo, `A Bynx decidiu a reclamação do pedido #${pedido.numero}.`, `/pedido/${pedido.id}`)
        await sino(sb, lojista, titulo, `A Bynx decidiu a reclamação do pedido #${pedido.numero}.`, `/minha-loja/${pedido.loja_id}/pedidos`)
        const cc = await contato(sb, pedido.comprador_user_id)
        if (cc.email) await emailSeguro(renderReclamacaoDecisaoEmail({ ...base, to: cc.email, nome: cc.nome, papel: 'comprador' }))
        const cl = await contato(sb, lojista)
        if (cl.email) await emailSeguro(renderReclamacaoDecisaoEmail({ ...base, to: cl.email, nome: cl.nome, papel: 'loja' }))
      } catch (err) {
        console.error('[reclamacao decidir] avisos:', (err as Error)?.message)
      }
    }

    return json(200, { ok: true, resultado: res, valor_estornado_cents: valor, refund: refundId })
  } catch (err) {
    console.error('[reclamacao decidir] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
