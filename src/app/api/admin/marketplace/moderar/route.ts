import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// Modera um anúncio do marketplace: remove (soft-delete) ou restaura.
// Body:
//   { id: string; action: 'remover' | 'restaurar'; motivo?: string }
//
// 'remover':   define removido_em=now(), removido_motivo, removido_por
// 'restaurar': zera removido_em/motivo/por (volta ao normal)
//
// removido_por é resolvido buscando user_id pelo ADMIN_EMAIL do env.
// Se a busca falhar (env ausente ou user não encontrado), o registro é
// preservado mesmo assim com removido_por = NULL — rastreabilidade
// degrada gracefulmente sem bloquear a moderação.

export async function POST(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const body = await req.json().catch(() => null)
    if (!body || !body.id || !body.action) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }
    if (body.action !== 'remover' && body.action !== 'restaurar') {
      return NextResponse.json({ error: 'Action inválida' }, { status: 400 })
    }
    if (body.action === 'remover' && (!body.motivo || typeof body.motivo !== 'string' || !body.motivo.trim())) {
      return NextResponse.json({ error: 'Motivo é obrigatório ao remover' }, { status: 400 })
    }

    const sb = supabaseAdmin()

    if (body.action === 'remover') {
      // Resolve user_id do admin pelo ADMIN_EMAIL (best-effort)
      let removidoPor: string | null = null
      const adminEmail = process.env.ADMIN_EMAIL
      if (adminEmail) {
        const { data: adminUser } = await sb
          .from('users')
          .select('id')
          .eq('email', adminEmail)
          .limit(1)
        removidoPor = adminUser?.[0]?.id || null
      }

      const { error } = await sb
        .from('marketplace')
        .update({
          removido_em:     new Date().toISOString(),
          removido_motivo: body.motivo.trim().slice(0, 500),
          removido_por:    removidoPor,
        })
        .eq('id', body.id)

      if (error) {
        console.error('[admin/marketplace POST] remover:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    // action === 'restaurar'
    const { error } = await sb
      .from('marketplace')
      .update({
        removido_em:     null,
        removido_motivo: null,
        removido_por:    null,
      })
      .eq('id', body.id)

    if (error) {
      console.error('[admin/marketplace POST] restaurar:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[admin/marketplace POST]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
