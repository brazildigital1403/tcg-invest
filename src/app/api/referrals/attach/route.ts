// src/app/api/referrals/attach/route.ts
//
// Indique e Ganhe — associa ref_code ao novo user após o signup.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'invalid_session' }, { status: 401 })
    }

    let body: { ref_code?: string; fingerprint?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
    }

    const refCode = (body.ref_code || '').trim().toUpperCase()
    const fingerprint = (body.fingerprint || '').slice(0, 64)
    if (!refCode || !/^BYN[A-HJ-NP-Z2-9]{5}$/.test(refCode)) {
      return NextResponse.json({ ok: false, error: 'invalid_code_format' }, { status: 400 })
    }

    const xff = req.headers.get('x-forwarded-for')
    const cfip = req.headers.get('cf-connecting-ip')
    const ip = (cfip || xff?.split(',')[0] || '').trim().slice(0, 45) || null

    const userAgent = (req.headers.get('user-agent') || '').slice(0, 500)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const { data, error } = await supabase.rpc('award_referral_signup', {
      p_referred_user_id: user.id,
      p_ref_code: refCode,
      p_ip: ip,
      p_fingerprint: fingerprint || null,
      p_user_agent: userAgent || null,
    })

    if (error) {
      console.error('[referrals/attach] RPC error:', error.message)
      return NextResponse.json({ ok: false, error: 'rpc_error' }, { status: 500 })
    }

    return NextResponse.json(data || { ok: true })
  } catch (err: any) {
    console.error('[referrals/attach] unexpected:', err?.message)
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}