import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  montarReversa, lerPedidoME, separarEndereco, soDigitos, MAX_TENTATIVAS_ETIQUETA, TEXTO_FALTANDO,
  type CampoFaltando, type PessoaReversa,
} from '@/lib/etiquetaReversa'
import { prazoPostagem, fmtPrazo, validarRastreio } from '@/lib/leilao-reclamacao'
import { marcarDevolucaoEntregue, sino, nomeDaLoja } from '@/lib/reclamacaoServer'
import { cotarFrete, pacoteDeCartas } from '@/lib/melhor-envio'
import { SERVICO_PAC, SERVICO_SEDEX } from '@/lib/etiquetaReversa'

/**
 * Etiqueta reversa da desistencia no Melhor Envio (#500): rede e gravacao.
 * Regras puras em lib/etiquetaReversa; schema em
 * supabase/migrations/20260928210000_leilao_etiqueta_reversa.sql.
 *
 *   emitirEtiquetaReversa  -> carrinho (cart/reverse) -> pagamento (checkout,
 *                             saldo da carteira da Bynx) -> geracao (generate)
 *                             -> le o codigo. Cada passo grava o que obteve,
 *                             entao a repeticao (cron) continua de onde parou
 *                             e nunca compra duas etiquetas.
 *   sincronizarEtiqueta    -> le o pedido no Melhor Envio: postado (grava o
 *                             rastreio) e entregue (abre a janela de
 *                             contestacao da loja).
 *
 * ★ TOKEN: MELHOR_ENVIO_REVERSA_TOKEN (+ _REVERSA_BASE) quando existir, senao
 *   o mesmo MELHOR_ENVIO_TOKEN da cotacao. A reversa precisa dos
 *   escopos cart-write, shipping-checkout, shipping-generate e orders-read. Um
 *   token so de cotacao falha aqui com 401/403 -- a mensagem vai para
 *   etiqueta_erro.
 * ★ SANDBOX: o Melhor Envio nao gera o codigo de devolucao no sandbox (so
 *   carrinho e pagamento). O teste de verdade e em producao, com o Du.
 * ★ NUNCA importar em componente 'use client'.
 */

// A reversa pode apontar para outro ambiente que a cotacao: no teste local a
// cotacao fica no sandbox e a etiqueta de verdade vai para producao (o
// sandbox nao gera o codigo). Sem as variaveis _REVERSA, usa as da cotacao.
const BASE = process.env.MELHOR_ENVIO_REVERSA_BASE || process.env.MELHOR_ENVIO_BASE || 'https://www.melhorenvio.com.br'
const UA = process.env.MELHOR_ENVIO_UA || 'Bynx (contato@bynx.gg)'

async function me(path: string, metodo: 'GET' | 'POST', body?: unknown): Promise<{ ok: boolean; status: number; json: unknown; texto: string }> {
  const token = process.env.MELHOR_ENVIO_REVERSA_TOKEN || process.env.MELHOR_ENVIO_TOKEN
  if (!token) return { ok: false, status: 0, json: null, texto: 'MELHOR_ENVIO_TOKEN ausente' }
  const r = await fetch(`${BASE}${path}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': UA,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  })
  const texto = await r.text().catch(() => '')
  let json: unknown = null
  try { json = texto ? JSON.parse(texto) : null } catch { json = null }
  return { ok: r.ok, status: r.status, json, texto }
}

function erroCurto(etapa: string, r: { status: number; texto: string }): string {
  return `${etapa}: Melhor Envio ${r.status} ${r.texto.replace(/\s+/g, ' ').slice(0, 300)}`.slice(0, 500)
}

const COLS = 'id, pedido_id, comprador_user_id, loja_id, vendedor_user_id, motivo, status, devolucao_postada_em, devolucao_entregue_em, ' +
  'etiqueta_status, etiqueta_me_id, etiqueta_protocolo, etiqueta_codigo, etiqueta_custo_cents, etiqueta_paga_em, etiqueta_tentativas'

type Rec = {
  id: string; pedido_id: string; comprador_user_id: string; loja_id: string; vendedor_user_id: string
  motivo: string; status: string; devolucao_postada_em: string | null; devolucao_entregue_em: string | null
  etiqueta_status: string | null; etiqueta_me_id: string | null; etiqueta_protocolo: string | null
  etiqueta_codigo: string | null; etiqueta_custo_cents: number | null; etiqueta_paga_em: string | null; etiqueta_tentativas: number
}

export type ResultadoEtiqueta =
  | { ok: true; codigo: string; postarAte: string }
  | { ok: false; faltando?: CampoFaltando[]; erro: string }

/** Dados de quem devolve (comprador) e de quem recebe (loja + CPF do dono). */
async function pessoas(sb: SupabaseClient, rec: Rec): Promise<{ comprador: PessoaReversa; loja: PessoaReversa; valorCents: number; nomeItem: string }> {
  const [{ data: peds }, { data: us }, { data: ljs }] = await Promise.all([
    sb.from('pedidos').select('endereco, valor_item_cents, item_nome').eq('id', rec.pedido_id).limit(1),
    sb.from('users').select('name, email, cpf, whatsapp, logradouro, numero, complemento, bairro, cep, uf').eq('id', rec.comprador_user_id).limit(1),
    sb.from('lojas').select('nome, endereco, cidade, estado, cep, email, whatsapp, owner_user_id').eq('id', rec.loja_id).limit(1),
  ])
  const ped = peds?.[0] as { endereco?: Record<string, string | null> | null; valor_item_cents?: number; item_nome?: string } | undefined
  const u = (us?.[0] || {}) as Record<string, string | null>
  const l = (ljs?.[0] || {}) as Record<string, string | null>
  const end = ped?.endereco || {}
  const { data: donos } = await sb.from('users').select('cpf, email, whatsapp').eq('id', l.owner_user_id || rec.vendedor_user_id).limit(1)
  const dono = (donos?.[0] || {}) as Record<string, string | null>

  // Endereco do comprador: o cadastrado em Minha Conta quando completo; senao
  // o da entrega do pedido (texto livre do checkout da Stripe).
  const daEntrega = separarEndereco(end.linha1)
  const cadastroOk = !!(u.logradouro && soDigitos(u.cep).length === 8)
  const comprador: PessoaReversa = {
    nome: u.name || end.nome,
    email: u.email || end.email,
    telefone: u.whatsapp || end.telefone,
    cpf: u.cpf,
    rua: cadastroOk ? u.logradouro : daEntrega.rua,
    numero: cadastroOk ? (u.numero || 'S/N') : daEntrega.numero,
    complemento: cadastroOk ? u.complemento : null,
    bairro: cadastroOk ? u.bairro : (end.linha2 || daEntrega.bairro),
    cidade: end.cidade,
    uf: cadastroOk ? (u.uf || end.estado) : end.estado,
    cep: cadastroOk ? u.cep : end.cep,
  }
  const le = separarEndereco(l.endereco)
  const loja: PessoaReversa = {
    nome: l.nome,
    email: l.email || dono.email,
    telefone: l.whatsapp || dono.whatsapp,
    cpf: dono.cpf,
    rua: le.rua, numero: le.numero, bairro: le.bairro,
    cidade: l.cidade, uf: l.estado, cep: l.cep,
  }
  return { comprador, loja, valorCents: ped?.valor_item_cents || 0, nomeItem: ped?.item_nome || 'Carta colecionável' }
}

/**
 * A resposta do Melhor Envio traz nome, CPF, telefone e endereco das DUAS
 * pontas (from/to). Comprador e loja leem a propria linha de
 * pedido_reclamacoes pela RLS: guardar isso inteiro mostraria o CPF de um ao
 * outro. Fica so o que serve para depurar a etiqueta.
 */
function semDadosPessoais(j: unknown): unknown {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return j
  const { from: _f, to: _t, products: _p, ...resto } = j as Record<string, unknown>
  void _f; void _t; void _p
  return resto
}

async function gravar(sb: SupabaseClient, id: string, campos: Record<string, unknown>) {
  if ('etiqueta_resposta' in campos) campos = { ...campos, etiqueta_resposta: semDadosPessoais(campos.etiqueta_resposta) }
  const { error } = await sb.from('pedido_reclamacoes').update({ ...campos, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(`gravar etiqueta: ${error.message}`)
}

async function falhar(sb: SupabaseClient, id: string, erro: string, resposta?: unknown): Promise<ResultadoEtiqueta> {
  console.error(`[etiqueta] ${id} falhou: ${erro}`)
  await gravar(sb, id, { etiqueta_status: 'falhou', etiqueta_erro: erro.slice(0, 500), ...(resposta !== undefined ? { etiqueta_resposta: resposta } : {}) })
  return { ok: false, erro }
}

/**
 * Emite (ou continua emitindo) a etiqueta reversa de uma desistencia aberta e
 * ainda nao postada. `forcar` (admin) ignora o teto de tentativas.
 */
export async function emitirEtiquetaReversa(sb: SupabaseClient, rid: string, o: { forcar?: boolean } = {}): Promise<ResultadoEtiqueta> {
  const { data: recs, error } = await sb.from('pedido_reclamacoes').select(COLS).eq('id', rid).limit(1)
  if (error) return { ok: false, erro: error.message }
  const rec = recs?.[0] as unknown as Rec | undefined
  if (!rec || rec.motivo !== 'arrependimento' || rec.status !== 'aguardando_devolucao') return { ok: false, erro: 'desistencia nao esta aguardando devolucao' }
  if (rec.devolucao_postada_em) return { ok: false, erro: 'devolucao ja postada' }
  if (rec.etiqueta_status === 'pronta' && rec.etiqueta_codigo) return { ok: true, codigo: rec.etiqueta_codigo, postarAte: '' }
  if (!o.forcar && rec.etiqueta_tentativas >= MAX_TENTATIVAS_ETIQUETA) return { ok: false, erro: 'tentativas esgotadas: so o admin' }

  await gravar(sb, rid, { etiqueta_status: 'gerando', etiqueta_tentativas: rec.etiqueta_tentativas + 1, etiqueta_erro: null })

  // 1. Carrinho (so se ainda nao foi).
  let meId = rec.etiqueta_me_id
  if (!meId) {
    const p = await pessoas(sb, rec)
    // Servico: o mais barato entre PAC e SEDEX que atende o trecho. Dentro da
    // mesma cidade os Correios nao fazem PAC ("Transportadora nao atende este
    // trecho", visto no sandbox SP -> SP). Cotacao falhou: tenta PAC.
    let servico = SERVICO_PAC
    try {
      const ops = await cotarFrete(String(p.comprador.cep || ''), String(p.loja.cep || ''), [pacoteDeCartas(1, p.valorCents)], 10)
      const correios = ops.filter(o => o.id === SERVICO_PAC || o.id === SERVICO_SEDEX)
      if (correios.length) servico = correios[0].id
    } catch (err) {
      console.error('[etiqueta] cotacao:', (err as Error)?.message)
    }
    const m = montarReversa({ comprador: p.comprador, loja: p.loja, valorDeclaradoCents: p.valorCents, nomeItem: p.nomeItem, servico })
    if (!m.ok) {
      await falhar(sb, rid, `faltando: ${m.faltando.join(', ')}`)
      return { ok: false, faltando: m.faltando, erro: m.faltando.map(f => TEXTO_FALTANDO[f]).join(' ') }
    }
    const r = await me('/api/v2/me/cart/reverse', 'POST', m.body)
    if (!r.ok) return falhar(sb, rid, erroCurto('carrinho', r), r.json)
    const j = (r.json || {}) as Record<string, unknown>
    meId = typeof j.id === 'string' ? j.id : null
    if (!meId) return falhar(sb, rid, 'carrinho: resposta sem id', r.json)
    const preco = Number(j.price)
    await gravar(sb, rid, {
      etiqueta_me_id: meId,
      etiqueta_protocolo: typeof j.protocol === 'string' ? j.protocol : null,
      etiqueta_servico: Number(j.service_id) || null,
      etiqueta_custo_cents: Number.isFinite(preco) && preco > 0 ? Math.round(preco * 100) : null,
      etiqueta_resposta: r.json,
    })
  }

  // 2. Pagamento com o saldo da carteira (422 "ja foram pagas" = ja pago).
  if (!rec.etiqueta_paga_em) {
    const r = await me('/api/v2/me/shipment/checkout', 'POST', { orders: [meId] })
    const jaPaga = r.status === 422 && /pagas/i.test(r.texto)
    if (!r.ok && !jaPaga) return falhar(sb, rid, erroCurto('pagamento', r), r.json)
    await gravar(sb, rid, { etiqueta_paga_em: new Date().toISOString() })
  }

  // 3. Geracao do codigo. E ASSINCRONA no Melhor Envio (visto no sandbox em
  // 25/10: o generate devolve na hora, o pedido fica com generated_key
  // despachado e generated_at/authorization_code nulos ate a fila rodar).
  // So pede a geracao uma vez; depois so le o pedido.
  const antes = await me(`/api/v2/me/orders/${encodeURIComponent(meId)}`, 'GET')
  const jaPediu = !!((antes.json as Record<string, unknown> | null)?.generated_key)
  if (!jaPediu) {
    const g = await me('/api/v2/me/shipment/generate', 'POST', { orders: [meId] })
    if (!g.ok) return falhar(sb, rid, erroCurto('geracao', g), g.json)
  }
  let q = antes
  let e = lerPedidoME(q.json)
  for (let i = 0; i < 3 && !e.codigo; i++) {
    await new Promise(r => setTimeout(r, 2000))
    q = await me(`/api/v2/me/orders/${encodeURIComponent(meId)}`, 'GET')
    if (!q.ok) return falhar(sb, rid, erroCurto('consulta', q), q.json)
    e = lerPedidoME(q.json)
  }
  if (e.cancelado) return falhar(sb, rid, 'o Melhor Envio cancelou a etiqueta (ver etiqueta_resposta)', q.json)
  if (!e.codigo) {
    // Ainda na fila: segue 'gerando' (nao e falha) e o cron le de novo.
    await gravar(sb, rid, { etiqueta_status: 'gerando', etiqueta_erro: 'aguardando a geracao do codigo no Melhor Envio', etiqueta_resposta: q.json })
    return { ok: false, erro: 'aguardando a geracao do codigo' }
  }

  // 4. Pronta: o prazo de 7 dias para postar comeca agora.
  const agora = new Date()
  const postarAte = prazoPostagem(agora)!
  await gravar(sb, rid, {
    etiqueta_status: 'pronta',
    etiqueta_codigo: e.codigo,
    etiqueta_gerada_em: agora.toISOString(),
    etiqueta_resposta: q.json,
    ...(e.precoCents && !rec.etiqueta_custo_cents ? { etiqueta_custo_cents: e.precoCents } : {}),
    postar_ate: postarAte.toISOString(),
  })
  try {
    await sino(sb, rec.comprador_user_id, 'Código de postagem pronto',
      `Leve a carta a uma agência dos Correios até ${fmtPrazo(postarAte)} e mostre o código ${e.codigo}. O frete já está pago.`, `/pedido/${rec.pedido_id}`)
  } catch (err) {
    console.error('[etiqueta] aviso:', (err as Error)?.message)
  }
  return { ok: true, codigo: e.codigo, postarAte: postarAte.toISOString() }
}

/**
 * Le o pedido da etiqueta no Melhor Envio e anda a desistencia: postado grava
 * o rastreio e avisa a loja; entregue abre a janela de contestacao. Para o
 * cron; so mexe em desistencia com etiqueta pronta.
 */
export async function sincronizarEtiqueta(sb: SupabaseClient, rid: string): Promise<'postado' | 'entregue' | 'nada' | 'erro'> {
  const { data: recs } = await sb.from('pedido_reclamacoes').select(COLS).eq('id', rid).limit(1)
  const rec = recs?.[0] as unknown as Rec | undefined
  if (!rec?.etiqueta_me_id || rec.etiqueta_status !== 'pronta' || rec.status !== 'aguardando_devolucao') return 'nada'
  const q = await me(`/api/v2/me/orders/${encodeURIComponent(rec.etiqueta_me_id)}`, 'GET')
  await gravar(sb, rid, { etiqueta_rastreio_em: new Date().toISOString(), ...(q.ok ? { etiqueta_resposta: q.json } : {}) })
  if (!q.ok) {
    console.error(`[etiqueta] consulta ${rid}: ${erroCurto('consulta', q)}`)
    return 'erro'
  }
  const e = lerPedidoME(q.json)
  let res: 'postado' | 'entregue' | 'nada' = 'nada'

  if (e.postado && !rec.devolucao_postada_em) {
    const agora = new Date().toISOString()
    const rastreio = validarRastreio(e.rastreio || '') || null
    const { data: mexeu } = await sb.from('pedido_reclamacoes')
      .update({ devolucao_postada_em: agora, ...(rastreio ? { devolucao_rastreio: rastreio } : {}), updated_at: agora })
      .eq('id', rid).is('devolucao_postada_em', null).select('id')
    if (mexeu?.length) {
      res = 'postado'
      try {
        const loja = await nomeDaLoja(sb, rec.loja_id)
        await sino(sb, loja.owner || rec.vendedor_user_id, 'Devolução postada',
          `A devolução foi postada nos Correios${rastreio ? ` (rastreio ${rastreio})` : ''}. A etiqueta foi paga pela Bynx.`,
          `/minha-loja/${rec.loja_id}/pedidos`)
      } catch (err) {
        console.error('[etiqueta] aviso postado:', (err as Error)?.message)
      }
    }
  }
  if (e.entregue && !rec.devolucao_entregue_em) {
    const r = await marcarDevolucaoEntregue(sb, rid, new Date())
    if (r) res = 'entregue'
  }
  return res
}

/**
 * URL do PDF da declaracao de conteudo (DACE) da etiqueta. O Melhor Envio
 * prepara o arquivo em segundo plano: antes disso responde 422 "Dace pdf nao
 * processada" (visto em producao em 26/10) -> { pendente: true }.
 * GET /api/v2/me/imprimir/dace/pdf/{order_id} -> JSON com a URL.
 */
export async function urlDeclaracao(meId: string): Promise<{ url: string } | { pendente: true } | { erro: string }> {
  const r = await me(`/api/v2/me/imprimir/dace/pdf/${encodeURIComponent(meId)}`, 'GET')
  if (r.status === 422 && /processad/i.test(r.texto)) return { pendente: true }
  if (!r.ok) return { erro: erroCurto('declaracao', r) }
  const j = (r.json || {}) as Record<string, unknown>
  const url = [j.pdf, j.url, ...Object.values(j)].find(v => typeof v === 'string' && /^https:\/\//.test(v as string)) as string | undefined
  return url ? { url } : { erro: 'declaracao: resposta sem URL' }
}

/**
 * Cancela a etiqueta reversa ainda nao postada (desistencia expirada, teste):
 * o Melhor Envio devolve o valor a carteira em ate 12 h. Idempotente: etiqueta
 * ja cancelada nao chama a rede. POST /api/v2/me/shipment/cancel.
 */
export async function cancelarEtiqueta(sb: SupabaseClient, rid: string, descricao: string): Promise<{ ok: boolean; erro?: string }> {
  const { data: recs } = await sb.from('pedido_reclamacoes').select(COLS).eq('id', rid).limit(1)
  const rec = recs?.[0] as unknown as Rec | undefined
  if (!rec?.etiqueta_me_id) return { ok: false, erro: 'sem etiqueta' }
  if (rec.etiqueta_status === 'cancelada') return { ok: true }
  if (rec.devolucao_postada_em) return { ok: false, erro: 'devolucao ja postada' }
  const r = await me('/api/v2/me/shipment/cancel', 'POST', {
    order: { id: rec.etiqueta_me_id, reason_id: '2', description: descricao.slice(0, 200) },
  })
  const j = (r.json || {}) as Record<string, { canceled?: boolean }>
  if (!r.ok || j[rec.etiqueta_me_id]?.canceled !== true) {
    const erro = erroCurto('cancelamento', r)
    console.error(`[etiqueta] ${rid} nao cancelada: ${erro}`)
    return { ok: false, erro }
  }
  await gravar(sb, rid, { etiqueta_status: 'cancelada', etiqueta_erro: null })
  console.log(`[etiqueta] ${rid} cancelada no Melhor Envio (${rec.etiqueta_custo_cents ?? '?'} centavos voltam a carteira)`)
  return { ok: true }
}
