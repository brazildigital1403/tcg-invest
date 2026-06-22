// src/app/api/master-sets/catalog/route.ts
// Catalogo de master sets. Bearer opcional (deslogado ve tudo bloqueado, owned=0).
// Chama a RPC service-role get_master_sets_catalog.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
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
    const { data, error } = await svc.rpc('get_master_sets_catalog', { p_user_id: userId })
    if (error) {
      console.error('[master-sets/catalog]', error.message)
      return NextResponse.json({ error: 'Erro ao carregar catalogo' }, { status: 500 })
    }
    return NextResponse.json({ sets: data || [] })
  } catch (err: any) {
    console.error('[master-sets/catalog] CRITICAL:', err.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
