import { NextRequest } from 'next/server'
import { validarRodada } from '@/lib/leilao-painel'
import { contextoPainel, json, COLUNAS_RODADA } from './_comum'

/**
 * /api/lojas/[id]/leiloes — rodadas ao vivo da loja (painel, fatia 5).
 *
 * GET  -> { rodadas: [...rodada, lotes: n] } (todas, mais nova primeiro)
 * POST { titulo, descricao?, inicia_em?, link_transmissao? } -> cria em rascunho
 *
 * Auth: dono da loja ou admin (contextoPainel). Flag off -> 404.
 */

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params
    const c = await contextoPainel(req, lojaId)
    if (!c.ok) return c.res

    const { data, error } = await c.sb
      .from('leilao_rodadas')
      .select(`${COLUNAS_RODADA}, leiloes(count)`)
      .eq('loja_id', lojaId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) {
      console.error('[lojas/leiloes GET]', error.code, error.message)
      return json(500, { error: 'Erro ao carregar as rodadas.' })
    }

    const rodadas = (data ?? []).map((r: Record<string, unknown>) => {
      const cont = Array.isArray(r.leiloes) ? (r.leiloes[0] as { count?: number } | undefined)?.count ?? 0 : 0
      const resto = { ...r }
      delete resto.leiloes
      return { ...resto, lotes: cont }
    })
    return json(200, { rodadas })
  } catch (err) {
    console.error('[lojas/leiloes GET] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params
    const c = await contextoPainel(req, lojaId)
    if (!c.ok) return c.res
    if (c.loja.status !== 'ativa') {
      return json(403, { error: 'Sua loja precisa estar ativa para criar uma rodada.' })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json(400, { error: 'Requisição inválida.' })

    const v = validarRodada(body as Record<string, unknown>, false)
    if (!v.ok) return json(400, { error: v.erro })

    const { data, error } = await c.sb
      .from('leilao_rodadas')
      .insert({
        loja_id: lojaId,
        vendedor_user_id: c.loja.owner_user_id,
        titulo: v.valor.titulo,
        descricao: v.valor.descricao ?? null,
        inicia_em: v.valor.iniciaEm ?? null,
        link_transmissao: v.valor.linkTransmissao ?? null,
        modo: 'ao_vivo',
        status: 'rascunho',
      })
      .select(COLUNAS_RODADA)
      .single()
    if (error || !data) {
      console.error('[lojas/leiloes POST]', error?.code, error?.message)
      return json(500, { error: 'Erro ao criar a rodada.' })
    }
    return json(200, { ok: true, rodada: data })
  } catch (err) {
    console.error('[lojas/leiloes POST] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
