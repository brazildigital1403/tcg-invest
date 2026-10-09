import { unstable_cache } from 'next/cache'
import { getServiceSupabase } from '@/lib/supabaseServer'
import type { StatsConvite } from '@/components/cards/ConviteBynx'

/**
 * Numeros do convite de cadastro, GLOBAIS (nao dependem da pagina): cache de
 * 1 h compartilhado pelas ~66 mil paginas de carta e pelos hubs. `landing_stats`
 * le a matview de sets (a home ja usa) e a contagem de usuarios e uma tabela
 * de centenas de linhas. Falha lanca; o chamador cai no ultimo valor medido.
 */
const STATS_CONVITE_FALLBACK: StatsConvite = { cartas: 68448, colecionadores: 468 }

const statsDoConvite = unstable_cache(
  async (): Promise<StatsConvite> => {
    const sb = getServiceSupabase()
    if (!sb) throw new Error('[convite] sem cliente Supabase')
    const [{ data: stats, error: e1 }, { count, error: e2 }] = await Promise.all([
      sb.rpc('landing_stats'),
      sb.from('users').select('id', { count: 'exact', head: true }),
    ])
    if (e1) throw new Error(`[convite] landing_stats: ${e1.message}`)
    if (e2) throw new Error(`[convite] contagem de usuarios: ${e2.message}`)
    const s = Array.isArray(stats) ? stats[0] : stats
    const cartas = Number(s?.total_cards)
    const colecionadores = Number(count)
    if (!(cartas > 0) || !(colecionadores > 0)) throw new Error('[convite] stats vazias')
    return { cartas, colecionadores }
  },
  ['carta-convite-v1'],
  { revalidate: 3600 },
)

export async function fetchStatsConvite(): Promise<StatsConvite> {
  try {
    return await statsDoConvite()
  } catch {
    return STATS_CONVITE_FALLBACK
  }
}
