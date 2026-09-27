import 'server-only'
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { enviarEmailRenderizado, type EmailRenderizado } from '@/lib/email'
import { FOTO_MIMES, refundValido, type SlotFoto } from '@/lib/leilao-reclamacao'

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
  'prazo_reclamacao_ate, reclamacao_aberta, valor_reembolsado_cents, recebido_automatico'

/** Colunas da reclamacao que loja e admin leem. */
export const COLUNAS_RECLAMACAO =
  'id, pedido_id, loja_id, comprador_user_id, motivo, descricao, fotos, video_url, status, resposta_tipo, ' +
  'resposta_loja, contraproposta_cents, respondida_em, prazo_loja_ate, prazo_decisao_ate, decisao, ' +
  'decisao_nota, valor_estornado_cents, stripe_refund_id, decidido_por, decidido_em, created_at, updated_at'

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
}): Promise<RefundFeito> {
  const s = stripe()
  const existentes = await s.refunds.list({ payment_intent: args.paymentIntent, limit: 100 })
  const achado = existentes.data.find(r => r.metadata?.bynx_chave === args.chave && r.status !== 'failed' && r.status !== 'canceled')
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
  if (msg.includes('prazo_encerrado')) return { status: 409, mensagem: 'O prazo de 7 dias depois da entrega já terminou.' }
  if (msg.includes('ja_existe')) return { status: 409, mensagem: 'Já existe uma reclamação aberta para este pedido.' }
  return { status: 500, mensagem: 'Não foi possível registrar a reclamação.' }
}
