import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/lojas/[id]/track-click
 *
 * Registra um clique nos CTAs da página pública da loja (WhatsApp, Instagram,
 * Facebook, Website ou Maps). Usado pela feature "Analytics do Premium".
 *
 * AUTH: Pública (SEM Bearer token). Aceita cliques anônimos porque a página
 * de loja é pública. Se o user estiver logado, pegamos o user_id opcional
 * do header x-user-id (setado pelo frontend).
 *
 * Body JSON:
 *   { tipo: 'whatsapp' | 'instagram' | 'facebook' | 'website' | 'maps' }
 *
 * Retornos:
 *   201 → { success: true }
 *   400 → body inválido / tipo inválido
 *   404 → loja não encontrada ou não está ativa
 *   500 → erro interno (silenciado no frontend — nunca bloquear UX)
 *
 * O frontend deve chamar esse endpoint com `navigator.sendBeacon` ou
 * `fetch` com `keepalive: true` pra não bloquear a abertura do link externo.
 */

const TIPOS_VALIDOS = ['whatsapp', 'instagram', 'facebook', 'website', 'maps'] as const
type TipoClique = typeof TIPOS_VALIDOS[number]

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params

    // ─── Body ──────────────────────────────────────────────
    let body: Record<string, any>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
    }

    const tipo = String(body.tipo || '').toLowerCase().trim() as TipoClique
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({
        error: `Tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}`,
      }, { status: 400 })
    }

    const sb = supabaseAdmin()

    // ─── Valida que a loja existe e está ativa ─────────────
    const { data: lojas, error: lojaErr } = await sb
      .from('lojas')
      .select('id, status')
      .eq('id', lojaId)
      .limit(1)

    if (lojaErr) {
      console.error('[api/lojas/[id]/track-click] erro ao buscar loja', lojaErr)
      return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }

    const loja = lojas?.[0]
    if (!loja || loja.status !== 'ativa') {
      return NextResponse.json({ error: 'Loja não encontrada ou inativa' }, { status: 404 })
    }

    // ─── Extrai metadados opcionais ────────────────────────
    const userAgent = req.headers.get('user-agent') || null
    const referrer  = req.headers.get('referer')    || null
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      null

    // user_id opcional — pode vir do frontend se estiver logado
    // (não validamos o token aqui pra manter endpoint leve/rápido)
    const userIdHeader = req.headers.get('x-user-id')
    const userId = userIdHeader && userIdHeader.length === 36 ? userIdHeader : null

    // ─── Insert ────────────────────────────────────────────
    const { error: insertErr } = await sb.from('loja_cliques').insert({
      loja_id: lojaId,
      tipo,
      user_id: userId,
      user_agent: userAgent,
      referrer,
      ip,
    })

    if (insertErr) {
      console.error('[api/lojas/[id]/track-click] erro ao inserir', insertErr)
      return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })

  } catch (err: any) {
    console.error('[api/lojas/[id]/track-click] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}