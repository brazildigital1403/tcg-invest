import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { expiraSessaoLeilao } from '@/lib/leilao'
import { calcularArremate } from '@/lib/leilao-taxas'
import { ehMetodoValido, normalizarPrazo, PIX_DISPONIVEL, type MetodoPagamento } from '@/lib/comissao'
import { cotarFrete, pacoteDeCarta } from '@/lib/melhor-envio'
import { resolverRecebedor, podeReceber, type Recebedor } from '@/lib/vendedorRecebimento'
import { rotuloGraduacao } from '@/components/leilao/cardDoLote'

/**
 * /api/leiloes/[id]/checkout — o arremate vira pedido.
 *
 * GET  (Bearer): o que a tela /leiloes/[slug]/pagar precisa -- preco de
 *      martelo, prazo, vendedor e modo de frete. So para QUEM VENCEU.
 * POST (Bearer) body: { cep?, servico?, metodo? }: cria (ou reaproveita) o
 *      pedido e a Checkout Session da Stripe e devolve { url, pedido_id }.
 *
 * DINHEIRO (src/lib/leilao-taxas.ts, comissao.ts intocado): destination charge.
 *   application_fee_amount = applicationFeeCents do calcularArremate
 *                          = comissao do vendedor + protecao + custo do cartao
 *   transfer_data.destination = conta do recebedor (loja ou pessoa)
 *   O frete vai INTEGRAL para quem vende: entra no total e no liquido, fora da
 *   comissao. No pedido: total_comprador - liquido_loja = application_fee, a
 *   mesma conta que o webhook usa para lancar a receita.
 *
 * FRETE: re-cotado AQUI pelo servico escolhido (nunca o preco do cliente),
 * mesmo padrao do checkout do marketplace.
 *
 * ★ PROVEDOR ANTES DO BANCO. O id do pedido nasce aqui (randomUUID) e vai no
 *   metadata da sessao; a sessao e criada primeiro e o pedido e gravado ja com
 *   `stripe_session_id`. Se o insert falha, a sessao e expirada na Stripe (o
 *   comprador nunca recebeu a URL, entao nada foi pago). Nao existe pedido
 *   aberto sem sessao -- o que tambem mantem a regra do calote do motor
 *   ("checkout em andamento" = pedido aberto com stripe_session_id).
 *
 * ★ IDEMPOTENTE. Pedido aberto do lote com sessao ainda aberta e o mesmo total
 *   -> devolve a MESMA URL. Total diferente (outro CEP/servico) -> expira a
 *   sessao antiga na Stripe, cancela o pedido antigo e abre outro. Corrida de
 *   dois cliques -> o indice unico `pedidos_leilao_aberto_uniq` (migration
 *   20260928100000) recusa o segundo insert e a rota devolve a sessao do
 *   primeiro.
 *
 * ★ PRAZO. `expires_at` da sessao vai ate `pagar_ate` + 14 min (dentro da
 *   carencia de 15 min do tick, que nao marca calote com sessao aberta), nunca
 *   alem de 24h (teto da Stripe). Se nem assim sobra o minimo de 30 min da
 *   Stripe, a rota recusa (409). A tela continua mostrando `pagar_ate`.
 *
 * ★ SEM DUPLA COBRANCA. GET e POST recusam (409) lote que ja tem pedido pago
 *   -- por leiloes.pedido_id, pedidos.leilao_id ou pedido_itens.leilao_id, com
 *   pago_em ou status pago/enviado/entregue (mesmo criterio do tick). Cobre o
 *   lote que ficou em 'aguardando_pagamento' porque o webhook pagou o pedido
 *   mas nao conseguiu marcar o lote.
 *
 * ★ CANCELAMENTO NO MEIO. O lote so passa a apontar para o pedido novo se
 *   AINDA esta aguardando_pagamento com este comprador na lideranca. Se o lote
 *   mudou entre o carregar e o fim (cancelado pela loja, calote), a sessao
 *   recem-criada e expirada, o pedido e cancelado e a rota responde 409 --
 *   a URL nunca sai.
 *
 * LOJA: pedidos.loja_id = lote.loja_id quando a loja do lote e do mesmo dono
 * que recebe; senao, a loja que o resolverRecebedor escolheu.
 */

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const semCache = { 'Cache-Control': 'no-store', Vary: 'Authorization' }

function resposta(status: number, corpo: Record<string, unknown>) {
  return NextResponse.json(corpo, { status, headers: semCache })
}

function digits(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '')
}

interface LoteCheckout {
  id: string
  slug: string
  status: string
  lider_user_id: string | null
  vendedor_user_id: string
  loja_id: string | null
  pagar_ate: string | null
  pedido_id: string | null
  preco_atual_cents: number | null
  lance_inicial_cents: number
  card_id: string | null
  card_name: string
  card_numero: string | null
  card_image: string | null
  fotos: unknown
  condicao: string | null
  graduadora: string | null
  nota: string | null
}

// Literal: o supabase-js infere a linha pela string. NUNCA lider_maximo_cents.
const COLUNAS =
  'id, slug, status, lider_user_id, vendedor_user_id, loja_id, pagar_ate, pedido_id, preco_atual_cents, lance_inicial_cents, card_id, card_name, card_numero, card_image, fotos, condicao, graduadora, nota'

function nomeDoLote(l: LoteCheckout): string {
  return [l.card_name, l.card_numero, rotuloGraduacao(l)].filter(Boolean).join(' ')
}

function imagemDoLote(l: LoteCheckout): string | null {
  const fotos = Array.isArray(l.fotos) ? l.fotos.filter((u): u is string => typeof u === 'string' && !!u) : []
  return fotos[0] || l.card_image || null
}

function precoDoLote(l: LoteCheckout): number {
  return l.preco_atual_cents != null && l.preco_atual_cents > 0 ? l.preco_atual_cents : l.lance_inicial_cents
}

type Contexto =
  | { ok: true; db: SupabaseClient; compradorId: string; lote: LoteCheckout; recebedor: Recebedor | null }
  | { ok: false; res: NextResponse }

/** Login, lote, vencedor e prazo. Tudo com service role. */
async function carregar(req: NextRequest, id: string): Promise<Contexto> {
  if (!UUID_RE.test(id)) return { ok: false, res: resposta(404, { error: 'Lote não encontrado.' }) }

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return { ok: false, res: resposta(401, { erro: 'nao_autenticado', error: 'Entre na sua conta para pagar o lote.' }) }
  }

  const db = getServiceSupabase()
  if (!db) return { ok: false, res: resposta(500, { error: 'Pagamentos indisponíveis no momento.' }) }

  const { data: authData, error: authErr } = await db.auth.getUser(token)
  const compradorId = authData?.user?.id
  if (authErr || !compradorId) {
    return { ok: false, res: resposta(401, { erro: 'nao_autenticado', error: 'Sua sessão expirou. Entre de novo.' }) }
  }

  const { data, error } = await db.from('leiloes').select(COLUNAS).eq('id', id).neq('status', 'rascunho').maybeSingle()
  if (error) {
    console.error('[leilao/checkout] lote', id, error.code, error.message)
    return { ok: false, res: resposta(500, { error: 'Não foi possível carregar o lote. Tente de novo.' }) }
  }
  if (!data) return { ok: false, res: resposta(404, { error: 'Lote não encontrado.' }) }
  const lote = data as LoteCheckout

  const venceu = !!lote.lider_user_id && lote.lider_user_id === compradorId
  if (!venceu) {
    return {
      ok: false,
      res: resposta(403, { erro: 'nao_vencedor', error: 'Só quem venceu o lote pode pagar por ele.' }),
    }
  }

  // Antes de qualquer status: lote com pedido pago nunca abre outro pagamento.
  let pago: string | null
  try {
    pago = await pedidoPagoDoLote(db, lote)
  } catch (e) {
    console.error('[leilao/checkout] pedido pago do lote', id, (e as Error)?.message)
    return { ok: false, res: resposta(500, { error: 'Não foi possível carregar o lote. Tente de novo.' }) }
  }
  if (pago) {
    return { ok: false, res: resposta(409, { erro: 'pago', error: 'Este lote já foi pago.', pedido_id: pago }) }
  }
  if (lote.status === 'vendido') {
    return {
      ok: false,
      res: resposta(409, { erro: 'pago', error: 'Este lote já está pago.', pedido_id: lote.pedido_id }),
    }
  }
  if (lote.status !== 'aguardando_pagamento') {
    return {
      ok: false,
      res: resposta(409, {
        erro: 'fechado',
        error:
          lote.status === 'calote'
            ? 'O prazo para pagar este lote terminou.'
            : 'Este lote não está mais disponível para pagamento.',
      }),
    }
  }
  const prazoMs = lote.pagar_ate ? Date.parse(lote.pagar_ate) : NaN
  if (!Number.isFinite(prazoMs) || Date.now() >= prazoMs) {
    return { ok: false, res: resposta(409, { erro: 'prazo', error: 'O prazo para pagar este lote terminou.' }) }
  }
  if (lote.vendedor_user_id === compradorId) {
    return { ok: false, res: resposta(400, { error: 'Você não pode pagar pelo seu próprio lote.' }) }
  }

  const recebedor = await resolverRecebedor(db, lote.vendedor_user_id)
  return { ok: true, db, compradorId, lote, recebedor }
}

const STATUS_PAGO = ['pago', 'enviado', 'entregue']

function estaPago(p: { pago_em: string | null; status: string }): boolean {
  return p.pago_em != null || STATUS_PAGO.includes(p.status)
}

/**
 * Id de um pedido PAGO do lote, ou null. Mesmo criterio do calote no tick:
 * leiloes.pedido_id, pedidos.leilao_id ou pedido_itens.leilao_id, com pago_em
 * ou status pago/enviado/entregue. Erro de leitura -> throw (nunca "nao pago").
 */
async function pedidoPagoDoLote(db: SupabaseClient, lote: LoteCheckout): Promise<string | null> {
  type Ped = { id: string; pago_em: string | null; status: string }
  const filtro = lote.pedido_id ? `leilao_id.eq.${lote.id},id.eq.${lote.pedido_id}` : `leilao_id.eq.${lote.id}`
  const [{ data: peds, error: e1 }, { data: itens, error: e2 }] = await Promise.all([
    db.from('pedidos').select('id, pago_em, status').or(filtro),
    db.from('pedido_itens').select('pedido_id').eq('leilao_id', lote.id),
  ])
  if (e1) throw new Error(`pedidos do lote: ${e1.message}`)
  if (e2) throw new Error(`itens do lote: ${e2.message}`)
  const direto = ((peds ?? []) as Ped[]).find(estaPago)
  if (direto) return direto.id

  const conhecidos = new Set(((peds ?? []) as Ped[]).map(p => p.id))
  const viaItem = [...new Set(((itens ?? []) as { pedido_id: string }[]).map(i => i.pedido_id))].filter(
    pid => !conhecidos.has(pid)
  )
  if (viaItem.length === 0) return null
  const { data: outros, error: e3 } = await db.from('pedidos').select('id, pago_em, status').in('id', viaItem)
  if (e3) throw new Error(`pedidos dos itens do lote: ${e3.message}`)
  return ((outros ?? []) as Ped[]).find(estaPago)?.id ?? null
}

/**
 * Loja do pedido: a do lote quando ela e do mesmo dono que recebe (o lote
 * pode ter sido criado por uma loja que nao e a mais antiga do dono); senao a
 * que o resolverRecebedor escolheu.
 */
async function lojaDoPedido(db: SupabaseClient, lote: LoteCheckout, r: Recebedor): Promise<string | null> {
  if (!lote.loja_id || lote.loja_id === r.lojaId) return r.lojaId
  const { data, error } = await db
    .from('lojas')
    .select('id')
    .eq('id', lote.loja_id)
    .eq('owner_user_id', r.ownerUserId)
    .limit(1)
  if (error) {
    console.error('[leilao/checkout] loja do lote', lote.id, error.code, error.message)
    return r.lojaId
  }
  return data?.[0] ? lote.loja_id : r.lojaId
}

function podeVender(r: Recebedor | null): boolean {
  return podeReceber(r) && (r!.freteModo !== 'calculado' || !!r!.cepOrigem)
}

function motivoSemPagamento(r: Recebedor | null): string {
  if (r && podeReceber(r) && !r.cepOrigem) {
    return 'O vendedor deste lote ainda não informou o CEP de envio. Tente de novo mais tarde.'
  }
  return 'O vendedor deste lote ainda está ativando os recebimentos. Tente de novo mais tarde.'
}

// ─── GET: dados da tela de pagamento ────────────────────────────────────────

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  try {
    const { id } = await ctx.params
    const c = await carregar(req, id)
    if (!c.ok) return c.res
    const { lote, recebedor: r } = c
    const precoCents = precoDoLote(lote)

    return resposta(200, {
      lote: {
        id: lote.id,
        slug: lote.slug,
        nome: nomeDoLote(lote),
        imagem: imagemDoLote(lote),
        condicao: lote.condicao,
        preco_cents: precoCents,
      },
      pagar_ate: lote.pagar_ate,
      vendedor: r
        ? {
            tipo: r.tipo,
            nome: r.nome,
            verificada: r.verificada,
            frete_modo: r.freteModo,
            // Fixo ja resolvido (com o "gratis acima de" aplicado ao preco).
            frete_fixo_cents:
              r.freteModo === 'fixo'
                ? r.freteGratisAcimaCents != null && precoCents >= r.freteGratisAcimaCents
                  ? 0
                  : Math.max(0, r.freteCents)
                : null,
            pode_vender: podeVender(r),
            motivo: podeVender(r) ? null : motivoSemPagamento(r),
          }
        : null,
    })
  } catch (err) {
    console.error('[leilao/checkout GET] erro:', (err as Error)?.message)
    return resposta(500, { error: 'Erro interno.' })
  }
}

// ─── POST: pedido + Checkout Session ────────────────────────────────────────

interface PedidoAberto {
  id: string
  comprador_user_id: string
  stripe_session_id: string | null
  total_comprador_cents: number
}

/** Cancela um pedido que ainda esta aguardando (nunca um pago). */
async function cancelarAberto(db: SupabaseClient, pedidoId: string, motivo: string) {
  const agora = new Date().toISOString()
  const { error } = await db
    .from('pedidos')
    .update({
      status: 'cancelado',
      cancelado_em: agora,
      cancelado_por: 'sistema',
      cancelamento_motivo: motivo,
      updated_at: agora,
    })
    .eq('id', pedidoId)
    .eq('status', 'aguardando_pagamento')
  if (error) throw new Error(`cancelar pedido ${pedidoId}: ${error.message}`)
}

async function lerAberto(db: SupabaseClient, leilaoId: string): Promise<PedidoAberto | null> {
  const { data, error } = await db
    .from('pedidos')
    .select('id, comprador_user_id, stripe_session_id, total_comprador_cents')
    .eq('leilao_id', leilaoId)
    .eq('status', 'aguardando_pagamento')
    .limit(1)
  if (error) throw new Error(`pedido aberto do lote ${leilaoId}: ${error.message}`)
  return (data?.[0] as PedidoAberto | undefined) ?? null
}

type Reuso =
  | { tipo: 'url'; url: string; pedidoId: string }
  | { tipo: 'processando'; pedidoId: string }
  | { tipo: 'livre' }

/**
 * Decide o que fazer com o pedido aberto do lote, se houver.
 *   sessao aberta, mesmo comprador e mesmo total -> reaproveita a URL
 *   sessao paga (webhook a caminho)               -> 'processando'
 *   qualquer outro caso                           -> expira/cancela e libera
 */
async function tratarAberto(
  db: SupabaseClient,
  stripe: Stripe,
  aberto: PedidoAberto,
  compradorId: string,
  totalCents: number
): Promise<Reuso> {
  if (!aberto.stripe_session_id) {
    await cancelarAberto(db, aberto.id, 'Pedido sem sessao de pagamento, substituido por um novo.')
    return { tipo: 'livre' }
  }

  const s = await stripe.checkout.sessions.retrieve(aberto.stripe_session_id)
  if (s.status === 'complete') return { tipo: 'processando', pedidoId: aberto.id }

  if (s.status === 'open') {
    if (aberto.comprador_user_id === compradorId && aberto.total_comprador_cents === totalCents && s.url) {
      return { tipo: 'url', url: s.url, pedidoId: aberto.id }
    }
    // Total mudou (outro CEP/servico): a sessao antiga some antes do pedido.
    try {
      await stripe.checkout.sessions.expire(s.id)
    } catch (e) {
      const deNovo = await stripe.checkout.sessions.retrieve(s.id)
      if (deNovo.status === 'complete') return { tipo: 'processando', pedidoId: aberto.id }
      if (deNovo.status !== 'expired') throw e
    }
  }

  await cancelarAberto(db, aberto.id, 'Sessao de pagamento substituida por uma nova.')
  return { tipo: 'livre' }
}

function respostaReuso(r: Exclude<Reuso, { tipo: 'livre' }>) {
  if (r.tipo === 'url') return resposta(200, { url: r.url, pedido_id: r.pedidoId, reaproveitado: true })
  return resposta(409, {
    erro: 'processando',
    error: 'Seu pagamento já foi recebido e está sendo confirmado.',
    pedido_id: r.pedidoId,
  })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  try {
    const { id } = await ctx.params
    const c = await carregar(req, id)
    if (!c.ok) return c.res
    const { db, compradorId, lote, recebedor: r } = c

    const body = await req.json().catch(() => null)
    const metodo: MetodoPagamento = ehMetodoValido(body?.metodo) ? body.metodo : 'cartao'
    if (metodo === 'pix' && !PIX_DISPONIVEL) {
      return resposta(409, { error: 'O Pix ainda não está disponível na Bynx. Use cartão por enquanto.' })
    }

    if (!podeVender(r)) return resposta(409, { error: motivoSemPagamento(r) })
    const recebedor = r!

    const precoCents = precoDoLote(lote)
    if (!Number.isFinite(precoCents) || precoCents <= 0) {
      return resposta(400, { error: 'Preço inválido no lote.' })
    }
    const a = calcularArremate(precoCents, metodo)

    // ── Frete: fixo (vendedor) OU re-cotado aqui ─────────────────────────
    let freteCents = 0
    let freteLabel = `Frete — ${recebedor.nome}`
    if (recebedor.freteModo === 'calculado') {
      const cepDest = digits(body?.cep)
      const servicoId = Number(body?.servico)
      if (cepDest.length !== 8) return resposta(400, { error: 'Informe um CEP de entrega válido.' })
      if (!servicoId) return resposta(400, { error: 'Escolha uma opção de frete.' })
      try {
        const opcoes = await cotarFrete(recebedor.cepOrigem!, cepDest, [pacoteDeCarta(precoCents)])
        const escolhido = opcoes.find(o => o.id === servicoId)
        if (!escolhido) {
          return resposta(409, { error: 'Essa opção de frete não está mais disponível. Calcule o frete de novo.' })
        }
        freteCents = escolhido.precoCents
        freteLabel = `Frete — ${escolhido.empresa} ${escolhido.nome}`.trim()
      } catch (e) {
        console.error('[leilao/checkout] cotacao falhou:', (e as Error)?.message)
        return resposta(502, { error: 'Não foi possível calcular o frete agora. Tente de novo.' })
      }
    } else {
      const limite = recebedor.freteGratisAcimaCents
      freteCents = limite != null && precoCents >= limite ? 0 : Math.max(0, recebedor.freteCents)
    }

    const acrescimoCents = a.protecaoCents + a.custoMetodoCents
    const totalCents = a.compradorPagaCents + freteCents
    const liquidoCents = a.vendedorRecebeCents + freteCents

    const expiresAt = expiraSessaoLeilao(Date.parse(lote.pagar_ate!), Date.now())
    if (expiresAt == null) {
      return resposta(409, {
        erro: 'prazo_curto',
        error: 'Falta muito pouco para o fim do prazo e o pagamento não pode mais ser aberto. Fale com o vendedor.',
      })
    }

    if (!process.env.STRIPE_SECRET_KEY) return resposta(500, { error: 'Pagamentos indisponíveis no momento.' })
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // Mesma versao das outras rotas; o cast e o padrao de admin/parceiros (o tipo do SDK 17 e mais antigo).
      apiVersion: '2025-03-31.basil' as Stripe.StripeConfig['apiVersion'],
    })

    // ── Idempotencia: pedido aberto do lote ─────────────────────────────
    const aberto = await lerAberto(db, lote.id)
    if (aberto) {
      const reuso = await tratarAberto(db, stripe, aberto, compradorId, totalCents)
      if (reuso.tipo !== 'livre') return respostaReuso(reuso)
    }

    const lojaId = await lojaDoPedido(db, lote, recebedor)

    // ── 1. Stripe (o id do pedido nasce aqui) ────────────────────────────
    const pedidoId = randomUUID()
    const nome = nomeDoLote(lote)
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'
    const brl = (unit: number, n: string) => ({
      price_data: { currency: 'brl', unit_amount: unit, product_data: { name: n } },
      quantity: 1,
    })
    const linhas: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      brl(precoCents, `${nome} (arremate${lote.condicao ? `, ${lote.condicao}` : ''})`),
    ]
    if (a.protecaoCents > 0) linhas.push(brl(a.protecaoCents, 'Taxa de proteção'))
    if (a.custoMetodoCents > 0) linhas.push(brl(a.custoMetodoCents, metodo === 'pix' ? 'Taxa do Pix' : 'Acréscimo do cartão'))
    if (freteCents > 0) linhas.push(brl(freteCents, freteLabel))

    const metadata: Record<string, string> = {
      bynx_pedido_id: pedidoId,
      bynx_leilao_id: lote.id,
      bynx_vendedor_user_id: lote.vendedor_user_id,
      ...(lojaId ? { bynx_loja_id: lojaId } : {}),
    }

    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: [metodo === 'pix' ? 'pix' : 'card'],
        line_items: linhas,
        shipping_address_collection: { allowed_countries: ['BR'] },
        phone_number_collection: { enabled: true },
        client_reference_id: pedidoId,
        expires_at: expiresAt,
        metadata,
        payment_intent_data: {
          application_fee_amount: a.applicationFeeCents,
          transfer_data: { destination: recebedor.connectAccountId! },
          metadata: { bynx_pedido_id: pedidoId, bynx_leilao_id: lote.id },
        },
        success_url: `${base}/pedido/${pedidoId}?ok=1`,
        cancel_url: `${base}/leiloes/${lote.slug}/pagar?cancelado=1`,
      })
    } catch (e) {
      console.error('[leilao/checkout] Stripe recusou:', (e as Error)?.message)
      return resposta(502, { error: 'Não foi possível iniciar o pagamento. Tente de novo.' })
    }

    // Sessao criada e sem pedido: expira na Stripe. Ninguem recebeu a URL.
    const desfazerSessao = async () => {
      try {
        await stripe.checkout.sessions.expire(session.id)
      } catch (e) {
        console.error('[leilao/checkout] CRITICAL: sessao orfa', session.id, (e as Error)?.message)
      }
    }

    // ── 2. Pedido (ja com a sessao) ───────────────────────────────────────
    const { error: pedErr } = await db.from('pedidos').insert({
      id: pedidoId,
      loja_id: lojaId,
      vendedor_user_id: lote.vendedor_user_id,
      comprador_user_id: compradorId,
      leilao_id: lote.id,
      item_nome: nome,
      item_imagem: imagemDoLote(lote),
      item_card_id: lote.card_id,
      valor_item_cents: precoCents,
      frete_cents: freteCents,
      // Tudo que o comprador paga alem do martelo: protecao + custo do metodo.
      acrescimo_cents: acrescimoCents,
      total_comprador_cents: totalCents,
      comissao_bynx_cents: a.applicationFeeCents,
      liquido_loja_cents: liquidoCents,
      metodo,
      repasse_prazo: normalizarPrazo(recebedor.repassePrazo),
      stripe_connect_account_id: recebedor.connectAccountId,
      stripe_session_id: session.id,
      status: 'aguardando_pagamento',
    })

    if (pedErr) {
      await desfazerSessao()
      // Corrida: outro clique gravou o pedido aberto do lote primeiro.
      if (pedErr.code === '23505') {
        const outro = await lerAberto(db, lote.id)
        if (outro?.stripe_session_id && outro.comprador_user_id === compradorId) {
          const s = await stripe.checkout.sessions.retrieve(outro.stripe_session_id)
          if (s.status === 'open' && s.url) {
            return resposta(200, { url: s.url, pedido_id: outro.id, reaproveitado: true })
          }
        }
        return resposta(409, { error: 'Já existe um pagamento em andamento para este lote. Tente de novo em instantes.' })
      }
      console.error('[leilao/checkout] falha criando pedido:', pedErr.code, pedErr.message)
      return resposta(500, { error: 'Erro ao iniciar o pagamento.' })
    }

    // ── 3. Item (a verdade do pedido e pedido_itens) ──────────────────────
    const { error: itemErr } = await db.from('pedido_itens').insert({
      pedido_id: pedidoId,
      leilao_id: lote.id,
      nome,
      imagem: imagemDoLote(lote),
      tipo: 'carta',
      preco_cents: precoCents,
      quantidade: 1,
    })
    if (itemErr) {
      console.error('[leilao/checkout] falha criando item:', itemErr.code, itemErr.message)
      await desfazerSessao()
      await db.from('pedidos').delete().eq('id', pedidoId).eq('status', 'aguardando_pagamento')
      return resposta(500, { error: 'Erro ao iniciar o pagamento.' })
    }

    // ── 4. Lote aponta para o pedido em andamento ─────────────────────────
    // So se o lote AINDA espera ESTE comprador. Se mudou no meio (loja
    // cancelou, tick marcou calote), a URL nao sai: sessao expirada, pedido
    // cancelado, 409. Erro de escrita tambem desfaz (nao da para confirmar).
    const { data: loteOk, error: loteErr } = await db
      .from('leiloes')
      .update({ pedido_id: pedidoId })
      .eq('id', lote.id)
      .eq('status', 'aguardando_pagamento')
      .eq('lider_user_id', compradorId)
      .select('id')
    if (loteErr || !loteOk || loteOk.length === 0) {
      if (loteErr) console.error('[leilao/checkout] lote.pedido_id', lote.id, loteErr.code, loteErr.message)
      await desfazerSessao()
      try {
        await cancelarAberto(db, pedidoId, 'Lote mudou de estado durante o checkout.')
      } catch (e) {
        console.error('[leilao/checkout] CRITICAL: pedido sem lote ficou aberto', pedidoId, (e as Error)?.message)
      }
      if (loteErr) return resposta(500, { error: 'Erro ao iniciar o pagamento.' })
      return resposta(409, {
        erro: 'fechado',
        error: 'Este lote não está mais disponível para pagamento.',
      })
    }

    return resposta(200, { url: session.url, pedido_id: pedidoId })
  } catch (err) {
    console.error('[leilao/checkout] erro:', (err as Error)?.message)
    return resposta(500, { error: 'Erro interno.' })
  }
}
