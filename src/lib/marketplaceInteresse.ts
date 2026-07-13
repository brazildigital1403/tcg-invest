import { supabase } from '@/lib/supabaseClient'
import { dispararMarco } from '@/lib/marketplaceMarco'

/**
 * Manifesta interesse num anuncio do marketplace — o MESMO fluxo canonico do
 * marketplace (interesse()): reserva a carta (status=reservado + buyer_id),
 * dispara o marco (email/sino pro vendedor) e abre a conversa.
 *
 * Isso e necessario porque o ChatDock so mostra a conversa pra participantes
 * (vendedor OU comprador). Sem reservar, o comprador nao e participante e o
 * chat aparece como "Conversa indisponivel".
 *
 * Usado pela vitrine da loja (AnunciosLoja) e pelo perfil publico, pra manter
 * o comportamento identico ao do marketplace num unico lugar.
 *
 * Retorna false quando nao rolou (sem login, carta propria, ou ja reservada
 * por outra pessoa). O componente chamador deve confirmar com o usuario antes.
 */
export async function manifestarInteresse(anuncioId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id
  if (!uid) return false

  // re-checa o estado atual (evita corrida entre carregar e clicar)
  const { data: a } = await supabase
    .from('marketplace')
    .select('user_id, status, buyer_id')
    .eq('id', anuncioId)
    .single()
  if (!a) return false

  // nao pode manifestar interesse na propria carta
  if (a.user_id === uid) return false

  // ja reservada por outra pessoa
  if (a.buyer_id && a.buyer_id !== uid) return false

  // reserva (se ainda nao for o comprador) + notifica o vendedor
  if (a.buyer_id !== uid) {
    await supabase.from('marketplace').update({ status: 'reservado', buyer_id: uid }).eq('id', anuncioId)
    await dispararMarco(anuncioId, 'interesse')
  }

  window.location.href = `/marketplace?conversa=${anuncioId}`
  return true
}
