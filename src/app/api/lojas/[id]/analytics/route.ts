/**
 * GET /api/lojas/[id]/analytics
 *
 * Retorna analytics agregados de cliques da loja.
 *
 * Auth: owner da loja OU admin (cookie HMAC). Ver autenticarOwnerOuAdmin.
 *
 * Gate de plano:
 *   - OWNER: exclusivo do plano Premium. Basico/Pro -> 402 { requires_upgrade }.
 *   - ADMIN: BYPASSA o gate -> ve analytics de QUALQUER loja (qualquer plano).
 *
 * Periodo (query, em ordem de precedencia):
 *   - ?from=ISO&to=ISO  -> intervalo custom (admin)
 *   - ?range=all        -> tudo desde o 1o clique (default do painel admin)
 *   - ?days=7|30|90     -> janela de N dias (default 30; usado pelo owner)
 *
 * Filtro (query):
 *   - ?tipo=whatsapp|instagram|facebook|website|maps -> escopa total/serie/origem
 *
 * Resposta sucesso:
 *   {
 *     total, porTipo, porDia, porUsuario, porOrigem,
 *     periodoDias, desde, ate, tipoFiltro, plano, isAdmin
 *   }
 *
 * Resposta nao-premium (owner basico/pro):
 *   { error, requires_upgrade: true, plano_atual } com status 402.
 */

import { NextRequest, NextResponse } from 'next/server'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'

const PERIODOS_VALIDOS = [7, 30, 90]
const TIPOS_CLIQUE = ['whatsapp', 'instagram', 'facebook', 'website', 'maps'] as const

const DIA_MS = 24 * 60 * 60 * 1000
// Teto defensivo no preenchimento continuo da serie (evita arrays gigantes
// caso um range "all" cubra muitos anos). Em volume normal nao chega perto.
const MAX_DIAS_SERIE = 730

// Normaliza referrer pra um rotulo de origem (dominio), agregavel e SEM IP.
function normalizaOrigem(ref: string | null | undefined): string {
  if (!ref) return 'Direto'
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '')
    return host || 'Direto'
  } catch {
    const limpo = ref
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .trim()
    return limpo || 'Direto'
  }
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params

    // ─── Auth (owner ou admin) ──────────────────────────────────────
    const auth = await autenticarOwnerOuAdmin(req, lojaId, 'id, plano, owner_user_id')
    if ('error' in auth) return auth.error
    const { sb, loja, isAdmin } = auth

    // ─── Gate de plano: owner so premium; admin bypassa ─────────────
    const plano = (loja as any).plano as string
    if (!isAdmin && plano !== 'premium') {
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
    const rangeParam = searchParams.get('range')
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const daysRaw = Number(searchParams.get('days'))

    // Datas-limite efetivas (desde / ate). null = sem limite inferior (all).
    let desde: Date | null = null
    let ate: Date = new Date()

    const fromDate = fromParam ? new Date(fromParam) : null
    const toDate = toParam ? new Date(toParam) : null
    const fromOk = fromDate && !isNaN(fromDate.getTime())
    const toOk = toDate && !isNaN(toDate.getTime())

    if (fromOk || toOk) {
      // Intervalo custom (admin)
      desde = fromOk ? fromDate! : null
      ate = toOk ? toDate! : new Date()
    } else if (rangeParam === 'all') {
      desde = null
    } else {
      const days = PERIODOS_VALIDOS.includes(daysRaw) ? daysRaw : 30
      desde = new Date(Date.now() - (days - 1) * DIA_MS)
    }

    // ─── Busca cliques no período ───────────────────────────────────
    let q = sb
      .from('loja_cliques')
      .select('tipo, user_id, created_at, referrer')
      .eq('loja_id', lojaId)
      .order('created_at', { ascending: true })
      .limit(100000)

    if (desde) q = q.gte('created_at', desde.toISOString())
    if (toOk) q = q.lte('created_at', ate.toISOString())

    const { data: cliques, error } = await q

    if (error) {
      console.error('[api/lojas/[id]/analytics]', error.message)
      return NextResponse.json({ error: 'Erro ao buscar cliques' }, { status: 500 })
    }

    const linhas = cliques || []

    // ─── porTipo: sempre sobre TODOS os tipos do período (sem filtro) ─
    // (alimenta os KPIs e serve de seletor de filtro no painel admin)
    const porTipo: Record<string, number> = {}
    for (const t of TIPOS_CLIQUE) porTipo[t] = 0
    for (const c of linhas) {
      const t = c.tipo as string
      if (t in porTipo) porTipo[t]++
    }

    // ─── Filtro por tipo (escopa total/série/usuário/origem) ─────────
    const tipoFiltroRaw = searchParams.get('tipo')
    const tipoFiltro =
      tipoFiltroRaw && (TIPOS_CLIQUE as readonly string[]).includes(tipoFiltroRaw)
        ? tipoFiltroRaw
        : null
    const filtradas = tipoFiltro ? linhas.filter((c) => c.tipo === tipoFiltro) : linhas

    // ─── Janela da série (preenche dias vazios com 0 p/ continuidade) ─
    let inicio: Date
    if (desde) {
      inicio = desde
    } else if (filtradas.length || linhas.length) {
      const base = (filtradas.length ? filtradas : linhas)[0]
      inicio = new Date(String(base.created_at))
    } else {
      inicio = new Date(Date.now() - 29 * DIA_MS)
    }

    const inicioYmd = ymd(inicio)
    const ateYmd = ymd(ate)
    let nDias =
      Math.floor((new Date(ateYmd).getTime() - new Date(inicioYmd).getTime()) / DIA_MS) + 1
    if (nDias < 1) nDias = 1
    if (nDias > MAX_DIAS_SERIE) nDias = MAX_DIAS_SERIE

    const porDiaMap: Record<string, number> = {}
    const fimSerie = new Date(ateYmd + 'T00:00:00Z')
    for (let i = nDias - 1; i >= 0; i--) {
      porDiaMap[ymd(new Date(fimSerie.getTime() - i * DIA_MS))] = 0
    }
    for (const c of filtradas) {
      const key = String(c.created_at).slice(0, 10)
      if (key in porDiaMap) porDiaMap[key]++
    }
    const porDia = Object.entries(porDiaMap).map(([data, cliques]) => ({ data, cliques }))

    // ─── porUsuario (logado vs anônimo) sobre o conjunto filtrado ────
    let logados = 0
    let anonimos = 0
    for (const c of filtradas) {
      if (c.user_id) logados++
      else anonimos++
    }

    // ─── porOrigem (referrer → domínio), agregado e SEM IP ───────────
    const origemMap: Record<string, number> = {}
    for (const c of filtradas) {
      const o = normalizaOrigem(c.referrer as string | null)
      origemMap[o] = (origemMap[o] || 0) + 1
    }
    const porOrigem = Object.entries(origemMap)
      .map(([origem, total]) => ({ origem, total }))
      .sort((a, b) => b.total - a.total)

    return NextResponse.json({
      total: filtradas.length,
      porTipo,
      porDia,
      porUsuario: { logados, anonimos },
      porOrigem,
      periodoDias: nDias,
      desde: desde ? desde.toISOString() : porDia[0]?.data || null,
      ate: ate.toISOString(),
      tipoFiltro,
      plano,
      isAdmin,
    })
  } catch (err: any) {
    console.error('[api/lojas/[id]/analytics] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 })
  }
}
