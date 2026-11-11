import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { criarLimitador, ipDaRequest } from '@/lib/rateLimit'

/**
 * GET /api/cards/[id]/preco-internacional
 *
 * Preco de fora de UMA carta (TCGplayer em USD, Cardmarket em EUR), da tabela
 * card_preco_internacional (11/11/2026). A tabela tem RLS fechada: so a chave de
 * servico le, entao a tela passa por esta rota, igual a historico-vendas.
 *
 * ★ Decisao do Du: o valor de fora e INFORMATIVO. Esta rota so entrega o dado; quem
 * mostra decide o destaque (o Brasil vem sempre primeiro). Carta so do Brasil (id
 * liga-*) nao tem linha aqui e devolve { preco: null }.
 *
 * Falha de banco devolve 500 e nunca { preco: null }: um "sem dado" falso ficaria em
 * cache e esconderia o bloco de quem tem dado.
 */

const limitador = criarLimitador({ janelaMs: 60_000, max: 240 })

const COLUNAS =
  'card_id, usd_normal, usd_holofoil, usd_reverse_holofoil, usd_1st_edition_normal, usd_1st_edition_holofoil, ' +
  'eur_media_venda, eur_tendencia, eur_media_7d, eur_media_30d, eur_reverse_tendencia, ' +
  'tcgplayer_em, cardmarket_em, coletado_em'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = ipDaRequest(req)
  if (ip) {
    limitador.gc()
    if (limitador.excedeu(ip)) {
      return NextResponse.json({ error: 'Muitas consultas. Tente em instantes.' }, { status: 429 })
    }
  }

  const { id } = await params
  if (!id || id.length > 120) return NextResponse.json({ error: 'id invalido' }, { status: 400 })

  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Erro interno' }, { status: 500 })

  const { data, error } = await sb
    .from('card_preco_internacional')
    .select(COLUNAS)
    .eq('card_id', id)
    .maybeSingle()

  if (error) {
    console.error('[api/cards/preco-internacional] erro', error.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }

  // O dado muda uma vez por dia; 10 min de borda e de sobra e o 500 acima nunca cacheia.
  return NextResponse.json(
    { preco: data ?? null },
    { status: 200, headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } },
  )
}
