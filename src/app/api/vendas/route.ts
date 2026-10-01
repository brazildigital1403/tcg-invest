import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/supabaseServer'
import {
  marcarEnviado, cancelarEReembolsar, SELECT_POS_VENDA, type PedidoPosVenda,
} from '@/lib/pedidoVendedor'

/**
 * GET   /api/vendas  -> as vendas de quem NAO tem loja
 * PATCH /api/vendas  -> { pedido_id, acao: 'enviar'|'cancelar', rastreio?, motivo? }
 *
 * Auth: Bearer do proprio vendedor. Nao ha id de loja na URL porque nao ha loja.
 *
 * ★ POR QUE ESTA ROTA EXISTE (01/10/2026, F5 do epico). A F2 e a F3 ligaram a
 * VENDA para pessoa fisica, e o pos-venda ficou inteiro de fora: a unica rota
 * que marca enviado e cancela e `/api/lojas/[id]/pedidos`, que filtra
 * `loja_id = [id]`. Pedido de pessoa fisica tem `loja_id` NULO -- nao e
 * permissao, e que nao existe id para pôr na URL. Resultado: quem vendesse sem
 * loja nao informava rastreio, o comprador nunca recebia "foi enviado", e nao
 * havia como estornar.
 *
 * ★ O ESCOPO E `loja_id is null`, E ISSO RESOLVE O DEGRAU. Quem vende sem loja
 * hoje e abre loja amanha continua vendo aqui os pedidos antigos, e os novos
 * nascem no painel da loja -- nenhum pedido fica orfao e nao precisa migrar
 * dado. O filtro e por `vendedor_user_id`, nao por "nao tem loja": e sobre o
 * PEDIDO, nao sobre o estado atual da pessoa.
 *
 * ★ A REGRA E A MESMA DA LOJA, de proposito (decisao do Du): mesma lib, mesmo
 * refund integral, mesmo "so antes de enviar". Quem vende sem loja nao tem
 * politica de estorno propria.
 */

/** Le o Bearer e devolve o id do usuario. Sem token, 401. */
async function autenticar(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return { error: NextResponse.json({ error: 'Faça login para ver suas vendas.' }, { status: 401 }) }
  }
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user }, error } = await anon.auth.getUser(token)
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Sessão expirada. Entre de novo.' }, { status: 401 }) }
  }
  // `pedidos` so aceita escrita por service_role: o dinheiro nao depende de
  // RLS de cliente. A leitura tambem passa por aqui para o SELECT ser o mesmo
  // nos dois verbos.
  const sb = getServiceSupabase()
  if (!sb) {
    return { error: NextResponse.json({ error: 'Serviço indisponível no momento.' }, { status: 500 }) }
  }
  return { userId: user.id, sb }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await autenticar(req)
    if ('error' in auth) return auth.error
    const { userId, sb } = auth

    const { data, error } = await sb
      .from('pedidos')
      // ★ LITERAL, NAO CONCATENADO. O supabase-js le esta string em tempo de
      //   TIPO para inferir a linha; montada com `+` ela vira `string` e a
      //   linha colapsa em `GenericStringError` -- o erro aparece longe daqui,
      //   na primeira propriedade lida. A mesma armadilha esta anotada em
      //   `vendedorRecebimento.ts`, e eu cai nela de novo escrevendo isto.
      .select('id, numero, status, item_nome, item_imagem, total_comprador_cents, liquido_loja_cents, repasse_prazo, rastreio, endereco, created_at, pago_em, enviado_em, entregue_em, cancelado_em, cancelamento_motivo, comprador_user_id')
      .eq('vendedor_user_id', userId)
      .is('loja_id', null)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[vendas GET]', error.message)
      return NextResponse.json({ error: 'Erro ao carregar suas vendas.' }, { status: 500 })
    }

    const pedidos = data || []

    // ★ O NOME DO COMPRADOR VEM DE `public_users`, nao de `users`. A view
    //   enumera as colunas publicas (id, name, username, city...), entao nao
    //   ha risco de vazar e-mail ou documento de quem comprou para a tela de
    //   quem vendeu. O endereco de entrega e outra coisa: ele JA esta no
    //   proprio pedido, gravado no checkout, e quem vende precisa dele para
    //   despachar.
    const ids = [...new Set(pedidos.map(p => p.comprador_user_id).filter(Boolean))]
    const nomes = new Map<string, string>()
    if (ids.length) {
      const { data: compradores } = await sb.from('public_users').select('id, name').in('id', ids)
      for (const c of compradores || []) nomes.set(c.id as string, (c.name as string) || 'Comprador')
    }

    return NextResponse.json({
      vendas: pedidos.map(p => ({
        ...p,
        comprador_nome: nomes.get(p.comprador_user_id as string) || 'Comprador',
        comprador_user_id: undefined,
      })),
    })
  } catch (err) {
    console.error('[vendas GET] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await autenticar(req)
    if ('error' in auth) return auth.error
    const { userId, sb } = auth

    const body = await req.json().catch(() => null)
    const pedidoId = body?.pedido_id
    const acao = body?.acao
    const rastreio = typeof body?.rastreio === 'string' ? body.rastreio.trim().slice(0, 60) : null
    const motivo = typeof body?.motivo === 'string' ? body.motivo.trim().slice(0, 300) : null

    if (!pedidoId || (acao !== 'enviar' && acao !== 'cancelar')) {
      return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
    }

    // ★ OS DOIS FILTROS SAO A SEGURANCA: o pedido tem que ser DESTE vendedor
    //   E nao pertencer a loja nenhuma. Sem o `is('loja_id', null)`, um
    //   lojista poderia mexer pela porta errada no pedido da propria loja,
    //   pulando o `autenticarOwnerOuAdmin` -- que e onde o admin tambem e
    //   reconhecido. Dois caminhos para o mesmo pedido e como se perde o
    //   controle de quem pode o que.
    const { data: peds } = await sb
      .from('pedidos')
      .select(SELECT_POS_VENDA)
      .eq('id', pedidoId)
      .eq('vendedor_user_id', userId)
      .is('loja_id', null)
      .limit(1)

    const pedido = peds?.[0]
    if (!pedido) return NextResponse.json({ error: 'Venda não encontrada.' }, { status: 404 })

    // Como o comprador ve quem vendeu: o nome da pessoa. Vem de `users`
    // porque e o proprio vendedor pedindo, nao um terceiro.
    const { data: eu } = await sb.from('users').select('name, username').eq('id', userId).maybeSingle()
    const nome = (eu?.name as string) || (eu?.username as string) || 'O vendedor'

    const r = acao === 'enviar'
      ? await marcarEnviado(sb, pedido as PedidoPosVenda, rastreio || '', {
          nomeExibido: nome, linkPainel: '/vendas', vendedorUserId: userId, canceladoPor: 'vendedor',
        })
      : await cancelarEReembolsar(sb, pedido as PedidoPosVenda, motivo, {
          nomeExibido: nome, linkPainel: '/vendas', vendedorUserId: userId, canceladoPor: 'vendedor',
        })

    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: r.status })
    return NextResponse.json({ ok: true, ...(r.extra || {}) })
  } catch (err) {
    console.error('[vendas PATCH] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
