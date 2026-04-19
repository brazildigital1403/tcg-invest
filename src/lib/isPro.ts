import { supabase } from './supabaseClient'

export async function getUserPlan(userId: string): Promise<{ 
  isPro: boolean
  plano: string
  isTrial: boolean
  trialDaysLeft: number
}> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('is_pro, plano, pro_expira_em, trial_expires_at')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return { isPro: false, plano: 'free', isTrial: false, trialDaysLeft: 0 }

    // Verifica se é Pro pago
    if (data.is_pro) {
      if (data.pro_expira_em && new Date(data.pro_expira_em) < new Date()) {
        return { isPro: false, plano: 'free', isTrial: false, trialDaysLeft: 0 }
      }
      return { isPro: true, plano: data.plano || 'mensal', isTrial: false, trialDaysLeft: 0 }
    }

    // Verifica trial ativo
    if (data.trial_expires_at) {
      const trialExpiry = new Date(data.trial_expires_at)
      const now = new Date()
      if (trialExpiry > now) {
        const msLeft = trialExpiry.getTime() - now.getTime()
        const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
        return { isPro: true, plano: 'trial', isTrial: true, trialDaysLeft: daysLeft }
      }
    }

    return { isPro: false, plano: 'free', isTrial: false, trialDaysLeft: 0 }
  } catch {
    return { isPro: false, plano: 'free', isTrial: false, trialDaysLeft: 0 }
  }
}