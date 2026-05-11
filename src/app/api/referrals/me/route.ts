// src/app/api/referrals/me/route.ts
//
// Indique e Ganhe — endpoint do dashboard pessoal (Sprint 2 vai consumir).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    )

    const { data, error } = await supabase.rpc('get_referral_stats')

    if (error) {
      console.error('[referrals/me] RPC error:', error.message)
      return NextResponse.json({ ok: false, error: 'rpc_error' }, { status: 500 })
    }

    return NextResponse.json(data || { ok: false, error: 'no_data' })
  } catch (err: any) {
    console.error('[referrals/me] unexpected:', err?.message)
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}