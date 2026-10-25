/**
 * Servico de bancada no Financeiro (23/10/2026).
 *
 * Ate aqui nenhum caminho de pagamento de servico gravava em `lancamentos`:
 * nem o Pix confirmado no admin, nem o cartao pelo webhook, nem o estorno. O
 * painel /admin/financeiro so enxerga `lancamentos`, entao servico pago nao
 * existia para o faturamento, o limite do MEI ou o resultado do mes.
 *
 * Um lancamento por ETAPA paga (sinal, servico, integral), com a chave
 * `servico_pagamento_id` (UNIQUE): o Pix nao tem PaymentIntent para servir de
 * chave como o cartao tem. A funcao SINCRONIZA -- le o estado atual de
 * `servico_pagamentos` e grava o lancamento igual a ele -- entao chamar duas
 * vezes da o mesmo resultado (idempotente), e o estorno e so uma nova chamada.
 *
 * Bruto = o que a Bynx recebeu e nao devolveu (valor - reembolsado). Estorno
 * REDUZ o bruto, nunca grava valor negativo (`lancamentos` tem CHECK >= 0) --
 * o mesmo padrao da comissao em pedidoVendedor.ts. A taxa do cartao fica: a
 * Stripe nao devolve a taxa no estorno.
 *
 * O sinal e o valor declarado dos Correios + o frete de volta: a Bynx recebe e
 * repassa. Entra aqui como receita bruta (e o dinheiro que entrou), com a
 * composicao em `detalhes` (sub-itens que a tela expande); o custo da
 * etiqueta ainda e lancado a mao.
 *
 * Nunca derruba o fluxo de pagamento: falha vira log, e a proxima chamada
 * (outro pagamento ou estorno do mesmo pedido) corrige.
 */
import Stripe from 'stripe'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { numeroServico } from '@/lib/servicos'

const ROTULO: Record<string, string> = {
  sinal: 'Sinal (valor declarado + frete de volta)',
  servico: 'Serviço',
  integral: 'Pagamento integral',
}

/** Data em Brasilia (o banco guarda UTC; a competencia e o dia daqui). */
function diaBRT(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

async function taxaStripeCentavos(piId: string): Promise<number> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return 0
  try {
    const stripe = new Stripe(key, { apiVersion: '2025-03-31.basil' as Stripe.StripeConfig['apiVersion'] })
    // A balance_transaction pode demorar ~1s depois do checkout (mesma
    // armadilha documentada no webhook): tenta 3 vezes antes de desistir.
    for (let i = 0; i < 3; i++) {
      const pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge.balance_transaction'] })
      const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null
      const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null
      if (typeof bt?.fee === 'number') return bt.fee
      await new Promise(r => setTimeout(r, 800))
    }
    console.warn(`[financeiro/servico] PI ${piId} sem fee apos 3 tentativas -- lancamento com taxa 0, corrigir a mao`)
  } catch (e) {
    console.warn(`[financeiro/servico] nao consegui ler a taxa do PI ${piId}:`, e instanceof Error ? e.message : e)
  }
  return 0
}

/**
 * Deixa `lancamentos` igual as etapas PAGAS do pedido. Chamar depois de
 * confirmar um pagamento e depois de registrar um estorno.
 */
export async function sincronizarReceitaServico(solicitacaoId: string): Promise<void> {
  const sb = getServiceSupabase()
  if (!sb) return
  try {
    const [{ data: sols, error: eS }, { data: pags, error: eP }] = await Promise.all([
      sb.from('servico_solicitacoes')
        .select('id, numero, user_id, servico, orcamento_cents, seguro_cents, frete_volta_cents')
        .eq('id', solicitacaoId).limit(1),
      sb.from('servico_pagamentos')
        .select('id, etapa, valor_cents, metodo, pago_em, stripe_payment_intent_id, stripe_checkout_session_id, reembolsado_cents, reembolsado_em')
        .eq('solicitacao_id', solicitacaoId).not('pago_em', 'is', null),
    ])
    if (eS) throw new Error(eS.message)
    if (eP) throw new Error(eP.message)
    const sol = sols?.[0]
    if (!sol || !pags?.length) return

    const { data: existentes } = await sb.from('lancamentos')
      .select('servico_pagamento_id, taxa').in('servico_pagamento_id', pags.map(p => p.id))
    const taxaJa = new Map((existentes || []).map(l => [l.servico_pagamento_id as string, Number(l.taxa) || 0]))

    for (const p of pags) {
      // Cartao em modo de teste (sandbox) nao e dinheiro: nunca vira receita.
      if (String(p.stripe_checkout_session_id || '').startsWith('cs_test_')) continue
      const reembolsado = Number(p.reembolsado_cents || 0)
      const brutoCents = Math.max(0, p.valor_cents - reembolsado)
      // Taxa: le na Stripe uma vez so (o lancamento ja existente guarda o valor).
      let taxaCents = Math.round((taxaJa.get(p.id) ?? -1) * 100)
      if (taxaCents < 0) taxaCents = p.metodo === 'stripe' && p.stripe_payment_intent_id ? await taxaStripeCentavos(p.stripe_payment_intent_id) : 0

      // Composicao no formato de sub-itens que a tela do Financeiro ja expande
      // ({descricao, valor, taxa} em reais). A taxa do cartao vai no 1o item
      // para o total expandido bater com a linha. Em estorno, os sub-itens
      // seguem mostrando o que foi cobrado; a observacao diz quanto voltou.
      const partes: [string, number][] = p.etapa === 'sinal'
        ? [['Valor declarado (Correios)', sol.seguro_cents || 0], ['Frete de volta', sol.frete_volta_cents || 0]]
        : p.etapa === 'servico'
          ? [['Serviço', sol.orcamento_cents || 0]]
          : [['Serviço', sol.orcamento_cents || 0], ['Valor declarado (Correios)', sol.seguro_cents || 0], ['Frete de volta', sol.frete_volta_cents || 0]]
      const detalhes = partes.filter(([, v]) => v > 0)
        .map(([descricao, v], i) => ({ descricao, valor: v / 100, taxa: i === 0 ? taxaCents / 100 : 0 }))

      const linha = {
        servico_pagamento_id: p.id,
        tipo: 'receita',
        categoria: 'servico',
        fonte: p.metodo === 'stripe' ? 'stripe' : 'outro',
        descricao: `Serviço ${numeroServico(sol.numero)} — ${ROTULO[p.etapa] || p.etapa}`,
        valor_bruto: brutoCents / 100,
        taxa: taxaCents / 100,
        valor_liquido: Math.max(0, brutoCents - taxaCents) / 100,
        data_competencia: diaBRT(p.pago_em as string),
        data_liquidacao: diaBRT(p.pago_em as string),
        recebido: true,
        pago: false,
        user_id: sol.user_id,
        stripe_payment_intent_id: p.stripe_payment_intent_id || null,
        observacao: reembolsado > 0
          ? `Estornado ${(reembolsado / 100).toFixed(2).replace('.', ',')} de ${(p.valor_cents / 100).toFixed(2).replace('.', ',')}${p.reembolsado_em ? ` em ${diaBRT(p.reembolsado_em)}` : ''} (${p.metodo === 'stripe' ? 'cartão' : 'Pix'}).`
          : null,
        detalhes: detalhes.length > 1 ? detalhes : null,
      }
      const { error } = await sb.from('lancamentos').upsert(linha, { onConflict: 'servico_pagamento_id' })
      if (error) console.error(`[financeiro/servico] ${numeroServico(sol.numero)} etapa ${p.etapa}: ${error.message}`)
    }
  } catch (e) {
    console.error(`[financeiro/servico] pedido ${solicitacaoId}:`, e instanceof Error ? e.message : e)
  }
}
