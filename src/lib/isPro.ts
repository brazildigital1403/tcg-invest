import { supabase } from './supabaseClient'
import { resolvePlan, type PlanCaps, type PlanTier } from './plan'

// getUserPlan: continua devolvendo os 4 campos historicos (isPro, plano, isTrial,
// trialDaysLeft) pra nao quebrar nenhum call site existente, e agora ADICIONA
// `tier` + `caps` (capabilities resolvidas via lib/plan.ts).
export async function getUserPlan(userId: string): Promise<{
  isPro: boolean
  plano: string
  isTrial: boolean
  trialDaysLeft: number
  tier: PlanTier
  caps: PlanCaps
}> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('is_pro, plano, pro_expira_em, trial_expires_at')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) {
      const r = resolvePlan(null)
      return { isPro: false, plano: 'free', isTrial: false, trialDaysLeft: 0, tier: r.tier, caps: r.caps }
    }

    const r = resolvePlan(data as any)
    // mantem o campo `plano` compativel: 'trial' quando em trial, senao o tier canonico
    const plano = r.isTrial ? 'trial' : r.tier
    return {
      isPro: r.isPro,
      plano,
      isTrial: r.isTrial,
      trialDaysLeft: r.trialDaysLeft,
      tier: r.tier,
      caps: r.caps,
    }
  } catch {
    const r = resolvePlan(null)
    return { isPro: false, plano: 'free', isTrial: false, trialDaysLeft: 0, tier: r.tier, caps: r.caps }
  }
}
