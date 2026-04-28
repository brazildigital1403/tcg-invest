/**
 * GET /api/lojas/[id]/analytics?days=30
 *
 * Retorna analytics agregados de cliques pra loja. Exclusivo do plano premium.
 *
 * Auth: owner da loja OU admin (cookie HMAC).
 *
 * Resposta sucesso (premium):
 *   {
 *     total: number,
 *     porTipo: { whatsapp: 23, instagram: 12, ... },
 *     porDia:  [{ data: "2026-04-01", cliques: 3 }, ...],
 *     porUsuario: { logados: 18, anonimos: 29 },
 *     periodoDias: 30,
 *     plano: "premium",
 *   }
 *
 * Resposta não-premium (basico/pro):
 *   { error: "...", requires_upgrade: true, plano_atual: "pro" } com status 402.
 *   Frontend usa isso pra renderizar teaser + CTA upgrade SEM rodar query.
 *
 * Períodos suportados via ?days=: 7, 30, 90. Default 30. Outros valores caem em 30.
 */

import { NextRequest, NextResponse } from 'next/server'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'

const PERIODOS_VALIDOS = [7, 30, 90]
const TIPOS_CLIQUE = ['whatsapp', 'instagram', 'facebook', 'website', 'maps'] as const

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params

    // ─── Auth (owner ou admin) ──────────────────────────────────────
    const auth = await autenticarOwnerOuAdmin(req, lojaId, 'id, plano, owner_user_id')
    if ('error' in auth) return auth.error
    const { sb, loja } = auth

    // ─── Gating de plano: só premium tem analytics ──────────────────
    const plano = (loja as any).plano as string
    if (plano !== 'premium') {
      return NextResponse.json(
        {
          error: 'Analytics está disponível apenas no plano Premium',
          requires_upgrade: true,
          plano_atual: plano,
        },
        { status: 402 }
      )
    }

    // ─── Período ────────────────────────────────────────────────────
    const { searchParams } = new URL(req.url)
    const daysRaw = Number(searchParams.get('days'))
    const days = PERIODOS_VALIDOS.includes(daysRaw) ? daysRaw : 30
    const desde = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // ─── Busca cliques no período ───────────────────────────────────
    const { data: cliques, error } = await sb
      .from('loja_cliques')
      .select('tipo, user_id, created_at')
      .eq('loja_id', lojaId)
      .gte('created_at', desde)

    if (error) {
      console.error('[api/lojas/[id]/analytics]', error.message)
      return NextResponse.json({ error: 'Erro ao buscar cliques' }, { status: 500 })
    }

    // ─── Agregações ─────────────────────────────────────────────────

    // 1) Por tipo (sempre todos os 5 no resultado, mesmo com zero)
    const porTipo: Record<string, number> = {}
    for (const t of TIPOS_CLIQUE) porTipo[t] = 0
    for (const c of cliques || []) {
      const t = c.tipo as string
      if (t in porTipo) porTipo[t]++
    }

    // 2) Por dia (preenche dias sem clique com 0 pra ficar contínuo)
    const porDiaMap: Record<string, number> = {}
    const hoje = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(hoje.getTime() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10) // YYYY-MM-DD
      porDiaMap[key] = 0
    }
    for (const c of cliques || []) {
      const key = String(c.created_at).slice(0, 10)
      if (key in porDiaMap) porDiaMap[key]++
    }
    const porDia = Object.entries(porDiaMap).map(([data, qtd]) => ({ data, cliques: qtd }))

    // 3) Por usuário (logado vs anônimo)
    let logados = 0
    let anonimos = 0
    for (const c of cliques || []) {
      if (c.user_id) logados++
      else anonimos++
    }

    return NextResponse.json({
      total: cliques?.length || 0,
      porTipo,
      porDia,
      porUsuario: { logados, anonimos },
      periodoDias: days,
      plano: 'premium',
    })
  } catch (err: any) {
    console.error('[api/lojas/[id]/analytics] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 })
  }
}
