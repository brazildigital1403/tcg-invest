// src/app/api/referrals/rewards/route.ts
//
// Indique e Ganhe — GET catálogo de recompensas ativas.
// Público — não exige auth.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase
      .from('rewards')
      .select('id, sku, title, description, cost_points, reward_type, reward_payload, stock, sort_order')
      .eq('active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('[referrals/rewards] db error:', error.message)
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, items: data || [] })
  } catch (err: any) {
    console.error('[referrals/rewards] unexpected:', err?.message)
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}
