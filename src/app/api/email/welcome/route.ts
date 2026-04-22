import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWelcomeEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const { data: user } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', userId)
      .limit(1)

    if (!user?.[0]?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await sendWelcomeEmail(user[0].email, user[0].name || '')
    console.log(`[email/welcome] Enviado para ${user[0].email}`)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[email/welcome]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}