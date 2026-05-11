// src/app/api/referrals/check-activation/route.ts
//
// Indique e Ganhe — detecção inline de ativação. Idempotente.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendReferralActivatedEmail } from '@/lib/email'

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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const { data, error } = await supabase.rpc('qualify_referral', {
      p_user_id: user.id,
    })

    if (error) {
      console.error('[referrals/check-activation] RPC error:', error.message)
      return NextResponse.json({ ok: false, error: 'rpc_error' }, { status: 500 })
    }

    if (data?.qualified && data?.referrer_user_id) {
      try {
        const { data: referrerData } = await supabase
          .from('users')
          .select('email, name, points_balance')
          .eq('id', data.referrer_user_id)
          .limit(1)

        const referrer = referrerData?.[0]
        if (referrer?.email) {
          await sendReferralActivatedEmail({
            to: referrer.email,
            name: referrer.name || '',
            pointsAwarded: data.points_awarded || 0,
            newBalance: referrer.points_balance || 0,
          })
        }
      } catch (emailErr: any) {
        console.error('[referrals/check-activation] email error:', emailErr?.message)
      }
    }

    return NextResponse.json(data || { ok: true })
  } catch (err: any) {
    console.error('[referrals/check-activation] unexpected:', err?.message)
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}