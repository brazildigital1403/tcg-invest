import { supabase } from './supabaseClient'

export async function getUserPlan(userId: string): Promise<{ isPro: boolean; plano: string }> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('is_pro, plano, pro_expira_em')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return { isPro: false, plano: 'free' }
    if (!data.is_pro) return { isPro: false, plano: 'free' }

    // Verifica se Pro expirou
    if (data.pro_expira_em && new Date(data.pro_expira_em) < new Date()) {
      return { isPro: false, plano: 'free' }
    }

    return { isPro: true, plano: data.plano || 'mensal' }
  } catch {
    return { isPro: false, plano: 'free' }
  }
}