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
 * ★ DATA REAL (07/09/2026): a frente A grava a data verdadeira da venda em
 *   `vendido_em` (date). Registros legados (MyPCards) tem `vendido_em` NULL e
 *   usam `capturado_em` como aproximacao. Devolvemos `data_venda` = a efetiva
 *   (vendido_em ?? capturado_em), e filtramos/ordenamos por ela -- assim o
 *   "X dias atras" no modal reflete quando a carta VENDEU, nao quando o scan rodou.
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

  // Traz as linhas da carta ordenadas por captura (as do ultimo scan vem juntas).
  // Uma carta tem poucas vendas (dezenas), entao o LIMITE cobre com folga e o
  // filtro por data real e feito aqui (PostgREST nao filtra por expressao coalesce).
  const { data, error } = await sb
    .from('card_ultima_venda_historico')
    .select('valor_cents, variante, condicao, idioma, capturado_em, vendido_em')
    .eq('card_id', id)
    .order('capturado_em', { ascending: false })
    .limit(LIMITE_LINHAS)

  if (error) {
    console.error('[api/cards/historico-vendas] erro', error.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }

  const desdeMs = Date.now() - dias * 24 * 60 * 60 * 1000

  const historico = (data || [])
    .map((r: any) => ({
      valor_cents: r.valor_cents,
      variante: r.variante,
      condicao: r.condicao,
      idioma: r.idioma,
      capturado_em: r.capturado_em,
      // data efetiva da venda: real (vendido_em) ou, no legado, a de captura.
      data_venda: r.vendido_em || (r.capturado_em ? String(r.capturado_em).slice(0, 10) : null),
    }))
    .filter((r: any) => {
      if (!r.data_venda) return false
      const t = new Date(r.data_venda).getTime()
      return Number.isFinite(t) && t >= desdeMs
    })
    .sort((a: any, b: any) => (a.data_venda < b.data_venda ? 1 : a.data_venda > b.data_venda ? -1 : 0))

  return NextResponse.json({ historico }, { status: 200 })
}
