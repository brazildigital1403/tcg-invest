import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

// Mesmo padrao de /api/admin/metrics: service-role + requireAdmin.
// A service-role ignora RLS, entao a tabela zenrows_usage segue trancada
// (sem policy de leitura). Nenhuma chave da ZenRows toca o Vercel: esta rota
// le o NOSSO Supabase, alimentado pela Mia Servidor.
function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function GET(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const sb = supabaseAdmin()

    // ultimo snapshot
    const { data: latestRows, error: e1 } = await sb
      .from('zenrows_usage')
      .select('captured_at, status, plan_name, usage_credits, credit_limit, remaining_credits, usage_percent, period_ends_at, top_ups')
      .order('captured_at', { ascending: false })
      .limit(1)
    if (e1) throw e1

    const latest = latestRows?.[0]
    if (!latest) return NextResponse.json({ empty: true })

    // historico enxuto (sem o raw) pra calcular ritmo
    const { data: hist } = await sb
      .from('zenrows_usage')
      .select('captured_at, usage_credits')
      .order('captured_at', { ascending: false })
      .limit(800)

    // baseline = snapshot mais antigo AINDA dentro do ciclo atual.
    // Indo pra tras no tempo o usage deve cair; se um mais antigo tem usage
    // MAIOR, cruzamos a renovacao (reset) -> paramos ali.
    let baseline: { captured_at: string; usage_credits: number } | null = null
    if (Array.isArray(hist) && hist.length >= 2) {
      let prev = hist[0]
      for (let i = 1; i < hist.length; i++) {
        const older = hist[i]
        if (Number(older.usage_credits) > Number(prev.usage_credits)) break
        baseline = older
        prev = older
      }
    }

    const now = new Date(latest.captured_at)
    const usage = Number(latest.usage_credits) || 0
    const limit = Number(latest.credit_limit) || 0
    const remaining = latest.remaining_credits != null ? Number(latest.remaining_credits) : (limit - usage)
    const usagePct = latest.usage_percent != null ? Number(latest.usage_percent) : (limit ? (usage / limit) * 100 : 0)
    const cycleEnds = latest.period_ends_at ? new Date(latest.period_ends_at) : null
    const topUpsCount = Array.isArray(latest.top_ups) ? latest.top_ups.length : 0

    // ritmo + projecao
    let ratePerDay: number | null = null
    let daysCoverage: number | null = null
    let projectedExhaustAt: string | null = null
    let coversCycle: boolean | null = null

    if (baseline) {
      const spanDays = (now.getTime() - new Date(baseline.captured_at).getTime()) / 86400000
      const deltaCredits = usage - Number(baseline.usage_credits)
      if (spanDays >= 0.25 && deltaCredits > 0) {
        ratePerDay = deltaCredits / spanDays
        daysCoverage = remaining / ratePerDay
        const exhaust = new Date(now.getTime() + daysCoverage * 86400000)
        projectedExhaustAt = exhaust.toISOString()
        if (cycleEnds) coversCycle = exhaust.getTime() >= cycleEnds.getTime()
      }
    }

    // saude
    let health: 'ok' | 'warn' | 'crit' = 'ok'
    if (remaining <= 0) {
      health = 'crit'
    } else if (coversCycle === false) {
      health = 'crit'
    } else if (coversCycle === true && cycleEnds && projectedExhaustAt) {
      const folgaDias = (new Date(projectedExhaustAt).getTime() - cycleEnds.getTime()) / 86400000
      health = folgaDias < 2 ? 'warn' : 'ok'
    } else {
      health = usagePct >= 80 ? 'warn' : 'ok'
    }

    return NextResponse.json({
      empty: false,
      captured_at: latest.captured_at,
      zr_status: latest.status ?? null,
      plan_name: latest.plan_name ?? null,
      usage_credits: usage,
      credit_limit: limit,
      remaining_credits: remaining,
      usage_percent: usagePct,
      period_ends_at: latest.period_ends_at ?? null,
      top_ups_count: topUpsCount,
      rate_per_day: ratePerDay,
      days_coverage: daysCoverage,
      projected_exhaust_at: projectedExhaustAt,
      covers_cycle: coversCycle,
      health,
      estimando: ratePerDay === null,
      stale_hours: (Date.now() - now.getTime()) / 3600000,
    })
  } catch (err: any) {
    console.error('[admin/zenrows-usage]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
