import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { sendPurchaseConfirmationEmail } from '@/lib/email'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// POST /api/admin/users/[id]/send-pro-email
// Envia o e-mail oficial de boas-vindas PRO (mesmo do checkout Stripe) para
// usuarios que tiveram o PRO concedido manualmente no Admin.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const sb = supabaseAdmin()

    const { data: users, error } = await sb
      .from('users')
      .select('email, name, plano, is_pro')
      .eq('id', id)
      .limit(1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const u = users?.[0]
    if (!u?.email) return NextResponse.json({ error: 'Usuario sem email' }, { status: 404 })

    const tipo = u.plano === 'anual' ? 'pro_anual' : 'pro_mensal'
    await sendPurchaseConfirmationEmail(u.email, u.name || '', tipo)

    return NextResponse.json({ ok: true, to: u.email, tipo })
  } catch (err: any) {
    console.error('[admin/users/[id]/send-pro-email POST]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
