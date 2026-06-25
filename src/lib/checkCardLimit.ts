import { supabase } from './supabaseClient'
import { resolvePlan } from './plan'

// Flag de enforcement: quando '1', os limites por tier valem (rollout coordenado).
// Sem ela, o limite de cartas fica "infinito" (comportamento atual) -> o codigo sobe
// sem mexer em ninguem ate o momento do rollout.
export const ENFORCEMENT_ATIVO = process.env.NEXT_PUBLIC_ENFORCEMENT_ATIVO === '1'

// Flag do muro pos-trial (loss-framing semi-bloqueante). '1' = ligado no rollout.
export const MURO_POSTRIAL_ATIVO = process.env.NEXT_PUBLIC_MURO_POSTRIAL_ATIVO === '1'

// Mantidos por compat de imports antigos (telas que ainda exibem texto).
export const LIMITE_FREE          = 100
export const LIMITE_FREE_MKTPLACE = 3

async function fetchPlanRow(userId: string) {
  const { data } = await supabase
    .from('users')
    .select('is_pro, plano, pro_expira_em, trial_expires_at')
    .eq('id', userId)
    .maybeSingle()
  return data
}

// Limite de cartas por tier. Conta ENTRADAS DISTINTAS (linhas de user_cards),
// nao a soma de quantidade. Free 100 / Plus 500 / Pro e Anual ilimitado.
export async function checkCardLimit(userId: string): Promise<{ bloqueado: boolean; total: number; limite: number }> {
  const { count } = await supabase
    .from('user_cards')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  const total = count || 0

  if (!ENFORCEMENT_ATIVO) return { bloqueado: false, total, limite: Infinity }

  const row = await fetchPlanRow(userId)
  const { caps } = resolvePlan(row as any)
  const limite = caps.limiteCartas
  return { bloqueado: total >= limite, total, limite }
}

// Limite de anuncios no marketplace por tier (Free 3 / Plus+ ilimitado).
// NAO depende da flag: o limite de 3 do Free ja vale hoje; aqui so passa a respeitar
// os caps (pra o Plus ganhar ilimitado quando existir).
export async function checkMarketplaceLimit(userId: string): Promise<{ bloqueado: boolean; total: number; limite: number }> {
  const { count } = await supabase
    .from('marketplace')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('status', 'in', '("cancelado","concluido")')
  const total = count || 0

  const row = await fetchPlanRow(userId)
  const { caps } = resolvePlan(row as any)
  const limite = caps.limiteAnuncios
  return { bloqueado: total >= limite, total, limite }
}
