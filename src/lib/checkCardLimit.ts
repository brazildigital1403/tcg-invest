import { supabase } from './supabaseClient'
import { resolvePlan, getPlanCaps } from './plan'
import { STATUS_OCUPAM_VAGA } from './marketplaceStatus'

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
//
// ★ CONSERTADO 12/09. A conta era `not in (cancelado, concluido)` e sem
// `removido_em` -- ou seja, anuncio que o proprio usuario APAGOU seguia
// ocupando vaga, e `vendido` ocupava pra sempre depois da venda. Medido: 2
// usuarios do Gratis travados no limite com ZERO anuncio no ar, um deles com 7
// removidos desde 25/08. O usuario via "o plano Gratis permite 3 anuncios
// ativos" tendo nenhum, sem nada na tela explicando de onde vinham os 3.
// Agora a lista e positiva e compartilhada (STATUS_OCUPAM_VAGA), que e o
// remedio que o marketplaceStatus.ts ja documentava pra esta exata divergencia.
export async function checkMarketplaceLimit(userId: string): Promise<{ bloqueado: boolean; total: number; limite: number }> {
  const { count } = await supabase
    .from('marketplace')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', STATUS_OCUPAM_VAGA as unknown as string[])
    .is('removido_em', null)
  const total = count || 0

  // ★ QUEM DECIDE E O BANCO (13/09/2026). A regra ganhou a loja: dono de loja
  // ativa com plano Pro/Premium valido ou com recebimentos ativos anuncia sem
  // limite. Em vez de repetir essa conta aqui, a tela pergunta a mesma funcao
  // que o gatilho trg_enforce_limite_cartas usa -- uma regra so, nos dois
  // lados. `minhas_cartas_ilimitadas()` responde sobre auth.uid(), que em
  // todos os chamadores e o proprio userId.
  const { data: ilimitado, error } = await supabase.rpc('minhas_cartas_ilimitadas')
  if (!error && typeof ilimitado === 'boolean') {
    const limite = ilimitado ? Infinity : getPlanCaps('free').limiteAnuncios
    return { bloqueado: total >= limite, total, limite }
  }

  // Sem resposta do banco, cai no plano pessoal (a regra antiga). Nao ha risco
  // de furar: a trava de verdade e o gatilho, que roda de qualquer jeito.
  const row = await fetchPlanRow(userId)
  const { caps } = resolvePlan(row as any)
  const limite = caps.limiteAnuncios
  return { bloqueado: total >= limite, total, limite }
}

/** Texto legivel quando o gatilho do banco recusa por limite de anuncios. */
export function mensagemLimiteAnuncios(erro: { message?: string } | null | undefined): string | null {
  const m = erro?.message || ''
  return m.startsWith('LIMITE_ANUNCIOS') ? m.replace(/^LIMITE_ANUNCIOS:\s*/, '') : null
}
