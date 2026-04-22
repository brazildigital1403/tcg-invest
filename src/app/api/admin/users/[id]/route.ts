import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// ─── GET — detalhe completo do usuário ──────────────────────────────────────

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const sb = supabaseAdmin()

    const { data: users, error } = await sb
      .from('users')
      .select('*')
      .eq('id', id)
      .limit(1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!users?.[0]) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const user = users[0]

    // Info derivada
    const now = Date.now()
    const trialMs = user.trial_expires_at ? new Date(user.trial_expires_at).getTime() : 0
    const isTrial = !user.is_pro && trialMs > now
    const planoEfetivo = user.is_pro ? 'pro' : isTrial ? 'trial' : 'free'

    // Totaliza coleção
    const [{ count: totalCards }, { count: totalTickets }] = await Promise.all([
      sb.from('user_cards').select('id', { count: 'exact', head: true }).eq('user_id', id),
      sb.from('tickets').select('id', { count: 'exact', head: true }).eq('user_id', id),
    ])

    return NextResponse.json({
      user: {
        ...user,
        display_name: user.name || null,
        plano_efetivo: planoEfetivo,
        trial_days_left: isTrial ? Math.ceil((trialMs - now) / 86_400_000) : 0,
      },
      stats: {
        total_cards:   totalCards   || 0,
        total_tickets: totalTickets || 0,
      },
    })
  } catch (err: any) {
    console.error('[admin/users/[id] GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// ─── PATCH — ações: conceder Pro, adicionar créditos, estender trial ────────

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const { action, value } = body

    const sb = supabaseAdmin()

    // Confirma que existe
    const { data: users } = await sb.from('users').select('id, is_pro, scan_creditos, trial_expires_at, pro_expira_em, plano').eq('id', id).limit(1)
    if (!users?.[0]) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    const user = users[0]

    const patch: any = {}

    switch (action) {
      // ─── Conceder Pro por N meses ────────────────────────────────────────
      case 'grant_pro': {
        const months = Math.max(1, Math.min(60, Number(value) || 1))
        const base = user.pro_expira_em && new Date(user.pro_expira_em) > new Date()
          ? new Date(user.pro_expira_em)  // estende a partir do fim atual
          : new Date()                     // começa agora
        base.setMonth(base.getMonth() + months)
        patch.is_pro = true
        patch.plano = months === 12 ? 'anual' : 'mensal'
        patch.pro_expira_em = base.toISOString()
        break
      }

      // ─── Revogar Pro ──────────────────────────────────────────────────────
      case 'revoke_pro': {
        patch.is_pro = false
        patch.pro_expira_em = null
        // Deixa o plano como está (histórico)
        break
      }

      // ─── Estender trial por N dias ───────────────────────────────────────
      case 'extend_trial': {
        const days = Math.max(1, Math.min(365, Number(value) || 7))
        const base = user.trial_expires_at && new Date(user.trial_expires_at) > new Date()
          ? new Date(user.trial_expires_at)
          : new Date()
        base.setDate(base.getDate() + days)
        patch.trial_expires_at = base.toISOString()
        break
      }

      // ─── Adicionar créditos de scan ──────────────────────────────────────
      case 'add_scan_credits': {
        const amount = Math.max(1, Math.min(1000, Number(value) || 0))
        const atual = Number(user.scan_creditos) || 0
        patch.scan_creditos = atual + amount
        break
      }

      // ─── Zerar créditos de scan ──────────────────────────────────────────
      case 'set_scan_credits': {
        const amount = Math.max(0, Math.min(10000, Number(value) || 0))
        patch.scan_creditos = amount
        break
      }

      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    const { data: updated, error } = await sb
      .from('users')
      .update(patch)
      .eq('id', id)
      .select()
      .limit(1)

    if (error) {
      console.error('[admin/users/[id] PATCH]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, user: updated?.[0], applied: patch })
  } catch (err: any) {
    console.error('[admin/users/[id] PATCH]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}