import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { comissaoVendedorCents, acrescimoCompradorCents, normalizarPrazo, ehMetodoValido, PIX_DISPONIVEL, type MetodoPagamento } from '@/lib/comissao'
import { resolverRecebedor, type Recebedor } from '@/lib/vendedorRecebimento'
import { cotarFrete, pacoteDeCartas, pacoteDeProduto, type ItemFrete } from '@/lib/melhor-envio'

/**
 * Carrinho por VENDEDOR -- loja ou pessoa fisica.
 *
 * POST /api/carrinho/resumo   -> { vendedor_id, itens:[{id,tipo}], metodo } -> conta
 * POST /api/carrinho/checkout -> idem + auth -> cria pedido (N itens) + Session
 *
 * ★ ERA POR LOJA ATE 02/10/2026. A rota lia `lojas` direto, entao quem vende
 * SEM loja nao tinha carrinho nenhum: so dava para comprar um item por vez,
 * pagando um frete inteiro em cada. Numa carta de R$ 0,90 isso significava
 * R$ 17,44 de frete por carta. Hoje 70 dos 96 anuncios sao de pessoa fisica.
 *
 * ★ QUEM RESOLVE E `resolverRecebedor`, e a regra dele e EXCLUSIVA: tendo loja
 * ativa quem recebe e a conta DA LOJA, senao a da pessoa -- nunca as duas.
 * Usar a mesma funcao do checkout de item unico e o que impede esta rota de
 * ter uma segunda opiniao sobre de quem e o dinheiro.
 *
 * ★ O cliente manda SO IDs. ★ Preco, nome, imagem e disponibilidade sao lidos
 * daqui do servidor. Se aceitassemos preco do cliente, editar o localStorage
 * compraria um Charizard por R$ 1.
 *
 * Comissao e acrescimo sao os dois sobre o SUBTOTAL: o pedido e UMA transacao,
 * entao leva UMA taxa fixa (R$0,40 acima de R$20) e UM acrescimo de metodo.
 */

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

const SELECT_LOJA =
  'id, nome, slug, status, owner_user_id, stripe_connect_account_id, connect_charges_enabled, repasse_prazo, frete_cents, frete_gratis_acima_cents, frete_modo, cep, logo_url, verificada, cidade, estado, plano'

interface Entrada { id: string; tipo: 'carta' | 'produto'; qtd?: number }
interface ItemResolvido {
  id: string
  tipo: 'carta' | 'produto'
  nome: string
  imagem: string | null
  preco_cents: number
  disponivel: boolean
  motivo?: string
  /** So produto, e so pra montar o pacote do frete calculado. */
  peso_g?: number | null
  /** O tipo do PRODUTO (selado/pelucia/...), que define a dimensao do pacote. */
  tipo_produto?: string | null
  /** Unidades efetivamente vendaveis: o pedido do cliente cortado no estoque. */
  qtd: number
  /** Estoque atual, pro seletor da tela saber o teto. Carta e sempre 1. */
  estoque: number
  /** true quando o pedido do cliente foi cortado pelo estoque. */
  qtd_ajustada?: boolean
}

/**
 * Le os itens do banco e diz quais ainda estao a venda DESTE vendedor.
 *
 * ★ Carta casa por `owner_user_id` e produto por `loja_id`, e e por isso que
 * produto de pessoa fisica nao existe: `loja_produtos` so tem dono com loja.
 * Anuncio de pessoa fisica chega aqui com `lojaId` null e nenhum produto.
 */
async function resolverItens(
  db: ReturnType<typeof sb>,
  alvo: { lojaId: string | null; ownerUserId: string },
  entradas: Entrada[]
) {
  const idsCarta = entradas.filter(e => e.tipo === 'carta').map(e => e.id)
  const idsProd = entradas.filter(e => e.tipo === 'produto').map(e => e.id)
  const out: ItemResolvido[] = []
  const qtdPedida = (id: string) => {
    const e = entradas.find(x => x.id === id)
    const n = Math.floor(Number(e?.qtd))
    return Number.isFinite(n) && n > 0 ? Math.min(n, 99) : 1
  }

  if (idsCarta.length) {
    const { data } = await db
      .from('marketplace')
      .select('id, card_name, card_image, price, status, user_id, removido_em')
      .in('id', idsCarta)
    for (const id of idsCarta) {
      const c = data?.find(x => x.id === id)
      if (!c || c.user_id !== alvo.ownerUserId) {
        out.push({ id, tipo: 'carta', nome: 'Item removido', imagem: null, preco_cents: 0, disponivel: false, motivo: 'não é mais deste vendedor', qtd: 1, estoque: 0 })
        continue
      }
      out.push({
        id,
        tipo: 'carta',
        nome: c.card_name || 'Carta',
        imagem: c.card_image,
        preco_cents: Math.round(Number(c.price) * 100),
        // `removido_em` = moderacao do admin (nao mexe no status). Sem isto o
        // carrinho aceitaria anuncio removido.
        disponivel: c.status === 'disponivel' && !c.removido_em,
        motivo: c.removido_em ? 'não está mais disponível' : c.status !== 'disponivel' ? 'já foi vendida' : undefined,
        // Carta e peca unica: 1 anuncio, 1 unidade.
        qtd: 1,
        estoque: 1,
      })
    }
  }

  if (idsProd.length) {
    const { data } = await db
      .from('loja_produtos')
      .select('id, nome, fotos, preco_cents, estoque, ativo, loja_id, tipo, peso_g')
      .in('id', idsProd)
    for (const id of idsProd) {
      const p = data?.find(x => x.id === id)
      if (!p || !alvo.lojaId || p.loja_id !== alvo.lojaId) {
        out.push({ id, tipo: 'produto', nome: 'Item removido', imagem: null, preco_cents: 0, disponivel: false, motivo: 'não está mais nesta loja', qtd: 1, estoque: 0 })
        continue
      }
      out.push({
        id,
        tipo: 'produto',
        nome: p.nome,
        imagem: Array.isArray(p.fotos) && p.fotos.length ? p.fotos[0] : null,
        preco_cents: p.preco_cents,
        disponivel: !!p.ativo && p.estoque > 0,
        motivo: !p.ativo || p.estoque <= 0 ? 'esgotou' : undefined,
        peso_g: p.peso_g ?? null,
        tipo_produto: p.tipo ?? null,
        // A quantidade vem do cliente e e CORTADA no estoque real. Nunca se
        // confia no numero que chegou -- ele mora no localStorage dele.
        qtd: qtdPedida(id) > p.estoque ? Math.max(1, p.estoque) : qtdPedida(id),
        estoque: Math.max(0, p.estoque),
        qtd_ajustada: qtdPedida(id) > p.estoque,
      })
    }
  }

  // devolve na ordem que o cliente mandou (a ordem do carrinho dele)
  return entradas.map(e => out.find(o => o.id === e.id)).filter((x): x is ItemResolvido => !!x)
}

/**
 * A conta do carrinho. Fonte unica pro resumo e pro checkout.
 *
 * `freteCents` chega RESOLVIDO de fora: no modo fixo sai da loja, no calculado
 * sai de uma cotacao no servidor. Antes esta funcao lia `loja.frete_cents`
 * direto e ignorava `frete_modo` -- uma loja em frete calculado cobraria o
 * fixo (que costuma ser 0), ou seja, frete de graca sem ninguem querer.
 */
function montarConta(itens: ItemResolvido[], prazo: 14 | 30, metodo: MetodoPagamento, freteCents: number) {
  const validos = itens.filter(i => i.disponivel)
  const subtotal = validos.reduce((s, i) => s + i.preco_cents * i.qtd, 0)

  // ★ UMA taxa fixa por PEDIDO (decisao do Du, 03/09/2026). Antes o reduce
  // aplicava `comissaoVendedorCents` item a item, e a fixa de R$0,40 incidia N
  // vezes -- mas ela existe pra cobrir o custo fixo que a Stripe cobra por
  // TRANSACAO, e um pedido de N itens e uma transacao so. Cobrar N vezes viraria
  // margem disfarcada. `comissaoVendedorCents` sobre o subtotal ja resolve:
  // percentual do subtotal + uma unica fixa.
  const comissao = comissaoVendedorCents(subtotal, prazo)
  // Acrescimo sobre o subtotal: e UMA transacao no cartao/Pix.
  const acrescimo = subtotal > 0 ? acrescimoCompradorCents(subtotal, metodo) : 0

  const frete = subtotal === 0 ? 0 : Math.max(0, freteCents)

  return {
    subtotal_cents: subtotal,
    acrescimo_cents: acrescimo,
    frete_cents: frete,
    total_comprador_cents: subtotal + acrescimo + frete,
    comissao_bynx_cents: comissao + acrescimo,
    liquido_loja_cents: subtotal - comissao + frete,
    validos,
  }
}

async function carregar(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const vendedorId = body?.vendedor_id
  const entradas: Entrada[] = Array.isArray(body?.itens)
    ? body.itens
        .filter((i: unknown): i is Entrada => !!i && typeof (i as Entrada).id === 'string' && ((i as Entrada).tipo === 'carta' || (i as Entrada).tipo === 'produto'))
        .slice(0, 50)
        .map((i: Entrada) => ({ ...i, qtd: Math.max(1, Math.min(Math.floor(Number(i.qtd)) || 1, 99)) }))
    : []
  const metodo: MetodoPagamento = ehMetodoValido(body?.metodo) ? body.metodo : 'cartao'
  return { vendedorId, entradas, metodo, body }
}

export async function POST(req: NextRequest) {
  // Rota unica: /api/carrinho?acao=resumo|checkout
  const acao = new URL(req.url).searchParams.get('acao') || 'resumo'
  try {
    const { vendedorId, entradas, metodo, body } = await carregar(req)
    if (!vendedorId || entradas.length === 0) {
      return NextResponse.json({ error: 'Carrinho vazio.' }, { status: 400 })
    }
    if (metodo === 'pix' && !PIX_DISPONIVEL) {
      return NextResponse.json({ error: 'O Pix ainda não está disponível na Bynx. Use cartão por enquanto.' }, { status: 409 })
    }

    const db = sb()
    const recebedor = await resolverRecebedor(db, vendedorId)
    if (!recebedor) {
      return NextResponse.json({ error: 'Vendedor indisponível.' }, { status: 409 })
    }

    // ★ DADOS DE EXIBICAO, separados dos de DINHEIRO. O `recebedor` traz o que
    //   decide a cobranca (conta Connect, prazo, frete, CEP de origem); isto
    //   aqui e so a coluna de confianca da tela -- cidade, logo, plano. Loja
    //   tem painel proprio, pessoa fisica tem o perfil publico.
    let cidade: string | null = null
    let estado: string | null = null
    let plano: string | null = null
    if (recebedor.tipo === 'loja' && recebedor.lojaId) {
      const { data: ls } = await db.from('lojas').select(SELECT_LOJA).eq('id', recebedor.lojaId).limit(1)
      const l = ls?.[0]
      cidade = (l?.cidade as string) ?? null
      estado = (l?.estado as string) ?? null
      plano = (l?.plano as string) ?? null
    } else {
      const { data: pu } = await db.from('public_users').select('city').eq('id', recebedor.ownerUserId).limit(1)
      cidade = (pu?.[0]?.city as string) ?? null
    }

    const prazo = normalizarPrazo(recebedor.repassePrazo)
    const itens = await resolverItens(db, { lojaId: recebedor.lojaId, ownerUserId: recebedor.ownerUserId }, entradas)
    const validos = itens.filter(i => i.disponivel)
    const subtotalPrevio = validos.reduce((acc, i) => acc + i.preco_cents * i.qtd, 0)

    // ── Frete ────────────────────────────────────────────────────────────
    // Fixo: sai da loja (com a regra de gratis acima de X).
    // Calculado: PRECISA de cep + servico e e RE-COTADO aqui, casando por id --
    // nunca se confia no preco que o cliente mandou. Sem cep ainda (o comprador
    // acabou de abrir o carrinho), o resumo devolve frete_pendente e o total
    // fica indefinido, igual ao checkout de item unico.
    const ehCalculado = recebedor.freteModo === 'calculado'
    let freteCents = 0
    let fretePendente = false

    if (ehCalculado) {
      const cepDest = String(body?.cep || '').replace(/\D/g, '')
      const servicoId = Number(body?.servico)
      if (cepDest.length === 8 && servicoId) {
        if (!recebedor.cepOrigem) {
          // Vale para os dois: loja sem CEP e pessoa que nunca informou de onde
          // posta. O texto fala de VENDEDOR porque hoje a maioria nao tem loja.
          return NextResponse.json({ error: 'Esse vendedor ainda não informou o CEP de envio.' }, { status: 409 })
        }
        try {
          // ★ UM VOLUME PARA TODAS AS CARTAS, N volumes para os produtos.
          //   Carta empilha no mesmo envelope; produto selado nao. Declarar um
          //   pacote por carta punha 80 g em cada uma e tirava o Mini Envios
          //   da lista a partir da 4a. Ver `pacoteDeCartas`.
          //   ★ Conta IDENTICA a de `/api/frete/cotar`: divergir aqui faz a
          //     opcao escolhida no resumo sumir no checkout, e o comprador
          //     leva um 409 no momento de pagar.
          const pacotes: ItemFrete[] = validos
            .filter(i => i.tipo === 'produto')
            .map(i => ({ ...pacoteDeProduto(i.peso_g ?? null, i.tipo_produto ?? null, i.preco_cents, i.qtd), id: `p-${i.id}` }))
          const cartas = validos.filter(i => i.tipo !== 'produto')
          if (cartas.length) {
            const valorCents = cartas.reduce((t, i) => t + i.preco_cents, 0)
            pacotes.push({ ...pacoteDeCartas(cartas.length, valorCents), id: 'cartas' })
          }
          const opcoes = pacotes.length ? await cotarFrete(recebedor.cepOrigem, cepDest, pacotes) : []
          const escolhido = opcoes.find(o => o.id === servicoId)
          if (!escolhido) {
            return NextResponse.json(
              { error: 'Essa opção de frete não está mais disponível. Calcule o frete de novo.' },
              { status: 409 }
            )
          }
          freteCents = escolhido.precoCents
        } catch (e) {
          console.error('[carrinho] cotacao falhou:', (e as Error)?.message)
          return NextResponse.json({ error: 'Não consegui calcular o frete agora. Tente de novo.' }, { status: 502 })
        }
      } else {
        fretePendente = true
      }
    } else {
      const base = Math.max(0, recebedor.freteCents || 0)
      const limite = recebedor.freteGratisAcimaCents
      freteCents = limite != null && subtotalPrevio >= limite ? 0 : base
    }

    const conta = montarConta(itens, prazo, metodo, freteCents)

    // ── Resumo (a pagina do carrinho) ────────────────────────────────────
    if (acao === 'resumo') {
      // Reputacao da loja: mesma fonte da pagina publica (avaliacoes do DONO).
      // Best effort — falha aqui nao pode derrubar o carrinho.
      let rating: { media: number; total: number } | null = null
      try {
        const { data: avs } = await db.from('avaliacoes').select('estrelas').eq('avaliado_id', recebedor.ownerUserId)
        const notas = (avs || []).map(a => a.estrelas).filter((n): n is number => typeof n === 'number')
        if (notas.length) rating = { media: notas.reduce((x, y) => x + y, 0) / notas.length, total: notas.length }
      } catch (e) {
        console.error('[carrinho] rating:', (e as Error)?.message)
      }

      return NextResponse.json({
        // ★ A CHAVE E `vendedor`, nao `loja`. Quem monta a tela precisa saber
        //   que pode vir pessoa fisica: `tipo` diz qual, `loja_id` e null
        //   nesse caso, e a copy muda ("enviado pela loja" x "pelo vendedor").
        vendedor: {
          tipo: recebedor.tipo,
          id: recebedor.ownerUserId,
          loja_id: recebedor.lojaId,
          nome: recebedor.nome,
          slug: recebedor.slug,
          pode_vender: recebedor.chargesEnabled,
          frete_modo: ehCalculado ? 'calculado' : 'fixo',
          // Pra coluna de confianca do carrinho: quem esta vendendo, onde fica,
          // se e verificado e como as pessoas avaliaram. Comprar de quem voce
          // nao conhece e o atrito real aqui.
          logo_url: recebedor.logoUrl,
          verificada: recebedor.verificada,
          cidade,
          estado,
          plano,
          rating,
        },
        itens,
        ...conta,
        validos: undefined,
        frete_pendente: fretePendente,
        // Com frete por cotar o total ainda nao existe: quem monta a tela nao
        // pode exibir um numero que vai mudar.
        total_comprador_cents: fretePendente ? null : conta.total_comprador_cents,
        qtd_validos: conta.validos.length,
      })
    }

    // ── Checkout ─────────────────────────────────────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Faça login para comprar.' }, { status: 401 })
    const { data: authData } = await db.auth.getUser(token)
    const compradorId = authData?.user?.id
    if (!compradorId) return NextResponse.json({ error: 'Sessão expirada. Entre de novo.' }, { status: 401 })

    if (recebedor.ownerUserId === compradorId) {
      return NextResponse.json({ error: 'Você não pode comprar os seus próprios anúncios.' }, { status: 400 })
    }
    if (!recebedor.connectAccountId || !recebedor.chargesEnabled) {
      return NextResponse.json({ error: 'Esse vendedor ainda está ativando os recebimentos.' }, { status: 409 })
    }
    if (conta.validos.length === 0) {
      return NextResponse.json({ error: 'Nenhum item do seu carrinho está disponível.' }, { status: 409 })
    }
    if (fretePendente) {
      return NextResponse.json({ error: 'Calcule o frete antes de finalizar.' }, { status: 400 })
    }
    // Estoque caiu entre montar o carrinho e clicar em finalizar: NAO cortamos
    // calado. Cortar mudaria o total que ele acabou de ver na tela, e ninguem
    // deve descobrir isso na fatura.
    const ajustados = conta.validos.filter(i => i.qtd_ajustada)
    if (ajustados.length > 0) {
      const nomes = ajustados.map(i => `${i.nome} (${i.estoque} ${i.estoque === 1 ? 'unidade' : 'unidades'})`).join(', ')
      return NextResponse.json(
        { error: `O estoque mudou: ${nomes}. Revise o carrinho e tente de novo.` },
        { status: 409 }
      )
    }

    const primeiro = conta.validos[0]
    const resto = conta.validos.length - 1
    const nomePrimeiro = primeiro.qtd > 1 ? `${primeiro.nome} (${primeiro.qtd}x)` : primeiro.nome
    const resumoNome = resto > 0 ? `${nomePrimeiro} + ${resto} ${resto === 1 ? 'item' : 'itens'}` : nomePrimeiro

    const { data: pedidoIns, error: pedErr } = await db
      .from('pedidos')
      .insert({
        // ★ NULL quando quem vende e pessoa fisica, igual ao checkout de item
        //   unico. E o `vendedor_user_id` que manda, e o pos-venda de quem nao
        //   tem loja le exatamente por `loja_id is null` (rota /api/vendas).
        loja_id: recebedor.lojaId,
        vendedor_user_id: recebedor.ownerUserId,
        comprador_user_id: compradorId,
        // Atalho so quando e 1 item; com N, a verdade esta em pedido_itens.
        marketplace_id: conta.validos.length === 1 && primeiro.tipo === 'carta' ? primeiro.id : null,
        produto_id: conta.validos.length === 1 && primeiro.tipo === 'produto' ? primeiro.id : null,
        item_nome: resumoNome,
        item_imagem: primeiro.imagem,
        valor_item_cents: conta.subtotal_cents,
        frete_cents: conta.frete_cents,
        acrescimo_cents: conta.acrescimo_cents,
        total_comprador_cents: conta.total_comprador_cents,
        comissao_bynx_cents: conta.comissao_bynx_cents,
        liquido_loja_cents: conta.liquido_loja_cents,
        metodo,
        repasse_prazo: prazo,
        stripe_connect_account_id: recebedor.connectAccountId,
        status: 'aguardando_pagamento',
      })
      .select('id, numero')
      .single()

    if (pedErr || !pedidoIns) {
      console.error('[carrinho checkout] falha criando pedido:', pedErr?.message)
      return NextResponse.json({ error: 'Erro ao iniciar a compra.' }, { status: 500 })
    }

    const { error: itErr } = await db.from('pedido_itens').insert(
      conta.validos.map(i => ({
        pedido_id: pedidoIns.id,
        marketplace_id: i.tipo === 'carta' ? i.id : null,
        produto_id: i.tipo === 'produto' ? i.id : null,
        nome: i.nome,
        imagem: i.imagem,
        tipo: i.tipo,
        preco_cents: i.preco_cents,
        quantidade: i.qtd,
      }))
    )
    if (itErr) {
      console.error('[carrinho checkout] falha nos itens:', itErr.message)
      await db.from('pedidos').delete().eq('id', pedidoIns.id)
      return NextResponse.json({ error: 'Erro ao montar o pedido.' }, { status: 500 })
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Pagamentos indisponíveis no momento.' }, { status: 500 })
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' })
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'

    const brl = (unit: number, nome: string, quantity = 1) => ({
      price_data: { currency: 'brl' as const, unit_amount: unit, product_data: { name: nome } },
      quantity,
    })
    // Preco UNITARIO x quantity: o recibo da Stripe mostra "3 x R$ 150,00".
    const linhas: Stripe.Checkout.SessionCreateParams.LineItem[] = conta.validos.map(i => brl(i.preco_cents, i.nome, i.qtd))
    if (conta.acrescimo_cents > 0) {
      linhas.push(brl(conta.acrescimo_cents, metodo === 'pix' ? 'Taxa do Pix' : 'Acréscimo do cartão'))
    }
    if (conta.frete_cents > 0) linhas.push(brl(conta.frete_cents, `Frete — ${recebedor.nome}`))

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: [metodo === 'pix' ? 'pix' : 'card'],
        line_items: linhas,
        shipping_address_collection: { allowed_countries: ['BR'] },
        phone_number_collection: { enabled: true },
        client_reference_id: String(pedidoIns.id),
        // `bynx_loja_id` so quando existe loja -- mesmo padrao do checkout de
        // item unico (marketplace/[id]/checkout). Pessoa fisica nao tem.
        metadata: {
          bynx_pedido_id: String(pedidoIns.id),
          bynx_vendedor_id: String(recebedor.ownerUserId),
          ...(recebedor.lojaId ? { bynx_loja_id: String(recebedor.lojaId) } : {}),
        },
        payment_intent_data: {
          application_fee_amount: conta.comissao_bynx_cents,
          transfer_data: { destination: recebedor.connectAccountId },
          metadata: { bynx_pedido_id: String(pedidoIns.id) },
        },
        success_url: `${base}/pedido/${pedidoIns.id}?ok=1`,
        cancel_url: `${base}/carrinho?cancelado=1`,
      })

      await db.from('pedidos').update({ stripe_session_id: session.id, updated_at: new Date().toISOString() }).eq('id', pedidoIns.id)
      return NextResponse.json({ url: session.url, pedido_id: pedidoIns.id })
    } catch (e) {
      console.error('[carrinho checkout] Stripe recusou:', (e as Error)?.message)
      await db.from('pedidos').delete().eq('id', pedidoIns.id) // cascade limpa os itens
      return NextResponse.json({ error: 'Não foi possível iniciar o pagamento. Tente de novo.' }, { status: 502 })
    }
  } catch (err) {
    console.error('[carrinho] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
