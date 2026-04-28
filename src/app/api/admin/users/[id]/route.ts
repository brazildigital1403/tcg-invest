import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// ─── GET — detalhe completo do usuário ──────────────────────────────────────

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

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

    const now = Date.now()
    const trialMs = user.trial_expires_at ? new Date(user.trial_expires_at).getTime() : 0
    const isTrial = !user.is_pro && trialMs > now
    const planoEfetivo = user.is_pro ? 'pro' : isTrial ? 'trial' : 'free'

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
        is_suspended: !!user.suspended_at,
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

// ─── PATCH — ações administrativas ──────────────────────────────────────────

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const { action, value } = body

    const sb = supabaseAdmin()

    const { data: users } = await sb
      .from('users')
      .select('id, is_pro, scan_creditos, trial_expires_at, pro_expira_em, plano, suspended_at')
      .eq('id', id)
      .limit(1)
    if (!users?.[0]) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    const user = users[0]

    const patch: any = {}

    switch (action) {
      // ─── Conceder Pro ─────────────────────────────────────────────────────
      case 'grant_pro': {
        const months = Math.max(1, Math.min(60, Number(value) || 1))
        const base = user.pro_expira_em && new Date(user.pro_expira_em) > new Date()
          ? new Date(user.pro_expira_em)
          : new Date()
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
        break
      }

      // ─── Estender trial ───────────────────────────────────────────────────
      case 'extend_trial': {
        const days = Math.max(1, Math.min(365, Number(value) || 7))
        const base = user.trial_expires_at && new Date(user.trial_expires_at) > new Date()
          ? new Date(user.trial_expires_at)
          : new Date()
        base.setDate(base.getDate() + days)
        patch.trial_expires_at = base.toISOString()
        break
      }

      // ─── Adicionar créditos ───────────────────────────────────────────────
      case 'add_scan_credits': {
        const amount = Math.max(1, Math.min(1000, Number(value) || 0))
        const atual = Number(user.scan_creditos) || 0
        patch.scan_creditos = atual + amount
        break
      }

      case 'set_scan_credits': {
        const amount = Math.max(0, Math.min(10000, Number(value) || 0))
        patch.scan_creditos = amount
        break
      }

      // ─── Editar dados do perfil ───────────────────────────────────────────
      case 'edit_profile': {
        const profile = (value || {}) as Record<string, any>
        const allowedFields = ['name', 'username', 'city', 'whatsapp']
        for (const field of allowedFields) {
          if (profile[field] !== undefined) {
            // Strings vazias viram null
            const v = String(profile[field] || '').trim()
            patch[field] = v || null
          }
        }
        if (Object.keys(patch).length === 0) {
          return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
        }
        // Valida username único se está sendo alterado
        if (patch.username) {
          const { data: conflict } = await sb
            .from('users')
            .select('id')
            .eq('username', patch.username)
            .neq('id', id)
            .limit(1)
          if (conflict?.[0]) {
            return NextResponse.json({ error: 'Este username já está em uso' }, { status: 409 })
          }
        }
        break
      }

      // ─── Suspender conta ──────────────────────────────────────────────────
      case 'suspend': {
        const reason = String(value?.reason || '').trim().slice(0, 500) || null
        patch.suspended_at     = new Date().toISOString()
        patch.suspended_reason = reason
        break
      }

      // ─── Reativar conta ───────────────────────────────────────────────────
      case 'unsuspend': {
        patch.suspended_at     = null
        patch.suspended_reason = null
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

// ─── DELETE — exclusão definitiva (hard delete) ─────────────────────────────
// Exige confirmação: body deve conter `{ confirmEmail: "email exato" }`

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const confirmEmail = String(body.confirmEmail || '').trim().toLowerCase()

    if (!confirmEmail) {
      return NextResponse.json({ error: 'É necessário confirmar o email' }, { status: 400 })
    }

    const sb = supabaseAdmin()

    // 1. Busca usuário pra validar o email de confirmação
    const { data: users } = await sb
      .from('users')
      .select('id, email, is_pro')
      .eq('id', id)
      .limit(1)
    if (!users?.[0]) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    const user = users[0]

    if (user.email?.toLowerCase() !== confirmEmail) {
      return NextResponse.json({
        error: 'O email de confirmação não bate com o email da conta'
      }, { status: 400 })
    }

    // 2. Segurança extra: se tiver assinatura Pro ativa, avisa pra cancelar o Stripe primeiro
    if (user.is_pro) {
      return NextResponse.json({
        error: 'Usuário tem assinatura Pro ativa. Cancele a assinatura no Stripe primeiro, depois revogue o Pro aqui, e só então exclua.'
      }, { status: 400 })
    }

    // 3. Exclusão em cascata — ordem importa por causa de FK
    // Apagamos explicitamente as tabelas "filhas" antes, caso não tenha cascade em todas
    await sb.from('ticket_messages').delete().eq('sender_id', id)
    await sb.from('tickets').delete().eq('user_id', id)
    await sb.from('user_cards').delete().eq('user_id', id)
    try { await sb.from('notifications').delete().eq('user_id', id) } catch {}
    try { await sb.from('marketplace_listings').delete().eq('user_id', id) } catch {}
    try { await sb.from('marketplace_ads').delete().eq('user_id', id) } catch {}

    // 4. Apaga da tabela users
    const { error: uErr } = await sb.from('users').delete().eq('id', id)
    if (uErr) {
      console.error('[admin/users/[id] DELETE] users table:', uErr.message)
      return NextResponse.json({ error: uErr.message }, { status: 500 })
    }

    // 5. Apaga do auth.users (Supabase Auth) — libera o email pra novo cadastro
    const { error: authErr } = await sb.auth.admin.deleteUser(id)
    if (authErr) {
      // User da tabela users já foi apagado, mas o auth falhou. Loga e retorna sucesso parcial.
      console.error('[admin/users/[id] DELETE] auth.admin.deleteUser:', authErr.message)
      return NextResponse.json({
        ok: true,
        warning: `Dados apagados, mas conta de autenticação precisou ser removida manualmente: ${authErr.message}`,
      })
    }

    console.log(`[admin] Usuário ${user.email} (${id}) EXCLUÍDO permanentemente`)
    return NextResponse.json({ ok: true, deleted_email: user.email })
  } catch (err: any) {
    console.error('[admin/users/[id] DELETE]', err?.message)
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 })
  }
}
