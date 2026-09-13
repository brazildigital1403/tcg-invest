import { cache } from 'react'
import { getServiceSupabase } from '@/lib/supabaseServer'

/**
 * Anuncios de carta graduada a venda agora, para a /cartas-graduadas.
 *
 * Le com service role, entao os filtros da RLS NAO se aplicam: status e
 * removido_em precisam estar aqui (mesma licao de ofertasDaCarta). So entra o
 * que da para comprar agora -- anuncio em negociacao nao vira vitrine.
 *
 * Falha devolve lista vazia: o bloco some e a pagina, que e um guia, continua
 * inteira. Nao ha unstable_cache aqui; quem segura o intervalo e o revalidate
 * da pagina.
 */

export type GraduadaAVenda = {
  id: string
  slug: string | null
  card_name: string
  card_image: string | null
  price: number
  graduadora: string
  nota: number | null
  black_label: boolean | null
}

export const buscarGraduadasAVenda = cache(async function buscarGraduadasAVenda(limite = 8): Promise<GraduadaAVenda[]> {
  const sb = getServiceSupabase()
  if (!sb) return []
  const { data, error } = await sb
    .from('marketplace')
    .select('id, slug, card_name, card_image, price, graduadora, nota, black_label')
    .eq('graduada', true)
    .eq('status', 'disponivel')
    .is('removido_em', null)
    .not('graduadora', 'is', null)
    .not('card_image', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error) {
    console.error('[cartas-graduadas] anuncios:', error.message)
    return []
  }
  return (data || []) as GraduadaAVenda[]
})
