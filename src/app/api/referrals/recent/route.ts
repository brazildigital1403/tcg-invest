// src/app/api/referrals/recent/route.ts
//
// Indique e Ganhe — GET últimas 10 indicações do user logado.
// Usado pelo dashboard /indique-e-ganhe pra listar quem foi indicado e em
// que status (cadastrou / ativou / engajado).
//
// Privacidade: retorna apenas iniciais do email do indicado (ex: 'k***@k***.com')
// e o username público (se setado) — nunca o email completo.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function maskEmail(email: string | null): string {
  if (!email) return ''
  const [local, domain] = email.split('@')
  if (!local || !domain) return ''
  const ml = local.length > 1 ? local[0] + '***' : '***'
  const dotIdx = domain.lastIndexOf('.')
  const md = dotIdx > 0 ? domain[0] + '***' + domain.slice(dotIdx) : domain[0] + '***'
  return `${ml}@${md}`
}

export async function GET(req: NextRequest) {
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

    // Busca últimas 10 indicações
    const { data: referrals, error } = await supabase
      .from('referrals')
      .select('id, status, cadastrou_at, ativou_at, engajou_at, referred_user_id, is_suspicious')
      .eq('referrer_user_id', user.id)
      .order('cadastrou_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('[referrals/recent] db error:', error.message)
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }

    if (!referrals || referrals.length === 0) {
      return NextResponse.json({ ok: true, items: [] })
    }

    // Busca dados públicos dos indicados (username + email mascarado)
    const referredIds = referrals.map(r => r.referred_user_id)
    const { data: refUsers } = await supabase
      .from('users')
      .select('id, username, email')
      .in('id', referredIds)

    const userMap = new Map(refUsers?.map(u => [u.id, u]) || [])

    const items = referrals.map(r => {
      const u = userMap.get(r.referred_user_id)
      return {
        id: r.id,
        status: r.status,
        cadastrou_at: r.cadastrou_at,
        ativou_at: r.ativou_at,
        engajou_at: r.engajou_at,
        is_suspicious: r.is_suspicious,
        referred: {
          username: u?.username || null,
          email_masked: maskEmail(u?.email || null),
        },
      }
    })

    return NextResponse.json({ ok: true, items })
  } catch (err: any) {
    console.error('[referrals/recent] unexpected:', err?.message)
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}
