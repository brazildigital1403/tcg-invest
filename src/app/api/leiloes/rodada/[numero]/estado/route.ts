import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { numeroDaRodada, separarLotesRodada, versaoRodada, type EstadoRodada } from '@/lib/leilao-rodada'
import { lerLotesDaRodada, lerReferenciaMercadoCents, lerRodadaPorNumero } from '@/app/leiloes/_dados'

/**
 * GET /api/leiloes/rodada/[numero]/estado
 *
 * Estado publico da rodada para a pagina /leiloes/rodada/[numero]: a rodada,
 * todos os lotes (fila, no ar, encerrados), `server_now` para o relogio e
 * `versao` para a tela descartar resposta atrasada.
 *
 * PUBLICA E IGUAL PARA TODOS: sem Bearer, sem dado de usuario. Le a rodada
 * por colunas explicitas (nunca vendedor_user_id) e os lotes pela view
 * `leiloes_publico` (sem teto, lider so como apelido mascarado), tambem por
 * colunas explicitas. Nada de user_id, teto, pedido ou pagar_ate. A posicao
 * de quem esta logado (voce lidera, seu maximo) continua vindo da rota do
 * lote, que a ilha de lance consulta so quando precisa.
 *
 * PESO: fila e encerrados saem sem `fotos` e sem `lider_apelido` (so a
 * card_image); o lote no ar ganha os dois numa leitura por PK. A referencia
 * do Mercado Brasileiro do lote no ar (aviso de lance alto) e outra leitura
 * por PK em `pokemon_cards`, so para carta sem graduacao.
 *
 * SEM CACHE em nenhuma camada: muda a cada lance e cada lote que abre.
 *
 * FECHAMENTO PREGUICOSO: igual a rota de estado do lote. Lote `ativo` vencido
 * ha 1s ou mais -> `leilao_fechar_lote` (service role; a funcao ja avanca a
 * rodada para o proximo lote) e rele. A folga de 1s e a mesma do SQL.
 */

export const dynamic = 'force-dynamic'

const semCache = { 'Cache-Control': 'no-store, max-age=0' }
const FOLGA_FECHAR_MS = 1000

export async function GET(_req: Request, ctx: { params: Promise<{ numero: string }> }) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })

  const { numero: param } = await ctx.params
  const numero = numeroDaRodada(param)
  if (!numero) return NextResponse.json({ erro: 'nao_encontrado' }, { status: 404, headers: semCache })

  const db = getServiceSupabase()
  if (!db) return NextResponse.json({ erro: 'config' }, { status: 500, headers: semCache })

  try {
    let rodada = await lerRodadaPorNumero(db, numero)
    if (!rodada) {
      return NextResponse.json(
        { erro: 'nao_encontrado', server_now: new Date().toISOString() },
        { status: 404, headers: semCache }
      )
    }
    let lotes = await lerLotesDaRodada(db, rodada.id)

    const { ativo } = separarLotesRodada(lotes)
    const fim = ativo?.terminaEm ? Date.parse(ativo.terminaEm) : NaN
    if (ativo && Number.isFinite(fim) && fim <= Date.now() - FOLGA_FECHAR_MS) {
      const fechou = await db.rpc('leilao_fechar_lote', { p_leilao: ativo.id })
      if (fechou.error) {
        console.error('[leilao/rodada/estado] fechar', ativo.id, fechou.error.code, fechou.error.message)
      } else if (fechou.data) {
        // Fechar pode ter aberto o proximo lote e encerrado a rodada: rele os dois.
        const [r2, l2] = await Promise.all([lerRodadaPorNumero(db, numero), lerLotesDaRodada(db, rodada.id)])
        if (r2) rodada = r2
        lotes = l2
      }
    }

    const noAr = separarLotesRodada(lotes).ativo
    const referenciaMercadoCents = noAr ? await lerReferenciaMercadoCents(db, noAr.cardId, noAr.graduadora) : null

    const corpo: EstadoRodada = {
      rodada,
      lotes,
      server_now: new Date().toISOString(),
      versao: versaoRodada(rodada.status, lotes),
      referenciaMercadoCents,
    }
    return NextResponse.json(corpo, { headers: semCache })
  } catch (e) {
    console.error('[leilao/rodada/estado]', numero, (e as Error).message)
    return NextResponse.json(
      { erro: 'falha', server_now: new Date().toISOString() },
      { status: 500, headers: semCache }
    )
  }
}
