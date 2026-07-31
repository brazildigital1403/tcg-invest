import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { criarLimitador, ipDaRequest } from '@/lib/rateLimit'

/**
 * GET /api/cards/[id]/historico-vendas?dias=30
 *
 * Historico de "ultima venda" (preco REALIZADO, de fonte externa) de uma
 * carta ao longo do tempo. `card_ultima_venda_historico` tem RLS trancada
 * (so a service role le/escreve) -- mesmo motivo do /api/cards/lookup: nao
 * expor a tabela direto pro client.
 *
 * So chamada quando o usuario abre o detalhe de UMA carta (nao em lote na
 * vitrine), entao o rate-limit e mais folgado que o lookup em massa.
 */

const DIAS_PADRAO = 30
const DIAS_MAX = 90
const LIMITE_LINHAS = 200

const limitador = criarLimitador({ janelaMs: 60_000, max: 120 })

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
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const diasParam = Number(req.nextUrl.searchParams.get('dias'))
  const dias = Number.isFinite(diasParam) && diasParam > 0
    ? Math.min(diasParam, DIAS_MAX)
    : DIAS_PADRAO

  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Erro interno' }, { status: 500 })

  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await sb
    .from('card_ultima_venda_historico')
    .select('valor_cents, variante, condicao, idioma, capturado_em')
    .eq('card_id', id)
    .gte('capturado_em', desde)
    .order('capturado_em', { ascending: false })
    .limit(LIMITE_LINHAS)

  if (error) {
    console.error('[api/cards/historico-vendas] erro', error.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }

  return NextResponse.json({ historico: data || [] }, { status: 200 })
}
