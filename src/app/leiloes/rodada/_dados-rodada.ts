import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/supabaseServer'
import {
  COLUNAS_LANCE_PUBLICO,
  LIMITE_FEED_LANCES,
  lancesPublicosDeLinhas,
  type LancePublico,
} from '@/lib/leilao-rodada'
import type { LotePublico } from '@/lib/leilao'

/**
 * Leituras server-side proprias da pagina da RODADA (/leiloes/rodada/[numero])
 * e da rota de estado dela. Ficam fora de `../_dados.ts` (vitrine) de
 * proposito: as duas telas evoluem em paralelo.
 *
 * Tudo por PK ou indice. Nada toca `pokemon_cards` fora de leitura por PK.
 */

/**
 * Ultimos lances do lote no ar pela view `leilao_lances_publico` (apelido ja
 * mascarado; a view nao tem user_id). Filtro por `leilao_id` + ordem `id desc`
 * + limit: e exatamente o indice `idx_leilao_lances_leilao (leilao_id, id
 * desc)`, entao a leitura toca LIMITE_FEED_LANCES linhas, nunca o historico.
 *
 * Complementar: falha vira null (o feed some naquela volta; a rodada segue).
 */
export async function lerLancesDoLote(db: SupabaseClient, loteId: string): Promise<LancePublico[] | null> {
  const { data, error } = await db
    .from('leilao_lances_publico')
    .select(COLUNAS_LANCE_PUBLICO)
    .eq('leilao_id', loteId)
    .order('id', { ascending: false })
    .limit(LIMITE_FEED_LANCES)
  if (error) {
    console.error('[leiloes/rodada] lances', loteId, error.code, error.message)
    return null
  }
  return lancesPublicosDeLinhas(data as unknown[] | null)
}

export interface ReputacaoLoja {
  /** Media das avaliacoes recebidas pelo dono da loja. null = sem avaliacao. */
  media: number | null
  total: number
  /** Rodadas da loja que foram ao ar (ao vivo ou encerradas). null = nao deu para contar. */
  rodadas: number | null
}

/**
 * Reputacao da loja para o topo e o cartao da rodada. As avaliacoes vem da
 * MESMA RPC do ReputacaoCard (`get_avaliacoes_usuario`, avaliado = dono da
 * loja). O id do dono so e usado aqui no servidor: nao sai na pagina.
 * Rodadas: contagem pelo indice `idx_leilao_rodadas_loja`.
 *
 * Complementar: qualquer falha vira "sem dado" (a linha some), nunca derruba
 * a pagina.
 */
export const buscarReputacaoLoja = cache(async (lojaId: string | null): Promise<ReputacaoLoja | null> => {
  if (!lojaId) return null
  const db = getServiceSupabase()
  if (!db) return null

  const [dono, rodadas] = await Promise.all([
    db.from('lojas').select('owner_user_id').eq('id', lojaId).maybeSingle(),
    db
      .from('leilao_rodadas')
      .select('id', { count: 'exact', head: true })
      .eq('loja_id', lojaId)
      .in('status', ['ao_vivo', 'encerrada']),
  ])

  let media: number | null = null
  let total = 0
  const ownerId = (dono.data as { owner_user_id?: string | null } | null)?.owner_user_id ?? null
  if (!dono.error && ownerId) {
    const av = await db.rpc('get_avaliacoes_usuario', { p_user_id: ownerId })
    if (!av.error && Array.isArray(av.data)) {
      const estrelas = (av.data as Array<{ estrelas?: unknown }>)
        .map(a => Number(a.estrelas))
        .filter(n => Number.isFinite(n) && n > 0)
      total = estrelas.length
      media = total ? estrelas.reduce((s, v) => s + v, 0) / total : null
    }
  }

  return {
    media,
    total,
    rodadas: rodadas.error || rodadas.count == null ? null : rodadas.count,
  }
})

/**
 * "Mercado hoje a partir de" da fila de proximos: o MENOR preco (regra de
 * divulgacao) das cartas SEM graduacao, numa leitura por PK (`id in (...)`)
 * na view `pokemon_cards`. Slab nao tem preco comparavel no catalogo.
 * Mapa loteId -> centavos. Complementar: falha vira mapa vazio (a linha some).
 */
export async function buscarReferenciasFila(lotes: LotePublico[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  const alvo = lotes.filter(l => l.status === 'agendado' && l.cardId && !l.graduadora)
  const ids = [...new Set(alvo.map(l => l.cardId as string))]
  if (!ids.length) return out
  const db = getServiceSupabase()
  if (!db) return out
  const { data, error } = await db.from('pokemon_cards').select('id, preco_min').in('id', ids)
  if (error || !data) return out
  const porCarta = new Map<string, number>()
  for (const r of data as Array<{ id: string; preco_min: unknown }>) {
    const v = Number(r.preco_min)
    if (Number.isFinite(v) && v > 0) porCarta.set(String(r.id), Math.round(v * 100))
  }
  for (const l of alvo) {
    const v = porCarta.get(l.cardId as string)
    if (v != null) out[l.id] = v
  }
  return out
}
