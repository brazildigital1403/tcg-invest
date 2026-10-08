import { NextRequest, NextResponse } from 'next/server'
import { criarContexto, rodarEventos } from '@/lib/regua/motor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron-regua -- os gatilhos de EVENTO da regua de e-mail
 * (E02, E03, E04, E05, E06, E07, E08, E09, E15, E16, E20).
 *
 * Vercel cron (UTC): 22:30 e 22:50 = 19h30 e 19h50 de Brasilia, o horario de
 * marketing que o Du prefere. O segundo tick so termina o que o primeiro nao
 * coube nos 60s: o dedup do log garante que ninguem recebe duas vezes.
 *
 * ★ CHAVE GERAL: REGUA_ATIVA. Diferente de '1' = SIMULACAO: calcula tudo,
 * grava em email_envios com status 'simulado' e nao chama o Resend.
 *
 * ★ ORCAMENTO: para de comecar trabalho novo aos ~42s; o que sobrou aparece
 * como `incompleto` e fica para o proximo tick.
 *
 * Auth: Bearer ${CRON_SECRET}.
 * Parametros (para rodar a simulacao na mao):
 *   ?forcar=1     ignora o calendario (so na simulacao; com a chave ligada, nunca)
 *   ?so=E08,E09   so estes templates
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const inicio = Date.now()
  const q = req.nextUrl.searchParams
  const so = (q.get('so') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
  try {
    const ctx = await criarContexto({ forcar: q.get('forcar') === '1', inicioMs: inicio })
    const templates = await rodarEventos(ctx, so)
    const resumo = {
      modo: ctx.modo,
      hoje: ctx.hoje,
      forcar: ctx.forcar,
      ms: Date.now() - inicio,
      incompleto: templates.some((t) => t.incompleto),
      templates,
    }
    console.log(`[cron-regua] ${JSON.stringify({ ...resumo, templates: templates.map((t) => ({ t: t.template, g: t.noGatilho, c: t.candidatos, f: t.fechado, m: t.motivos, e: t.envio && { s: t.envio.simulados, e: t.envio.enviados, x: t.envio.falhas } })) })}`)
    return NextResponse.json(resumo)
  } catch (e) {
    // Falha de leitura (usuarios, log) aborta o tick inteiro: sem log nao ha teto nem dedup.
    console.error('[cron-regua] abortado:', (e as Error)?.message)
    return NextResponse.json({ error: (e as Error)?.message || 'erro' }, { status: 500 })
  }
}
