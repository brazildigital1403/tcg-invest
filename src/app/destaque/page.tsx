/**
 * /destaque — "Colecionadores em Destaque"
 *
 * 2 categorias (Trade Analyzer e naming decididos com o Du 13/08): Maior
 * coleção e Mais completo. "Mais valiosa" ficou de fora de propósito -- o
 * unico jeito de somar preço por usuário exige juntar user_cards (4k linhas,
 * barato) com pokemon_cards_all (187MB) carta a carta, medido em ~11 mil
 * buffers via explain analyze. Nao é seq scan da tabela toda, mas cruza a
 * zona de risco do CLAUDE.md ("milhares = risco") -- decidir com o Du se
 * vale uma matview antes de acrescentar essa aba.
 *
 * Sem tabela/matview nova: usa a RLS que ja existe (`user_cards` tem policy
 * "Public read cards of public profiles" via is_profile_public(user_id)),
 * `set_id`/`quantity` ja vem denormalizado em `user_cards` -- zero join na
 * tabela grande. Cacheado 1h via unstable_cache; falha SEMPRE lança (nunca
 * `return []`), regra da casa (ver /lojas/page.tsx).
 */

import { unstable_cache } from 'next/cache'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import DestaqueClient, { type RankingRow } from './DestaqueClient'

export const revalidate = 3600

const getRanking = unstable_cache(
  async (): Promise<{ maiorColecao: RankingRow[]; maisCompleto: RankingRow[] }> => {
    const { data: cards, error: e1 } = await supabase
      .from('user_cards')
      .select('user_id, set_id, quantity')
    if (e1) throw new Error(`[/destaque] user_cards: ${e1.message}`)

    const { data: sets, error: e2 } = await supabase
      .from('pokemon_sets')
      .select('id, printed_total')
    if (e2) throw new Error(`[/destaque] pokemon_sets: ${e2.message}`)

    const userIds = [...new Set((cards || []).map(c => c.user_id))]
    const { data: perfis, error: e3 } = await supabase
      .from('public_users')
      .select('id, name, username')
      .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])
    if (e3) throw new Error(`[/destaque] public_users: ${e3.message}`)

    const nomeById: Record<string, string> = {}
    for (const p of perfis || []) nomeById[p.id] = (p.name || p.username || 'Colecionador').trim()

    const totalBySet: Record<string, number> = {}
    for (const s of sets || []) if (s.printed_total) totalBySet[s.id] = Number(s.printed_total)

    // ── Maior coleção: soma de quantity por usuário ──────────────────────
    const cartasPorUser: Record<string, number> = {}
    // ── Mais completo: contagem de cartas distintas por (usuário, set) ───
    const cartasPorUserSet: Record<string, Record<string, number>> = {}

    for (const c of cards || []) {
      const uid = c.user_id
      cartasPorUser[uid] = (cartasPorUser[uid] || 0) + (Number(c.quantity) || 1)
      if (c.set_id) {
        cartasPorUserSet[uid] = cartasPorUserSet[uid] || {}
        cartasPorUserSet[uid][c.set_id] = (cartasPorUserSet[uid][c.set_id] || 0) + 1
      }
    }

    const maiorColecao: RankingRow[] = Object.entries(cartasPorUser)
      .map(([userId, cartas]) => {
        const nSets = Object.keys(cartasPorUserSet[userId] || {}).length
        return {
          userId, nome: nomeById[userId] || 'Colecionador', valor: cartas,
          legenda: `${nSets} ${nSets === 1 ? 'set' : 'sets'}`,
        }
      })
      .filter(r => nomeById[r.userId])
      .sort((a, b) => b.valor - a.valor)

    // "Completo" de verdade (100%) e raro com so 198 colecionadores -- medido
    // ao vivo, zero usuario tem hoje. Rankeia pelo maior % de conclusao num
    // set so (o set onde a pessoa esta mais perto de fechar), nao por sets
    // 100% fechados -- da resultado real com o dado que existe agora.
    const maisCompleto: RankingRow[] = Object.entries(cartasPorUserSet)
      .map(([userId, porSet]) => {
        let melhorPct = 0
        for (const [setId, qtd] of Object.entries(porSet)) {
          const total = totalBySet[setId]
          if (!total) continue
          melhorPct = Math.max(melhorPct, Math.min(100, Math.round((qtd / total) * 100)))
        }
        const nSets = Object.keys(porSet).length
        return {
          userId, nome: nomeById[userId] || 'Colecionador', valor: melhorPct,
          legenda: `${nSets} ${nSets === 1 ? 'set iniciado' : 'sets iniciados'}`,
        }
      })
      .filter(r => nomeById[r.userId] && r.valor > 0)
      .sort((a, b) => b.valor - a.valor)

    return { maiorColecao, maisCompleto }
  },
  ['destaque-colecionadores-v1'],
  { revalidate: 3600 }
)

export default async function DestaquePage() {
  const { maiorColecao, maisCompleto } = await getRanking()

  return (
    <AppLayout>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 0 60px' }}>
        <PageHeader
          trilha={[INICIO, { name: 'Colecionadores em Destaque', href: '/destaque' }]}
          titulo="Colecionadores em Destaque"
          descricao="Quem mais coleciona e quem está mais perto de completar os sets, entre perfis públicos."
          selo={
            <span style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245,158,11,0.13)', border: '1px solid rgba(245,158,11,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', flex: '0 0 auto' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 20V10M12 20V4M20 20v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </span>
          }
        />
        <DestaqueClient maiorColecao={maiorColecao} maisCompleto={maisCompleto} />
      </div>
    </AppLayout>
  )
}
