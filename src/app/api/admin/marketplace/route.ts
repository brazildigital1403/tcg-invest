import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// Lista anúncios do marketplace pro painel admin.
// Query string:
//   ?view=ativos|removidos  (default: ativos)
//   ?q=texto                (busca em card_name por ilike)
//
// Retorna anúncios já hidratados com dados do vendedor (name, email, city)
// e nome de quem removeu (caso aplicável).

export async function GET(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') === 'removidos' ? 'removidos' : 'ativos'
    const q    = searchParams.get('q')?.trim()

    const sb = supabaseAdmin()

    let query = sb
      .from('marketplace')
      .select('id, user_id, card_id, card_name, card_image, card_link, price, variante, condicao, descricao, status, buyer_id, created_at, removido_em, removido_motivo, removido_por')
      .order('created_at', { ascending: false })
      .limit(300)

    if (view === 'ativos') {
      query = query.is('removido_em', null)
    } else {
      query = query.not('removido_em', 'is', null)
    }

    if (q) {
      query = query.ilike('card_name', `%${q}%`)
    }

    const { data: anuncios, error } = await query
    if (error) {
      console.error('[admin/marketplace GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Hidrata vendedores e quem removeu (1 query batch combinando os dois)
    const userIds = [
      ...new Set([
        ...(anuncios || []).map(a => a.user_id).filter(Boolean),
        ...(anuncios || []).map(a => a.removido_por).filter(Boolean),
      ]),
    ] as string[]

    const userMap: Record<string, { email: string; name: string; city: string | null }> = {}
    if (userIds.length > 0) {
      const { data: users } = await sb
        .from('users')
        .select('id, email, name, city')
        .in('id', userIds)
      for (const u of users || []) {
        userMap[u.id] = { email: u.email, name: u.name || '', city: u.city }
      }
    }

    const enriched = (anuncios || []).map(a => ({
      ...a,
      seller_email: userMap[a.user_id!]?.email || null,
      seller_name:  userMap[a.user_id!]?.name  || null,
      seller_city:  userMap[a.user_id!]?.city  || null,
      removido_por_nome: a.removido_por ? (userMap[a.removido_por]?.name || userMap[a.removido_por]?.email || null) : null,
    }))

    return NextResponse.json({ anuncios: enriched })
  } catch (err: any) {
    console.error('[admin/marketplace GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
