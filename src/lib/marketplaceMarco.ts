import { supabase } from '@/lib/supabaseClient'

export type MarcoTipo = 'interesse' | 'enviado' | 'concluido'

/**
 * Dispara o marco da negociacao no servidor: email para a contraparte
 * (e, a partir do item 2, tambem o sino via notify()).
 *
 * Fire-and-forget: NUNCA lanca. Falha de email/rede nao quebra a acao do
 * usuario (a transicao de status ja foi feita pelo chamador).
 */
export async function dispararMarco(anuncioId: string, tipo: MarcoTipo): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    await fetch(`/api/marketplace/${anuncioId}/marco`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tipo }),
    })
  } catch {
    /* noop */
  }
}
