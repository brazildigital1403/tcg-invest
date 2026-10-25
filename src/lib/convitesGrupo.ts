// src/lib/convitesGrupo.ts
//
// Convite de grupo (tabela convites_grupo): um link compartilhado que da N dias
// de Pro a quem se cadastra ou entra por ele. Primeiro uso: criadores de
// conteudo, /criadores?c=<codigo> (23/10/2026). SO SERVIDOR: service role.
//
// O Pro e liberado pela funcao resgatar_convite_grupo, que trava a linha do
// convite e confere ativo, prazo e teto na mesma transacao. Nada aqui grava
// plano direto -- uma fonte so para a regra.
//
// Evento de funil e medicao: falha vira log, nunca derruba a pessoa.

import { getServiceSupabase } from '@/lib/supabaseServer'

export type EstadoConvite = 'ativo' | 'encerrado' | 'invalido'

export interface ConviteGrupoPublico {
  estado: EstadoConvite
  nome?: string
  diasPro?: number
  expiraEm?: string
  /** Teto do convite (as vagas anunciadas). Os usos ficam no servidor. */
  vagas?: number
}

export type CodigoResgate =
  | 'CONVITE_INVALIDO' | 'CONVITE_ENCERRADO' | 'SEM_USUARIO' | 'JA_RESGATOU' | 'ASSINANTE' | 'ERRO'

const CODIGO_RE = /^[a-z0-9-]{4,40}$/

export function normalizarCodigo(c: unknown): string | null {
  if (typeof c !== 'string') return null
  const v = c.trim().toLowerCase()
  return CODIGO_RE.test(v) ? v : null
}

interface LinhaConvite {
  id: string
  nome: string
  campanha: string
  dias_pro: number
  max_usos: number
  usos: number
  expira_em: string
  ativo: boolean
}

export async function buscarConviteGrupo(codigo: unknown): Promise<LinhaConvite | null> {
  const c = normalizarCodigo(codigo)
  const sb = getServiceSupabase()
  if (!c || !sb) return null
  const { data, error } = await sb
    .from('convites_grupo')
    .select('id, nome, campanha, dias_pro, max_usos, usos, expira_em, ativo')
    .eq('codigo', c)
    .limit(1)
  if (error) {
    console.error('[convite-grupo] buscar falhou:', error.message)
    return null
  }
  return (data?.[0] as LinhaConvite) || null
}

export function estadoDoConvite(c: LinhaConvite | null): EstadoConvite {
  if (!c) return 'invalido'
  if (!c.ativo || Date.parse(c.expira_em) <= Date.now() || c.usos >= c.max_usos) return 'encerrado'
  return 'ativo'
}

export function conviteParaPublico(c: LinhaConvite | null): ConviteGrupoPublico {
  const estado = estadoDoConvite(c)
  if (!c || estado === 'invalido') return { estado }
  return { estado, nome: c.nome, diasPro: c.dias_pro, expiraEm: c.expira_em, vagas: c.max_usos }
}

export async function registrarEventoConvite(conviteId: string, etapa: 'visita' | 'cta' | 'envio' | 'erro'): Promise<void> {
  const sb = getServiceSupabase()
  if (!sb) return
  const { error } = await sb.from('convite_grupo_eventos').insert({ convite_id: conviteId, etapa })
  if (error) console.error(`[convite-grupo] evento ${etapa} falhou:`, error.message)
}

export async function resgatarConviteGrupo(
  codigo: string,
  userId: string,
  contaNova: boolean
): Promise<{ ok: true; proAte: string } | { ok: false; code: CodigoResgate }> {
  const sb = getServiceSupabase()
  if (!sb) return { ok: false, code: 'ERRO' }
  const { data, error } = await sb.rpc('resgatar_convite_grupo', { p_codigo: codigo, p_user: userId, p_conta_nova: contaNova })
  if (error) {
    console.error('[convite-grupo] resgate falhou:', error.message)
    return { ok: false, code: 'ERRO' }
  }
  const r = data as { ok: boolean; code?: CodigoResgate; pro_ate?: string }
  return r?.ok ? { ok: true, proAte: r.pro_ate! } : { ok: false, code: r?.code || 'ERRO' }
}

/** Texto que a pessoa ve para cada recusa do resgate. */
export const MENSAGEM_RESGATE: Record<CodigoResgate, string> = {
  CONVITE_INVALIDO: 'Este link de convite não existe. Confira o link que você recebeu.',
  CONVITE_ENCERRADO: 'Este convite encerrou.',
  SEM_USUARIO: 'Não encontramos sua conta. Entre de novo e tente outra vez.',
  JA_RESGATOU: 'Sua conta já usou um convite de Pro.',
  ASSINANTE: 'Sua conta já tem uma assinatura ativa. Fale com a Bynx pelo suporte para combinarmos o seu ano.',
  ERRO: 'Não conseguimos liberar o seu ano agora. Tente de novo em instantes.',
}

/** Usuario dono do Bearer token (rotas chamadas com authFetch). */
export async function usuarioDoToken(authHeader: string | null): Promise<{ id: string; email: string | null } | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  const sb = getServiceSupabase()
  if (!token || !sb) return null
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data?.user) return null
  return { id: data.user.id, email: data.user.email ?? null }
}
