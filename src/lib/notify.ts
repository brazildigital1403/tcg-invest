import { getServiceSupabase } from './supabaseServer'

/**
 * Helper SERVER-SIDE de notificacoes (sino).
 *
 * A tabela `notifications` NAO tem policy de INSERT pra anon/authenticated (de
 * proposito): quem cria notificacao e sempre o servidor, via service role. Por
 * isso `criarNotificacao` (lib/notificacoes.ts, client) falha em silencio — use
 * ESTE helper em Route Handlers / libs server-side.
 *
 * NUNCA importar em componente 'use client' (vaza a service key).
 */

export type NotifType =
  | 'valorizacao'
  | 'desvalorizacao'
  | 'interesse'
  | 'venda'
  | 'enviado'
  | 'recebido'
  | 'avaliacao'
  | 'cancelado'
  | 'carta_adicionada'
  | 'watch_listada'
  | 'novidade'
  | 'boas_vindas'
  | 'mensagem'
  | 'aviso'

/** Cria uma notificacao para 1 usuario. Retorna true se gravou. */
export async function notify(
  userId: string,
  type: NotifType,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<boolean> {
  if (!userId) return false
  const sb = getServiceSupabase()
  if (!sb) return false
  const { error } = await sb.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    read: false,
    data: data ?? {},
  })
  return !error
}

/**
 * Broadcast: cria a MESMA notificacao para TODOS os usuarios (fan-out, 1 linha
 * por usuario) via RPC `broadcast_notification` (SECURITY DEFINER, so service
 * role executa). Retorna quantos usuarios foram notificados.
 */
export async function notifyAll(
  type: NotifType,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<number> {
  const sb = getServiceSupabase()
  if (!sb) return 0
  const { data: res, error } = await sb.rpc('broadcast_notification', {
    p_type: type,
    p_title: title,
    p_message: message,
    p_data: data ?? {},
  })
  if (error) return 0
  return typeof res === 'number' ? res : 0
}
