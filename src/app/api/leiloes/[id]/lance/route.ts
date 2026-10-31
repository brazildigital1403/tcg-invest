import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { erroDoLance, lanceResultadoDeJson } from '@/lib/leilao'

/**
 * POST /api/leiloes/[id]/lance
 * body: { maximoCents: int, idem: uuid, vistoCents?: int }
 *
 * `vistoCents` (opcional) = lance minimo que a tela mostrava ao confirmar. So
 * serve para a mensagem de abaixo_minimo: minimo do banco maior que o visto =
 * outro lance chegou primeiro; igual = o valor digitado ficou abaixo.
 *
 * Exige login (Bearer). Chama o RPC `dar_lance` com o client DO USUARIO: o
 * banco resolve auth.uid(), trava a linha, aplica incremento, lance automatico
 * e soft close. Esta rota nao decide nada de regra, so valida o formato e
 * traduz o erro do banco em mensagem de tela.
 *
 * `idem` e gerado pela tela a cada clique: se a rede reenviar, o banco devolve
 * o mesmo resultado em vez de registrar dois lances.
 */

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Teto de sanidade do formulario: R$ 1.000.000,00. */
const MAXIMO_CENTS_TETO = 100_000_000

const semCache = { 'Cache-Control': 'no-store' }

function erro(status: number, codigo: string, mensagem: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, erro: codigo, mensagem, ...extra }, { status, headers: semCache })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })

  const { id } = await ctx.params
  if (!UUID_RE.test(id)) return erro(404, 'nao_encontrado', 'Lote não encontrado.')

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return erro(401, 'nao_autenticado', 'Entre na sua conta para dar lances.')

  let bruto: unknown
  try {
    bruto = await req.json()
  } catch {
    return erro(400, 'corpo_invalido', 'Pedido inválido.')
  }
  // `null`, numero, string ou array sao JSON valido, mas nao sao o corpo esperado.
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) {
    return erro(400, 'corpo_invalido', 'Pedido inválido.')
  }
  const body = bruto as { maximoCents?: unknown; idem?: unknown; vistoCents?: unknown }

  const maximoCents = body.maximoCents
  if (
    typeof maximoCents !== 'number' ||
    !Number.isInteger(maximoCents) ||
    maximoCents < 100 ||
    maximoCents > MAXIMO_CENTS_TETO
  ) {
    return erro(400, 'valor_invalido', 'Informe um valor de lance válido.')
  }
  const idem = typeof body.idem === 'string' ? body.idem : ''
  if (!UUID_RE.test(idem)) return erro(400, 'idem_invalido', 'Pedido inválido. Atualize a página e tente de novo.')
  const vistoCents =
    typeof body.vistoCents === 'number' && Number.isInteger(body.vistoCents) && body.vistoCents > 0
      ? body.vistoCents
      : null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return erro(500, 'config', 'Não foi possível registrar o lance. Tente de novo.')

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data, error, status } = await supabase.rpc('dar_lance', {
    p_leilao: id,
    p_maximo_cents: maximoCents,
    p_idem: idem,
  })

  if (error) {
    // unique_violation: a mesma chave `idem` ja foi usada em outro lote/valor.
    // E erro do pedido, nao do servidor: 400, e a tela gera chave nova.
    if (error.code === '23505') {
      return erro(400, 'idem_invalido', 'Pedido inválido. Atualize a página e tente de novo.')
    }
    const e = erroDoLance(`${error.message ?? ''} ${error.details ?? ''}`, {
      vistoCents,
      httpStatus: status,
      pgCode: error.code,
    })
    if (e.codigo === 'desconhecido' || e.codigo === 'lote_ocupado') {
      console.error('[leilao/lance] rpc', id, error.code, error.message)
    }
    return erro(e.status, e.codigo, e.mensagem, e.minimoCents != null ? { minimoCents: e.minimoCents } : undefined)
  }

  if (!data || typeof data !== 'object') {
    console.error('[leilao/lance] retorno vazio', id)
    return erro(500, 'desconhecido', 'Não foi possível registrar o lance. Tente de novo.')
  }

  return NextResponse.json(lanceResultadoDeJson(data as Record<string, unknown>), { headers: semCache })
}
