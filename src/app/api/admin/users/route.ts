import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// GET /api/admin/users?q=&page=1&perPage=50&filter=pro|trial|free|suspended
export async function GET(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { searchParams } = new URL(req.url)
    const q       = searchParams.get('q')?.trim().toLowerCase()
    const page    = Math.max(1, Number(searchParams.get('page')    || 1))
    const perPage = Math.min(100, Number(searchParams.get('perPage') || 50))
    const filter  = searchParams.get('filter')

    const sb = supabaseAdmin()
    const from = (page - 1) * perPage
    const to   = from + perPage - 1

    let query = sb
      .from('users')
      .select('id, email, name, username, city, whatsapp, is_pro, plano, trial_expires_at, pro_expira_em, scan_creditos, suspended_at, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (q) {
      // S29 FIX (auditoria admin): sanitizar input pra evitar query injection.
      // Permite apenas alfanuméricos, espaço, ponto, @ (email), hífen, underscore.
      const safeQ = q.replace(/[^a-zA-Z0-9 @._\-\u00C0-\u017F]/g, '').trim().slice(0, 100)
      if (safeQ) {
        query = query.or(`email.ilike.%${safeQ}%,name.ilike.%${safeQ}%,username.ilike.%${safeQ}%`)
      }
    }

    const nowISO = new Date().toISOString()
    if (filter === 'pro') {
      query = query.eq('is_pro', true)
    } else if (filter === 'trial') {
      query = query.eq('is_pro', false).gt('trial_expires_at', nowISO)
    } else if (filter === 'free') {
      query = query.eq('is_pro', false).or(`trial_expires_at.is.null,trial_expires_at.lt.${nowISO}`)
    } else if (filter === 'suspended') {
      query = query.not('suspended_at', 'is', null)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[admin/users GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // S32: enriquecer com last_sign_in_at (auth.users via RPC) + coleção + anúncios ativos.
    // 3 queries paralelas — adicionam 1 round-trip total, sem N+1.
    const userIds = (data || []).map(u => u.id)

    const lastSignInMap = new Map<string, string | null>()
    const collectionMap = new Map<string, number>()
    const anuncioMap    = new Map<string, number>()

    if (userIds.length > 0) {
      const [authRes, cardsRes, adsRes] = await Promise.all([
        sb.rpc('admin_get_users_last_sign_in', { user_ids: userIds }),
        sb.from('user_cards')
          .select('user_id, quantity')
          .in('user_id', userIds),
        sb.from('marketplace')
          .select('user_id')
          .in('user_id', userIds)
          .eq('status', 'disponivel')
          .is('removido_em', null),
      ])

      for (const r of (authRes.data as Array<{ id: string; last_sign_in_at: string | null }>) || []) {
        lastSignInMap.set(r.id, r.last_sign_in_at)
      }
      for (const c of (cardsRes.data || []) as Array<{ user_id: string | null; quantity: number | null }>) {
        if (!c.user_id) continue
        collectionMap.set(c.user_id, (collectionMap.get(c.user_id) || 0) + (Number(c.quantity) || 0))
      }
      for (const a of (adsRes.data || []) as Array<{ user_id: string | null }>) {
        if (!a.user_id) continue
        anuncioMap.set(a.user_id, (anuncioMap.get(a.user_id) || 0) + 1)
      }
    }

    const now = Date.now()
    const users = (data || []).map(u => {
      const trialMs = u.trial_expires_at ? new Date(u.trial_expires_at).getTime() : 0
      const isTrial = !u.is_pro && trialMs > now
      return {
        ...u,
        display_name: u.name || null,
        plano_efetivo: u.is_pro ? 'pro' : isTrial ? 'trial' : 'free',
        trial_days_left: isTrial ? Math.ceil((trialMs - now) / 86_400_000) : 0,
        is_suspended: !!u.suspended_at,
        last_sign_in_at:  lastSignInMap.get(u.id) || null,
        collection_count: collectionMap.get(u.id) || 0,
        anuncios_count:   anuncioMap.get(u.id)    || 0,
      }
    })

    return NextResponse.json({
      users,
      total: count || 0,
      page,
      perPage,
      totalPages: count ? Math.ceil(count / perPage) : 1,
    })
  } catch (err: any) {
    console.error('[admin/users GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
