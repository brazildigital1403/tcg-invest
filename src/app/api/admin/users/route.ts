import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// GET /api/admin/users?q=&page=1&perPage=50&filter=pro|trial|free|suspended
export async function GET(req: NextRequest) {
  try {
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
      query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%,username.ilike.%${q}%`)
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