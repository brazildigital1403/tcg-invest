/**
 * Painel de pedidos da LOJA: em que aba cada pedido cai, quem precisa agir,
 * o que, e ate quando. Funcao PURA (sem rede, sem banco), coberta por
 * scripts/reclamacao-selftest.mjs.
 *
 * ★ POR QUE (11/10, redesenho aprovado pelo Du depois da auditoria de UX e
 *   UI): o painel tinha duas listas que nao se cruzavam (pedidos embaixo,
 *   reclamacoes e desistencias num bloco solto em cima). O mesmo pedido
 *   aparecia duas vezes dizendo coisas contraditorias, e nada dizia de quem
 *   era a vez. Agora e um caso por pedido: a reclamacao ou desistencia ABERTA
 *   manda no estado; sem ela, manda o status do pedido.
 *
 * Abas: 'sua_vez' (a loja age), 'comprador' (esperando o comprador ou os
 * Correios), 'bynx' (a Bynx decide ou processa), 'concluidos'.
 */

import {
  prazoEnvio, somarDias, lojaPodeResponder, lojaSemResposta, lojaPodeContestar, DIAS_FECHAMENTO_AUTO,
  STATUS_ABERTOS, type DevolucaoEstado,
} from './leilao-reclamacao'

export type Aba = 'sua_vez' | 'comprador' | 'bynx' | 'concluidos'
export type Quem = 'voce' | 'comprador' | 'correios' | 'bynx' | 'concluido'
export type Acao =
  | 'enviar' | 'responder' | 'conferir'
  | 'confirmar_recebimento' | 'postar' | 'a_caminho'
  | 'decidir' | 'devolucao_bynx' | 'estorno' | 'etiqueta'
  | 'entregue' | 'cancelado' | 'reembolsado'
export type Tipo = 'venda' | 'leilao'
export type Ocorrencia = 'reclamacao' | 'desistencia' | null
/** Botao principal do card (so na vez da loja; 'conferir_cedo' e secundario). */
export type Botao = 'enviar' | 'responder' | 'conferir' | 'conferir_cedo' | null

export interface PedidoPainel {
  status: string
  leilao_id?: string | null
  pago_em?: string | null
  enviado_em?: string | null
  created_at?: string | null
}

export interface ReclamacaoPainel extends DevolucaoEstado {
  status: string
  motivo: string
  prazo_loja_ate: string
  prazo_decisao_ate?: string | null
}

export interface Caso {
  aba: Aba
  quem: Quem
  acao: Acao
  /** Ate quando quem age tem para agir (null = sem prazo). */
  prazo: Date | null
  /** 'vencido' = passou; 'hoje' = falta menos de 24 h. */
  urgencia: 'normal' | 'hoje' | 'vencido'
  tipo: Tipo
  ocorrencia: Ocorrencia
  botao: Botao
  /** Quando o pedido fecha sozinho (enviado de leilao sem confirmacao). */
  fechaEm: Date | null
  /** Para ordenar: o prazo, ou a data de referencia quando nao ha prazo. */
  ordem: number
}

const DIA_MS = 24 * 60 * 60 * 1000

function ms(v: string | null | undefined): number {
  return v ? new Date(v).getTime() : NaN
}

function urgenciaDe(prazo: Date | null, agora: number): Caso['urgencia'] {
  if (!prazo) return 'normal'
  const t = prazo.getTime()
  if (agora > t) return 'vencido'
  if (t - agora < DIA_MS) return 'hoje'
  return 'normal'
}

/**
 * A reclamacao ou desistencia que manda no card: a ABERTA, se houver; senao a
 * mais recente (so para o selo no historico). Recebe a lista do pedido.
 */
export function ocorrenciaDoPedido<R extends { status: string; created_at?: string }>(lista: R[]): R | null {
  if (!lista.length) return null
  const abertas = lista.filter(r => (STATUS_ABERTOS as string[]).includes(r.status))
  const pool = abertas.length ? abertas : lista
  return [...pool].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0]
}

export function classificarCaso(p: PedidoPainel, r: ReclamacaoPainel | null, agora: number): Caso {
  const tipo: Tipo = p.leilao_id ? 'leilao' : 'venda'
  const ocorrencia: Ocorrencia = r ? (r.motivo === 'arrependimento' ? 'desistencia' : 'reclamacao') : null
  const aberta = !!r && (STATUS_ABERTOS as string[]).includes(r.status)
  const ref = ms(p.created_at) || 0
  const caso = (c: Omit<Caso, 'tipo' | 'ocorrencia' | 'urgencia' | 'ordem' | 'fechaEm'> & { fechaEm?: Date | null; ordem?: number }): Caso => ({
    tipo,
    ocorrencia,
    fechaEm: c.fechaEm ?? null,
    urgencia: c.aba === 'concluidos' ? 'normal' : urgenciaDe(c.prazo, agora),
    // Sem prazo vai para o fim da fila da aba (os mais antigos antes).
    ordem: c.ordem ?? (c.prazo ? c.prazo.getTime() : 9e15 + ref),
    ...c,
  })

  // ── Ocorrencia aberta manda ──
  if (r && aberta) {
    if (r.motivo === 'arrependimento' && r.status === 'aguardando_devolucao') {
      if (!r.devolucao_postada_em) {
        // Etiqueta reversa (#500) ainda saindo: e com a Bynx, nao com o comprador.
        if (r.etiqueta_status && r.etiqueta_status !== 'pronta') {
          return caso({ aba: 'bynx', quem: 'bynx', acao: 'etiqueta', prazo: null, botao: null })
        }
        const prazo = r.postar_ate ? new Date(r.postar_ate) : null
        return caso({ aba: 'comprador', quem: 'comprador', acao: 'postar', prazo, botao: null })
      }
      if (!r.devolucao_entregue_em) {
        return caso({
          aba: 'comprador', quem: 'correios', acao: 'a_caminho', prazo: null,
          botao: lojaPodeContestar(r, agora) ? 'conferir_cedo' : null,
        })
      }
      const prazo = r.contestar_ate ? new Date(r.contestar_ate) : null
      if (lojaPodeContestar(r, agora)) return caso({ aba: 'sua_vez', quem: 'voce', acao: 'conferir', prazo, botao: 'conferir' })
      // Janela passou: o estorno automatico e da Bynx (cron).
      return caso({ aba: 'bynx', quem: 'bynx', acao: 'estorno', prazo: null, botao: null })
    }
    if (r.status === 'aguardando_loja') {
      const prazo = new Date(r.prazo_loja_ate)
      if (lojaPodeResponder(r, agora)) return caso({ aba: 'sua_vez', quem: 'voce', acao: 'responder', prazo, botao: 'responder' })
      if (lojaSemResposta(r, agora)) return caso({ aba: 'bynx', quem: 'bynx', acao: 'decidir', prazo, botao: null })
    }
    if (r.status === 'em_analise') {
      const prazo = r.prazo_decisao_ate ? new Date(r.prazo_decisao_ate) : null
      return caso({ aba: 'bynx', quem: 'bynx', acao: 'decidir', prazo, botao: null })
    }
    if (r.status === 'aguardando_devolucao') {
      return caso({ aba: 'bynx', quem: 'bynx', acao: 'devolucao_bynx', prazo: null, botao: null })
    }
  }

  // ── Sem ocorrencia aberta: status do pedido ──
  switch (p.status) {
    case 'pago': {
      const prazo = tipo === 'leilao' ? prazoEnvio({ status: p.status, ehLeilao: true, pago_em: p.pago_em }) : null
      return caso({ aba: 'sua_vez', quem: 'voce', acao: 'enviar', prazo, botao: 'enviar', ordem: prazo ? prazo.getTime() : ms(p.pago_em) || ref })
    }
    case 'cancelando':
      return caso({ aba: 'bynx', quem: 'bynx', acao: 'estorno', prazo: null, botao: null })
    case 'enviado': {
      const fechaEm = tipo === 'leilao' && p.enviado_em ? somarDias(p.enviado_em, DIAS_FECHAMENTO_AUTO) : null
      return caso({ aba: 'comprador', quem: 'comprador', acao: 'confirmar_recebimento', prazo: null, botao: null, fechaEm, ordem: fechaEm ? fechaEm.getTime() : ms(p.enviado_em) || ref })
    }
    case 'entregue':
      return caso({ aba: 'concluidos', quem: 'concluido', acao: 'entregue', prazo: null, botao: null, ordem: -ref })
    case 'reembolsado':
      return caso({ aba: 'concluidos', quem: 'concluido', acao: 'reembolsado', prazo: null, botao: null, ordem: -ref })
    default:
      return caso({ aba: 'concluidos', quem: 'concluido', acao: 'cancelado', prazo: null, botao: null, ordem: -ref })
  }
}

/** Dias inteiros desde `desde` (0 = hoje). */
export function diasDesde(desde: string | null | undefined, agora: number): number | null {
  const t = ms(desde)
  return Number.isFinite(t) ? Math.max(0, Math.floor((agora - t) / DIA_MS)) : null
}

/** "faltam 3 dias" / "falta 1 dia" / null quando ja e hoje ou passou. */
export function faltam(prazo: Date | null, agora: number): string | null {
  if (!prazo) return null
  const d = Math.floor((prazo.getTime() - agora) / DIA_MS)
  if (d < 1) return null
  return d === 1 ? 'falta 1 dia' : `faltam ${d} dias`
}

// ─── Lado do COMPRADOR (/pedido/[id]) ───────────────────────────────────────
//
// ★ 11/10, mockup aprovado: uma faixa no topo do pedido diz de quem e a vez
//   (voce / a loja / a Bynx / os Correios), o que falta e ate quando. Mesma
//   regra de prioridade da loja: a reclamacao ou desistencia ABERTA manda;
//   sem ela, manda o status do pedido.

export type QuemComprador = 'voce' | 'loja' | 'bynx' | 'correios' | 'pagamento' | 'concluido' | 'cancelado'
export type AcaoComprador =
  | 'pagar' | 'aguardar_envio' | 'cancelar_atraso' | 'confirmar_recebimento' | 'estorno'
  | 'loja_responde' | 'bynx_decide' | 'bynx_devolucao'
  | 'gerando_codigo' | 'postar_devolucao' | 'devolucao_a_caminho' | 'loja_confere'
  | 'entregue' | 'reembolsado' | 'cancelado'

export interface CasoComprador {
  quem: QuemComprador
  acao: AcaoComprador
  prazo: Date | null
  /** Pedido enviado de leilao fecha sozinho nesta data. */
  fechaEm: Date | null
}

export function casoComprador(
  p: PedidoPainel & { status: string },
  r: ReclamacaoPainel | null,
  agora: number,
): CasoComprador {
  const leilao = !!p.leilao_id
  const out = (quem: QuemComprador, acao: AcaoComprador, prazo: Date | null = null, fechaEm: Date | null = null): CasoComprador =>
    ({ quem, acao, prazo, fechaEm })

  if (r && (STATUS_ABERTOS as string[]).includes(r.status)) {
    if (r.motivo === 'arrependimento' && r.status === 'aguardando_devolucao') {
      if (!r.devolucao_postada_em) {
        // O prazo de postar so corre com o codigo da etiqueta pronto (#500).
        if (r.etiqueta_status && r.etiqueta_status !== 'pronta') return out('bynx', 'gerando_codigo')
        return out('voce', 'postar_devolucao', r.postar_ate ? new Date(r.postar_ate) : null)
      }
      if (!r.devolucao_entregue_em) return out('correios', 'devolucao_a_caminho')
      return out('loja', 'loja_confere', r.contestar_ate ? new Date(r.contestar_ate) : null)
    }
    if (r.status === 'aguardando_loja') {
      if (lojaSemResposta(r, agora)) return out('bynx', 'bynx_decide')
      return out('loja', 'loja_responde', new Date(r.prazo_loja_ate))
    }
    if (r.status === 'em_analise') return out('bynx', 'bynx_decide', r.prazo_decisao_ate ? new Date(r.prazo_decisao_ate) : null)
    if (r.status === 'aguardando_devolucao') return out('bynx', 'bynx_devolucao')
  }

  switch (p.status) {
    case 'aguardando_pagamento': return out('pagamento', 'pagar')
    case 'pago': {
      const prazo = leilao ? prazoEnvio({ status: 'pago', ehLeilao: true, pago_em: p.pago_em }) : null
      if (prazo && agora > prazo.getTime()) return out('voce', 'cancelar_atraso', prazo)
      return out('loja', 'aguardar_envio', prazo)
    }
    case 'cancelando': return out('bynx', 'estorno')
    case 'enviado': {
      const fechaEm = leilao && p.enviado_em ? somarDias(p.enviado_em, DIAS_FECHAMENTO_AUTO) : null
      return out('voce', 'confirmar_recebimento', null, fechaEm)
    }
    case 'entregue': return out('concluido', 'entregue')
    case 'reembolsado': return out('cancelado', 'reembolsado')
    default: return out('cancelado', 'cancelado')
  }
}
