import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { lotePublicoDeLinha, type EstadoLote } from '@/lib/leilao'

/**
 * GET /api/leiloes/[id]/estado
 * Authorization: Bearer <token> (opcional)
 *
 * Estado vivo de um lote para o relogio e o placar da tela. Leitura por PK da
 * view `leiloes_publico` (sem o teto oculto do lider, apelido ja mascarado).
 * Sem cache em nenhuma camada: o valor muda a cada lance, a resposta muda por
 * usuario, e o `server_now` e o que a tela usa para acertar o proprio relogio.
 *
 * FECHAMENTO PREGUICOSO: se a leitura mostra lote `ativo` com `termina_em` ja
 * vencido, chama `leilao_fechar_lote(id)` antes de responder, para a tela nao
 * esperar o proximo tick do pg_cron. A funcao so tem EXECUTE para service_role
 * e usa `for update skip locked` (lance segurando a linha = o tick fecha
 * depois). So roda nesse caso: o caminho normal e uma leitura por PK.
 *
 * QUEM LIDERA: com Bearer, le o PROPRIO teto em `leilao_proxy` com o client do
 * usuario (a RLS so devolve a linha dele: user_id = auth.uid(); o PostgREST
 * valida o JWT sem ida ao servidor de auth). Se ha linha, compara com
 * `leiloes.lider_user_id` lido por PK com service role. Nunca sai daqui o teto
 * de outra pessoa nem o user_id do lider.
 */

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const semCache = { 'Cache-Control': 'no-store, max-age=0', Vary: 'Authorization' }

type Linha = Record<string, unknown>

async function lerLote(db: SupabaseClient, id: string) {
  return db.from('leiloes_publico').select('*').eq('id', id).neq('status', 'rascunho').maybeSingle()
}

/** O proprio teto do usuario do token, pela RLS. null sem token, sem lance ou token vencido. */
async function lerMeuTeto(token: string | null, id: string): Promise<{ userId: string; maximoCents: number } | null> {
  if (!token) return null
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
  // 401 (token vencido) ou qualquer falha: trata como visitante, a tela segue.
  if (error || !data) return null
  const userId = typeof data.user_id === 'string' ? data.user_id : null
  const maximoCents = Number(data.maximo_cents)
  return userId && Number.isFinite(maximoCents) ? { userId, maximoCents } : null
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

  const [lido, meuTeto] = await Promise.all([lerLote(db, id), lerMeuTeto(token, id)])
  let { data, error } = lido

  // Fechamento preguicoso: so quando a leitura ja mostra o lote vencido.
  if (!error && data) {
    const r = data as Linha
    const fim = typeof r.termina_em === 'string' ? Date.parse(r.termina_em) : NaN
    if (r.status === 'ativo' && Number.isFinite(fim) && fim <= Date.now()) {
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

  let voceLidera = false
  if (meuTeto) {
    const { data: lider, error: eLider } = await db
      .from('leiloes')
      .select('lider_user_id')
      .eq('id', id)
      .maybeSingle()
    if (eLider) console.error('[leilao/estado] lider', id, eLider.code, eLider.message)
    voceLidera = !!lider && (lider as Linha).lider_user_id === meuTeto.userId
  }

  const corpo: EstadoLote = {
    lote: lotePublicoDeLinha(data as Linha),
    server_now: serverNow,
    voceLidera,
    seuMaximoCents: meuTeto?.maximoCents ?? null,
  }
  return NextResponse.json(corpo, { headers: semCache })
}
