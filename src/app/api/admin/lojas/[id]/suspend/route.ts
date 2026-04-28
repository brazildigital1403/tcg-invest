import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmailLojaSuspensa } from '@/lib/email'
import { requireAdmin } from '@/lib/admin-auth'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// POST /api/admin/lojas/[id]/suspend
// Body: { motivo: string } (min 10 chars, max 500)
// Suspende loja e envia email avisando o owner com o motivo

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const motivo = String(body.motivo || '').trim()

    // 1) Valida motivo
    if (motivo.length < 10) {
      return NextResponse.json({ error: 'Motivo é obrigatório (mínimo 10 caracteres)' }, { status: 400 })
    }
    if (motivo.length > 500) {
      return NextResponse.json({ error: 'Motivo deve ter no máximo 500 caracteres' }, { status: 400 })
    }

    const sb = supabaseAdmin()

    // 2) Busca loja
    const { data: lojas, error: lErr } = await sb
      .from('lojas')
      .select('id, nome, slug, status, owner_user_id')
      .eq('id', id)
      .limit(1)
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
    if (!lojas?.[0]) return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })

    const loja = lojas[0]

    // 3) Valida transição
    if (loja.status === 'suspensa') {
      return NextResponse.json({ error: 'Loja já está suspensa' }, { status: 400 })
    }
    if (loja.status === 'inativa') {
      return NextResponse.json({
        error: 'Loja está inativa — não faz sentido suspender uma conta inativa'
      }, { status: 400 })
    }

    // 4) Atualiza loja
    const { data: updated, error: uErr } = await sb
      .from('lojas')
      .update({
        status: 'suspensa',
        suspensao_motivo: motivo,
        suspensao_data: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .limit(1)
    if (uErr) {
      console.error('[admin/lojas/[id]/suspend] update failed:', uErr.message)
      return NextResponse.json({ error: uErr.message }, { status: 500 })
    }

    // 5) Envia email pro owner
    if (loja.owner_user_id) {
      try {
        const { data: owner } = await sb
          .from('users')
          .select('email, name')
          .eq('id', loja.owner_user_id)
          .limit(1)
        if (owner?.[0]?.email) {
          await sendEmailLojaSuspensa({
            to:        owner[0].email,
            nomeUser:  owner[0].name || 'colecionador',
            nomeLoja:  loja.nome,
            motivo,
          })
        }
      } catch (e: any) {
        console.error('[admin/lojas/[id]/suspend] email failed:', e?.message)
      }
    }

    return NextResponse.json({ loja: updated?.[0] })
  } catch (err: any) {
    console.error('[admin/lojas/[id]/suspend POST]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
