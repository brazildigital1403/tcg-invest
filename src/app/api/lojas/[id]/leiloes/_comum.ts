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

/** Prazo de repasse exigido para agendar rodada (Protecao Bynx). */
export const REPASSE_LEILAO_DIAS = 30

export const UUID_RE =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

/**
 * A loja pode ativar a rodada agora? Mesma regra do checkout do arremate.
 *
 * ★ RECEBEDOR DA LOJA CERTA. Nao existe no repo resolvedor por lojaId: o
 *   `resolverRecebedor` e por DONO e, com duas lojas ativas do mesmo dono,
 *   escolhe a MAIS ANTIGA -- e e ele que o checkout do arremate usa
 *   (/api/leiloes/[id]/checkout). Se a loja da URL nao for a que o resolvedor
 *   escolhe, o dinheiro, o prazo de repasse e o CEP/modo de frete do arremate
 *   sairiam de OUTRA loja do mesmo dono, e esta conferencia de Connect/CEP
 *   estaria olhando a loja errada. Por isso: recebedor resolvido tem de ser
 *   exatamente esta loja (tipo 'loja' e lojaId igual); senao, nao agenda.
 *   Caso raro (dono com duas lojas ativas agendando pela mais nova). Quando
 *   existir resolvedor por loja, trocar aqui e no checkout juntos.
 */
export async function recebimentoDaLoja(
  sb: SupabaseClient,
  loja: LojaPainel
): Promise<{ podeReceber: boolean; motivo: string | null }> {
  if (loja.status !== 'ativa') {
    return { podeReceber: false, motivo: 'Sua loja precisa estar ativa para agendar.' }
  }
  const r = await resolverRecebedor(sb, loja.owner_user_id)
  if (!r) return { podeReceber: false, motivo: 'Não foi possível conferir os recebimentos da loja.' }
  if (r.tipo !== 'loja' || r.lojaId !== loja.id) {
    return {
      podeReceber: false,
      motivo:
        'Os arremates desta conta são recebidos por outra loja sua. Por enquanto, crie a rodada na sua loja mais antiga.',
    }
  }
  if (!podeReceber(r)) {
    return { podeReceber: false, motivo: 'Ative os recebimentos em Pagamentos para receber pelos arremates.' }
  }
  // ★ REPASSE DE 30 DIAS (Protecao Bynx, decisao do Du 28/09). Sem retencao do
  //   dinheiro, o que cobre o estorno de uma reclamacao (ate 21 + 7 dias depois
  //   do envio) e o saldo da loja ainda nao repassado: com delay de 30 dias o
  //   reverse_transfer do estorno encontra saldo. Com 14 nao.
  //   Fonte: `repasse_prazo` JA GRAVADO (lojas, ou users quando a loja usa a
  //   conta do dono -- o resolvedor escolhe). O PATCH de /api/lojas/[id]/connect
  //   aplica o delay_days na Stripe ANTES de gravar ("a Stripe manda, o banco
  //   obedece"), entao o banco espelha o payout schedule sem chamar a Stripe a
  //   cada agendamento. null normaliza para 30 (piso da Stripe BR em conta nova).
  if (r.repassePrazo !== REPASSE_LEILAO_DIAS) {
    return {
      podeReceber: false,
      motivo: `Para leiloar, o repasse da loja precisa estar em ${REPASSE_LEILAO_DIAS} dias. Ajuste em Pagamentos.`,
    }
  }
  // Frete calculado sem CEP de origem: o checkout do arremate recusa. Barrar
  // aqui evita uma rodada inteira de lotes que ninguem consegue pagar.
  if (r.freteModo === 'calculado' && !r.cepOrigem) {
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

/** Origin do Supabase configurado (de onde saem as URLs publicas do storage). */
export function origemSupabase(sb: SupabaseClient): string {
  return new URL(sb.storage.from('loja-fotos').getPublicUrl('x').data.publicUrl).origin
}
