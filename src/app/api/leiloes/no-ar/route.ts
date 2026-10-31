import { NextResponse, connection } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'

/**
 * GET /api/leiloes/no-ar
 *
 * Rota publica e leve do selo AO VIVO do cabecalho do Bynx Leiloes:
 * `{ numero }` = numero da rodada ao vivo mais recente, ou `null` se nao ha
 * rodada no ar. Igual para todos (sem Bearer, sem dado de usuario).
 *
 * LEITURA: `leilao_rodadas` com `status = 'ao_vivo'`, que e exatamente o
 * predicado do indice parcial `idx_leilao_rodadas_ao_vivo` (so as rodadas no
 * ar, unidades). Uma coluna, uma linha: nunca varre a tabela.
 *
 * O selo (SeloAoVivo.tsx) chama a cada 30s com a aba visivel e na troca de
 * rota. Antes a leitura era server-side no layout, o que congelava o selo no
 * build das paginas estaticas (ex. /leiloes/meus-lances).
 *
 * `connection()`: marca a rota como dinamica por requisicao sem exportar
 * `dynamic`; quem controla o cache e o header abaixo.
 */

const semCache = { 'Cache-Control': 'no-store, max-age=0' }
// DECISAO DO DU: cache — mesmo criterio do cache de 1s aprovado em 27/09.
// A resposta e publica e igual para todo espectador; 10s na CDN so na resposta
// 200. Erro segue sem cache (nao grava falha).
const cacheCurto = { 'Cache-Control': 'public, max-age=0, s-maxage=10' }

export async function GET() {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  await connection()

  const db = getServiceSupabase()
  if (!db) return NextResponse.json({ erro: 'config' }, { status: 500, headers: semCache })

  const { data, error } = await db
    .from('leilao_rodadas')
    .select('numero')
    .eq('status', 'ao_vivo')
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[leilao/no-ar]', error.code, error.message)
    return NextResponse.json({ erro: 'falha' }, { status: 500, headers: semCache })
  }
  const n = Number((data as { numero?: unknown } | null)?.numero)
  return NextResponse.json({ numero: Number.isInteger(n) && n > 0 ? n : null }, { headers: cacheCurto })
}
