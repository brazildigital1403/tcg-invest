import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { sendPedidoEnviadoEmail, sendReembolsoCompradorEmail } from '@/lib/email'

/**
 * O pos-venda de um pedido, do lado de quem VENDEU -- loja ou pessoa.
 *
 * ★ POR QUE ESTA LIB EXISTE (01/10/2026, F5 do epico de recebimento). Marcar
 * enviado e cancelar/reembolsar moravam dentro de
 * `/api/lojas/[id]/pedidos`, uma rota que autentica pelo dono da LOJA e filtra
 * `loja_id = [id]`. Pedido de pessoa fisica tem `loja_id` NULO: nao e questao
 * de permissao, e que nao existe id para pôr na URL. Resultado medido antes
 * desta fatia: quem vendesse sem loja nao tinha como informar rastreio, o
 * comprador nunca recebia "foi enviado", e nao havia caminho para estornar.
 *
 * ★ POR QUE EXTRAIR EM VEZ DE COPIAR. O cancelamento tem cinco etapas
 * encadeadas e todas mexem em coisa que nao se desfaz: refund na Stripe,
 * status do pedido, estorno do lancamento, inventario e avisos. Duas copias
 * disso divergem -- e o dia em que divergirem, uma metade do marketplace vai
 * estornar diferente da outra. Mesma razao pela qual a comissao vive num
 * arquivo so.
 *
 * ★ O QUE VARIA ENTRE LOJA E PESSOA e so o CONTEXTO: o nome que o comprador
 * ve, para onde o sino do vendedor aponta, e o rotulo de quem cancelou. A
 * ORDEM e as regras sao identicas de proposito -- quem vende sem loja nao tem
 * politica de estorno propria.
 *
 * ★ ORDEM COM DINHEIRO, preservada da rota original: a Stripe manda primeiro.
 * Se o refund falhar, nada no banco foi tocado e a resposta diz isso. Se o
 * refund passar e o banco falhar, o log grita com o id do refund, porque o
 * dinheiro JA voltou e nada aqui desfaz isso.
 */

export type ContextoVendedor = {
  /** Quem vendeu, como o COMPRADOR le: nome da loja ou nome da pessoa. */
  nomeExibido: string
  /** Para onde o sino do vendedor leva: painel da loja ou /vendas. */
  linkPainel: string
  /** Quem recebe o sino do lado do vendedor. */
  vendedorUserId: string
  /** Vai em `pedidos.cancelado_por`. Hoje: 'loja' ou 'vendedor'. */
  canceladoPor: 'loja' | 'vendedor'
}

/** O que as duas acoes precisam saber do pedido. Mesmo SELECT nas duas rotas. */
export type PedidoPosVenda = {
  id: string
  numero: number
  status: string
  comprador_user_id: string
  item_nome: string
  produto_id: string | null
  marketplace_id: string | null
  total_comprador_cents: number
  stripe_payment_intent_id: string | null
}

export const SELECT_POS_VENDA =
  'id, numero, status, loja_id, comprador_user_id, item_nome, produto_id, marketplace_id, total_comprador_cents, stripe_payment_intent_id'

export type Resultado =
  | { ok: true; extra?: Record<string, unknown> }
  | { ok: false; erro: string; status: number }

/**
 * Marca como enviado e avisa o comprador.
 *
 * O rastreio e OBRIGATORIO e tem minimo de 8 caracteres: o comprador precisa
 * dele para acompanhar a entrega, e sem isso a confirmacao de recebimento vira
 * palavra contra palavra.
 */
export async function marcarEnviado(
  sb: SupabaseClient,
  pedido: PedidoPosVenda,
  rastreio: string,
  ctx: ContextoVendedor
): Promise<Resultado> {
  if (!rastreio || rastreio.length < 8) {
    return {
      ok: false, status: 400,
      erro: 'Informe um código de rastreio válido (mínimo 8 caracteres) para marcar como enviado.',
    }
  }
  if (pedido.status !== 'pago') {
    return {
      ok: false, status: 409,
      erro: `Só dá para enviar um pedido pago. Esse está como "${pedido.status}".`,
    }
  }

  const { error: upErr } = await sb
    .from('pedidos')
    .update({ status: 'enviado', rastreio, enviado_em: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', pedido.id)

  if (upErr) {
    console.error('[posVenda enviar]', upErr.message)
    return { ok: false, status: 500, erro: 'Erro ao marcar como enviado.' }
  }

  // Avisa o comprador (sino + email). Falha aqui nao desfaz o envio.
  try {
    await sb.from('notifications').insert({
      user_id: pedido.comprador_user_id,
      type: 'aviso',
      title: 'Seu pedido foi enviado!',
      message: `${pedido.item_nome} está a caminho${rastreio ? ` · rastreio ${rastreio}` : ''}.`,
      data: { link: `/pedido/${pedido.id}` },
    })

    const { data: comprador } = await sb.from('users').select('email, name').eq('id', pedido.comprador_user_id).maybeSingle()
    if (comprador?.email) {
      await sendPedidoEnviadoEmail({
        to: comprador.email,
        nomeUser: comprador.name || '',
        pedidoId: pedido.id,
        pedidoNumero: pedido.numero,
        itemNome: pedido.item_nome,
        nomeLoja: ctx.nomeExibido,
        rastreio,
      })
    }
  } catch (err) {
    console.error('[posVenda enviar] falha avisando comprador:', (err as Error)?.message)
  }

  return { ok: true }
}

/**
 * Cancela e reembolsa INTEGRALMENTE, antes do envio.
 *
 * ★ SO ANTES DE ENVIAR, e isso vale igual para loja e pessoa: depois de
 * despachado o item esta na rua, e estornar sem ele de volta e prejuizo
 * garantido para quem vendeu.
 */
export async function cancelarEReembolsar(
  sb: SupabaseClient,
  pedido: PedidoPosVenda,
  motivo: string | null,
  ctx: ContextoVendedor
): Promise<Resultado> {
  if (pedido.status !== 'pago') {
    return {
      ok: false, status: 409,
      erro: `Só dá para cancelar um pedido que ainda não foi enviado. Esse está como "${pedido.status}".`,
    }
  }
  if (!pedido.stripe_payment_intent_id) {
    return { ok: false, status: 409, erro: 'Pedido sem pagamento associado. Não há o que reembolsar.' }
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, status: 500, erro: 'Pagamentos indisponíveis no momento.' }
  }

  // ── 1. A STRIPE MANDA. Um refund que devolve ao comprador, reverte o
  //       transfer de quem vendeu e devolve a comissao da Bynx.
  const apiVersion = '2025-03-31.basil' as Stripe.StripeConfig['apiVersion']
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion })
  let refundId: string
  try {
    const refund = await stripe.refunds.create({
      payment_intent: pedido.stripe_payment_intent_id,
      reverse_transfer: true,
      refund_application_fee: true,
    })
    refundId = refund.id
  } catch (e) {
    console.error('[posVenda cancelar] refund falhou:', (e as Error)?.message)
    return {
      ok: false, status: 502,
      erro: 'Não foi possível processar o reembolso na Stripe. Nada foi alterado — tente de novo em instantes.',
    }
  }

  // ── 2. O pedido
  const { error: upErr } = await sb
    .from('pedidos')
    .update({
      status: 'reembolsado',
      cancelado_em: new Date().toISOString(),
      cancelamento_motivo: motivo,
      cancelado_por: ctx.canceladoPor,
      stripe_refund_id: refundId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pedido.id)

  if (upErr) {
    // O dinheiro JA foi estornado na Stripe. Loga alto pra reconciliar.
    console.error('[posVenda cancelar] refund OK mas update falhou:', upErr.message, '| pedido', pedido.id, '| refund', refundId)
    return {
      ok: false, status: 500,
      erro: 'O reembolso foi feito na Stripe, mas houve um erro ao atualizar o pedido. Fale com o suporte com o número do pedido.',
    }
  }

  // ── 3. Estorna a receita no financeiro ───────────────────────────────
  // Par obrigatorio do registro que o webhook faz na venda. Sem isto, a
  // comissao continuaria somando no /admin/financeiro depois do dinheiro ter
  // voltado pro comprador -- o painel superestimaria a receita, que e pior
  // que subestimar.
  //
  // Por que ZERAR e nao inserir estorno negativo: `lancamentos` tem CHECK de
  // valor_bruto >= 0 e valor_liquido >= 0, e indice unico por
  // stripe_payment_intent_id. Entao a linha fica (auditoria preservada), com
  // valor zerado e o motivo em `observacao`.
  try {
    const rotulo = ctx.canceladoPor === 'loja' ? 'pela loja' : 'pelo vendedor'
    const { data: estornados, error: estErr } = await sb
      .from('lancamentos')
      .update({
        valor_bruto: 0,
        valor_liquido: 0,
        observacao: `Estornado — pedido #${pedido.numero} cancelado ${rotulo} em ${new Date().toISOString().slice(0, 10)} (refund ${refundId})`,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_payment_intent_id', pedido.stripe_payment_intent_id)
      .select('id')

    if (estErr) {
      console.error(
        '[posVenda cancelar] CRITICAL: falha ao estornar lancamento |',
        'pedido', pedido.id, '| PI', pedido.stripe_payment_intent_id, '|', estErr.message
      )
    } else if (!estornados || estornados.length === 0) {
      console.log(`[posVenda cancelar] sem lancamento para o PI ${pedido.stripe_payment_intent_id} — nada a estornar`)
    } else {
      console.log(`[posVenda cancelar] lancamento zerado para o pedido ${pedido.numero}`)
    }
  } catch (err) {
    console.error('[posVenda cancelar] CRITICAL: excecao ao estornar lancamento:', (err as Error)?.message)
  }

  // ── 4. Inventario ────────────────────────────────────────────────────
  // A verdade e `pedido_itens`: os campos produto_id/marketplace_id do pedido
  // so vem preenchidos quando ele tem 1 item, entao olhar so pra eles nao
  // devolvia nada num pedido de carrinho.
  //
  // ★ A RPC `restaurar_estoque_produto` nao cobre multi-item: o guard dela e
  // `pedidos.produto_id = p_id`, null nesses pedidos. Item unico segue por ela
  // (caminho provado com refund real); multi-item repoe direto.
  try {
    const { data: itensCanc } = await sb
      .from('pedido_itens')
      .select('marketplace_id, produto_id, quantidade')
      .eq('pedido_id', pedido.id)

    if (itensCanc && itensCanc.length) {
      for (const it of itensCanc) {
        if (it.marketplace_id) {
          await sb.from('marketplace').update({ status: 'disponivel', buyer_id: null }).eq('id', it.marketplace_id)
        } else if (it.produto_id) {
          const qtd = Math.max(1, Number(it.quantidade) || 1)
          const { data: prod } = await sb
            .from('loja_produtos')
            .select('estoque, vendidos')
            .eq('id', it.produto_id)
            .maybeSingle()
          if (prod) {
            await sb
              .from('loja_produtos')
              .update({
                estoque: (prod.estoque || 0) + qtd,
                vendidos: Math.max(0, (prod.vendidos || 0) - qtd),
                updated_at: new Date().toISOString(),
              })
              .eq('id', it.produto_id)
          }
        }
      }
    } else if (pedido.produto_id) {
      await sb.rpc('restaurar_estoque_produto', { p_id: pedido.produto_id })
    } else if (pedido.marketplace_id) {
      await sb.from('marketplace').update({ status: 'disponivel', buyer_id: null }).eq('id', pedido.marketplace_id)
    }
  } catch (err) {
    console.error('[posVenda cancelar] falha restaurando inventario:', (err as Error)?.message)
  }

  // ── 5. Avisa os dois lados ───────────────────────────────────────────
  try {
    const valor = (pedido.total_comprador_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    await sb.from('notifications').insert([
      {
        user_id: pedido.comprador_user_id,
        type: 'aviso',
        title: 'Pedido reembolsado',
        message: `${ctx.nomeExibido} cancelou o pedido de ${pedido.item_nome}. ${valor} foi estornado no seu cartão.`,
        data: { link: `/pedido/${pedido.id}` },
      },
      {
        user_id: ctx.vendedorUserId,
        type: 'aviso',
        title: 'Pedido cancelado',
        message: `Você cancelou e reembolsou o pedido de ${pedido.item_nome}.`,
        data: { link: ctx.linkPainel },
      },
    ])

    const { data: comprador } = await sb.from('users').select('email, name').eq('id', pedido.comprador_user_id).maybeSingle()
    if (comprador?.email) {
      await sendReembolsoCompradorEmail({
        to: comprador.email,
        nomeUser: comprador.name || '',
        pedidoId: pedido.id,
        pedidoNumero: pedido.numero,
        itemNome: pedido.item_nome,
        nomeLoja: ctx.nomeExibido,
        valorCents: pedido.total_comprador_cents,
        motivo,
      })
    }
  } catch (err) {
    console.error('[posVenda cancelar] falha avisando:', (err as Error)?.message)
  }

  return { ok: true, extra: { reembolsado: true } }
}
