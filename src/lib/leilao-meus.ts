/**
 * "Meus lances" — funcoes puras (sem I/O). Usadas por GET /api/leiloes/meus
 * (agrupa) e pela tela /leiloes/meus-lances (so mostra).
 *
 * Grupo de cada lote, para QUEM tem teto nele:
 *   agendado/ativo              -> liderando | superado
 *   aguardando_pagamento + lider -> a_pagar  (pago detectado pelo pedido -> pagos)
 *   vendido + lider             -> pagos
 *   calote + lider              -> encerrados (o prazo venceu; o checkout recusa)
 *   qualquer outro fim          -> encerrados (sem_lances, cancelado, outro venceu)
 */

import type { LotePublico, StatusLote } from './leilao'

export type GrupoMeus = 'liderando' | 'superado' | 'a_pagar' | 'pagos' | 'encerrados'

export const ORDEM_GRUPOS: readonly GrupoMeus[] = ['liderando', 'superado', 'a_pagar', 'pagos', 'encerrados']

export const TITULO_GRUPO: Record<GrupoMeus, string> = {
  liderando: 'Liderando',
  superado: 'Superado',
  a_pagar: 'Arrematados a pagar',
  pagos: 'Arrematados pagos',
  // Titulo neutro: o grupo tambem recebe o arremate nao pago (calote), que
  // foi vitoria. "Sem vitoria" mentiria para quem venceu e perdeu o prazo.
  encerrados: 'Encerrados',
}

export type EstadoPagamento = 'aguardando' | 'pago' | 'calote'

export interface PagamentoMeu {
  estado: EstadoPagamento
  /** Prazo (ISO), so em 'aguardando'. */
  pagarAte: string | null
  /** Pedido do proprio comprador, so em 'pago' quando conhecido. */
  pedidoId: string | null
}

export interface ItemMeu {
  grupo: GrupoMeus
  lote: LotePublico
  voceLidera: boolean
  /** O SEU teto em leilao_proxy. Nunca o de outra pessoa. */
  seuMaximoCents: number
  pagamento: PagamentoMeu | null
}

export interface RespostaMeus {
  server_now: string
  grupos: Array<{ grupo: GrupoMeus; titulo: string; itens: ItemMeu[] }>
}

/** Entrada da classificacao: o que a rota ja sabe de cada lote. */
export interface EntradaMeu {
  lote: LotePublico
  seuMaximoCents: number
  voceLidera: boolean
  /** pagar_ate do lote (coluna privada; so usada se voce venceu). */
  pagarAte: string | null
  /** Id de pedido PAGO do lote, se houver (webhook pagou e o lote ainda nao virou vendido). */
  pedidoPagoId: string | null
  /** leiloes.pedido_id (so usado se voce venceu). */
  pedidoId: string | null
}

const ABERTOS: ReadonlySet<StatusLote> = new Set<StatusLote>(['agendado', 'ativo'])

export function grupoDoLote(status: StatusLote, voceLidera: boolean, pagoDetectado = false): GrupoMeus {
  if (ABERTOS.has(status)) return voceLidera ? 'liderando' : 'superado'
  if (!voceLidera) return 'encerrados'
  if (status === 'vendido') return 'pagos'
  if (status === 'aguardando_pagamento') return pagoDetectado ? 'pagos' : 'a_pagar'
  return 'encerrados'
}

export function pagamentoDoLote(e: EntradaMeu): PagamentoMeu | null {
  if (!e.voceLidera) return null
  const st = e.lote.status
  if (st === 'vendido' || (st === 'aguardando_pagamento' && e.pedidoPagoId)) {
    return { estado: 'pago', pagarAte: null, pedidoId: e.pedidoPagoId ?? e.pedidoId ?? null }
  }
  if (st === 'aguardando_pagamento') return { estado: 'aguardando', pagarAte: e.pagarAte, pedidoId: null }
  if (st === 'calote') return { estado: 'calote', pagarAte: null, pedidoId: null }
  return null
}

const ms = (iso: string | null | undefined, vazio: number) => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : vazio
}

/** Ordem dentro do grupo: o que pede acao primeiro. */
function comparar(grupo: GrupoMeus) {
  return (a: ItemMeu, b: ItemMeu): number => {
    if (grupo === 'liderando' || grupo === 'superado') {
      // Ativo antes de agendado; entre ativos, quem termina antes.
      const fa = a.lote.status === 'ativo' ? ms(a.lote.terminaEm, Infinity) : Infinity
      const fb = b.lote.status === 'ativo' ? ms(b.lote.terminaEm, Infinity) : Infinity
      if (fa !== fb) return fa - fb
      return ms(a.lote.iniciaEm, Infinity) - ms(b.lote.iniciaEm, Infinity)
    }
    if (grupo === 'a_pagar') return ms(a.pagamento?.pagarAte, Infinity) - ms(b.pagamento?.pagarAte, Infinity)
    // Encerrados/pagos: mais recente primeiro.
    return ms(b.lote.encerradoEm, 0) - ms(a.lote.encerradoEm, 0)
  }
}

/** Classifica e agrupa. Grupos vazios ficam de fora; a ordem e ORDEM_GRUPOS. */
export function agruparMeus(entradas: EntradaMeu[], serverNow: string): RespostaMeus {
  const por: Record<GrupoMeus, ItemMeu[]> = { liderando: [], superado: [], a_pagar: [], pagos: [], encerrados: [] }
  for (const e of entradas) {
    const grupo = grupoDoLote(e.lote.status, e.voceLidera, !!e.pedidoPagoId)
    por[grupo].push({
      grupo,
      lote: e.lote,
      voceLidera: e.voceLidera,
      seuMaximoCents: e.seuMaximoCents,
      pagamento: pagamentoDoLote(e),
    })
  }
  return {
    server_now: serverNow,
    grupos: ORDEM_GRUPOS.filter(g => por[g].length > 0).map(g => ({
      grupo: g,
      titulo: TITULO_GRUPO[g],
      itens: por[g].sort(comparar(g)),
    })),
  }
}

/** Divide em blocos de `n` (filtro `in (...)` com URL curta no PostgREST). */
export function emBlocos<T>(lista: readonly T[], n = 50): T[][] {
  const tam = Math.max(1, Math.floor(n))
  const out: T[][] = []
  for (let i = 0; i < lista.length; i += tam) out.push(lista.slice(i, i + tam))
  return out
}
