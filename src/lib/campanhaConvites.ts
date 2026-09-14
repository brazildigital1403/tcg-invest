// src/lib/campanhaConvites.ts
//
// Convite pessoal de campanha (tabela campanha_convites). SO SERVIDOR: usa a
// service role, nunca importar em 'use client'.
//
// Cada etapa do funil e um carimbo de data que so e gravado UMA vez (filtro
// `is null`), entao recarregar a pagina ou clicar duas vezes nao move o numero.
// Falha de carimbo nunca derruba o fluxo da pessoa: e medicao, nao regra.

import { getServiceSupabase } from '@/lib/supabaseServer'
import { ehTokenValido } from '@/lib/ofertaPresente'

export interface Convite {
  id: string
  campanha: string
  token: string
  nome: string
  email: string
  user_id: string | null
  cadastro_em: string | null
  pago_em: string | null
}

type Etapa = 'landing_aberta_em' | 'presente_aberto_em' | 'cadastro_em' | 'checkout_em' | 'pago_em'

export async function buscarConvite(token: unknown): Promise<Convite | null> {
  if (!ehTokenValido(token)) return null
  const sb = getServiceSupabase()
  if (!sb) return null
  const { data, error } = await sb
    .from('campanha_convites')
    .select('id, campanha, token, nome, email, user_id, cadastro_em, pago_em')
    .eq('token', token)
    .limit(1)
  if (error) {
    console.error('[campanha] buscar convite falhou:', error.message)
    return null
  }
  return (data?.[0] as Convite) || null
}

/** Grava a data da etapa so na primeira vez, e os campos extras sempre. */
export async function carimbarConvite(
  id: string,
  etapa: Etapa,
  extra: Record<string, string | null> = {}
): Promise<void> {
  const sb = getServiceSupabase()
  if (!sb) return
  try {
    const { error } = await sb
      .from('campanha_convites')
      .update({ [etapa]: new Date().toISOString() })
      .eq('id', id)
      .is(etapa, null)
    if (error) console.error(`[campanha] carimbo ${etapa} falhou (${id}):`, error.message)
    if (Object.keys(extra).length) {
      const { error: e2 } = await sb.from('campanha_convites').update(extra).eq('id', id)
      if (e2) console.error(`[campanha] extra de ${etapa} falhou (${id}):`, e2.message)
    }
  } catch (e: any) {
    console.error(`[campanha] carimbo ${etapa} lancou (${id}):`, e?.message)
  }
}

/** A pessoa ja tem conta na Bynx com este e-mail? */
export async function emailJaTemConta(email: string): Promise<boolean> {
  const sb = getServiceSupabase()
  if (!sb) return false
  const { data } = await sb.from('users').select('id').ilike('email', email).limit(1)
  return !!data?.[0]
}
