import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { COLUNAS_PRECO } from '@/lib/calcPatrimonio'
import {
  agruparPorUsuario,
  emBlocos,
  idsDePreco,
  montarSnapshots,
  type LinhaPreco,
  type LinhaUserCard,
  type PriceMap,
} from '@/lib/portfolioSnapshot'

export const maxDuration = 60

// Pagina de leitura de user_cards. O PostgREST corta em max-rows (1000 por
// padrao); a paginacao abaixo nao depende deste numero bater com o corte.
const PAGINA_USER_CARDS = 1000
// Ids por chamada no lookup de preco (`.in` na PK de pokemon_cards).
const LOTE_PRECOS = 300
// Linhas por upsert em portfolio_history.
const LOTE_UPSERT = 200

/*
 * Antes: um SELECT de preco + um UPSERT POR USUARIO, em serie (~576 idas e
 * voltas iad1 -> sa-east-1, ~95 s) contra maxDuration de 60 s. Morria no meio
 * todo dia e os usuarios do fim da fila (os mais novos) ficavam sem snapshot.
 * Agora: user_cards paginado, precos em lotes de ids distintos, upsert em lote.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const inicio = Date.now()
  const today = new Date().toISOString().slice(0, 10)

  try {
    // 1. user_cards inteira, paginada por id (ordem estavel). Para so quando
    //    uma pagina volta vazia -- assim um max-rows menor que a pagina pedida
    //    nao encerra a leitura antes da hora.
    const allCards: LinhaUserCard[] = []
    for (let offset = 0; ; ) {
      const { data, error } = await supabase
        .from('user_cards')
        .select('id, user_id, pokemon_api_id, card_id, card_link, variante, quantity, graduada, valor_graduada')
        .order('id', { ascending: true })
        .range(offset, offset + PAGINA_USER_CARDS - 1)
      // Leitura parcial geraria patrimonio menor sem aviso: aborta o cron.
      if (error) throw new Error(`user_cards offset ${offset}: ${error.message}`)
      if (!data || data.length === 0) break
      allCards.push(...(data as LinhaUserCard[]))
      offset += data.length
    }

    if (allCards.length === 0) {
      console.log('[cron-portfolio] nenhuma carta em user_cards')
      return NextResponse.json({ message: 'Nenhuma carta', snapshots: 0 })
    }

    // 2. Precos em lotes, so por PK (`.in('id', ...)`) -- nunca varredura.
    const priceMap: PriceMap = {}
    const idsComFalha = new Set<string>()
    const lotesIds = emBlocos(idsDePreco(allCards), LOTE_PRECOS)
    for (const [i, lote] of lotesIds.entries()) {
      let ok = false
      for (let tentativa = 1; tentativa <= 2 && !ok; tentativa++) {
        const { data, error } = await supabase
          .from('pokemon_cards')
          .select(COLUNAS_PRECO)
          .in('id', lote)
        if (error) {
          console.error(`[cron-portfolio] precos lote ${i + 1}/${lotesIds.length} tentativa ${tentativa}: ${error.message}`)
          continue
        }
        for (const p of (data as unknown as LinhaPreco[] | null) ?? []) priceMap[p.id] = p
        ok = true
      }
      if (!ok) lote.forEach(id => idsComFalha.add(id))
    }

    // 3. Patrimonio por usuario -- calcPatrimonio, a fonte unica.
    const porUsuario = agruparPorUsuario(allCards)
    const { snapshots, pulados } = montarSnapshots(porUsuario, priceMap, today, idsComFalha)
    if (pulados.length > 0) {
      console.error(`[cron-portfolio] ${pulados.length} usuarios sem snapshot por falha no lote de precos`)
    }

    // 4. Upsert em blocos. Erro de bloco e logado e contado, nao engolido.
    let gravados = 0
    let falhasUpsert = 0
    const blocos = emBlocos(snapshots, LOTE_UPSERT)
    for (const [i, bloco] of blocos.entries()) {
      const { error } = await supabase
        .from('portfolio_history')
        .upsert(bloco, { onConflict: 'user_id,recorded_at' })
      if (error) {
        falhasUpsert += bloco.length
        console.error(`[cron-portfolio] upsert bloco ${i + 1}/${blocos.length} (${bloco.length} linhas): ${error.message}`)
      } else {
        gravados += bloco.length
      }
    }

    // 5. Resumo.
    const resumo = {
      date: today,
      linhas_user_cards: allCards.length,
      usuarios: porUsuario.size,
      ids_preco: lotesIds.reduce((n, l) => n + l.length, 0),
      lotes_preco: lotesIds.length,
      gravados,
      falhas: pulados.length + falhasUpsert,
      falhas_preco: pulados.length,
      falhas_upsert: falhasUpsert,
      ms: Date.now() - inicio,
    }
    console.log(`[cron-portfolio] resumo ${JSON.stringify(resumo)}`)

    const status = resumo.falhas > 0 ? 500 : 200
    return NextResponse.json({ message: 'Snapshots salvos', snapshots: gravados, ...resumo }, { status })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[cron-portfolio] abortado apos ${Date.now() - inicio} ms: ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
