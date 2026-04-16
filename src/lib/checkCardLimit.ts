import { supabase } from './supabaseClient'

export const LIMITE_FREE = 15

export async function checkCardLimit(userId: string): Promise<{ bloqueado: boolean; total: number }> {
  const { count } = await supabase
    .from('user_cards')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const total = count || 0
  return { bloqueado: total >= LIMITE_FREE, total }
}