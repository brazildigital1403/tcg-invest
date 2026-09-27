import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { lotePublicoDeLinha, mascararApelido, type EstadoLote } from '@/lib/leilao'

/**
 * GET /api/leiloes/[id]/estado
 * Authorization: Bearer <token> (opcional)
 *
 * Estado vivo de um lote para o relogio e o placar da tela. Sem cache em
 * nenhuma camada: o valor muda a cada lance, a resposta muda por usuario, e o
 * `server_now` e o que a tela usa para acertar o proprio relogio.
 *
 * UMA LEITURA POR PK: le `leiloes` com service role, colunas explicitas (nunca
 * `lider_maximo_cents`), trazendo `lider_user_id`, `vendedor_user_id` e o nome
 * do lider (embed pelo FK) no MESMO statement. Assim `voceLidera` e o preco
 * saem da mesma foto da linha — duas leituras podiam cair uma de cada lado de
 * um lance. Os dois user_id so servem para comparar aqui: nao sao serializados.
 * O apelido e mascarado com a mesma regra do SQL `leilao_mascarar`.
 *
 * FECHAMENTO PREGUICOSO: se a leitura mostra lote `ativo` com `termina_em`
 * vencido ha pelo menos 1s, chama `leilao_fechar_lote(id)` antes de responder,
 * para a tela nao esperar o proximo tick do pg_cron. A folga de 1s e a mesma
 * do SQL (lance aceito no ultimo instante nao pode ser atropelado pelo fecho).
 * A funcao so tem EXECUTE para service_role e usa `for update skip locked`.
 *
 * QUEM E O USUARIO: com Bearer, le o PROPRIO teto em `leilao_proxy` com o
 * client do usuario (a RLS so devolve a linha dele). Essa leitura tambem prova
 * o token: o PostgREST valida a assinatura do JWT e responde 401 se ele for
 * falso ou vencido. So com a leitura sem erro o `sub` do token e usado para
 * `voceLidera` e `proprio`. Nunca sai daqui o teto de outra pessoa nem user_id.
 */

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const semCache = { 'Cache-Control': 'no-store, max-age=0', Vary: 'Authorization' }
/** Mesma folga do SQL: so fecha quando termina_em <= now() - 1s. */
const FOLGA_FECHAR_MS = 1000

type Linha = Record<string, unknown>

/**
 * Colunas publicas (as mesmas de `leiloes_publico`, menos o apelido calculado)
 * + os dois user_id de comparacao + o nome do lider pelo FK.
 * ★ NUNCA incluir `lider_maximo_cents` aqui.
 */
const COLUNAS_LOTE = [
  'id', 'codigo', 'slug', 'rodada_id', 'ordem', 'loja_id',
  'card_id', 'card_slug', 'card_name', 'card_numero', 'set_nome', 'card_image', 'fotos',
  'condicao', 'idioma', 'graduadora', 'nota', 'descricao',
  'lance_inicial_cents', 'preco_atual_cents',
  'n_lances', 'n_participantes', 'duracao_seg', 'soft_close_seg',
  'inicia_em', 'termina_em', 'prorrogacoes', 'status', 'encerrado_em', 'versao', 'game',
  'lider_user_id', 'vendedor_user_id',
  'lider:users!leiloes_lider_user_id_fkey(username, name)',
].join(', ')

async function lerLote(db: SupabaseClient, id: string) {
  return db.from('leiloes').select(COLUNAS_LOTE).eq('id', id).neq('status', 'rascunho').maybeSingle()
}

/** Separa o que sai (linha publica) do que so serve para comparar. */
function separar(r: Linha): { publica: Linha; liderUserId: string | null; vendedorUserId: string | null } {
  const { lider_user_id, vendedor_user_id, lider, ...resto } = r
  const u = (Array.isArray(lider) ? lider[0] : lider) as { username?: unknown; name?: unknown } | null | undefined
  const username = typeof u?.username === 'string' ? u.username.trim() : ''
  const nome = username || (typeof u?.name === 'string' ? u.name : '')
  return {
    publica: { ...resto, lider_apelido: lider_user_id ? mascararApelido(nome) : null },
    liderUserId: typeof lider_user_id === 'string' ? lider_user_id : null,
    vendedorUserId: typeof vendedor_user_id === 'string' ? vendedor_user_id : null,
  }
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

interface Eu {
  userId: string
  /** Meu teto em leilao_proxy; null = nunca dei lance neste lote. */
  maximoCents: number | null
}

/** O usuario do token (validado pelo PostgREST) e o proprio teto, pela RLS. null sem token ou token invalido. */
async function lerEu(token: string | null, id: string): Promise<Eu | null> {
  if (!token) return null
  const userId = subDoToken(token)
  if (!userId) return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  const sb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await sb
    .from('leilao_proxy')
    .select('user_id, maximo_cents')
    .eq('leilao_id', id)
    .maybeSingle()
  // 401 (token vencido/falso) ou qualquer falha: trata como visitante, a tela segue.
  if (error) return null
  if (!data) return { userId, maximoCents: null }
  if (data.user_id !== userId) return null
  const maximoCents = Number(data.maximo_cents)
  return { userId, maximoCents: Number.isFinite(maximoCents) ? maximoCents : null }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })

  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ erro: 'nao_encontrado' }, { status: 404, headers: semCache })
  }

  const db = getServiceSupabase()
  if (!db) return NextResponse.json({ erro: 'config' }, { status: 500, headers: semCache })

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || null

  const [lido, eu] = await Promise.all([lerLote(db, id), lerEu(token, id)])
  let { data, error } = lido

  // Fechamento preguicoso: so quando a leitura mostra o lote vencido ha 1s ou mais.
  if (!error && data) {
    const r = data as unknown as Linha
    const fim = typeof r.termina_em === 'string' ? Date.parse(r.termina_em) : NaN
    if (r.status === 'ativo' && Number.isFinite(fim) && fim <= Date.now() - FOLGA_FECHAR_MS) {
      const fechou = await db.rpc('leilao_fechar_lote', { p_leilao: id })
      if (fechou.error) {
        console.error('[leilao/estado] fechar', id, fechou.error.code, fechou.error.message)
      } else if (fechou.data) {
        ;({ data, error } = await lerLote(db, id))
      }
    }
  }

  const serverNow = new Date().toISOString()

  if (error) {
    console.error('[leilao/estado]', id, error.code, error.message)
    return NextResponse.json({ erro: 'falha', server_now: serverNow }, { status: 500, headers: semCache })
  }
  if (!data) {
    return NextResponse.json({ erro: 'nao_encontrado', server_now: serverNow }, { status: 404, headers: semCache })
  }

  const { publica, liderUserId, vendedorUserId } = separar(data as unknown as Linha)

  const corpo: EstadoLote = {
    lote: lotePublicoDeLinha(publica),
    server_now: serverNow,
    voceLidera: !!eu && !!liderUserId && liderUserId === eu.userId,
    seuMaximoCents: eu?.maximoCents ?? null,
    proprio: !!eu && !!vendedorUserId && vendedorUserId === eu.userId,
  }
  return NextResponse.json(corpo, { headers: semCache })
}
