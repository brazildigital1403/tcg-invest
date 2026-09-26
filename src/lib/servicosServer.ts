// Servidor do servico de bancada (restauracao / pre-grading). SO SERVIDOR:
// usa a service role, nunca importar em 'use client'.
//
// As tabelas servico_* nascem fechadas (F7): authenticated so le a propria
// solicitacao, e toda escrita passa por aqui, depois de conferir o dono e se a
// transicao de status e valida. As fotos vivem no bucket PRIVADO
// servico-midias; o cliente sobe direto por URL assinada (o arquivo nao passa
// pelo lambda de 4,5 MB) e depois confirma, e so entao a midia e registrada.

import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { requireAdmin } from '@/lib/admin-auth'

export const BUCKET_SERVICOS = 'servico-midias'
export const FOTO_MAX_BYTES = 10 * 1024 * 1024
export const FOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp']
export const SLOTS = ['frente', 'verso', 'rasante', 'cantos'] as const
export type Slot = (typeof SLOTS)[number]
export const SLOTS_OBRIGATORIOS: Slot[] = ['frente', 'verso']

export const TIPO_POR_SLOT: Record<Slot, string> = {
  frente: 'cliente_frente',
  verso: 'cliente_verso',
  rasante: 'cliente_extra',
  cantos: 'cliente_extra',
}

/** Termo de ciencia de risco vigente. Trocar a versao quando o texto mudar. */
export const TERMO_VERSAO_ATUAL = 'v1-2026-09'

export function numeroSolicitacao(n: number | string) {
  return `#S-${String(n).padStart(4, '0')}`
}

export function erro(status: number, mensagem: string) {
  return NextResponse.json({ error: mensagem }, { status })
}

export function sbAdmin(): SupabaseClient {
  const sb = getServiceSupabase()
  if (!sb) throw new Error('Supabase service role nao configurada')
  return sb
}

export async function usuarioDoToken(req: NextRequest): Promise<User | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user } } = await sb.auth.getUser(token)
  return user
}

export interface Solicitacao {
  id: string
  numero: number
  user_id: string
  servico: string
  status: string
}

/**
 * Carrega a solicitacao e confere quem pede. Dono sempre passa; admin passa
 * so onde `permitirAdmin` for true (leitura de midia).
 */
export async function carregarAutorizado(
  req: NextRequest,
  id: string,
  { permitirAdmin = false }: { permitirAdmin?: boolean } = {},
): Promise<{ ok: true; sol: Solicitacao; user: User | null; admin: boolean } | { ok: false; resposta: NextResponse }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, resposta: erro(404, 'Solicitação não encontrada') }

  const { data } = await sbAdmin()
    .from('servico_solicitacoes')
    .select('id, numero, user_id, servico, status')
    .eq('id', id)
    .limit(1)
  const sol = data?.[0] as Solicitacao | undefined
  if (!sol) return { ok: false, resposta: erro(404, 'Solicitação não encontrada') }

  const user = await usuarioDoToken(req)
  if (user && user.id === sol.user_id) return { ok: true, sol, user, admin: false }

  if (permitirAdmin && !(await requireAdmin(req))) return { ok: true, sol, user, admin: true }

  return { ok: false, resposta: erro(user ? 403 : 401, user ? 'Sem permissão' : 'Não autorizado') }
}

export async function registrarEvento(solicitacaoId: string, status: string, nota?: string) {
  const { error } = await sbAdmin().from('servico_eventos').insert({ solicitacao_id: solicitacaoId, status, nota: nota ?? null })
  if (error) console.error('[servicos] evento', status, error.message)
}

/** Caminho no bucket. Nunca usa nome vindo do cliente. */
export function caminhoFoto(solicitacaoId: string, itemId: string, slot: Slot, mime: string) {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp'
  return `${solicitacaoId}/${itemId}/${slot}-${crypto.randomUUID()}.${ext}`
}

export async function urlDeUpload(path: string) {
  const { data, error } = await sbAdmin().storage.from(BUCKET_SERVICOS).createSignedUploadUrl(path)
  if (error || !data) throw new Error(error?.message || 'sem url de upload')
  return { path: data.path, token: data.token }
}
