import { supabase } from './supabaseClient'

export async function getUserPlan(userId: string): Promise<{ isPro: boolean; plano: string }> {
  const { data } = await supabase
    .from('users')
    .select('is_pro, plano, pro_expira_em')
    .eq('id', userId)
    .single()

  if (!data) return { isPro: false, plano: 'free' }

  if (data.is_pro && data.pro_expira_em) {
    const expirou = new Date(data.pro_expira_em) < new Date()
    if (expirou) return { isPro: false, plano: 'free' }
  }

  return {
    isPro: data.is_pro || false,
    plano: data.plano || 'free',
  }
}