import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// Auth: o middleware já garante que só admins chegam aqui

export async function GET() {
  try {
    const sb = supabaseAdmin()
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // ─── Tickets ─────────────────────────────────────────────────────────────

    const [openTk, ipTk, resTk, last7Tk] = await Promise.all([
      sb.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      sb.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
      sb.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'resolved'),
      sb.from('tickets').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    ])

    // ─── Usuários ────────────────────────────────────────────────────────────

    let totalUsers = 0
    let newUsers7d = 0
    let proUsers   = 0
    let trialUsers = 0
    try {
      const [total, news, pros, trials] = await Promise.all([
        sb.from('users').select('id', { count: 'exact', head: true }),
        sb.from('users').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
        sb.from('users').select('id', { count: 'exact', head: true }).eq('is_pro', true),
        sb.from('users').select('id', { count: 'exact', head: true }).gt('trial_expires_at', now.toISOString()).eq('is_pro', false),
      ])
      totalUsers = total.count || 0
      newUsers7d = news.count || 0
      proUsers   = pros.count || 0
      trialUsers = trials.count || 0
    } catch (e: any) {
      console.error('[admin/metrics] users counts failed:', e?.message)
    }

    // ─── Cartas ──────────────────────────────────────────────────────────────

    let totalCards = 0
    try {
      const { count } = await sb.from('user_cards').select('id', { count: 'exact', head: true })
      totalCards = count || 0
    } catch (e: any) {
      console.error('[admin/metrics] cards count failed:', e?.message)
    }

    return NextResponse.json({
      tickets: {
        open:        openTk.count  || 0,
        in_progress: ipTk.count    || 0,
        resolved:    resTk.count   || 0,
        last7:       last7Tk.count || 0,
      },
      users: {
        total:  totalUsers,
        new7d:  newUsers7d,
        pro:    proUsers,
        trial:  trialUsers,
      },
      cards: { total: totalCards },
    })
  } catch (err: any) {
    console.error('[admin/metrics]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}