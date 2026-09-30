import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { sendPagamentoLembreteEmail } from '@/lib/email'

/**
 * GET /api/cron-pagamento-lembrete  (Vercel Cron, ver vercel.json)
 *
 * Lembra quem montou um pedido e nao concluiu o pagamento, ENQUANTO a sessao
 * da Stripe ainda esta viva.
 *
 * ★ POR QUE EXISTE (30/09/2026, medido no unico pedido real da Bynx). O #9 --
 * 5 Elite Trainer Box, R$ 1.950,88, o primeiro e unico pedido de um cliente
 * que nao e da casa -- nasceu num domingo as 21:34, nunca chegou ao
 * PaymentIntent e morreu 24h depois. Nesse intervalo inteiro ninguem falou com
 * ele: o handler de `checkout.session.expired` cancelava em silencio, e nao
 * havia nada entre "abriu o checkout" e "perdeu a venda".
 *
 * O e-mail de expirado (no webhook) avisa DEPOIS, quando a intencao ja
 * esfriou e o checkout nao existe mais. Este cron age no meio da janela, com
 * a Session aberta: o link leva de volta a MESMA tela, com o mesmo preco e o
 * frete que a pessoa ja escolheu.
 *
 * ★ A JANELA E 3h A 20h DE VIDA, e os dois lados tem motivo:
 *   - 3h de piso porque antes disso a pessoa pode estar decidindo agora;
 *     lembrar alguem que acabou de sair da tela e atropelo, nao ajuda.
 *   - 20h de teto porque a Session da Stripe dura 24h (nao definimos
 *     `expires_at`, entao vale o padrao dela). Lembrete com 1h de vida util
 *     nao da tempo de pagar e ainda soa como cobranca.
 *   Com o cron a cada 3h, todo pedido cai na janela pelo menos uma vez.
 *
 * ★ A VERDADE DA SESSAO E A STRIPE, NAO O NOSSO BANCO. O status local diz
 * `aguardando_pagamento`, mas a Session pode ter expirado, sido paga por outro
 * caminho ou ficado sem `url`. Por isso cada pedido passa por um
 * `sessions.retrieve` e so segue quem volta com `status: 'open'` e url.
 *
 * ★ IDEMPOTENCIA SEM COLUNA NOVA: a marca e o proprio sino, no padrao que a
 * casa ja usa no cron do trial (`marco_trial` dentro do `data`). Existe sino
 * com `marco_lembrete_pagamento = pedido.id`? Entao ja lembramos, e nao
 * lembramos de novo. Isso deixa a fatia sem migration -- e a marca fica onde
 * qualquer um pode conferir.
 *
 * Auth: Bearer ${CRON_SECRET}. `?dry=1` lista sem escrever nem enviar.
 */

/** Idade minima para lembrar. Antes disso a pessoa ainda pode estar na tela. */
const HORAS_MIN = 3

/** Idade maxima. A Session vence em 24h; lembrar em cima da hora nao ajuda. */
const HORAS_MAX = 20

/**
 * Teto de pedidos por rodada. O Resend vai em serie, e o cron do trial das
 * lojas ja estourou 30s com ~3,3s por envio -- aqui cada pedido custa uma ida
 * a Stripe MAIS um e-mail. 20 e o que cabe com folga nos 60s.
 */
const MAX_LOTE = 20

type Alvo = {
  id: string
  numero: number
  item_nome: string
  total_comprador_cents: number
  comprador_user_id: string
  loja_id: string | null
  stripe_session_id: string | null
  created_at: string
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dry = req.nextUrl.searchParams.get('dry') === '1'

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
  )

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe indisponivel' }, { status: 500 })
  }
  // O pacote tipado espera `acacia`; a conta roda em `basil`. O cast e o
  // padrao dos arquivos novos da casa -- cravar a string crua adiciona um
  // erro ao baseline, como ja acontece nas rotas antigas de Stripe.
  const apiVersion = '2025-03-31.basil' as Stripe.StripeConfig['apiVersion']
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion })

  const agora = Date.now()
  const limiteNovo = new Date(agora - HORAS_MIN * 3600_000).toISOString()
  const limiteVelho = new Date(agora - HORAS_MAX * 3600_000).toISOString()

  try {
    const { data: candidatos, error } = await sb
      .from('pedidos')
      .select('id, numero, item_nome, total_comprador_cents, comprador_user_id, loja_id, stripe_session_id, created_at')
      .eq('status', 'aguardando_pagamento')
      .not('stripe_session_id', 'is', null)
      .lte('created_at', limiteNovo)
      .gte('created_at', limiteVelho)
      .order('created_at', { ascending: true })
      .limit(MAX_LOTE)

    if (error) {
      console.error('[cron-pagamento-lembrete] consulta falhou:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const alvos = (candidatos || []) as Alvo[]
    const relatorio: Record<string, unknown>[] = []
    let enviados = 0

    for (const ped of alvos) {
      // Ja lembrado? A marca e o sino da rodada anterior.
      const { data: marca } = await sb
        .from('notifications')
        .select('id')
        .eq('user_id', ped.comprador_user_id)
        .eq('data->>marco_lembrete_pagamento', ped.id)
        .limit(1)

      if (marca?.length) {
        relatorio.push({ pedido: ped.numero, acao: 'pulado', motivo: 'ja lembrado' })
        continue
      }

      // A Stripe manda: sessao fechada, paga ou sem url nao gera lembrete.
      let urlCheckout: string | null = null
      let expiraEm = 0
      try {
        const sess = await stripe.checkout.sessions.retrieve(ped.stripe_session_id!)
        if (sess.status === 'open' && sess.url) {
          urlCheckout = sess.url
          expiraEm = sess.expires_at || 0
        } else {
          relatorio.push({ pedido: ped.numero, acao: 'pulado', motivo: `session ${sess.status}` })
          continue
        }
      } catch (e: any) {
        relatorio.push({ pedido: ped.numero, acao: 'erro', motivo: `stripe: ${e?.message}` })
        continue
      }

      const horasRestantes = expiraEm > 0 ? (expiraEm * 1000 - agora) / 3600_000 : 0
      if (horasRestantes <= 0.5) {
        relatorio.push({ pedido: ped.numero, acao: 'pulado', motivo: 'menos de 30min de sessao' })
        continue
      }

      if (dry) {
        relatorio.push({
          pedido: ped.numero, acao: 'lembraria', item: ped.item_nome,
          total: ped.total_comprador_cents, horas_restantes: Math.round(horasRestantes * 10) / 10,
        })
        continue
      }

      const [{ data: comprador }, { data: loja }] = await Promise.all([
        sb.from('users').select('email, name').eq('id', ped.comprador_user_id).maybeSingle(),
        ped.loja_id
          ? sb.from('lojas').select('nome').eq('id', ped.loja_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      // ★ ORDEM: a MARCA primeiro. Se o e-mail falhar depois, a pessoa deixa de
      // receber uma vez -- o que e ruim. Se a marca falhasse depois de um
      // e-mail enviado, a proxima rodada mandaria de novo, e de novo: insistir
      // com quem nao pagou e pior do que ficar quieto.
      const { error: errSino } = await sb.from('notifications').insert({
        user_id: ped.comprador_user_id,
        type: 'aviso',
        title: 'Falta concluir o pagamento',
        message: `O seu pedido #${ped.numero} (${ped.item_nome}) esta esperando o pagamento. O item continua reservado enquanto o prazo nao vence.`,
        data: { link: `/pedido/${ped.id}`, marco_lembrete_pagamento: ped.id },
      })
      if (errSino) {
        relatorio.push({ pedido: ped.numero, acao: 'erro', motivo: `sino: ${errSino.message}` })
        continue
      }

      if (comprador?.email) {
        try {
          await sendPagamentoLembreteEmail({
            to: comprador.email,
            nomeUser: comprador.name || '',
            pedidoNumero: ped.numero,
            itemNome: ped.item_nome,
            nomeVendedor: loja?.nome || 'Bynx',
            totalBRL: (ped.total_comprador_cents / 100).toLocaleString('pt-BR', {
              style: 'currency', currency: 'BRL',
            }),
            urlCheckout,
            horasRestantes,
          })
          enviados++
          relatorio.push({ pedido: ped.numero, acao: 'lembrado', item: ped.item_nome })
        } catch (e: any) {
          relatorio.push({ pedido: ped.numero, acao: 'sino ok, email falhou', motivo: e?.message })
        }
      } else {
        relatorio.push({ pedido: ped.numero, acao: 'sino ok, sem email' })
      }
    }

    console.log(`[cron-pagamento-lembrete] ${alvos.length} candidato(s), ${enviados} lembrete(s)${dry ? ' (dry)' : ''}`)
    return NextResponse.json({ ok: true, dry, candidatos: alvos.length, enviados, detalhe: relatorio })
  } catch (err: any) {
    console.error('[cron-pagamento-lembrete] erro:', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
