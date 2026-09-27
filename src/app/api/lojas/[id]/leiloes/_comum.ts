import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { resolverRecebedor, podeReceber } from '@/lib/vendedorRecebimento'

/**
 * Comum das rotas /api/lojas/[id]/leiloes/** (painel da loja, fatia 5).
 *
 * - Flag desligada -> 404 antes de qualquer leitura.
 * - Dono da loja (Bearer) ou admin, pelo autenticarOwnerOuAdmin da casa. O
 *   client devolvido e SERVICE ROLE: toda escrita do leilao passa por aqui
 *   (as tabelas nao tem grant de escrita para anon/authenticated).
 * - Toda leitura/escrita de rodada filtra por `loja_id` da URL ja validada:
 *   o id da rodada nunca alcanca rodada de outra loja.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const SEM_CACHE = { 'Cache-Control': 'no-store, max-age=0' }

export function json(status: number, corpo: Record<string, unknown>) {
  return NextResponse.json(corpo, { status, headers: SEM_CACHE })
}

export interface LojaPainel {
  id: string
  owner_user_id: string
  nome: string
  status: string
}

export type Contexto =
  | { ok: true; sb: SupabaseClient; loja: LojaPainel }
  | { ok: false; res: NextResponse }

export async function contextoPainel(req: NextRequest, lojaId: string): Promise<Contexto> {
  if (!LEILAO_ATIVO) return { ok: false, res: new NextResponse(null, { status: 404 }) }
  if (!UUID_RE.test(lojaId)) return { ok: false, res: json(404, { error: 'Loja não encontrada.' }) }
  const auth = await autenticarOwnerOuAdmin(req, lojaId, 'id, owner_user_id, nome, status')
  if ('error' in auth) return { ok: false, res: auth.error }
  return { ok: true, sb: auth.sb, loja: auth.loja as LojaPainel }
}

/** A loja pode ativar a rodada agora? Mesma regra do checkout do arremate. */
export async function recebimentoDaLoja(
  sb: SupabaseClient,
  loja: LojaPainel
): Promise<{ podeReceber: boolean; motivo: string | null }> {
  const r = await resolverRecebedor(sb, loja.owner_user_id)
  if (!podeReceber(r)) {
    return { podeReceber: false, motivo: 'Ative os recebimentos em Pagamentos para receber pelos arremates.' }
  }
  // Frete calculado sem CEP de origem: o checkout do arremate recusa. Barrar
  // aqui evita uma rodada inteira de lotes que ninguem consegue pagar.
  if (r!.freteModo === 'calculado' && !r!.cepOrigem) {
    return { podeReceber: false, motivo: 'Informe o CEP de envio da loja para o frete dos arremates.' }
  }
  return { podeReceber: true, motivo: null }
}

/** Colunas da rodada que o painel usa. */
export const COLUNAS_RODADA =
  'id, numero, loja_id, titulo, descricao, modo, status, inicia_em, link_transmissao, created_at, updated_at'

/**
 * Colunas do lote que o painel usa. ★ NUNCA lider_maximo_cents, lider_user_id,
 * segundo_user_id: o painel da loja nao ve quem da lance nem o teto.
 */
export const COLUNAS_LOTE_PAINEL =
  'id, codigo, slug, rodada_id, ordem, card_id, card_slug, card_name, card_numero, set_nome, card_image, ' +
  'fotos, condicao, idioma, graduadora, nota, descricao, lance_inicial_cents, preco_atual_cents, ' +
  'n_lances, duracao_seg, inicia_em, termina_em, status, encerrado_em, created_at'

/** Caminho das fotos do leilao da loja no bucket `loja-fotos`. */
export function pastaFotos(lojaId: string) {
  return `leiloes/${lojaId}/`
}

export function prefixoFotos(sb: SupabaseClient, lojaId: string): string {
  return sb.storage.from('loja-fotos').getPublicUrl(pastaFotos(lojaId)).data.publicUrl
}
