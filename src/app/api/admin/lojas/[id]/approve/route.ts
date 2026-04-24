import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmailLojaAprovada } from '@/lib/email'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// POST /api/admin/lojas/[id]/approve
// Aprova loja pendente ou suspensa → ativa
// Envia email APENAS na primeira aprovação (aprovada_data nulo antes)

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const sb = supabaseAdmin()

    // 1) Busca loja
    const { data: lojas, error: lErr } = await sb
      .from('lojas')
      .select('id, nome, slug, status, owner_user_id, aprovada_data')
      .eq('id', id)
      .limit(1)
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
    if (!lojas?.[0]) return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })

    const loja = lojas[0]

    // 2) Valida transição
    if (loja.status === 'ativa') {
      return NextResponse.json({ error: 'Loja já está ativa' }, { status: 400 })
    }
    if (loja.status === 'inativa') {
      return NextResponse.json({
        error: 'Loja está inativa — o owner precisa reativar antes via /api/lojas/[id]'
      }, { status: 400 })
    }

    const primeiraAprovacao = !loja.aprovada_data

    // 3) Atualiza loja
    const patch: any = {
      status: 'ativa',
      suspensao_motivo: null,
      suspensao_data: null,
      suspenso_por: null,
      updated_at: new Date().toISOString(),
    }
    if (primeiraAprovacao) {
      patch.aprovada_data = new Date().toISOString()
    }

    const { data: updated, error: uErr } = await sb
      .from('lojas')
      .update(patch)
      .eq('id', id)
      .select()
      .limit(1)
    if (uErr) {
      console.error('[admin/lojas/[id]/approve] update failed:', uErr.message)
      return NextResponse.json({ error: uErr.message }, { status: 500 })
    }

    // 4) Envia email apenas na primeira aprovação (não spammar reativações)
    if (primeiraAprovacao && loja.owner_user_id) {
      try {
        const { data: owner } = await sb
          .from('users')
          .select('email, name')
          .eq('id', loja.owner_user_id)
          .limit(1)
        if (owner?.[0]?.email) {
          await sendEmailLojaAprovada({
            to:        owner[0].email,
            nomeUser:  owner[0].name || 'colecionador',
            nomeLoja:  loja.nome,
            slug:      loja.slug,
          })
        }
      } catch (e: any) {
        // Loga mas não falha a request — aprovação vale mais que o email
        console.error('[admin/lojas/[id]/approve] email failed:', e?.message)
      }
    }

    return NextResponse.json({ loja: updated?.[0], primeiraAprovacao })
  } catch (err: any) {
    console.error('[admin/lojas/[id]/approve POST]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}