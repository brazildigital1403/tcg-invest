import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminToken, ADMIN_COOKIE } from '@/lib/admin-auth'

/**
 * GET /api/admin/lojas/[id]
 *
 * Retorna os dados completos de uma loja, sem filtro de status nem ownership.
 * Usado pela página `/admin/lojas/[id]/editar` pra preencher o FormLoja.
 *
 * Auth: cookie `bynx_admin` (HMAC).
 *
 * Retornos:
 *   - 200 → { loja: {...} }
 *   - 401 → não admin
 *   - 404 → loja não encontrada
 *   - 500 → erro interno
 */

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    // ─── Auth admin ────────────────────────────────────────
    const token = req.cookies.get(ADMIN_COOKIE)?.value
    const isAdmin = await verifyAdminToken(token)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id: lojaId } = await ctx.params

    // ─── Busca loja completa ───────────────────────────────
    const sb = supabaseAdmin()
    const { data: lojas, error: lojaErr } = await sb
      .from('lojas')
      .select('*')
      .eq('id', lojaId)
      .limit(1)

    if (lojaErr) {
      console.error('[admin/lojas/[id] GET] erro ao buscar loja', lojaErr)
      return NextResponse.json({ error: 'Erro ao buscar loja' }, { status: 500 })
    }

    const loja = lojas?.[0]
    if (!loja) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
    }

    // ─── Busca dados do owner (pra mostrar quem é o dono no banner) ─
    let owner: { id: string; email: string; name: string | null } | null = null
    if (loja.owner_user_id) {
      const { data: owners } = await sb
        .from('users')
        .select('id, email, name')
        .eq('id', loja.owner_user_id)
        .limit(1)
      owner = owners?.[0] || null
    }

    return NextResponse.json({ loja, owner })

  } catch (err: any) {
    console.error('[admin/lojas/[id] GET] erro inesperado', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
