/**
 * Protecao Bynx: politica de reclamacao dos pedidos de LEILAO (decisao do Du,
 * 28/09). Funcoes PURAS -- sem rede, sem banco -- usadas pelas rotas, pelo
 * cron e pela UI, e cobertas por scripts/reclamacao-selftest.mjs.
 *
 * Regras (prazos encurtados em 28/09 para caber no repasse de 30 dias; os
 * numeros vivem SO nas constantes DIAS_* abaixo -- UI, e-mail e rotas
 * interpolam, e o SQL de 20260928170000_leilao_arrependimento.sql espelha):
 *   - a loja envia em ate DIAS_UTEIS_ENVIO (3) dias uteis depois do pagamento;
 *     sem envio, o comprador pode pedir o cancelamento (estorno integral);
 *   - o comprador reclama OU desiste em ate DIAS_RECLAMAR (7) dias depois da
 *     entrega (confirmacao dele ou fechamento automatico). Uma janela so para
 *     os dois desde 10/10 (antes, 5 dias so para reclamar);
 *   - sem confirmacao, o pedido vira entregue em enviado + DIAS_FECHAMENTO_AUTO
 *     (10) dias; aviso no dia DIAS_AVISO_RECEBIMENTO (6). Reclamacao aberta
 *     trava o fechamento;
 *   - a loja responde em DIAS_UTEIS_LOJA (2) dias uteis; silencio = decisao a
 *     favor do comprador;
 *   - a Bynx decide em ate DIAS_UTEIS_DECISAO (2) dias uteis.
 *
 * ARREPENDIMENTO (art. 49 do CDC, Quadro #469, decisao do Du em 10/10):
 *   - antes do envio: estorno integral na hora;
 *   - depois: DIAS_POSTAR_DEVOLUCAO (7) dias para postar a carta de volta;
 *     chegou na loja, ela tem DIAS_UTEIS_CONTESTAR (2) dias uteis para
 *     contestar com prova; sem contestacao, o estorno integral sai sozinho;
 *     nao postou, a desistencia expira sem estorno;
 *   - a loja fotografa frente e verso ao enviar lote a partir de
 *     VALOR_FOTO_ENVIO_CENTS (R$ 150): e a prova dela numa contestacao.
 *
 * ★ DIA UTIL: segunda a sexta, fora dos feriados nacionais de data FIXA. Os
 *   moveis (Carnaval, Sexta-feira Santa, Corpus Christi) NAO entram: contar um
 *   deles como util so encurta o prazo da loja em um dia, nunca o do comprador.
 *   O relogio e o de Brasilia (UTC-3 fixo, sem horario de verao desde 2019): o
 *   prazo vence as 23:59:59 do ultimo dia util.
 */

import { validarRastreioCorreios } from './rastreio'

export const MOTIVOS = {
  nao_chegou: 'Não chegou',
  diferente_do_anuncio: 'Diferente do anúncio',
  suspeita_falsificacao: 'Suspeita de falsificação',
  danificado: 'Chegou danificado',
  arrependimento: 'Desistência da compra',
} as const
export type MotivoReclamacao = keyof typeof MOTIVOS
/**
 * Os motivos do formulario "Tive um problema". O arrependimento NAO entra:
 * tem botao, rota e RPC proprios (nasce em aguardando_devolucao).
 */
export const LISTA_MOTIVOS: MotivoReclamacao[] = ['nao_chegou', 'diferente_do_anuncio', 'suspeita_falsificacao', 'danificado']

/** Motivo aceito pela rota de reclamacao (arrependimento fica de fora). */
export function ehMotivo(v: unknown): v is MotivoReclamacao {
  return typeof v === 'string' && (LISTA_MOTIVOS as string[]).includes(v)
}
/** Nos tres motivos de "chegou, mas", as fotos frente/verso/embalagem sao obrigatorias. */
export function motivoExigeFoto(m: MotivoReclamacao): boolean {
  return m !== 'nao_chegou' && m !== 'arrependimento'
}

export const SLOTS_FOTO = ['frente', 'verso', 'embalagem'] as const
export type SlotFoto = (typeof SLOTS_FOTO)[number]
export const ROTULO_SLOT: Record<SlotFoto, string> = { frente: 'Frente da carta', verso: 'Verso da carta', embalagem: 'Embalagem' }

/**
 * URLs assinadas das fotos -> itens do GaleriaMidias. O rotulo sai do nome do
 * arquivo (`<pedido>/<comprador>/<slot>-<uuid>.<ext>`, gravado pela rota de
 * upload); nome fora do padrao vira "Foto N".
 */
export function fotosParaGaleria(urls: string[]): { id: string; url: string; mime: string; rotulo: string }[] {
  return urls.map((url, i) => {
    const arquivo = url.split('?')[0].split('/').pop() || ''
    const slot = arquivo.split('-')[0] as SlotFoto
    const ext = (arquivo.split('.').pop() || '').toLowerCase()
    return {
      id: `${i}-${arquivo}`,
      url,
      mime: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg',
      rotulo: ROTULO_SLOT[slot] || `Foto ${i + 1}`,
    }
  })
}
export const FOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp']

export type StatusReclamacao = 'aguardando_loja' | 'em_analise' | 'aguardando_devolucao' | 'resolvida' | 'improcedente'
export const STATUS_RECLAMACAO: Record<StatusReclamacao, string> = {
  aguardando_loja: 'Aguardando a loja',
  em_analise: 'Em análise pela Bynx',
  aguardando_devolucao: 'Aguardando devolução',
  resolvida: 'Resolvida',
  improcedente: 'Encerrada sem estorno',
}
export const STATUS_ABERTOS: StatusReclamacao[] = ['aguardando_loja', 'em_analise', 'aguardando_devolucao']

export type Decisao = 'estorno_total' | 'estorno_parcial' | 'devolucao' | 'improcedente'
export const DECISOES: Record<Decisao, string> = {
  estorno_total: 'Estorno total',
  estorno_parcial: 'Estorno parcial',
  devolucao: 'Devolução',
  improcedente: 'Improcedente',
}
export type RespostaLoja = 'aceitar' | 'contraproposta' | 'provas'
export const RESPOSTAS_LOJA: Record<RespostaLoja, string> = {
  aceitar: 'Aceito o estorno',
  contraproposta: 'Proponho um acordo',
  provas: 'Envio minhas provas',
}
export function ehRespostaLoja(v: unknown): v is RespostaLoja {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(RESPOSTAS_LOJA, v)
}

export const DIAS_UTEIS_ENVIO = 3
/** Espelhado no SQL (interval '7 days'): mudar aqui exige migration nova. */
export const DIAS_RECLAMAR = 7
export const DIAS_UTEIS_LOJA = 2
export const DIAS_UTEIS_DECISAO = 2
export const DIAS_AVISO_RECEBIMENTO = 6
export const DIAS_FECHAMENTO_AUTO = 10
/** Arrependimento: dias corridos para postar a carta de volta. */
export const DIAS_POSTAR_DEVOLUCAO = 7
/** Arrependimento: dias uteis da loja para contestar depois que a devolucao chega. */
export const DIAS_UTEIS_CONTESTAR = 2
/** Lote de leilao a partir deste valor exige foto da carta no envio. */
export const VALOR_FOTO_ENVIO_CENTS = 15000
export const SLOTS_FOTO_ENVIO = ['frente', 'verso'] as const
export type SlotFotoEnvio = (typeof SLOTS_FOTO_ENVIO)[number]

/** Descricao gravada no arrependimento: o CDC nao pede motivo. */
export const DESCRICAO_ARREPENDIMENTO = 'Desistência da compra (direito de arrependimento, art. 49 do CDC).'

export const ROTULO_BOTAO_PROBLEMA = 'Tive um problema com este pedido'
export const TEXTO_PROTECAO =
  `Você tem até ${DIAS_RECLAMAR} dias depois da entrega para nos contar. A loja responde em até ${DIAS_UTEIS_LOJA} dias úteis e a Bynx decide se ela não resolver.`

const DIA_MS = 24 * 60 * 60 * 1000
const OFFSET_BRT_MS = -3 * 60 * 60 * 1000

/** Feriados nacionais de data fixa (MM-DD). */
const FERIADOS_FIXOS = new Set(['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'])

function ms(v: Date | string | number | null | undefined): number {
  if (v == null) return NaN
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'number') return v
  return new Date(v).getTime()
}

/** Meia-noite (em Brasilia) do dia civil de `t`, expressa em ms UTC. */
function inicioDoDiaBrt(t: number): number {
  const local = t + OFFSET_BRT_MS
  return Math.floor(local / DIA_MS) * DIA_MS - OFFSET_BRT_MS
}

/** O dia civil (Brasilia) que comeca em `inicio` e util? */
export function ehDiaUtil(inicioDiaBrtMs: number): boolean {
  const d = new Date(inicioDiaBrtMs + OFFSET_BRT_MS) // campos UTC = campos de Brasilia
  const sem = d.getUTCDay()
  if (sem === 0 || sem === 6) return false
  const mmdd = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  return !FERIADOS_FIXOS.has(mmdd)
}

/**
 * Fim (23:59:59.999 de Brasilia) do n-esimo dia util DEPOIS do dia de `inicio`.
 * O proprio dia do inicio nao conta. Data invalida -> null.
 */
export function somarDiasUteis(inicio: Date | string | number, n: number): Date | null {
  const t = ms(inicio)
  if (!Number.isFinite(t) || !Number.isInteger(n) || n < 0) return null
  let dia = inicioDoDiaBrt(t)
  let contados = 0
  while (contados < n) {
    dia += DIA_MS
    if (ehDiaUtil(dia)) contados++
  }
  return new Date(dia + DIA_MS - 1)
}

export function somarDias(inicio: Date | string | number, n: number): Date | null {
  const t = ms(inicio)
  return Number.isFinite(t) ? new Date(t + n * DIA_MS) : null
}

const FMT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
/** "27/09 às 23:59" em Brasilia. Vazio se a data nao vale. */
export function fmtPrazo(v: Date | string | number | null | undefined): string {
  const t = ms(v)
  if (!Number.isFinite(t)) return ''
  const p: Record<string, string> = {}
  for (const part of FMT.formatToParts(new Date(t))) p[part.type] = part.value
  return `${p.day}/${p.month} às ${p.hour === '24' ? '00' : p.hour}:${p.minute}`
}

// ─── Comprador ──────────────────────────────────────────────────────────────

export interface PedidoPrazo {
  status: string
  ehLeilao: boolean
  pago_em?: string | null
  enviado_em?: string | null
  entregue_em?: string | null
  prazo_reclamacao_ate?: string | null
  reclamacao_aberta?: boolean | null
  aviso_recebimento_em?: string | null
}

/** Ate quando da para reclamar de um pedido entregue (null se nao entregue). */
export function prazoReclamacao(p: PedidoPrazo): Date | null {
  if (p.status !== 'entregue') return null
  if (p.prazo_reclamacao_ate) return new Date(p.prazo_reclamacao_ate)
  return p.entregue_em ? somarDias(p.entregue_em, DIAS_RECLAMAR) : null
}

export type PodeReclamar =
  | { pode: true; ate: Date | null }
  | { pode: false; motivo: 'nao_e_leilao' | 'status' | 'prazo_encerrado' | 'ja_aberta' }

export function podeReclamar(p: PedidoPrazo, agora: number): PodeReclamar {
  if (!p.ehLeilao) return { pode: false, motivo: 'nao_e_leilao' }
  if (p.reclamacao_aberta) return { pode: false, motivo: 'ja_aberta' }
  if (p.status === 'enviado') return { pode: true, ate: null }
  if (p.status !== 'entregue') return { pode: false, motivo: 'status' }
  const ate = prazoReclamacao(p)
  if (!ate || agora > ate.getTime()) return { pode: false, motivo: 'prazo_encerrado' }
  return { pode: true, ate }
}

/** Prazo da loja para enviar: DIAS_UTEIS_ENVIO dias uteis depois do pagamento. */
export function prazoEnvio(p: PedidoPrazo): Date | null {
  return p.pago_em ? somarDiasUteis(p.pago_em, DIAS_UTEIS_ENVIO) : null
}

export type PodeCancelar =
  | { pode: true }
  | { pode: false; motivo: 'nao_e_leilao' | 'status' | 'no_prazo'; liberaEm: Date | null }

/** Comprador pode pedir o cancelamento por atraso no envio? */
export function podeCancelarPorAtraso(p: PedidoPrazo, agora: number): PodeCancelar {
  if (!p.ehLeilao) return { pode: false, motivo: 'nao_e_leilao', liberaEm: null }
  if (p.status !== 'pago') return { pode: false, motivo: 'status', liberaEm: null }
  const limite = prazoEnvio(p)
  if (!limite) return { pode: false, motivo: 'status', liberaEm: null }
  if (agora <= limite.getTime()) return { pode: false, motivo: 'no_prazo', liberaEm: new Date(limite.getTime() + 1) }
  return { pode: true }
}

/** O que o cron faz com um pedido de leilao enviado. */
export function acaoRecebimento(p: PedidoPrazo, agora: number): 'fechar' | 'avisar' | null {
  if (!p.ehLeilao || p.status !== 'enviado' || p.reclamacao_aberta) return null
  const env = ms(p.enviado_em)
  if (!Number.isFinite(env)) return null
  if (agora >= env + DIAS_FECHAMENTO_AUTO * DIA_MS) return 'fechar'
  if (!p.aviso_recebimento_em && agora >= env + DIAS_AVISO_RECEBIMENTO * DIA_MS) return 'avisar'
  return null
}

// ─── Arrependimento ─────────────────────────────────────────────────────────

export type PodeDesistir =
  | { pode: true; modo: 'antes_do_envio'; ate: null }
  | { pode: true; modo: 'devolucao'; ate: Date | null }
  | { pode: false; motivo: 'nao_e_leilao' | 'status' | 'prazo_encerrado' | 'ja_aberta' | 'em_disputa' }

/**
 * Comprador pode desistir? Pago = antes do envio, estorno na hora. Enviado ou
 * entregue dentro de DIAS_RECLAMAR = devolucao. Mesma janela da reclamacao.
 * 'cancelando' (desistencia ou atraso que caiu no meio) conta como pago para
 * o retry reaproveitar o estorno.
 */
export function podeDesistir(p: PedidoPrazo & { em_disputa?: boolean | null }, agora: number): PodeDesistir {
  if (!p.ehLeilao) return { pode: false, motivo: 'nao_e_leilao' }
  if (p.em_disputa) return { pode: false, motivo: 'em_disputa' }
  if (p.status === 'pago' || p.status === 'cancelando') return { pode: true, modo: 'antes_do_envio', ate: null }
  const r = podeReclamar(p, agora)
  if (!r.pode) return { pode: false, motivo: r.motivo }
  return { pode: true, modo: 'devolucao', ate: r.ate }
}

/** Ate quando postar a devolucao: abertura + DIAS_POSTAR_DEVOLUCAO dias corridos. */
export function prazoPostagem(abertura: Date | string | number): Date | null {
  return somarDias(abertura, DIAS_POSTAR_DEVOLUCAO)
}

/** Fim da janela de contestacao da loja: entrega da devolucao + DIAS_UTEIS_CONTESTAR. */
export function prazoContestacao(entrega: Date | string | number): Date | null {
  return somarDiasUteis(entrega, DIAS_UTEIS_CONTESTAR)
}

/**
 * Codigo de rastreio dos Correios (padrao S10). A regra mora em lib/rastreio
 * (validarRastreioCorreios), dividida com o envio da loja.
 */
export const validarRastreio = validarRastreioCorreios

export interface DevolucaoEstado {
  motivo: MotivoReclamacao | string
  status: StatusReclamacao | string
  postar_ate?: string | null
  devolucao_postada_em?: string | null
  devolucao_entregue_em?: string | null
  contestar_ate?: string | null
  contestada_em?: string | null
}

/** Desistencia ainda andando sozinha (antes de contestacao): fora dos botoes de decisao da Bynx. */
export function arrependimentoAguardando(r: { motivo?: unknown; status?: unknown }): boolean {
  return r.motivo === 'arrependimento' && r.status === 'aguardando_devolucao'
}

function ehDevolucaoAberta(r: DevolucaoEstado): boolean {
  return arrependimentoAguardando(r)
}

/** Comprador ainda pode informar a postagem? */
export function podeInformarPostagem(r: DevolucaoEstado, agora: number): boolean {
  return ehDevolucaoAberta(r) && !r.devolucao_postada_em && agora <= ms(r.postar_ate)
}

/**
 * Loja pode contestar a devolucao? Depois da postagem (ela pode receber antes
 * de a Bynx marcar a entrega) e ate contestar_ate, quando ele existe.
 */
export function lojaPodeContestar(r: DevolucaoEstado, agora: number): boolean {
  if (!ehDevolucaoAberta(r) || !r.devolucao_postada_em || r.contestada_em) return false
  return !r.contestar_ate || agora <= ms(r.contestar_ate)
}

/**
 * O que o cron faz com uma desistencia aberta:
 *   - 'expirar': nao postou ate postar_ate -> encerra sem estorno;
 *   - 'estornar': entregue na loja e a janela de contestacao passou em branco.
 */
export function acaoDevolucao(r: DevolucaoEstado, agora: number): 'expirar' | 'estornar' | null {
  if (!ehDevolucaoAberta(r)) return null
  if (!r.devolucao_postada_em) {
    const lim = ms(r.postar_ate)
    return Number.isFinite(lim) && agora > lim ? 'expirar' : null
  }
  if (r.devolucao_entregue_em && !r.contestada_em) {
    const lim = ms(r.contestar_ate)
    return Number.isFinite(lim) && agora > lim ? 'estornar' : null
  }
  return null
}

/** Foto da carta obrigatoria no envio? So lote de leilao a partir de R$ 150. */
export function exigeFotoEnvio(p: { ehLeilao: boolean; valor_item_cents: number | null | undefined }): boolean {
  return p.ehLeilao && (p.valor_item_cents ?? 0) >= VALOR_FOTO_ENVIO_CENTS
}

/**
 * Caminhos das fotos de envio mandados pelo cliente: na pasta <pedido>/envio/,
 * slot conhecido (frente, verso), sem repetir. Devolve na ordem frente, verso.
 */
export function validarFotosEnvio(
  fotos: unknown,
  pasta: string,
  exigir: boolean,
): { ok: true; fotos: string[] } | { ok: false; erro: string } {
  const lista = Array.isArray(fotos) ? fotos.map(String) : []
  if (lista.length > SLOTS_FOTO_ENVIO.length) return { ok: false, erro: 'Fotos demais.' }
  const porSlot = new Map<string, string>()
  for (const f of lista) {
    if (!f.startsWith(pasta) || f.includes('..')) return { ok: false, erro: 'Foto inválida.' }
    const slot = f.slice(pasta.length).split('-')[0]
    if (!(SLOTS_FOTO_ENVIO as readonly string[]).includes(slot)) return { ok: false, erro: 'Foto inválida.' }
    if (porSlot.has(slot)) return { ok: false, erro: 'Foto repetida.' }
    porSlot.set(slot, f)
  }
  if (exigir && porSlot.size < SLOTS_FOTO_ENVIO.length) {
    return { ok: false, erro: 'Fotografe a frente e o verso da carta antes de confirmar o envio.' }
  }
  return { ok: true, fotos: SLOTS_FOTO_ENVIO.filter(s => porSlot.has(s)).map(s => porSlot.get(s)!) }
}

// ─── Loja e Bynx ────────────────────────────────────────────────────────────

export interface ReclamacaoEstado {
  status: StatusReclamacao | string
  prazo_loja_ate: string
}

export function lojaPodeResponder(r: ReclamacaoEstado, agora: number): boolean {
  return r.status === 'aguardando_loja' && agora <= ms(r.prazo_loja_ate)
}

/** Silencio da loja: o prazo passou sem resposta. Decisao a favor do comprador. */
export function lojaSemResposta(r: ReclamacaoEstado, agora: number): boolean {
  return r.status === 'aguardando_loja' && agora > ms(r.prazo_loja_ate)
}

export function podeDecidir(r: ReclamacaoEstado, agora: number): boolean {
  return r.status === 'em_analise' || r.status === 'aguardando_devolucao' || lojaSemResposta(r, agora)
}

export type PlanoDecisao =
  | { ok: true; status: 'resolvida' | 'improcedente' | 'aguardando_devolucao'; valorCents: number }
  | { ok: false; erro: string }

/**
 * Traduz o botao do admin em transicao + valor a estornar.
 * `restanteCents` = total pago - o que ja foi estornado.
 * Devolucao tem dois passos: o primeiro so muda o status (nada de dinheiro);
 * quando a reclamacao ja esta em 'aguardando_devolucao', a mesma decisao
 * conclui com o estorno do restante.
 */
export function planejarDecisao(args: {
  r: ReclamacaoEstado
  decisao: string
  valorCents?: number | null
  restanteCents: number
  agora: number
}): PlanoDecisao {
  const { r, decisao, restanteCents, agora } = args
  if (!podeDecidir(r, agora)) {
    return { ok: false, erro: r.status === 'aguardando_loja' ? 'A loja ainda está no prazo para responder.' : 'Esta reclamação já foi encerrada.' }
  }
  if (r.status === 'aguardando_devolucao' && decisao !== 'devolucao' && decisao !== 'improcedente') {
    return { ok: false, erro: 'Esta reclamação aguarda a devolução. Conclua a devolução ou encerre como improcedente.' }
  }
  const restante = Math.max(0, Math.floor(restanteCents))
  switch (decisao) {
    case 'improcedente':
      return { ok: true, status: 'improcedente', valorCents: 0 }
    case 'estorno_total':
      if (restante <= 0) return { ok: false, erro: 'Não há valor a estornar neste pedido.' }
      return { ok: true, status: 'resolvida', valorCents: restante }
    case 'estorno_parcial': {
      const v = Number(args.valorCents)
      if (!Number.isInteger(v) || v <= 0) return { ok: false, erro: 'Informe o valor do estorno parcial.' }
      if (v >= restante) return { ok: false, erro: 'Para devolver o valor inteiro, use o estorno total.' }
      return { ok: true, status: 'resolvida', valorCents: v }
    }
    case 'devolucao':
      if (r.status !== 'aguardando_devolucao') return { ok: true, status: 'aguardando_devolucao', valorCents: 0 }
      if (restante <= 0) return { ok: false, erro: 'Não há valor a estornar neste pedido.' }
      return { ok: true, status: 'resolvida', valorCents: restante }
    default:
      return { ok: false, erro: 'Decisão inválida.' }
  }
}

/**
 * Quanto ainda da para estornar, pela STRIPE e pelo banco (vence o menor).
 *   - Stripe: `amount - amount_refunded` da charge. Pega estorno manual feito
 *     no dashboard, que o banco (valor_reembolsado_cents) nao ve.
 *   - O refund DESTA decisao (mesma chave) volta para o restante: no retry
 *     depois de falha do banco ele ja esta em amount_refunded, e sem isso o
 *     estorno_total viraria "nada a estornar" e o reaproveitamento nunca
 *     aconteceria.
 * Sem charge legivel (null), fica so o banco.
 */
export function restanteEstornavel(a: {
  totalCents: number
  reembolsadoBancoCents: number
  charge: { amount: number; amountRefunded: number } | null
  refundDestaChaveCents: number
}): number {
  const peloBanco = Math.max(0, Math.floor(a.totalCents) - Math.max(0, Math.floor(a.reembolsadoBancoCents || 0)))
  if (!a.charge) return peloBanco
  const pelaStripe = Math.max(0,
    Math.floor(a.charge.amount) - Math.floor(a.charge.amountRefunded || 0) + Math.max(0, Math.floor(a.refundDestaChaveCents || 0)))
  return Math.min(peloBanco, pelaStripe)
}

/** Status de refund que a Stripe conta como devolvido (ou a caminho). */
export function refundValido(status: string | null | undefined): boolean {
  return status === 'succeeded' || status === 'pending'
}

const reais = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`

/**
 * Confere o refund que voltou da Stripe antes de gravar a decisao.
 *   - status fora de succeeded/pending (failed, canceled, requires_action):
 *     nao grava nada -> 502;
 *   - refund reaproveitado pela chave com valor DIFERENTE do plano atual (ex.:
 *     1a tentativa foi parcial e falhou no banco; agora o admin pede total):
 *     nao grava nada -> 409. Gravar o valor antigo sob a decisao nova deixaria
 *     reclamacao e pedido mentindo sobre o que voltou.
 * `esperadoCents` null = estorno do restante inteiro (sem comparar).
 */
export function conferirRefund(
  r: { amount: number; status: string | null | undefined },
  esperadoCents: number | null,
): { ok: true } | { ok: false; http: 409 | 502; erro: string } {
  if (!refundValido(r.status)) {
    return { ok: false, http: 502, erro: `A Stripe não concluiu o estorno (situação: ${r.status || 'desconhecida'}). Nada foi gravado. Confira na Stripe antes de tentar de novo.` }
  }
  if (esperadoCents != null && r.amount !== esperadoCents) {
    return {
      ok: false,
      http: 409,
      erro: `Já existe um estorno desta reclamação na Stripe de ${reais(r.amount)}, diferente dos ${reais(esperadoCents)} desta decisão. Nada foi gravado. Confira esse estorno na Stripe antes de decidir de novo.`,
    }
  }
  return { ok: true }
}

// ─── Validacao de entrada ───────────────────────────────────────────────────

/** Link de video: so https, ate 500 caracteres. '' ou null -> null; invalido -> false. */
export function validarVideoUrl(v: unknown): string | null | false {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  if (s.length > 500) return false
  try {
    const u = new URL(s)
    return u.protocol === 'https:' ? u.toString() : false
  } catch {
    return false
  }
}

export function validarDescricao(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return s.length >= 10 && s.length <= 2000 ? s : null
}

/**
 * Caminhos de foto enviados pelo cliente: tem de estar na pasta que o servidor
 * emitiu (<pedido>/<comprador>/), ter um slot conhecido e nao repetir slot.
 * Devolve a lista na ordem frente, verso, embalagem, ou o motivo da recusa.
 */
export function validarFotos(
  fotos: unknown,
  pasta: string,
  exigir: boolean,
): { ok: true; fotos: string[] } | { ok: false; erro: string } {
  const lista = Array.isArray(fotos) ? fotos.map(String) : []
  if (lista.length > SLOTS_FOTO.length) return { ok: false, erro: 'Fotos demais.' }
  const porSlot = new Map<string, string>()
  for (const f of lista) {
    if (!f.startsWith(pasta) || f.includes('..')) return { ok: false, erro: 'Foto inválida.' }
    const slot = f.slice(pasta.length).split('-')[0]
    if (!(SLOTS_FOTO as readonly string[]).includes(slot)) return { ok: false, erro: 'Foto inválida.' }
    if (porSlot.has(slot)) return { ok: false, erro: 'Foto repetida.' }
    porSlot.set(slot, f)
  }
  if (exigir && porSlot.size < SLOTS_FOTO.length) {
    return { ok: false, erro: 'Envie as 3 fotos: frente, verso e embalagem.' }
  }
  return { ok: true, fotos: SLOTS_FOTO.filter(s => porSlot.has(s)).map(s => porSlot.get(s)!) }
}
