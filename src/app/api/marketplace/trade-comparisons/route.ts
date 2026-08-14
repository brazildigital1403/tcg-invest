import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'

/**
 * /api/marketplace/trade-comparisons — Fase 2 do Comparador (feed "comparado
 * agora pela comunidade"). Tabela trancada de proposito (RLS ligada, zero
 * policy) -- so essas rotas (service_role) leem/escrevem. O client nunca fala
 * direto com `trade_comparisons`, entao user_id de quem pediu anonimato nunca
 * vaza, mesmo que alguem inspecione a rede.
 *
 * GET: ultimas comparacoes publicadas + contagem da semana. Se a query falhar
 * (ou a tabela ainda nao existir), devolve disponivel:false em vez de lancar
 * -- o feed cai no fallback de exemplos rotulados, nunca fica em branco sem
 * explicacao nem finge que tem zero atividade.
 * POST: publica uma comparacao (opt-in explicito, nunca automatico).
 */

const VEREDITOS = new Set(['equilibrada', 'desequilibrada', 'muito_desequilibrada'])

export async function GET() {
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ disponivel: false, itens: [], contagemSemana: 0 })

  try {
    const desde = new Date(Date.now() - 7 * 86400000).toISOString()

    const [{ data: itens, error: e1 }, { count, error: e2 }] = await Promise.all([
      sb.from('trade_comparisons')
        .select('id, user_id, mostrar_usuario, lado_a, lado_b, total_a, total_b, pct, veredito, created_at')
        .order('created_at', { ascending: false })
        .limit(12),
      sb.from('trade_comparisons').select('id', { count: 'exact', head: true }).gte('created_at', desde),
    ])
    if (e1 || e2) throw e1 || e2

    const userIds = [...new Set((itens || []).filter(i => i.mostrar_usuario && i.user_id).map(i => i.user_id as string))]
    let nomeById: Record<string, string> = {}
    if (userIds.length) {
      const { data: perfis } = await sb.from('public_users').select('id, name, username').in('id', userIds)
      nomeById = Object.fromEntries((perfis || []).map(p => [p.id, p.username || p.name || 'colecionador']))
    }

    const publicos = (itens || []).map(i => ({
      id: i.id,
      autor: i.mostrar_usuario && i.user_id ? `@${nomeById[i.user_id] || 'colecionador'}` : 'Colecionador anônimo',
      ladoA: i.lado_a,
      ladoB: i.lado_b,
      totalA: Number(i.total_a),
      totalB: Number(i.total_b),
      pct: Number(i.pct),
      veredito: i.veredito,
      criadoEm: i.created_at,
    }))

    return NextResponse.json({ disponivel: true, itens: publicos, contagemSemana: count || 0 })
  } catch {
    return NextResponse.json({ disponivel: false, itens: [], contagemSemana: 0 })
  }
}

export async function POST(req: NextRequest) {
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })

  const body = await req.json().catch(() => null)
  const ladoA = Array.isArray(body?.ladoA) ? body.ladoA : null
  const ladoB = Array.isArray(body?.ladoB) ? body.ladoB : null
  const totalA = Number(body?.totalA)
  const totalB = Number(body?.totalB)
  const pct = Number(body?.pct)
  const veredito = body?.veredito

  if (!ladoA?.length || !ladoB?.length || ladoA.length > 10 || ladoB.length > 10) {
    return NextResponse.json({ error: 'Troca inválida — cada lado precisa de 1 a 10 cartas.' }, { status: 400 })
  }
  if (!Number.isFinite(totalA) || !Number.isFinite(totalB) || !Number.isFinite(pct) || !VEREDITOS.has(veredito)) {
    return NextResponse.json({ error: 'Dados da troca incompletos.' }, { status: 400 })
  }

  let userId: string | null = null
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (bearer) {
    const { data } = await sb.auth.getUser(bearer)
    userId = data?.user?.id ?? null
  }

  let mostrarUsuario = false
  if (userId && body?.mostrarUsuario) {
    const { data: perfil } = await sb.from('public_users').select('perfil_publico').eq('id', userId).maybeSingle()
    mostrarUsuario = !!perfil?.perfil_publico
  }

  const { error } = await sb.from('trade_comparisons').insert({
    user_id: userId,
    mostrar_usuario: mostrarUsuario,
    lado_a: ladoA,
    lado_b: ladoB,
    total_a: totalA,
    total_b: totalB,
    pct,
    veredito,
  })
  if (error) return NextResponse.json({ error: 'Não foi possível publicar agora.' }, { status: 500 })

  return NextResponse.json({ publicado: true })
}
