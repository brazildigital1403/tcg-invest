import { NextRequest } from 'next/server'
import { ANTECEDENCIA_MIN_AGENDAR, erroDoPainel, validarRodada } from '@/lib/leilao-painel'
import {
  contextoPainel, json, recebimentoDaLoja, UUID_RE, COLUNAS_RODADA, COLUNAS_LOTE_PAINEL,
} from '../_comum'

/**
 * /api/lojas/[id]/leiloes/[rodadaId] — uma rodada da loja (painel, fatia 5).
 *
 * GET   -> { rodada, lotes (por ordem), recebimento: { podeReceber, motivo } }
 * PATCH { titulo?, descricao?, inicia_em?, link_transmissao? } -> so em rascunho
 * POST  { acao: 'agendar' }                 -> RPC leilao_agendar_rodada
 *       { acao: 'reordenar', ids: uuid[] }  -> RPC leilao_reordenar_lotes
 *       { acao: 'cancelar', motivo? }       -> RPC leilao_cancelar_rodada
 *       { acao: 'encerrar', motivo? }       -> RPC leilao_encerrar_rodada (ao vivo:
 *         o lote ativo termina no tempo dele, os agendados sao cancelados; #416)
 *
 * As tres acoes sao atomicas no banco (migration 20260928120000_leilao_painel)
 * e recebem o `loja_id` da URL ja validado: rodada de outra loja nao e achada.
 * O Connect (podeReceber) e conferido AQUI antes do agendar: o dado e da
 * Stripe, nao do banco.
 */

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; rodadaId: string }> }

async function carregarRodada(sb: import('@supabase/supabase-js').SupabaseClient, lojaId: string, rodadaId: string) {
  const { data, error } = await sb
    .from('leilao_rodadas')
    .select(COLUNAS_RODADA)
    .eq('id', rodadaId)
    .eq('loja_id', lojaId)
    .limit(1)
  if (error) throw new Error(`rodada: ${error.message}`)
  return (data?.[0] as unknown as Record<string, unknown> | undefined) ?? null
}

export async function GET(req: NextRequest, ctx: Params) {
  try {
    const { id: lojaId, rodadaId } = await ctx.params
    const c = await contextoPainel(req, lojaId)
    if (!c.ok) return c.res
    if (!UUID_RE.test(rodadaId)) return json(404, { error: 'Rodada não encontrada.' })

    const rodada = await carregarRodada(c.sb, lojaId, rodadaId)
    if (!rodada) return json(404, { error: 'Rodada não encontrada.' })

    const [{ data: lotes, error }, recebimento] = await Promise.all([
      c.sb
        .from('leiloes')
        .select(COLUNAS_LOTE_PAINEL)
        .eq('rodada_id', rodadaId)
        .eq('loja_id', lojaId)
        .order('ordem', { ascending: true })
        .limit(200),
      recebimentoDaLoja(c.sb, c.loja),
    ])
    if (error) {
      console.error('[lojas/leiloes/rodada GET] lotes', error.code, error.message)
      return json(500, { error: 'Erro ao carregar os lotes.' })
    }
    return json(200, { rodada, lotes: lotes ?? [], recebimento })
  } catch (err) {
    console.error('[lojas/leiloes/rodada GET] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}

export async function PATCH(req: NextRequest, ctx: Params) {
  try {
    const { id: lojaId, rodadaId } = await ctx.params
    const c = await contextoPainel(req, lojaId)
    if (!c.ok) return c.res
    if (!UUID_RE.test(rodadaId)) return json(404, { error: 'Rodada não encontrada.' })

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json(400, { error: 'Requisição inválida.' })
    const v = validarRodada(body as Record<string, unknown>, true)
    if (!v.ok) return json(400, { error: v.erro })

    const patch: Record<string, unknown> = {}
    if (v.valor.titulo !== undefined) patch.titulo = v.valor.titulo
    if (v.valor.descricao !== undefined) patch.descricao = v.valor.descricao
    if (v.valor.iniciaEm !== undefined) patch.inicia_em = v.valor.iniciaEm
    if (v.valor.linkTransmissao !== undefined) patch.link_transmissao = v.valor.linkTransmissao
    if (Object.keys(patch).length === 0) return json(400, { error: 'Nada para salvar.' })

    // So rascunho: rodada agendada ja esta na vitrine publica com a hora dela.
    const { data, error } = await c.sb
      .from('leilao_rodadas')
      .update(patch)
      .eq('id', rodadaId)
      .eq('loja_id', lojaId)
      .eq('status', 'rascunho')
      .select(COLUNAS_RODADA)
    if (error) {
      console.error('[lojas/leiloes/rodada PATCH]', error.code, error.message)
      return json(500, { error: 'Erro ao salvar a rodada.' })
    }
    if (!data || data.length === 0) {
      const existe = await carregarRodada(c.sb, lojaId, rodadaId)
      if (!existe) return json(404, { error: 'Rodada não encontrada.' })
      return json(409, { error: 'Só é possível editar a rodada enquanto ela está em rascunho.' })
    }
    return json(200, { ok: true, rodada: data[0] })
  } catch (err) {
    console.error('[lojas/leiloes/rodada PATCH] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}

export async function POST(req: NextRequest, ctx: Params) {
  try {
    const { id: lojaId, rodadaId } = await ctx.params
    const c = await contextoPainel(req, lojaId)
    if (!c.ok) return c.res
    if (!UUID_RE.test(rodadaId)) return json(404, { error: 'Rodada não encontrada.' })

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    const acao = body?.acao

    if (acao === 'agendar') {
      if (c.loja.status !== 'ativa') return json(403, { error: 'Sua loja precisa estar ativa para agendar.' })
      const rec = await recebimentoDaLoja(c.sb, c.loja)
      if (!rec.podeReceber) return json(409, { error: rec.motivo })
      const { data, error } = await c.sb.rpc('leilao_agendar_rodada', {
        p_rodada: rodadaId,
        p_loja: lojaId,
        p_antecedencia_min: ANTECEDENCIA_MIN_AGENDAR,
      })
      if (error) {
        const e = erroDoPainel(error.message)
        if (e.status === 500) console.error('[lojas/leiloes/agendar]', error.code, error.message)
        return json(e.status, { error: e.mensagem })
      }
      return json(200, { ok: true, resultado: data })
    }

    if (acao === 'reordenar') {
      const ids = Array.isArray(body?.ids) ? (body!.ids as unknown[]).map(String) : []
      if (ids.length === 0 || ids.length > 200 || !ids.every(i => UUID_RE.test(i))) {
        return json(400, { error: 'Lista de lotes inválida.' })
      }
      const { error } = await c.sb.rpc('leilao_reordenar_lotes', { p_rodada: rodadaId, p_loja: lojaId, p_ids: ids })
      if (error) {
        const e = erroDoPainel(error.message)
        if (e.status === 500) console.error('[lojas/leiloes/reordenar]', error.code, error.message)
        return json(e.status, { error: e.mensagem })
      }
      return json(200, { ok: true })
    }

    if (acao === 'cancelar') {
      const motivo = typeof body?.motivo === 'string' ? body.motivo.trim().slice(0, 300) : null
      const { data, error } = await c.sb.rpc('leilao_cancelar_rodada', {
        p_rodada: rodadaId,
        p_loja: lojaId,
        p_motivo: motivo || null,
      })
      if (error) {
        const e = erroDoPainel(error.message)
        if (e.status === 500) console.error('[lojas/leiloes/cancelar]', error.code, error.message)
        return json(e.status, { error: e.mensagem })
      }
      return json(200, { ok: true, resultado: data })
    }

    if (acao === 'encerrar') {
      const motivo = typeof body?.motivo === 'string' ? body.motivo.trim().slice(0, 300) : null
      const { data, error } = await c.sb.rpc('leilao_encerrar_rodada', {
        p_rodada: rodadaId,
        p_loja: lojaId,
        p_motivo: motivo || null,
      })
      if (error) {
        const e = erroDoPainel(error.message)
        if (e.status === 500) console.error('[lojas/leiloes/encerrar]', error.code, error.message)
        return json(e.status, { error: e.mensagem })
      }
      return json(200, { ok: true, resultado: data })
    }

    return json(400, { error: 'Ação inválida.' })
  } catch (err) {
    console.error('[lojas/leiloes/rodada POST] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro interno.' })
  }
}
