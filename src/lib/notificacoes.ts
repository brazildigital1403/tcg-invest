import { supabase } from './supabaseClient'

export async function criarNotificacao(
  userId: string,
  type: 'interesse' | 'enviado' | 'recebido' | 'avaliacao' | 'cancelado' | 'valorizacao' | 'desvalorizacao',
  title: string,
  message: string,
  data?: Record<string, any>
) {
  await supabase.from('notifications').insert({
    user_id: userId, type, title, message, data: data || {},
  })
}

export async function marcarTodasLidas(userId: string) {
  await supabase.from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
}