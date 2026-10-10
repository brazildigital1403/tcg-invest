/**
 * Parte pura do cron-portfolio (src/app/api/cron-portfolio/route.ts).
 *
 * Separada da rota para poder ser testada sem banco: recebe as linhas de
 * `user_cards` e o mapa de precos ja buscado, e devolve as linhas que vao
 * para `portfolio_history`. O valor vem de `calcPatrimonio` -- a mesma fonte
 * unica do topo da tela; aqui nao existe regra de preco propria.
 */
import { calcPatrimonio, type CartaDoUsuario } from '@/lib/calcPatrimonio'

export type LinhaUserCard = CartaDoUsuario & { user_id: string }

/** Linha de pokemon_cards com as COLUNAS_PRECO. */
export type LinhaPreco = { id: string } & Record<string, unknown>
export type PriceMap = Record<string, LinhaPreco>

export type SnapshotPortfolio = {
  user_id: string
  valor: number
  recorded_at: string
}

/** Fatia um array em blocos de `tamanho`. */
export function emBlocos<T>(itens: T[], tamanho: number): T[][] {
  const blocos: T[][] = []
  for (let i = 0; i < itens.length; i += tamanho) blocos.push(itens.slice(i, i + tamanho))
  return blocos
}

/**
 * Ids de catalogo distintos usados no lookup de preco.
 * Mesmo criterio do cron antigo: so `pokemon_api_id` (o canonico).
 */
export function idsDePreco(cards: LinhaUserCard[]): string[] {
  return [...new Set(cards.map(c => c.pokemon_api_id).filter(Boolean) as string[])]
}

export function agruparPorUsuario(cards: LinhaUserCard[]): Map<string, LinhaUserCard[]> {
  const porUsuario = new Map<string, LinhaUserCard[]>()
  for (const card of cards) {
    const lista = porUsuario.get(card.user_id)
    if (lista) lista.push(card)
    else porUsuario.set(card.user_id, [card])
  }
  return porUsuario
}

/**
 * Monta os snapshots do dia.
 *
 * `idsComFalha`: ids cujo lote de preco nao voltou do banco. O usuario que
 * tem carta nesses ids NAO recebe snapshot (vai para `pulados`) -- gravar
 * seria registrar um patrimonio menor do que o real, sem erro nenhum.
 */
export function montarSnapshots(
  porUsuario: Map<string, LinhaUserCard[]>,
  priceMap: PriceMap,
  dia: string,
  idsComFalha: Set<string> = new Set(),
): { snapshots: SnapshotPortfolio[]; pulados: string[] } {
  const snapshots: SnapshotPortfolio[] = []
  const pulados: string[] = []

  for (const [userId, cards] of porUsuario) {
    if (idsComFalha.size > 0 && cards.some(c => c.pokemon_api_id && idsComFalha.has(c.pokemon_api_id))) {
      pulados.push(userId)
      continue
    }
    // Sem cotacao de proposito: o cron nao depende de API externa para fechar
    // o snapshot do dia (as poucas cartas so com preco em USD entram como zero,
    // igual ao comportamento anterior).
    const { valor } = calcPatrimonio(cards, priceMap)
    snapshots.push({ user_id: userId, valor: parseFloat(valor.toFixed(2)), recorded_at: dia })
  }

  return { snapshots, pulados }
}
