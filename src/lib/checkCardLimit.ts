import { supabase } from './supabaseClient'

export const LIMITE_FREE     = 6
export const LIMITE_FREE_MKTPLACE = 3

// Verifica limite de cartas
export async function checkCardLimit(userId: string): Promise<{ bloqueado: boolean; total: number }> {
  const { count } = await supabase
    .from('user_cards')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const total = count || 0
  return { bloqueado: total >= LIMITE_FREE, total }
}

// Verifica limite de negociações ativas no marketplace
export async function checkMarketplaceLimit(userId: string): Promise<{ bloqueado: boolean; total: number }> {
  const { count } = await supabase
    .from('marketplace')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('status', 'in', '("cancelado","concluido")')

  const total = count || 0
  return { bloqueado: total >= LIMITE_FREE_MKTPLACE, total }
}