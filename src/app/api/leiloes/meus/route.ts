import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { lotePublicoDeLinha, type LotePublico } from '@/lib/leilao'
import { agruparMeus, emBlocos, type EntradaMeu } from '@/lib/leilao-meus'

/**
 * GET /api/leiloes/meus
 * Authorization: Bearer <token> (obrigatorio)
 *
 * Os lotes em que o usuario tem teto, agrupados (src/lib/leilao-meus.ts).
 * Sem cache em nenhuma camada: a resposta e por pessoa e muda a cada lance.
 *
 * 1. TETOS: `leilao_proxy` com o client DO USUARIO. A RLS so devolve as linhas
 *    dele, e essa leitura prova o token (PostgREST responde 401 a JWT falso ou
 *    vencido). So depois disso o `sub` do token e usado.
 * 2. LOTES: `leiloes_publico` por id in (...) em blocos de 50 (service role;
 *    a view ja tira o teto do lider e o rascunho).
 * 3. QUEM LIDERA + PRAZO: `leiloes` por PK com service role, so lider_user_id,
 *    pagar_ate e pedido_id. Os user_id so servem para comparar aqui: nao saem.
 *    pagar_ate/pedido_id so saem para QUEM VENCEU.
 * 4. PAGO SEM LOTE MARCADO: para os arremates ainda em aguardando_pagamento,
 *    pedido pago do proprio comprador pelo idx_pedidos_leilao (o webhook pode
 *    ter pago e nao marcado o lote). Mesmo criterio de pago do checkout.
 *
 * Nunca sai daqui o teto de outra pessoa nem user_id de ninguem.
 * Tudo por PK ou indice; nada toca tabela de catalogo.
 */

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const semCache = { 'Cache-Control': 'no-store, max-age=0', Vary: 'Authorization' }
/** Teto de lotes lidos por chamada (os mais recentes primeiro). */
const MAX_LOTES = 200
const STATUS_PAGO = ['pago', 'enviado', 'entregue']

const COLUNAS_PUBLICAS = [
  'id', 'codigo', 'slug', 'rodada_id', 'ordem', 'loja_id',
  'card_id', 'card_slug', 'card_name', 'card_numero', 'set_nome', 'card_image', 'fotos',
  'condicao', 'idioma', 'graduadora', 'nota', 'descricao',
  'lance_inicial_cents', 'preco_atual_cents', 'lider_apelido',
  'n_lances', 'n_participantes', 'duracao_seg', 'soft_close_seg',
  'inicia_em', 'termina_em', 'prorrogacoes', 'status', 'encerrado_em', 'versao', 'game',
].join(', ')

function resposta(status: number, corpo: unknown) {
  return NextResponse.json(corpo, { status, headers: semCache })
}

/** `sub` do JWT, sem verificar. So vale depois que o PostgREST aceitou o token. */
function subDoToken(token: string): string | null {
  try {
    const parte = token.split('.')[1]
    if (!parte) return null
    const json = JSON.parse(Buffer.from(parte.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    return typeof json?.sub === 'string' && UUID_RE.test(json.sub) ? json.sub : null
  } catch {
    return null
  }
}

type Teto = { leilaoId: string; maximoCents: number }
type Privado = { liderUserId: string | null; pagarAte: string | null; pedidoId: string | null }

/** Tetos do usuario pela RLS. null = token recusado. */
async function lerTetos(token: string, userId: string): Promise<Teto[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('config')
  const sb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error, status } = await sb
    .from('leilao_proxy')
    .select('leilao_id, user_id, maximo_cents')
    .order('atualizado_em', { ascending: false })
    .limit(MAX_LOTES)
  if (error) {
    if (status === 401 || /^PGRST30\d$/.test(error.code ?? '') || /\bjwt\b/i.test(error.message)) return null
    throw new Error(`proxy: ${error.code} ${error.message}`)
  }
  const out: Teto[] = []
  for (const r of (data ?? []) as Array<{ leilao_id: string; user_id: string; maximo_cents: unknown }>) {
    // A RLS ja filtra; a checagem e cinto e suspensorio.
    if (r.user_id !== userId) continue
    const m = Number(r.maximo_cents)
    if (Number.isFinite(m)) out.push({ leilaoId: r.leilao_id, maximoCents: m })
  }
  return out
}

async function lerPublicos(db: SupabaseClient, ids: string[]): Promise<Map<string, LotePublico>> {
  const mapa = new Map<string, LotePublico>()
  const partes = await Promise.all(
    emBlocos(ids, 50).map(bloco => db.from('leiloes_publico').select(COLUNAS_PUBLICAS).in('id', bloco))
  )
  for (const { data, error } of partes) {
    if (error) throw new Error(`leiloes_publico: ${error.code} ${error.message}`)
    for (const r of (data ?? []) as unknown as Record<string, unknown>[]) {
      const l = lotePublicoDeLinha(r)
      mapa.set(l.id, l)
    }
  }
  return mapa
}

async function lerPrivados(db: SupabaseClient, ids: string[]): Promise<Map<string, Privado>> {
  const mapa = new Map<string, Privado>()
  const partes = await Promise.all(
    emBlocos(ids, 50).map(bloco =>
      db.from('leiloes').select('id, lider_user_id, pagar_ate, pedido_id').in('id', bloco)
    )
  )
  for (const { data, error } of partes) {
    if (error) throw new Error(`leiloes: ${error.code} ${error.message}`)
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      mapa.set(String(r.id), {
        liderUserId: typeof r.lider_user_id === 'string' ? r.lider_user_id : null,
        pagarAte: typeof r.pagar_ate === 'string' ? r.pagar_ate : null,
        pedidoId: typeof r.pedido_id === 'string' ? r.pedido_id : null,
      })
    }
  }
  return mapa
}

/** leilao_id -> id de pedido PAGO do proprio comprador. */
async function lerPagos(db: SupabaseClient, ids: string[], userId: string): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  if (!ids.length) return mapa
  const partes = await Promise.all(
    emBlocos(ids, 50).map(bloco =>
      db
        .from('pedidos')
        .select('id, leilao_id, pago_em, status')
        .in('leilao_id', bloco)
        .eq('comprador_user_id', userId)
    )
  )
  for (const { data, error } of partes) {
    if (error) throw new Error(`pedidos: ${error.code} ${error.message}`)
    for (const p of (data ?? []) as Array<{ id: string; leilao_id: string; pago_em: string | null; status: string }>) {
      if (p.pago_em != null || STATUS_PAGO.includes(p.status)) mapa.set(p.leilao_id, p.id)
    }
  }
  return mapa
}

export async function GET(req: NextRequest) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || null
  const userId = token ? subDoToken(token) : null
  if (!token || !userId) return resposta(401, { erro: 'nao_autenticado' })

  const db = getServiceSupabase()
  if (!db) return resposta(500, { erro: 'config' })

  try {
    const tetos = await lerTetos(token, userId)
    if (!tetos) return resposta(401, { erro: 'nao_autenticado' })
    if (!tetos.length) return resposta(200, agruparMeus([], new Date().toISOString()))

    const ids = tetos.map(t => t.leilaoId)
    const [publicos, privados] = await Promise.all([lerPublicos(db, ids), lerPrivados(db, ids)])

    const aConferir = ids.filter(id => {
      const l = publicos.get(id)
      return l?.status === 'aguardando_pagamento' && privados.get(id)?.liderUserId === userId
    })
    const pagos = await lerPagos(db, aConferir, userId)

    const entradas: EntradaMeu[] = []
    for (const t of tetos) {
      const lote = publicos.get(t.leilaoId)
      if (!lote) continue
      const priv = privados.get(t.leilaoId)
      const voceLidera = !!priv?.liderUserId && priv.liderUserId === userId
      entradas.push({
        lote,
        seuMaximoCents: t.maximoCents,
        voceLidera,
        // Prazo e pedido so para quem venceu.
        pagarAte: voceLidera ? priv?.pagarAte ?? null : null,
        pedidoId: voceLidera ? priv?.pedidoId ?? null : null,
        pedidoPagoId: voceLidera ? pagos.get(t.leilaoId) ?? null : null,
      })
    }

    return resposta(200, agruparMeus(entradas, new Date().toISOString()))
  } catch (e) {
    console.error('[leilao/meus]', (e as Error)?.message)
    return resposta(500, { erro: 'falha' })
  }
}
