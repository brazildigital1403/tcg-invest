// src/app/api/master-sets/[setId]/sheet/route.ts
// Folha de um master set. Bearer opcional. Bloqueado retorna so a pagina 1 (teaser).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ setId: string }> }) {
  try {
    const { setId } = await params

    let userId: string | null = null
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (token) {
      const auth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user } } = await auth.auth.getUser(token)
      userId = user?.id || null
    }

    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const { data: det, error: detErr } = await svc.rpc('get_master_set_detail', { p_set_id: setId, p_user_id: userId })
    if (detErr) {
      console.error('[master-sets/sheet] detail', detErr.message)
      return NextResponse.json({ error: 'Erro ao carregar master set' }, { status: 500 })
    }
    const detail = det?.[0]
    if (!detail) return NextResponse.json({ error: 'Master set nao encontrado' }, { status: 404 })

    const { data: cards, error: cardsErr } = await svc.rpc('get_master_set_sheet', { p_set_id: setId, p_user_id: userId })
    if (cardsErr) {
      console.error('[master-sets/sheet] cards', cardsErr.message)
      return NextResponse.json({ error: 'Erro ao carregar cartas' }, { status: 500 })
    }

    const all = cards || []
    const locked = !detail.unlocked
    return NextResponse.json({
      detail,
      cards: locked ? all.slice(0, 9) : all,
      locked,
    })
  } catch (err: any) {
    console.error('[master-sets/sheet] CRITICAL:', err.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
