import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTrialExpiring5Email, sendTrialExpiring7Email } from '@/lib/email'

// Roda diariamente via Vercel Cron (ver vercel.json)
export async function GET(req: NextRequest) {
  // Valida o secret do cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const now = new Date()
  let sent5 = 0
  let sent7 = 0

  try {
    // Busca usuários em trial
    const { data: trialUsers } = await supabase
      .from('users')
      .select('id, email, name, trial_expires_at')
      .not('trial_expires_at', 'is', null)
      .eq('is_pro', false)

    for (const user of trialUsers || []) {
      if (!user.email || !user.trial_expires_at) continue

      const expiresAt = new Date(user.trial_expires_at)
      const msLeft = expiresAt.getTime() - now.getTime()
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))

      // 5º dia = 2 dias restantes
      if (daysLeft === 2) {
        await sendTrialExpiring5Email(user.email, user.name || '').catch(console.error)
        sent5++
      }

      // 7º dia = último dia (0 ou 1 dia restante)
      if (daysLeft === 1) {
        await sendTrialExpiring7Email(user.email, user.name || '').catch(console.error)
        sent7++
      }
    }

    console.log(`[cron/trial-emails] Enviados: ${sent5} (5º dia), ${sent7} (7º dia)`)
    return NextResponse.json({ ok: true, sent5, sent7, total: trialUsers?.length || 0 })
  } catch (err: any) {
    console.error('[cron/trial-emails]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}