'use server'

import { revalidatePath } from 'next/cache'
import { getServiceSupabase } from '@/lib/supabaseServer'

/**
 * Fura o ISR de 24h da pagina de uma carta quando o bloco "A venda na Bynx"
 * dela muda.
 *
 * ★ POR QUE UMA SERVER ACTION E NAO A ROTA /api/revalidate: aquela rota e a
 * porta pra quem esta FORA da aplicacao (o scan, em outra maquina, com
 * CRON_SECRET). Quem cria anuncio esta DENTRO — `AnunciarModal` e
 * `minha-colecao` inserem direto no Supabase pelo browser, sem passar por
 * nenhuma rota nossa. Nao havia gancho de servidor no caminho; esta action e
 * o gancho.
 *
 * ★ A BARREIRA AQUI E OUTRA, porque o problema e outro. A rota se protege com
 * um segredo; uma Server Action e alcancavel por qualquer visitante, entao o
 * segredo nao serve. A protecao e o ALVO: so invalida carta que realmente tem
 * anuncio disponivel. Isso prende o universo em 55 cartas (medido em 04/09)
 * em vez das 66.897 do catalogo — invalidar em massa deixa de ser possivel,
 * que e o mesmo risco que a rota trata com teto por chamada.
 *
 * Falhar aqui NAO pode quebrar o anuncio: quem chama ja gravou no banco e a
 * invalidacao e otimizacao. No pior caso a pagina atualiza no ISR de 24h,
 * que e exatamente o comportamento de antes desta funcao existir.
 */
export async function revalidarCartaComOferta(cardId: string): Promise<void> {
  try {
    if (!cardId || typeof cardId !== 'string' || cardId.length > 200) return

    const db = getServiceSupabase()
    if (!db) return

    // A barreira: sem anuncio disponivel, nao ha o que invalidar.
    const { data: temOferta } = await db
      .from('marketplace')
      .select('id')
      .eq('card_id', cardId)
      .eq('status', 'disponivel')
      .is('removido_em', null)
      .limit(1)

    if (!temOferta || temOferta.length === 0) return

    // Lookup por PK: Index Scan, 4 buffers, 0,1 ms (medido em 04/09).
    const { data: cartas } = await db
      .from('pokemon_cards')
      .select('slug')
      .eq('id', cardId)
      .limit(1)

    const slug = cartas?.[0]?.slug
    if (!slug) return

    revalidatePath(`/carta/${slug}`)
  } catch (err) {
    console.error('[revalidarCartaComOferta]', (err as Error)?.message)
  }
}
