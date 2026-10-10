/**
 * src/lib/adicionarCartaPublica.ts
 *
 * Grava UMA carta na colecao do usuario a partir da pagina publica da carta.
 * Mesmas colunas e mesma ordem de checagem do AddCardModal (existente ->
 * nao duplica; limite do plano -> bloqueia; insert pelo browser, RLS owner
 * de user_cards). Diferenca deliberada: aqui "adicionar" e IDEMPOTENTE --
 * se a carta ja esta na colecao, nao incrementa a quantidade. O botao da
 * pagina publica e um toque de ativacao, nao um contador.
 */

import { supabase } from '@/lib/supabaseClient'
import { checkCardLimit } from '@/lib/checkCardLimit'

export type CartaPublica = {
  id: string
  name: string
  number: string | null
  setTotal: number | null
  imageLarge: string | null
  imageSmall: string | null
  rarity: string | null
  setName: string | null
  idioma?: string | null
  variante?: string | null
}

export type ResultadoAdicionar =
  | { ok: true; jaTinha: boolean }
  | { ok: false; motivo: 'limite'; limite: number }
  | { ok: false; motivo: 'erro' }

export async function adicionarCartaPublica(userId: string, c: CartaPublica): Promise<ResultadoAdicionar> {
  const { data: existente } = await supabase
    .from('user_cards')
    .select('id')
    .eq('user_id', userId)
    .eq('pokemon_api_id', c.id)
    .eq('graduada', false)
    .limit(1)
    .maybeSingle()
  if (existente) return { ok: true, jaTinha: true }

  const { bloqueado, limite } = await checkCardLimit(userId)
  if (bloqueado) return { ok: false, motivo: 'limite', limite }

  // Mesmo nome gravado pelo AddCardModal: "Nome (001/165)".
  const number = c.number || ''
  const total = c.setTotal ? `/${c.setTotal}` : ''
  const numFmt = number && /^\d+$/.test(String(number)) && c.setTotal
    ? String(number).padStart(String(c.setTotal).length, '0')
    : number
  const cardName = number ? `${c.name} (${numFmt}${total})` : c.name

  const { error } = await supabase.from('user_cards').insert({
    user_id: userId,
    pokemon_api_id: c.id,
    card_name: cardName,
    card_id: c.id,
    card_image: c.imageLarge || c.imageSmall || null,
    card_link: null,
    rarity: c.rarity || null,
    variante: c.variante || 'normal',
    idioma: c.idioma || 'pt',
    quantity: 1,
    condicoes: null,
    set_name: c.setName || null,
  })

  if (error) {
    // corrida (a mesma carta entrou entre o SELECT e o INSERT): ja esta la
    if (error.code === '23505') return { ok: true, jaTinha: true }
    console.error('[adicionarCartaPublica]', error)
    return { ok: false, motivo: 'erro' }
  }
  return { ok: true, jaTinha: false }
}
