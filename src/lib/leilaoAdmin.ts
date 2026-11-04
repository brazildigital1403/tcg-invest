import type { SupabaseClient } from '@supabase/supabase-js'
import { separarEndereco } from '@/lib/etiquetaReversa'
import { MOTIVOS, STATUS_ABERTOS, podeDecidir, prazoEnvio, type MotivoReclamacao, type ReclamacaoEstado } from '@/lib/leilao-reclamacao'

/**
 * Leitura da central do leilao no Admin (/admin/leiloes). So leitura: nenhuma
 * acao de dinheiro ou banco passa por aqui.
 *
 * ★ Falha NUNCA vira zero. Cada leitura que falha volta null e entra em
 *   `falhas`: a tela mostra "sem leitura", e nao um "0 atrasados" falso.
 * ★ Sem dado pessoal: nem comprador, nem endereco (so se a loja tem), nem CPF.
 * ★ Nada toca pokemon_cards. As tabelas do leilao sao pequenas e os status mais
 *   lidos tem indice parcial; `RECENTES` limita a lista dos lotes fechados.
 */

const DIA_MS = 86_400_000
const DIAS_PERIODO = 30
/** O tick roda a cada 10 s: 6 voltas perdidas ja e relogio parado. */
const RELOGIO_PARADO_MS = 60_000
/** Envio entra na fila do Admin quando falta menos que isto (ou ja venceu). */
const JANELA_ENVIO_MS = DIA_MS
const RECENTES = 200

const VIVOS = ['ativo', 'agendado', 'aguardando_pagamento']
const ARREMATADOS = ['aguardando_pagamento', 'vendido', 'calote']

export type TipoFila = 'reclamacao' | 'envio' | 'loja'

export interface ItemFila {
  chave: string
  tipo: TipoFila
  titulo: string
  detalhe: string
  /** ISO. null = sem prazo (fica no fim da fila). */
  prazo: string | null
  acao: string
  href: string
}

export interface LoteAdmin {
  id: string
  slug: string
  card_name: string
  card_numero: string | null
  status: string
  loja: string
  rodada_numero: number | null
  valor_cents: number
  n_lances: number
  /** Fim do lote, inicio previsto ou prazo de pagamento, conforme o status. */
  quando: string | null
}

export interface LojaAdmin {
  id: string
  nome: string
  recebimento: boolean
  endereco: boolean
  abertos: number
}

export interface SaudeRelogio {
  estado: 'ok' | 'parado' | 'nao_agendado'
  ultima_volta_em: string | null
  falhas_6h: number
}

export interface CentralLeilao {
  agora: string
  falhas: string[]
  fila: ItemFila[] | null
  numeros: {
    abertos: number | null
    abertos_prazo: number | null
    abertos_vivo: number | null
    agendados: number | null
    lances_30d: number | null
    lances_24h: number | null
    arremates_30d: number | null
    arremates_30d_cents: number | null
    a_pagar: number | null
    a_pagar_cents: number | null
    envio_atrasado: number | null
    nao_pagos_30d: number | null
    nao_pagos_30d_cents: number | null
  }
  lotes: LoteAdmin[] | null
  lojas: LojaAdmin[] | null
  saude: {
    relogio: SaudeRelogio | null
    avisos_pendentes: number | null
    aviso_mais_antigo_em: string | null
    avisos_abandonados_30d: number | null
    erros_24h: number | null
    ultimo_erro_em: string | null
  }
}

type Linha = Record<string, unknown>
type Resposta<T> = { data: T | null; error: { message: string } | null; count?: number | null }

export async function lerCentralLeilao(sb: SupabaseClient, agoraMs: number = Date.now()): Promise<CentralLeilao> {
  const falhas: string[] = []
  const ler = async <T,>(rotulo: string, consulta: PromiseLike<Resposta<T>>): Promise<Resposta<T> | null> => {
    try {
      const r = await consulta
      if (r.error) throw new Error(r.error.message)
      return r
    } catch (e) {
      console.error('[admin/leiloes]', rotulo, (e as Error)?.message)
      falhas.push(rotulo)
      return null
    }
  }
  const iso = (ms: number) => new Date(ms).toISOString()
  const desde30d = iso(agoraMs - DIAS_PERIODO * DIA_MS)
  const desde24h = iso(agoraMs - DIA_MS)

  const COLUNAS_LOTE = 'id, slug, loja_id, rodada_id, card_name, card_numero, status, preco_atual_cents, lance_inicial_cents, n_lances, inicia_em, termina_em, pagar_ate, encerrado_em'

  const [
    vivos, recentes, arremates, lances30, lances24, envios, reclamacoes, lojas, rodadasVivas,
    relogio, pendentes, abandonados, erros,
  ] = await Promise.all([
    ler('lotes em andamento', sb.from('leiloes').select(COLUNAS_LOTE).in('status', VIVOS).limit(500)),
    ler('lotes recentes', sb.from('leiloes').select(COLUNAS_LOTE).not('status', 'in', `(${[...VIVOS, 'rascunho'].join(',')})`).order('created_at', { ascending: false }).limit(RECENTES)),
    ler('arremates', sb.from('leiloes').select('status, preco_atual_cents').in('status', ARREMATADOS).gte('encerrado_em', desde30d).limit(2000)),
    ler('lances 30 dias', sb.from('leilao_lances').select('id', { count: 'exact', head: true }).is('anulado_em', null).gte('created_at', desde30d)),
    ler('lances 24 horas', sb.from('leilao_lances').select('id', { count: 'exact', head: true }).is('anulado_em', null).gte('created_at', desde24h)),
    ler('envios', sb.from('pedidos').select('id, numero, item_nome, loja_id, pago_em').eq('status', 'pago').not('leilao_id', 'is', null).order('pago_em', { ascending: true }).limit(200)),
    ler('reclamações', sb.from('pedido_reclamacoes').select('id, pedido_id, loja_id, motivo, status, prazo_loja_ate, prazo_decisao_ate').in('status', STATUS_ABERTOS).order('created_at', { ascending: true }).limit(200)),
    ler('lojas', sb.from('lojas').select('id, nome, slug, endereco, stripe_connect_account_id, connect_charges_enabled').eq('status', 'ativa').limit(500)),
    ler('rodadas', sb.from('leilao_rodadas').select('id, numero, loja_id, inicia_em, status').in('status', ['agendada', 'ao_vivo']).limit(200)),
    ler('relógio', sb.rpc('admin_leilao_saude') as unknown as PromiseLike<Resposta<Linha>>),
    ler('fila de avisos', sb.from('leilao_eventos').select('created_at', { count: 'exact' }).is('processado_em', null).order('id', { ascending: true }).limit(1)),
    ler('avisos abandonados', sb.from('leilao_eventos').select('id', { count: 'exact', head: true }).like('ultimo_erro', 'desistiu:%').gte('created_at', desde30d)),
    ler('erros do motor', sb.from('leilao_eventos').select('created_at', { count: 'exact' }).eq('tipo', 'erro_tick').gte('created_at', desde24h).order('id', { ascending: false }).limit(1)),
  ])

  const linhasVivas = (vivos?.data ?? null) as Linha[] | null
  const linhasRecentes = (recentes?.data ?? null) as Linha[] | null
  const todosLotes = [...(linhasVivas ?? []), ...(linhasRecentes ?? [])]

  // ─── Lojas ────────────────────────────────────────────────────────────────
  const linhasLojas = (lojas?.data ?? null) as Linha[] | null
  const nomePorLoja = new Map((linhasLojas ?? []).map(l => [String(l.id), String(l.nome ?? l.slug ?? 'Loja')]))
  const abertosPorLoja = new Map<string, number>()
  for (const l of linhasVivas ?? []) {
    if (l.status === 'ativo' || l.status === 'agendado') {
      const k = String(l.loja_id)
      abertosPorLoja.set(k, (abertosPorLoja.get(k) ?? 0) + 1)
    }
  }
  const listaLojas: LojaAdmin[] | null = linhasLojas && linhasLojas.map(l => ({
    id: String(l.id),
    nome: String(l.nome ?? l.slug ?? 'Loja'),
    recebimento: !!l.stripe_connect_account_id && !!l.connect_charges_enabled,
    endereco: !!separarEndereco((l.endereco ?? null) as never).rua,
    abertos: abertosPorLoja.get(String(l.id)) ?? 0,
  }))
  listaLojas?.sort((a, b) => {
    const pendA = a.recebimento && a.endereco ? 0 : 1
    const pendB = b.recebimento && b.endereco ? 0 : 1
    return (pendB - pendA) || (b.abertos - a.abertos) || a.nome.localeCompare(b.nome, 'pt-BR')
  })

  // ─── Numero da rodada de cada lote ────────────────────────────────────────
  const idsRodada = [...new Set(todosLotes.map(l => l.rodada_id as string | null).filter((v): v is string => !!v))]
  const numeroRodada = new Map<string, number>()
  if (idsRodada.length) {
    const r = await ler('números das rodadas', sb.from('leilao_rodadas').select('id, numero').in('id', idsRodada.slice(0, 300)))
    for (const x of (r?.data ?? []) as Linha[]) numeroRodada.set(String(x.id), Number(x.numero))
  }

  const lotes: LoteAdmin[] | null = linhasVivas === null && linhasRecentes === null ? null : todosLotes.map(l => {
    const status = String(l.status)
    const preco = l.preco_atual_cents == null ? Number(l.lance_inicial_cents) : Number(l.preco_atual_cents)
    const quando = status === 'agendado' ? l.inicia_em
      : status === 'aguardando_pagamento' ? l.pagar_ate
      : status === 'ativo' ? l.termina_em
      : l.encerrado_em ?? l.termina_em
    return {
      id: String(l.id),
      slug: String(l.slug),
      card_name: String(l.card_name),
      card_numero: (l.card_numero as string | null) ?? null,
      status,
      loja: nomePorLoja.get(String(l.loja_id)) ?? 'Loja',
      rodada_numero: l.rodada_id ? numeroRodada.get(String(l.rodada_id)) ?? null : null,
      valor_cents: Number.isFinite(preco) ? preco : 0,
      n_lances: Number(l.n_lances) || 0,
      quando: (quando as string | null) ?? null,
    }
  })

  // ─── Fila: o que depende do Admin ou esta para estourar ───────────────────
  const fila: ItemFila[] = []
  const linhasRecl = (reclamacoes?.data ?? null) as (Linha & ReclamacaoEstado)[] | null
  const decidir = (linhasRecl ?? []).filter(r => podeDecidir(r, agoraMs))
  const idsPedido = [...new Set(decidir.map(r => String(r.pedido_id)))]
  const pedidoPorId = new Map<string, Linha>()
  if (idsPedido.length) {
    const r = await ler('pedidos das reclamações', sb.from('pedidos').select('id, numero, item_nome').in('id', idsPedido))
    for (const p of (r?.data ?? []) as Linha[]) pedidoPorId.set(String(p.id), p)
  }
  for (const r of decidir) {
    const p = pedidoPorId.get(String(r.pedido_id))
    const motivo = MOTIVOS[r.motivo as unknown as MotivoReclamacao] ?? 'Reclamação'
    fila.push({
      chave: `r-${r.id}`,
      tipo: 'reclamacao',
      titulo: `Reclamação${p ? ` no pedido #${p.numero}` : ''}: ${motivo}`,
      detalhe: [nomePorLoja.get(String(r.loja_id)), p?.item_nome].filter(Boolean).join(' · '),
      prazo: (r.prazo_decisao_ate as string | null) ?? (r.prazo_loja_ate as string | null) ?? null,
      acao: 'Decidir em Reclamações',
      href: '/admin/reclamacoes',
    })
  }

  const linhasEnvios = (envios?.data ?? null) as Linha[] | null
  let enviosAtrasados = 0
  for (const p of linhasEnvios ?? []) {
    const prazo = prazoEnvio({ status: 'pago', ehLeilao: true, pago_em: p.pago_em as string | null } as never)
    if (!prazo) continue
    if (prazo.getTime() < agoraMs) enviosAtrasados++
    if (prazo.getTime() - agoraMs > JANELA_ENVIO_MS) continue
    fila.push({
      chave: `e-${p.id}`,
      tipo: 'envio',
      titulo: `Envio do pedido #${p.numero} sem rastreio`,
      detalhe: [nomePorLoja.get(String(p.loja_id)), p.item_nome].filter(Boolean).join(' · '),
      prazo: prazo.toISOString(),
      acao: 'Abrir loja',
      href: `/admin/lojas/${p.loja_id}/eventos`,
    })
  }

  // Loja com leilao em andamento que deixou de poder receber ou enviar.
  const proximaRodada = new Map<string, Linha>()
  for (const r of (rodadasVivas?.data ?? []) as Linha[]) {
    const k = String(r.loja_id)
    const atual = proximaRodada.get(k)
    if (!atual || String(r.inicia_em) < String(atual.inicia_em)) proximaRodada.set(k, r)
  }
  for (const l of listaLojas ?? []) {
    const rodada = proximaRodada.get(l.id)
    if ((l.recebimento && l.endereco) || (l.abertos === 0 && !rodada)) continue
    const falta = !l.recebimento ? 'Recebimento pendente' : 'Falta o endereço'
    fila.push({
      chave: `l-${l.id}`,
      tipo: 'loja',
      titulo: `${falta} com leilão em andamento`,
      detalhe: [l.nome, rodada ? `rodada #${rodada.numero}` : `${l.abertos} ${l.abertos === 1 ? 'lote' : 'lotes'}`].join(' · '),
      prazo: (rodada?.inicia_em as string | null) ?? null,
      acao: 'Abrir loja',
      href: `/admin/lojas/${l.id}/editar`,
    })
  }
  fila.sort((a, b) => (a.prazo ? Date.parse(a.prazo) : Infinity) - (b.prazo ? Date.parse(b.prazo) : Infinity))

  // ─── Numeros ──────────────────────────────────────────────────────────────
  const ativos = (linhasVivas ?? []).filter(l => l.status === 'ativo')
  const aPagar = (linhasVivas ?? []).filter(l => l.status === 'aguardando_pagamento')
  const soma = (xs: Linha[]) => xs.reduce((s, l) => s + (Number(l.preco_atual_cents) || 0), 0)
  const linhasArremate = (arremates?.data ?? null) as Linha[] | null
  const calotes = (linhasArremate ?? []).filter(l => l.status === 'calote')
  const seVivos = <T,>(v: T): T | null => (linhasVivas ? v : null)
  const seArremates = <T,>(v: T): T | null => (linhasArremate ? v : null)

  // ─── Relogio ──────────────────────────────────────────────────────────────
  const r = (relogio?.data ?? null) as Linha | null
  let saudeRelogio: SaudeRelogio | null = null
  if (r) {
    const ultima = (r.ultima_volta_em as string | null) ?? null
    const ultimaMs = ultima ? Date.parse(ultima) : NaN
    const agoraBanco = Date.parse(String(r.agora))
    const referencia = Number.isFinite(agoraBanco) ? agoraBanco : agoraMs
    saudeRelogio = {
      estado: !r.agendado ? 'nao_agendado'
        : !r.ativo || !Number.isFinite(ultimaMs) || referencia - ultimaMs > RELOGIO_PARADO_MS || r.ultima_volta_status === 'failed' ? 'parado'
        : 'ok',
      ultima_volta_em: ultima,
      falhas_6h: Number(r.falhas_6h) || 0,
    }
  }

  return {
    agora: iso(agoraMs),
    falhas,
    fila: linhasRecl === null && linhasEnvios === null && listaLojas === null ? null : fila,
    numeros: {
      abertos: seVivos(ativos.length),
      abertos_prazo: seVivos(ativos.filter(l => !l.rodada_id).length),
      abertos_vivo: seVivos(ativos.filter(l => !!l.rodada_id).length),
      agendados: seVivos((linhasVivas ?? []).filter(l => l.status === 'agendado').length),
      lances_30d: lances30?.count ?? null,
      lances_24h: lances24?.count ?? null,
      arremates_30d: seArremates((linhasArremate ?? []).length),
      arremates_30d_cents: seArremates(soma(linhasArremate ?? [])),
      a_pagar: seVivos(aPagar.length),
      a_pagar_cents: seVivos(soma(aPagar)),
      envio_atrasado: linhasEnvios ? enviosAtrasados : null,
      nao_pagos_30d: seArremates(calotes.length),
      nao_pagos_30d_cents: seArremates(soma(calotes)),
    },
    lotes,
    lojas: listaLojas,
    saude: {
      relogio: saudeRelogio,
      avisos_pendentes: pendentes?.count ?? null,
      aviso_mais_antigo_em: ((pendentes?.data as Linha[] | null)?.[0]?.created_at as string | undefined) ?? null,
      avisos_abandonados_30d: abandonados?.count ?? null,
      erros_24h: erros?.count ?? null,
      ultimo_erro_em: ((erros?.data as Linha[] | null)?.[0]?.created_at as string | undefined) ?? null,
    },
  }
}
