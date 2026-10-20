import 'server-only'
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { enviarEmailRenderizado, type EmailRenderizado } from '@/lib/email'
import {
  FOTO_MIMES, DIAS_RECLAMAR, refundValido, restanteEstornavel, conferirRefund, type SlotFoto, type SlotFotoEnvio,
} from '@/lib/leilao-reclamacao'

/**
 * Servidor da Protecao Bynx (reclamacao de pedido de leilao). Schema em
 * supabase/migrations/20260928140000_pedido_reclamacoes.sql; regras puras em
 * src/lib/leilao-reclamacao.ts.
 *
 * ★ NUNCA importar em componente 'use client' (service role + Stripe).
 */

export const BUCKET_RECLAMACOES = 'reclamacoes'
export const SEM_CACHE = { 'Cache-Control': 'no-store, max-age=0' }
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Colunas de pedido que as rotas da reclamacao usam. */
export const COLUNAS_PEDIDO =
  'id, numero, status, loja_id, vendedor_user_id, comprador_user_id, item_nome, leilao_id, ' +
  'total_comprador_cents, stripe_payment_intent_id, pago_em, enviado_em, entregue_em, rastreio, ' +
  'prazo_reclamacao_ate, reclamacao_aberta, valor_reembolsado_cents, recebido_automatico, valor_item_cents, em_disputa'

/** Colunas da reclamacao que loja e admin leem. */
export const COLUNAS_RECLAMACAO =
  'id, pedido_id, loja_id, comprador_user_id, motivo, descricao, fotos, video_url, status, resposta_tipo, ' +
  'resposta_loja, contraproposta_cents, respondida_em, prazo_loja_ate, prazo_decisao_ate, decisao, ' +
  'decisao_nota, valor_estornado_cents, stripe_refund_id, decidido_por, decidido_em, created_at, updated_at, ' +
  'postar_ate, devolucao_rastreio, devolucao_postada_em, devolucao_entregue_em, contestar_ate, contestacao, ' +
  'contestacao_video_url, contestada_em, contestacao_tipo, destino_carta'

export interface PedidoRecl {
  id: string
  numero: number
  status: string
  loja_id: string
  vendedor_user_id: string
  comprador_user_id: string
  item_nome: string
  leilao_id: string | null
  total_comprador_cents: number
  stripe_payment_intent_id: string | null
  pago_em: string | null
  enviado_em: string | null
  entregue_em: string | null
  rastreio: string | null
  prazo_reclamacao_ate: string | null
  reclamacao_aberta: boolean
  valor_reembolsado_cents: number
  recebido_automatico: boolean
  valor_item_cents: number
  em_disputa: boolean
}

export function sbServico(): SupabaseClient {
  const sb = getServiceSupabase()
  if (!sb) throw new Error('supabase service indisponivel')
  return sb
}

export async function usuarioDoBearer(req: NextRequest, sb: SupabaseClient): Promise<string | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!bearer) return null
  const { data, error } = await sb.auth.getUser(bearer)
  if (error || !data?.user) return null
  return data.user.id
}

export async function carregarPedido(sb: SupabaseClient, pedidoId: string): Promise<PedidoRecl | null> {
  const { data, error } = await sb.from('pedidos').select(COLUNAS_PEDIDO).eq('id', pedidoId).limit(1)
  if (error) throw new Error(`pedido: ${error.message}`)
  return ((data?.[0] as unknown) as PedidoRecl | undefined) ?? null
}

/** Pedido de leilao = leilao_id no pedido OU em algum item (carrinho). */
export async function ehPedidoDeLeilao(sb: SupabaseClient, p: { id: string; leilao_id: string | null }): Promise<boolean> {
  if (p.leilao_id) return true
  const { data, error } = await sb.from('pedido_itens').select('id').eq('pedido_id', p.id).not('leilao_id', 'is', null).limit(1)
  if (error) throw new Error(`pedido_itens: ${error.message}`)
  return (data?.length ?? 0) > 0
}

/** Lotes de leilao do pedido (atalho + itens), sem repeticao. */
export async function lotesDoPedido(sb: SupabaseClient, p: { id: string; leilao_id: string | null }): Promise<string[]> {
  const ids = new Set<string>()
  if (p.leilao_id) ids.add(p.leilao_id)
  const { data } = await sb.from('pedido_itens').select('leilao_id').eq('pedido_id', p.id).not('leilao_id', 'is', null)
  for (const i of data || []) if (i.leilao_id) ids.add(i.leilao_id as string)
  return [...ids]
}

/** Pasta do comprador no bucket. Caminho sempre escolhido pelo servidor. */
export function pastaFotos(pedidoId: string, userId: string): string {
  return `${pedidoId}/${userId}/`
}

export function caminhoFoto(pedidoId: string, userId: string, slot: SlotFoto, mime: string): string {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp'
  return `${pastaFotos(pedidoId, userId)}${slot}-${crypto.randomUUID()}.${ext}`
}

/** Pasta das fotos de envio da loja (prova numa devolucao). */
export function pastaEnvio(pedidoId: string): string {
  return `${pedidoId}/envio/`
}

export function caminhoFotoEnvio(pedidoId: string, slot: SlotFotoEnvio, mime: string): string {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp'
  return `${pastaEnvio(pedidoId)}${slot}-${crypto.randomUUID()}.${ext}`
}

export function mimeValido(m: unknown): m is string {
  return typeof m === 'string' && FOTO_MIMES.includes(m)
}

/** Nomes dos arquivos que existem na pasta (para conferir o que o cliente mandou). */
export async function arquivosNaPasta(sb: SupabaseClient, pasta: string): Promise<Set<string>> {
  const { data, error } = await sb.storage.from(BUCKET_RECLAMACOES).list(pasta.replace(/\/$/, ''), { limit: 100 })
  if (error) throw new Error(`storage list: ${error.message}`)
  return new Set((data || []).map(o => `${pasta}${o.name}`))
}

/** Signed URLs curtas (10 min) para as fotos. Caminho sem URL fica de fora. */
export async function assinarFotos(sb: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  const unicos = [...new Set(paths.filter(Boolean))]
  if (!unicos.length) return {}
  const { data, error } = await sb.storage.from(BUCKET_RECLAMACOES).createSignedUrls(unicos, 600)
  if (error) {
    console.error('[reclamacao] signed urls:', error.message)
    return {}
  }
  const out: Record<string, string> = {}
  for (const d of data || []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl
  return out
}

// ─── Stripe ─────────────────────────────────────────────────────────────────

function stripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2025-03-31.basil' as Stripe.StripeConfig['apiVersion'] })
}

export interface RefundFeito {
  id: string
  amount: number
  /** succeeded | pending | failed | canceled | requires_action (conferir com conferirRefund). */
  status: string | null
  /** true = achado pela chave (retry), nao criado agora. */
  reaproveitado: boolean
}

/**
 * Estorno de destination charge: devolve ao comprador, reverte o transfer da
 * loja e a taxa da Bynx NA MESMA PROPORCAO (reverse_transfer +
 * refund_application_fee). Mesmo desenho do cancelamento pela loja.
 *
 * ★ IDEMPOTENCIA EM DOIS NIVEIS. (1) `idempotencyKey` = `chave`: clique duplo
 *   ou retry dentro de 24h devolve o MESMO refund. (2) Antes de criar, procura
 *   refund deste PI com `metadata.bynx_chave = chave`: se a Stripe ja estornou
 *   e o banco nao gravou (queda entre os dois), o retry depois de 24h nao
 *   estorna de novo -- reaproveita o refund e so grava.
 * `amountCents` null = o restante inteiro do pagamento.
 */
export async function estornarNaStripe(args: {
  paymentIntent: string
  chave: string
  amountCents: number | null
  metadata: Record<string, string>
  /** Chaves de outro caminho que estorna o MESMO valor (ver cancelarPagoComEstorno). */
  chavesIrmas?: string[]
}): Promise<RefundFeito> {
  const s = stripe()
  const existentes = await s.refunds.list({ payment_intent: args.paymentIntent, limit: 100 })
  const chaves = [args.chave, ...(args.chavesIrmas || [])]
  const achado = existentes.data.find(r => chaves.includes(r.metadata?.bynx_chave ?? '') && r.status !== 'failed' && r.status !== 'canceled')
  if (achado) return { id: achado.id, amount: achado.amount, status: achado.status ?? null, reaproveitado: true }

  const refund = await s.refunds.create(
    {
      payment_intent: args.paymentIntent,
      ...(args.amountCents != null ? { amount: args.amountCents } : {}),
      reverse_transfer: true,
      refund_application_fee: true,
      metadata: { ...args.metadata, bynx_chave: args.chave },
    },
    { idempotencyKey: args.chave },
  )
  return { id: refund.id, amount: refund.amount, status: refund.status ?? null, reaproveitado: false }
}

/**
 * O que a Stripe sabe do pagamento, para calcular o restante estornavel
 * (restanteEstornavel em lib/leilao-reclamacao): a charge (amount e
 * amount_refunded -- inclui estorno manual pelo dashboard) e o refund desta
 * chave, se ja existir e contar como devolvido. Leitura so; nunca estorna.
 */
export async function situacaoNaStripe(paymentIntent: string, chave: string): Promise<{
  charge: { amount: number; amountRefunded: number } | null
  refundDestaChaveCents: number
}> {
  const s = stripe()
  const [pi, refunds] = await Promise.all([
    s.paymentIntents.retrieve(paymentIntent, { expand: ['latest_charge'] }),
    s.refunds.list({ payment_intent: paymentIntent, limit: 100 }),
  ])
  const ch = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null
  const nosso = refunds.data.find(r => r.metadata?.bynx_chave === chave && refundValido(r.status))
  return {
    charge: ch ? { amount: ch.amount, amountRefunded: ch.amount_refunded } : null,
    refundDestaChaveCents: nosso?.amount ?? 0,
  }
}

/** Chargeback aberto: a Stripe ja segurou o valor, a Bynx nao estorna por cima. */
export const MSG_EM_DISPUTA =
  'Este pagamento está em contestação no cartão. O estorno pela Bynx fica suspenso até o banco decidir.'

/**
 * Cancela com estorno INTEGRAL um pedido de leilao ainda nao enviado: o
 * cancelamento por atraso da loja e a desistencia antes do envio. Mesma
 * sequencia, so muda a chave e o texto:
 *   1. CAS pago -> cancelando (o "enviar" da loja so vale de 'pago');
 *   2. refund integral na Stripe, idempotente pela `chave`;
 *   3. pedido -> reembolsado (CAS cancelando -> reembolsado);
 *   4. lotes -> cancelado (leilao_marcar_reembolsado, idempotente).
 * Stripe recusou -> volta para 'pago'. Queda de rede -> fica 'cancelando' e o
 * retry reaproveita o refund. Financeiro fica com o webhook charge.refunded.
 * Quem chama ja conferiu dono, leilao e prazo; aqui so o dinheiro.
 */
export const CHAVES_CANCELAMENTO = (pedidoId: string) => [`atraso-${pedidoId}`, `desistencia-${pedidoId}`]

export async function cancelarPagoComEstorno(sb: SupabaseClient, pedido: PedidoRecl, o: {
  chave: string
  origem: string
  canceladoPor: 'comprador'
  motivoTexto: string
  log: string
}): Promise<{ ok: true; refundId: string } | { ok: false; http: number; erro: string }> {
  if (pedido.em_disputa) return { ok: false, http: 409, erro: MSG_EM_DISPUTA }
  if (!pedido.stripe_payment_intent_id) return { ok: false, http: 409, erro: 'Pedido sem pagamento associado. Fale com o suporte.' }

  if (pedido.status !== 'cancelando') {
    const { data: travou, error: tErr } = await sb
      .from('pedidos')
      .update({ status: 'cancelando', updated_at: new Date().toISOString() })
      .eq('id', pedido.id)
      .eq('status', 'pago')
      .select('id')
    if (tErr) {
      console.error(`[${o.log}] trava falhou:`, tErr.message)
      return { ok: false, http: 500, erro: 'Erro ao iniciar o cancelamento. Nada foi alterado.' }
    }
    if (!travou?.length) {
      return { ok: false, http: 409, erro: 'O pedido mudou de situação (a loja pode ter acabado de enviar). Atualize a página.' }
    }
  }
  const destravar = async () => {
    const { error } = await sb.from('pedidos')
      .update({ status: 'pago', updated_at: new Date().toISOString() })
      .eq('id', pedido.id)
      .eq('status', 'cancelando')
    if (error) console.error(`[${o.log}] CRITICAL: pedido ficou em cancelando |`, pedido.id, '|', error.message)
  }

  let refundId: string
  try {
    const r = await estornarNaStripe({
      paymentIntent: pedido.stripe_payment_intent_id,
      chave: o.chave,
      amountCents: null,
      metadata: { pedido_id: pedido.id, origem: o.origem },
      // Atraso e desistencia antes do envio estornam o mesmo pedido inteiro.
      // Se um caiu no meio ('cancelando') e o comprador clica no outro, o
      // refund do primeiro e reaproveitado em vez de tentar um segundo.
      chavesIrmas: CHAVES_CANCELAMENTO(pedido.id).filter(c => c !== o.chave),
    })
    const conf = conferirRefund(r, null)
    if (!conf.ok) {
      console.error(`[${o.log}] refund ${r.id} com status ${r.status} | ${pedido.id}`)
      await destravar()
      return { ok: false, http: 502, erro: 'Não foi possível concluir o estorno agora. Nada foi alterado. Tente de novo em instantes.' }
    }
    refundId = r.id
  } catch (e) {
    console.error(`[${o.log}] refund falhou:`, (e as Error)?.message)
    if ((e as { type?: string })?.type !== 'StripeConnectionError') await destravar()
    return { ok: false, http: 502, erro: 'Não foi possível processar o estorno agora. Nada foi alterado. Tente de novo em instantes.' }
  }

  const agora = new Date().toISOString()
  const { data: mexeu, error: upErr } = await sb
    .from('pedidos')
    .update({
      status: 'reembolsado',
      cancelado_em: agora,
      cancelado_por: o.canceladoPor,
      cancelamento_motivo: o.motivoTexto,
      stripe_refund_id: refundId,
      updated_at: agora,
    })
    .eq('id', pedido.id)
    .eq('status', 'cancelando')
    .select('id')
  if (upErr || !mexeu?.length) {
    // O webhook charge.refunded pode ter chegado antes. Fora isso, o dinheiro
    // JA voltou na Stripe: loga alto para reconciliar.
    const agoraPed = await carregarPedido(sb, pedido.id).catch(() => null)
    if (agoraPed?.status !== 'reembolsado') {
      console.error(`[${o.log}] CRITICAL: refund OK mas pedido nao atualizado |`, pedido.id, '| refund', refundId, '|', upErr?.message || `status ${agoraPed?.status}`)
    }
  }

  await cancelarLotes(sb, pedido, o.log)
  return { ok: true, refundId }
}

/** Lotes do pedido -> cancelado. Idempotente; falha so loga (o dinheiro ja voltou). */
export async function cancelarLotes(sb: SupabaseClient, pedido: { id: string; numero: number; leilao_id: string | null }, log: string) {
  for (const lote of await lotesDoPedido(sb, pedido)) {
    const { data: r, error } = await sb.rpc('leilao_marcar_reembolsado', { p_leilao: lote, p_pedido: pedido.id })
    if (error || (r !== 'cancelado' && r !== 'ja_cancelado' && r !== 'outro_pedido')) {
      console.error(`[${log}] CRITICAL: lote ${lote} (pedido ${pedido.numero}):`, error?.message || r)
    }
  }
}

/**
 * Conclui a desistencia com devolucao: estorna o RESTANTE inteiro e fecha a
 * reclamacao 'arrependimento' como resolvida/estorno_total. Chamado pela loja
 * ("Recebi a carta certa") e pelo cron (janela de contestacao passou).
 * Provedor antes do banco, chave 'arrependimento-<rid>' (o retry reaproveita
 * o refund), mesmo desenho de /api/admin/reclamacoes/[rid]/decidir.
 */
export async function concluirDevolucao(sb: SupabaseClient, rid: string, pedido: PedidoRecl, por: 'loja' | 'automatico'): Promise<
  { ok: true; resultado: string; valorCents: number } | { ok: false; http: number; erro: string }
> {
  if (pedido.em_disputa) return { ok: false, http: 409, erro: MSG_EM_DISPUTA }
  if (!pedido.stripe_payment_intent_id) return { ok: false, http: 409, erro: 'Pedido sem pagamento associado.' }
  const chave = `arrependimento-${rid}`
  let restante: number
  try {
    const sit = await situacaoNaStripe(pedido.stripe_payment_intent_id, chave)
    restante = restanteEstornavel({
      totalCents: pedido.total_comprador_cents,
      reembolsadoBancoCents: pedido.valor_reembolsado_cents || 0,
      charge: sit.charge,
      refundDestaChaveCents: sit.refundDestaChaveCents,
    })
  } catch (e) {
    console.error('[devolucao] leitura da Stripe falhou:', (e as Error)?.message)
    return { ok: false, http: 502, erro: 'Não foi possível consultar o pagamento agora. Nada foi alterado. Tente de novo em instantes.' }
  }
  if (restante <= 0) return { ok: false, http: 409, erro: 'Não há valor a estornar neste pedido.' }

  let refundId: string
  let valor: number
  try {
    const r = await estornarNaStripe({
      paymentIntent: pedido.stripe_payment_intent_id,
      chave,
      amountCents: restante,
      metadata: { pedido_id: pedido.id, reclamacao_id: rid, decisao: 'arrependimento' },
    })
    const conf = conferirRefund(r, restante)
    if (!conf.ok) {
      console.error(`[devolucao] refund ${r.id} recusado (${r.amount}/${restante}, ${r.status}) | ${rid}`)
      return { ok: false, http: conf.http, erro: conf.erro }
    }
    refundId = r.id
    valor = r.amount
  } catch (e) {
    console.error('[devolucao] refund falhou:', (e as Error)?.message)
    return { ok: false, http: 502, erro: 'A Stripe não aceitou o estorno. Nada foi alterado. Tente de novo em instantes.' }
  }

  const { data: res, error } = await sb.rpc('pedido_reclamacao_resolver', {
    p_reclamacao: rid,
    p_status: 'resolvida',
    p_decisao: 'estorno_total',
    p_valor_cents: valor,
    p_refund: refundId,
    p_por: por,
    p_nota: por === 'loja' ? 'Loja confirmou o recebimento da devolução.' : 'Sem contestação da loja no prazo.',
  })
  if (error) {
    console.error('[devolucao] CRITICAL: resolver falhou |', rid, '| refund', refundId, '|', error.message)
    return { ok: false, http: 500, erro: 'O estorno foi feito na Stripe, mas a desistência não foi atualizada. Tente de novo: o mesmo estorno é reaproveitado.' }
  }
  await cancelarLotes(sb, pedido, 'devolucao')
  return { ok: true, resultado: String(res), valorCents: valor }
}

// ─── Avisos ─────────────────────────────────────────────────────────────────

export async function sino(sb: SupabaseClient, userId: string | null | undefined, title: string, message: string, link: string) {
  if (!userId) return
  const { error } = await sb.from('notifications').insert({ user_id: userId, type: 'aviso', title, message, read: false, data: { link } })
  if (error) console.error('[reclamacao] sino:', error.message)
}

export async function emailSeguro(e: EmailRenderizado | null) {
  if (!e?.to) return
  try {
    await enviarEmailRenderizado(e)
  } catch (err) {
    console.error('[reclamacao] email:', (err as Error)?.message)
  }
}

export async function contato(sb: SupabaseClient, userId: string | null | undefined): Promise<{ email: string | null; nome: string | null }> {
  if (!userId) return { email: null, nome: null }
  const { data } = await sb.from('users').select('email, name').eq('id', userId).limit(1)
  return { email: (data?.[0]?.email as string) || null, nome: (data?.[0]?.name as string) || null }
}

export async function nomeDaLoja(sb: SupabaseClient, lojaId: string): Promise<{ nome: string; owner: string | null }> {
  const { data } = await sb.from('lojas').select('nome, owner_user_id').eq('id', lojaId).limit(1)
  return { nome: (data?.[0]?.nome as string) || 'a loja', owner: (data?.[0]?.owner_user_id as string) || null }
}

/** Traduz os `raise exception` de pedido_reclamacao_abrir. */
export function erroDoAbrir(msg: string): { status: number; mensagem: string } {
  if (msg.includes('pedido_nao_encontrado')) return { status: 404, mensagem: 'Pedido não encontrado.' }
  if (msg.includes('nao_e_comprador')) return { status: 403, mensagem: 'Você não é o comprador deste pedido.' }
  if (msg.includes('nao_e_leilao')) return { status: 409, mensagem: 'A reclamação por aqui vale só para pedidos de leilão.' }
  if (msg.includes('status_invalido')) return { status: 409, mensagem: 'Este pedido não está em um estado que permita reclamação.' }
  if (msg.includes('prazo_encerrado')) return { status: 409, mensagem: `O prazo de ${DIAS_RECLAMAR} dias depois da entrega já terminou.` }
  if (msg.includes('ja_existe')) return { status: 409, mensagem: 'Já existe uma reclamação ou desistência aberta para este pedido.' }
  if (msg.includes('em_disputa')) return { status: 409, mensagem: MSG_EM_DISPUTA }
  if (msg.includes('motivo_invalido')) return { status: 400, mensagem: 'Escolha o motivo da reclamação.' }
  if (msg.includes('prazo_invalido')) return { status: 500, mensagem: 'Não foi possível registrar a desistência.' }
  return { status: 500, mensagem: 'Não foi possível registrar a reclamação.' }
}
