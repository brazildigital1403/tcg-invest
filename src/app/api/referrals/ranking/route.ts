// src/app/api/referrals/ranking/route.ts
//
// Indique e Ganhe — GET ranking top 20 + posição do user logado.
//
// Query params:
//   ?year=2026&month=5  (opcional — default: mês corrente)
//
// Auth opcional: se Bearer presente, retorna my_position; senão, só top.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const yearParam = url.searchParams.get('year')
    const monthParam = url.searchParams.get('month')

    const year = yearParam ? parseInt(yearParam, 10) : null
    const month = monthParam ? parseInt(monthParam, 10) : null

    if ((year !== null && (isNaN(year) || year < 2026 || year > 2100)) ||
        (month !== null && (isNaN(month) || month < 1 || month > 12))) {
      return NextResponse.json({ ok: false, error: 'invalid_period' }, { status: 400 })
    }

    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    // Se autenticado, usa cliente com JWT (RPC vê auth.uid())
    // Senão, usa anon (my_position retorna null)
    const supabase = token
      ? createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { global: { headers: { Authorization: `Bearer ${token}` } } }
        )
      : createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

    const { data, error } = await supabase.rpc('get_ranking', {
      p_year: year,
      p_month: month,
    })

    if (error) {
      console.error('[referrals/ranking] RPC error:', error.message, error.hint)
      return NextResponse.json({ ok: false, error: 'rpc_error', detail: error.message }, { status: 500 })
    }

    return NextResponse.json(data || { ok: true, top: [] })
  } catch (err: any) {
    console.error('[referrals/ranking] unexpected:', err?.message)
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}
