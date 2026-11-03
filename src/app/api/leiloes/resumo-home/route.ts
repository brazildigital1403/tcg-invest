import { NextResponse, connection } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { buscarLojasPorId, buscarRodadasAoVivo, lerLotesDaRodada, listarLotesVitrine, listarRodadasAgendadas } from '@/app/leiloes/_dados'

/**
 * GET /api/leiloes/resumo-home
 *
 * O que a secao de leilao da home mostra: rodada no ar, leiloes com prazo abertos,
 * a proxima rodada agendada ou nada. A home tem ISR de 10 min e lote dura segundos, entao
 * isto nao entra no getData: quem le e uma ilha no navegador.
 *
 * Igual para todos, sem Bearer. Le so os indices parciais de rodada e os lotes
 * dela, nunca pokemon_cards.
 *
 * DECISAO DO DU (03/11): secao dinamica logo depois do hero. 5 s na CDN so na
 * resposta 200, para muitos visitantes nao virarem muitas consultas. Erro nao
 * grava cache e nunca vira "nada": sem dado, a tela nao afirma que nao ha rodada.
 */

const semCache = { 'Cache-Control': 'no-store, max-age=0' }
const cacheCurto = { 'Cache-Control': 'public, max-age=0, s-maxage=5' }

export async function GET() {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  await connection()

  const db = getServiceSupabase()
  if (!db) return NextResponse.json({ erro: 'config' }, { status: 500, headers: semCache })

  try {
    const serverNow = new Date().toISOString()
    const [noAr, abertos] = await Promise.all([buscarRodadasAoVivo(), listarLotesVitrine('terminando')])
    // Leilao com prazo vem antes da agenda: e o que da para comprar agora. O lote
    // que esta no ar numa rodada fica na propria rodada.
    const comPrazo = abertos.filter(l => !l.rodadaId)
    if (!noAr.length && comPrazo.length) {
      const seis = comPrazo.slice(0, 6)
      const lojasDosLotes = await buscarLojasPorId(seis.map(l => l.lojaId ?? ''))
      const abertosHome = seis.map(l => ({ ...l, lojaNome: (l.lojaId && lojasDosLotes.get(l.lojaId)?.nome) || null }))
      return NextResponse.json({ estado: 'abertos', serverNow, lotes: abertosHome, totalAbertos: comPrazo.length }, { headers: cacheCurto })
    }
    const agendada = noAr.length ? null : (await listarRodadasAgendadas(1))[0] ?? null
    const rodada = noAr[0] ?? agendada
    if (!rodada) return NextResponse.json({ estado: 'nada', serverNow }, { headers: cacheCurto })

    const [lotes, lojas] = await Promise.all([
      lerLotesDaRodada(db, rodada.id),
      rodada.lojaId ? buscarLojasPorId([rodada.lojaId]) : Promise.resolve(new Map()),
    ])
    const validos = lotes.filter(l => l.status !== 'cancelado')
    const ativo = validos.find(l => l.status === 'ativo') ?? null
    const imagem = (l: (typeof validos)[number]) => l.fotos[0] || l.cardImage || null

    return NextResponse.json(
      {
        estado: noAr.length ? 'ao_vivo' : 'agendada',
        serverNow,
        rodada: {
          numero: rodada.numero,
          iniciaEm: rodada.iniciaEm,
          lojaNome: (rodada.lojaId && lojas.get(rodada.lojaId)?.nome) || 'Loja',
          nLotes: validos.length,
          outrasNoAr: Math.max(0, noAr.length - 1),
        },
        lote: ativo
          ? {
              nome: ativo.cardName,
              imagem: imagem(ativo),
              precoCents: ativo.nLances > 0 && ativo.precoAtualCents != null ? ativo.precoAtualCents : ativo.lanceInicialCents,
              nLances: ativo.nLances,
              terminaEm: ativo.terminaEm,
            }
          : null,
        proximos: validos
          .filter(l => l.status === 'agendado' || (!ativo && l.status !== 'ativo'))
          .map(imagem)
          .filter(Boolean)
          .slice(0, 5),
      },
      { headers: cacheCurto }
    )
  } catch (err) {
    console.error('[leilao/resumo-home]', (err as Error)?.message)
    return NextResponse.json({ erro: 'falha' }, { status: 500, headers: semCache })
  }
}
