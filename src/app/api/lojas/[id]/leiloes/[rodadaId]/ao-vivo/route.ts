import { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { mascararApelido } from '@/lib/leilao'
import { pedidoDoLote, type PedidoResumo } from '@/lib/leilao-painel'
import { contextoPainel, json, UUID_RE } from '../../_comum'

/**
 * GET /api/lojas/[id]/leiloes/[rodadaId]/ao-vivo — o painel da loja durante e
 * depois da rodada (polling da tela a cada 5s, 2s no fim do lote).
 *
 * -> { server_now, rodada, lotes: [{ ...lote, lider_apelido, pagar_ate, pedido }] }
 *
 * ★ Dono da loja ou admin (contextoPainel), no-store. Leitura:
 *   - rodada por PK + loja_id;
 *   - lotes por rodada_id + loja_id, ordenados por ordem (indice
 *     uq_leiloes_rodada_ordem, dezenas de linhas);
 *   - pedidos por leilao_id (idx_pedidos_leilao) e, so para o pedido_id de
 *     lote que nao voltou assim, por id; sempre da loja, em blocos de 50
 *     (URL curta, sem .or() com a lista inteira).
 *   Nada toca pokemon_cards.
 * ★ Nunca sai: lider_maximo_cents, user_id de ninguem, nome/e-mail/endereco
 *   do comprador. O lider aparece so pelo apelido mascarado ("j***a"), com a
 *   mesma regra do SQL leilao_mascarar.
 * ★ FECHAMENTO PREGUICOSO igual ao GET /api/leiloes/[id]/estado: lote `ativo`
 *   vencido ha 1s ou mais chama leilao_fechar_lote antes de responder (o
 *   proprio SQL abre o proximo lote e encerra a rodada no ultimo). Depois de
 *   fechar, rele rodada e lotes.
 */

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; rodadaId: string }> }
type Linha = Record<string, unknown>

/** Mesma folga do SQL: so fecha quando termina_em <= now() - 1s. */
const FOLGA_FECHAR_MS = 1000

/** Tamanho de cada `.in()` (mantem a URL do PostgREST curta). */
const BLOCO_IN = 50

const COLUNAS_PEDIDO = 'id, numero, status, created_at, leilao_id'

function blocos<T>(xs: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}

/** Pedidos da loja com `coluna` em `valores`, em blocos de BLOCO_IN. Falha de um bloco lanca. */
async function pedidosPor(sb: SupabaseClient, lojaId: string, coluna: 'leilao_id' | 'id', valores: string[]) {
  const res = await Promise.all(blocos(valores, BLOCO_IN).map(b =>
    sb.from('pedidos').select(COLUNAS_PEDIDO).eq('loja_id', lojaId).in(coluna, b).limit(500)))
  const out: PedidoResumo[] = []
  for (const r of res) {
    if (r.error) throw new Error(`pedidos por ${coluna}: ${r.error.code} ${r.error.message}`)
    out.push(...((r.data ?? []) as PedidoResumo[]))
  }
  return out
}

const COLUNAS_RODADA = 'id, numero, titulo, status, inicia_em, link_transmissao'

/** ★ NUNCA lider_maximo_cents. lider_user_id so para o embed do apelido; nao e serializado. */
const COLUNAS_LOTE = [
  'id', 'codigo', 'slug', 'ordem', 'card_name', 'card_numero', 'set_nome', 'card_image', 'fotos',
  'graduadora', 'nota', 'lance_inicial_cents', 'preco_atual_cents', 'n_lances', 'duracao_seg',
  'inicia_em', 'termina_em', 'status', 'encerrado_em', 'pagar_ate', 'pedido_id', 'cancelado_motivo',
  'lider_user_id', 'lider:users!leiloes_lider_user_id_fkey(username, name)',
].join(', ')

async function ler(sb: SupabaseClient, lojaId: string, rodadaId: string) {
  const [r, l] = await Promise.all([
    sb.from('leilao_rodadas').select(COLUNAS_RODADA).eq('id', rodadaId).eq('loja_id', lojaId).limit(1),
    sb.from('leiloes').select(COLUNAS_LOTE)
      .eq('rodada_id', rodadaId).eq('loja_id', lojaId)
      .order('ordem', { ascending: true }).limit(200),
  ])
  if (r.error) throw new Error(`rodada: ${r.error.message}`)
  if (l.error) throw new Error(`lotes: ${l.error.message}`)
  return {
    rodada: (r.data?.[0] as unknown as Linha | undefined) ?? null,
    lotes: (l.data ?? []) as unknown as Linha[],
  }
}

function vencido(l: Linha, agora: number): boolean {
  const fim = typeof l.termina_em === 'string' ? Date.parse(l.termina_em) : NaN
  return l.status === 'ativo' && Number.isFinite(fim) && fim <= agora - FOLGA_FECHAR_MS
}

function apelido(l: Linha): string | null {
  if (!l.lider_user_id) return null
  const u = (Array.isArray(l.lider) ? l.lider[0] : l.lider) as { username?: unknown; name?: unknown } | null | undefined
  const username = typeof u?.username === 'string' ? u.username.trim() : ''
  return mascararApelido(username || (typeof u?.name === 'string' ? u.name : ''))
}

export async function GET(req: NextRequest, ctx: Params) {
  try {
    const { id: lojaId, rodadaId } = await ctx.params
    const c = await contextoPainel(req, lojaId)
    if (!c.ok) return c.res
    if (!UUID_RE.test(rodadaId)) return json(404, { error: 'Rodada não encontrada.' })

    let { rodada, lotes } = await ler(c.sb, lojaId, rodadaId)
    if (!rodada) return json(404, { error: 'Rodada não encontrada.' })

    // Fechamento preguicoso (normalmente no maximo um lote ativo por rodada).
    const agora = Date.now()
    const vencidos = lotes.filter(l => vencido(l, agora)).map(l => String(l.id))
    if (vencidos.length > 0) {
      let fechou = false
      for (const id of vencidos) {
        const r = await c.sb.rpc('leilao_fechar_lote', { p_leilao: id })
        if (r.error) console.error('[lojas/leiloes/ao-vivo] fechar', id, r.error.code, r.error.message)
        else if (r.data) fechou = true
      }
      if (fechou) {
        ;({ rodada, lotes } = await ler(c.sb, lojaId, rodadaId))
        if (!rodada) return json(404, { error: 'Rodada não encontrada.' })
      }
    }

    // Pedidos dos lotes (so os da loja).
    const ids = lotes.map(l => String(l.id))
    const pedidoIds = lotes.map(l => l.pedido_id).filter((x): x is string => typeof x === 'string' && UUID_RE.test(x))
    let pedidos: PedidoResumo[] = []
    if (ids.length > 0) {
      try {
        const porLeilao = await pedidosPor(c.sb, lojaId, 'leilao_id', ids)
        const vistos = new Set(porLeilao.map(p => p.id))
        const faltam = [...new Set(pedidoIds)].filter(id => !vistos.has(id))
        const porId = faltam.length > 0 ? await pedidosPor(c.sb, lojaId, 'id', faltam) : []
        pedidos = [...porLeilao, ...porId.filter(p => !vistos.has(p.id))]
      } catch (e) {
        // Sem pedidos a tela ainda mostra o lote; so o link falta.
        console.error('[lojas/leiloes/ao-vivo]', (e as Error).message)
      }
    }

    const saida = lotes.map(l => {
      // user_id e embed do lider so servem para o apelido: nao saem daqui.
      const resto: Linha = { ...l }
      delete resto.lider_user_id
      delete resto.lider
      delete resto.pedido_id
      const p = pedidoDoLote(String(l.id), typeof l.pedido_id === 'string' ? l.pedido_id : null, pedidos)
      return {
        ...resto,
        lider_apelido: apelido(l),
        pedido: p ? { id: p.id, numero: p.numero, status: p.status } : null,
      }
    })

    return json(200, { server_now: new Date().toISOString(), rodada, lotes: saida })
  } catch (err) {
    console.error('[lojas/leiloes/ao-vivo] erro:', (err as Error)?.message)
    return json(500, { error: 'Erro ao carregar a rodada.' })
  }
}
