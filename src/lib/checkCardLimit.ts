import { supabase } from './supabaseClient'

export const LIMITE_FREE      = 6
export const LIMITE_FREE_MKTPLACE = 3

// Verifica se o usuário tem trial ativo
async function hasTrial(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('trial_expires_at, is_pro')
    .eq('id', userId)
    .single()
  if (!data) return false
  if (data.is_pro) return true
  if (data.trial_expires_at && new Date(data.trial_expires_at) > new Date()) return true
  return false
}

// Verifica limite de cartas — trial = sem limite
export async function checkCardLimit(userId: string): Promise<{ bloqueado: boolean; total: number }> {
  const trial = await hasTrial(userId)
  if (trial) return { bloqueado: false, total: 0 }

  const { count } = await supabase
    .from('user_cards')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const total = count || 0
  return { bloqueado: total >= LIMITE_FREE, total }
}

// Verifica limite de marketplace — trial = sem limite
export async function checkMarketplaceLimit(userId: string): Promise<{ bloqueado: boolean; total: number }> {
  const trial = await hasTrial(userId)
  if (trial) return { bloqueado: false, total: 0 }

  const { count } = await supabase
    .from('marketplace')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('status', 'in', '("cancelado","concluido")')

  const total = count || 0
  return { bloqueado: total >= LIMITE_FREE_MKTPLACE, total }
}