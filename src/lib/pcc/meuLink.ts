// Meu link do Club (plano de 25/11/2026, PLANO-MEU-LINK.md). O membro tem um endereço próprio,
// bynx.gg/@arroba, que conta a visita e leva ao cadastro com o código de indicação dele. O painel
// lê só números pela função club_meu_link: nunca nome, e-mail nem id de quem chegou.

import { supabase } from '@/lib/supabaseClient'

export type MeuLink = {
  /** O @ do Instagram do membro, sem o @. Nulo = ainda sem @ válido no Club. */
  arroba: string | null
  /** O código de indicação (BYN e cinco caracteres). O endereço com @ aponta para ele. */
  codigo: string | null
  visitas_total: number
  /** Visitas por dia nos últimos 14 dias, o último é hoje (Brasília). */
  visitas_14d: number[]
  cadastros: number
  ativados: number
  melhor_convidado_cartas: number
}

export type RespostaMeuLink = { ok: true; d: MeuLink } | { ok: false; naoMembro: boolean }

export const DOMINIO = 'https://bynx.gg'

/** O endereço que o membro cola na bio. Sem @ válido, vale o link do código. */
export function enderecoDoLink(l: Pick<MeuLink, 'arroba' | 'codigo'>): string | null {
  if (l.arroba) return `${DOMINIO}/@${l.arroba}`
  if (l.codigo) return `${DOMINIO}/?ref=${l.codigo}`
  return null
}

/** O mesmo endereço sem o https://, como aparece na tela. */
export const enderecoCurto = (l: Pick<MeuLink, 'arroba' | 'codigo'>): string | null =>
  enderecoDoLink(l)?.replace(/^https:\/\//, '') ?? null

export async function carregarMeuLink(): Promise<RespostaMeuLink> {
  const { data, error } = await supabase.rpc('club_meu_link')
  if (error || !data) return { ok: false, naoMembro: (error?.message || '').includes('nao_membro') }
  return { ok: true, d: data as MeuLink }
}
