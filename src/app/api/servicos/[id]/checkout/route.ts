// POST /api/servicos/[id]/checkout -- o dono paga a etapa devida com cartao
// (Stripe Checkout, fatia 4 do pagamento do servico de bancada).
//
// ★ O valor sai do servidor: a etapa devida e recalculada aqui (mesma
//   etapaCobravel do GET do pedido). Nada do corpo da requisicao entra na conta.
// ★ A Bynx absorve a taxa do cartao: o cliente paga o valor da etapa, sem
//   acrescimo. Cobranca na conta da propria Bynx (sem Connect, sem split).
// ★ Esta rota NUNCA marca pago. Quem confirma e o webhook (fatia 5), pela
//   confirmarPagamento, que so grava na transicao. O Pix manual segue ao lado.
// ★ Reaproveitamento: se a linha de servico_pagamentos ja aponta para uma
//   Session aberta com o mesmo valor, devolve a URL dela. Session aberta com
//   valor antigo (reorcamento) e expirada antes de nascer outra, para o cliente
//   nunca ter dois links pagaveis da mesma etapa.
// ★ Idempotencia: a chave e estavel por pagamento + valor + Session anterior.
//   Dois cliques simultaneos veem o mesmo estado e caem na mesma Session; depois
//   que uma Session expira, a chave muda sozinha (a anterior entra nela).
// ★ SERVICOS_CARTAO_ATIVO = false -> 404, igual a rota inexistente.

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import {
  sbAdmin, carregarAutorizado, erro, pagamentosDoPedido, etapaCobravel, ROTULO_ETAPA,
} from '@/lib/servicosServer'
import { SERVICOS, SERVICOS_CARTAO_ATIVO, numeroServico } from '@/lib/servicos'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!SERVICOS_CARTAO_ATIVO) return erro(404, 'Não encontrado')
  try {
    const { id } = await ctx.params
    const auth = await carregarAutorizado(req, id)
    if (!auth.ok) return auth.resposta

    const sb = sbAdmin()
    const [{ data: sols }, { data: cobr }, pagamentos] = await Promise.all([
      sb.from('servico_solicitacoes').select('id, numero, servico, status, proposta_aceita_em').eq('id', id).limit(1),
      sb.from('servico_eventos').select('id').eq('solicitacao_id', id).eq('status', 'cobranca_servico').limit(1),
      pagamentosDoPedido(id),
    ])
    const sol = sols?.[0]
    if (!sol) return erro(404, 'Solicitação não encontrada')

    const { devida } = etapaCobravel(sol.status, !!sol.proposta_aceita_em, pagamentos, !!cobr?.length)
    if (!devida) return erro(409, 'Nenhum pagamento em aberto neste pedido.')
    if (!Number.isInteger(devida.valor_cents) || devida.valor_cents < 100) {
      console.error(`[servicos/checkout] valor invalido na etapa ${devida.etapa} do pedido ${id}: ${devida.valor_cents}`)
      return erro(409, 'Este pagamento precisa ser conferido pela Bynx. Use o Pix ou fale com a gente.')
    }

    // A linha lida de novo, com a Session gravada (pagamentosDoPedido nao traz).
    const { data: linhas } = await sb.from('servico_pagamentos')
      .select('id, etapa, valor_cents, pago_em, stripe_checkout_session_id').eq('id', devida.id).limit(1)
    const linha = linhas?.[0]
    if (!linha || linha.pago_em) return erro(409, 'Este pagamento já foi registrado. Atualize a página.')

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[servicos/checkout] STRIPE_SECRET_KEY ausente')
      return erro(503, 'Pagamento com cartão indisponível no momento. Use o Pix.')
    }
    // Mesma versao do resto do repo; o cast e o mesmo de /api/recebimentos (o SDK
    // instalado tipa uma versao mais antiga e sem ele isso vira erro de tipo).
    const apiVersion = '2025-03-31.basil' as Stripe.StripeConfig['apiVersion']
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion })
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'

    // ── Session anterior: reaproveita, recusa ou expira ────────────────────
    const anterior = linha.stripe_checkout_session_id as string | null
    let s: Stripe.Checkout.Session | null = null
    if (anterior) {
      try { s = await stripe.checkout.sessions.retrieve(anterior) } catch (e) {
        // Session de OUTRA conta/modo (ex.: cs_test_ gravada num teste com a
        // chave do sandbox, lida agora com a chave live) nao existe aqui: segue
        // como se nao houvesse anterior. Qualquer outro erro, para.
        const code = (e as { code?: string })?.code
        if (code !== 'resource_missing') {
          console.error('[servicos/checkout] falha lendo Session anterior:', e instanceof Error ? e.message : e)
          return erro(502, 'Não foi possível iniciar o pagamento. Tente de novo.')
        }
        // O contrario nunca: uma Session LIVE invisivel aqui (teste com chave do
        // sandbox sobre o banco de producao) pode estar aberta e pagavel. Nao
        // sobrescreve o id dela; para.
        if (anterior.startsWith('cs_live_')) {
          console.error(`[servicos/checkout] Session live ${anterior} invisivel com a chave atual; recusando`)
          return erro(409, 'Este pagamento já tem um link aberto. Use o Pix ou fale com a gente.')
        }
        console.warn(`[servicos/checkout] Session anterior ${anterior} nao existe nesta conta; criando outra`)
      }
    }
    if (anterior && s) {
      const mesmaEtapa = s.metadata?.pagamento_id === linha.id
      if (s.status === 'complete' || s.payment_status === 'paid') {
        // Pago na Stripe, webhook ainda nao chegou: nunca abrir uma segunda cobranca.
        return erro(409, 'Recebemos um pagamento com cartão para esta etapa. A confirmação aparece aqui em instantes.')
      }
      if (s.status === 'open' && mesmaEtapa && s.amount_total === linha.valor_cents && s.url) {
        return NextResponse.json({ url: s.url, reaproveitada: true })
      }
      if (s.status === 'open') {
        // Valor mudou (reorcamento): o link antigo nao pode continuar pagavel.
        try { await stripe.checkout.sessions.expire(anterior) } catch (e) {
          console.error('[servicos/checkout] falha expirando Session antiga:', e instanceof Error ? e.message : e)
          return erro(409, 'Não foi possível atualizar o pagamento agora. Tente de novo em instantes.')
        }
      }
    }

    // ── Session nova ───────────────────────────────────────────────────────
    const servicoNome = SERVICOS.find(x => x.id === sol.servico)?.nome || 'Serviço de bancada'
    const numero = numeroServico(Number(sol.numero))
    const metadata = { solicitacao_id: String(sol.id), pagamento_id: String(linha.id), etapa: String(linha.etapa) }

    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        locale: 'pt-BR',
        line_items: [{
          price_data: {
            currency: 'brl',
            unit_amount: linha.valor_cents,
            product_data: { name: `${servicoNome} ${numero} · ${ROTULO_ETAPA[linha.etapa as keyof typeof ROTULO_ETAPA] || 'Pagamento'}` },
          },
          quantity: 1,
        }],
        ...(auth.user?.email ? { customer_email: auth.user.email } : {}),
        client_reference_id: String(linha.id),
        metadata,
        payment_intent_data: { metadata },
        success_url: `${base}/servico/${sol.id}?pagamento=ok`,
        cancel_url: `${base}/servico/${sol.id}?pagamento=cancelado`,
      }, {
        idempotencyKey: `servico-checkout:${linha.id}:${linha.valor_cents}:${anterior || 'primeira'}`,
      })
    } catch (e) {
      console.error('[servicos/checkout] Stripe recusou:', e instanceof Error ? e.message : e)
      return erro(502, 'Não foi possível iniciar o pagamento. Tente de novo ou use o Pix.')
    }

    // Grava a Session na linha, so se ela continua em aberto e ninguem gravou
    // outra no meio (o filtro pela anterior evita sobrescrever um clique paralelo).
    let up = sb.from('servico_pagamentos').update({ stripe_checkout_session_id: session.id })
      .eq('id', linha.id).is('pago_em', null)
    up = anterior ? up.eq('stripe_checkout_session_id', anterior) : up.is('stripe_checkout_session_id', null)
    const { data: gravou, error: errUp } = await up.select('id')
    if (errUp) {
      console.error('[servicos/checkout] falha gravando Session:', errUp.message)
      try { await stripe.checkout.sessions.expire(session.id) } catch { /* ja expirada ou paga: o webhook resolve */ }
      return erro(500, 'Não foi possível iniciar o pagamento. Tente de novo.')
    }
    if (!gravou?.length) {
      // Outro clique gravou antes (mesma chave de idempotencia = mesma Session,
      // ou a linha foi paga no meio). Relê e segue a verdade do banco.
      const { data: agora } = await sb.from('servico_pagamentos')
        .select('pago_em, stripe_checkout_session_id').eq('id', linha.id).limit(1)
      if (agora?.[0]?.pago_em) return erro(409, 'Este pagamento já foi registrado. Atualize a página.')
      if (agora?.[0]?.stripe_checkout_session_id !== session.id) {
        try { await stripe.checkout.sessions.expire(session.id) } catch { /* idem */ }
        return erro(409, 'Este pagamento mudou. Atualize a página e tente de novo.')
      }
    }

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[servicos/checkout]', e instanceof Error ? e.message : e)
    return erro(500, 'Erro interno')
  }
}
