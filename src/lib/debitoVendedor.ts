import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { descontoDeDebito } from '@/lib/custoEstorno'
import type { CustosDaCobranca } from '@/lib/custoEstornoStripe'

/**
 * Debito do vendedor com a Bynx (opcao a do Du, 25/10/2026). Schema em
 * supabase/migrations/20260928200000_vendedor_debitos.sql.
 *
 * Nasce quando um estorno custa mais que a comissao do pedido (taxa da Stripe
 * + etiqueta, ver lib/custoEstorno): a Stripe nao cobra conta conectada no
 * Brasil, entao a diferenca sai da comissao da PROXIMA venda do mesmo
 * recebedor (chave = conta Stripe, vale para loja e pessoa fisica).
 *
 *   registrarFaltaComoDebito  -> no estorno, quando faltaCobrirCents > 0
 *   descontoNoCheckout        -> nas rotas de checkout, antes da sessao
 *   quitarDebitoDaVenda       -> no webhook, quando o pagamento confirma
 *
 * Tudo com service role; a tabela nao tem leitura pelo navegador.
 * ★ NUNCA importar em componente 'use client'.
 */

/** Soma do debito em aberto do recebedor (indice parcial, poucas linhas). */
export async function debitoEmAberto(db: SupabaseClient, conta: string | null | undefined): Promise<number> {
  if (!conta) return 0
  const { data, error } = await db
    .from('vendedor_debitos')
    .select('valor_cents, quitado_cents')
    .eq('conta_stripe', conta)
    .is('quitado_em', null)
  if (error) {
    // Sem a leitura nao desconta nada: a venda segue, o debito espera a proxima.
    console.error('[debito] leitura falhou:', error.message)
    return 0
  }
  // quitado_em nulo = em aberto (a funcao de baixa so preenche quando zera).
  return (data || []).reduce((t, d) => t + Math.max(0, (d.valor_cents || 0) - (d.quitado_cents || 0)), 0)
}

/**
 * Quanto descontar nesta venda: o debito em aberto, ate o liquido do vendedor.
 * Quem chama soma em application_fee_amount e comissao_bynx_cents, tira de
 * liquido_loja_cents, grava em pedidos.debito_descontado_cents e manda
 * `bynx_debito_cents` + `bynx_debito_conta` no metadata da sessao E do
 * PaymentIntent.
 */
export async function descontoNoCheckout(db: SupabaseClient, conta: string | null | undefined, liquidoVendedorCents: number): Promise<number> {
  const aberto = await debitoEmAberto(db, conta)
  return descontoDeDebito({ debitoAbertoCents: aberto, liquidoVendedorCents })
}

/** Metadata padrao do desconto (sessao e PaymentIntent). Vazio quando nao ha. */
export function metadataDebito(conta: string | null | undefined, descontoCents: number): Record<string, string> {
  return conta && descontoCents > 0 ? { bynx_debito_cents: String(descontoCents), bynx_debito_conta: conta } : {}
}

/**
 * No estorno: registra o que a comissao nao cobriu. Idempotente pela chave do
 * estorno (origem_chave unica). Falha aqui NAO desfaz o estorno (o dinheiro
 * ja voltou ao comprador): fica no log como CRITICAL para lancar a mao.
 */
export async function registrarFaltaComoDebito(db: SupabaseClient, a: {
  custos: CustosDaCobranca
  chave: string
  faltaCents: number
  motivo: string
}): Promise<void> {
  if (!(a.faltaCents > 0)) return
  const conta = a.custos.destino
  if (!conta) {
    console.error(`[debito] CRITICAL: falta de ${a.faltaCents} centavos sem conta de destino | ${a.chave}`)
    return
  }
  let lojaId: string | null = null
  let vendedorId: string | null = null
  if (a.custos.pedidoId) {
    const { data } = await db.from('pedidos').select('loja_id, vendedor_user_id').eq('id', a.custos.pedidoId).limit(1)
    lojaId = data?.[0]?.loja_id ?? null
    vendedorId = data?.[0]?.vendedor_user_id ?? null
  }
  const { error } = await db.from('vendedor_debitos').upsert({
    conta_stripe: conta,
    loja_id: lojaId,
    vendedor_user_id: vendedorId,
    origem_pedido_id: a.custos.pedidoId,
    origem_chave: a.chave,
    motivo: a.motivo.slice(0, 300),
    valor_cents: a.faltaCents,
  }, { onConflict: 'origem_chave', ignoreDuplicates: true })
  if (error) {
    console.error(`[debito] CRITICAL: debito de ${a.faltaCents} centavos nao registrado | ${conta} | ${a.chave}:`, error.message)
  } else {
    console.log(`[debito] registrado ${a.faltaCents} centavos | ${conta} | ${a.chave}`)
  }
}

/**
 * No webhook, com o pagamento confirmado: baixa o debito que esta venda
 * cobrou (FIFO, idempotente por pedido). Se baixou menos do que cobrou (outra
 * venda pagou o mesmo debito ao mesmo tempo), devolve o excesso a loja como
 * estorno parcial da comissao desta venda, idempotente pelo pedido.
 */
export async function quitarDebitoDaVenda(db: SupabaseClient, s: Stripe, a: {
  conta: string
  pedidoId: string
  cobradoCents: number
  paymentIntent: string | null
}): Promise<{ baixadoCents: number; devolvidoCents: number }> {
  const { data, error } = await db.rpc('vendedor_debito_quitar', {
    p_conta: a.conta, p_pedido: a.pedidoId, p_valor: a.cobradoCents,
  })
  if (error) {
    console.error(`[debito] CRITICAL: baixa falhou | pedido ${a.pedidoId} | ${a.cobradoCents} centavos:`, error.message)
    return { baixadoCents: 0, devolvidoCents: 0 }
  }
  const baixado = Math.max(0, Number(data) || 0)
  const excesso = Math.max(0, a.cobradoCents - baixado)
  if (excesso === 0) return { baixadoCents: baixado, devolvidoCents: 0 }

  try {
    // O excesso entrou como comissao desta venda: devolver parte da propria
    // ApplicationFee e o caminho certo (um transfer novo amarrado a charge
    // falha, ela ja foi inteira para o vendedor no destination charge).
    if (!a.paymentIntent) throw new Error('venda sem PaymentIntent')
    const pi = await s.paymentIntents.retrieve(a.paymentIntent, { expand: ['latest_charge'] })
    const ch = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null
    const feeId = typeof ch?.application_fee === 'string' ? ch.application_fee : ch?.application_fee?.id
    if (!feeId) throw new Error('venda sem comissao (ApplicationFee)')
    await s.applicationFees.createRefund(
      feeId,
      { amount: excesso, metadata: { bynx_pedido_id: a.pedidoId, motivo: 'debito ja quitado por outra venda' } },
      { idempotencyKey: `debito-excesso-${a.pedidoId}` },
    )
    console.log(`[debito] excesso de ${excesso} centavos devolvido | pedido ${a.pedidoId}`)
    return { baixadoCents: baixado, devolvidoCents: excesso }
  } catch (e) {
    console.error(`[debito] CRITICAL: excesso de ${excesso} centavos NAO devolvido | pedido ${a.pedidoId}:`, (e as Error)?.message)
    return { baixadoCents: baixado, devolvidoCents: 0 }
  }
}
