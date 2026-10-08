// src/app/api/email/welcome/route.ts
//
// S29 Security Fix #3 — adicionar Bearer auth.
//
// Antes: aceitava `userId` no body sem validação → qualquer um podia
// disparar email de boas-vindas pra qualquer userId em loop (spam vector,
// risco de blacklist do domínio bynx.gg).
//
// Agora: exige Bearer token. O userId é inferido do JWT — o caller só
// pode disparar welcome pra si mesmo.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWelcomeEmail } from '@/lib/email'
import { enviarE02Agora } from '@/lib/regua/motor'

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    // ── Busca dados do user com service key (RLS habilitada na tabela)─
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const { data: userData } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', user.id)
      .limit(1)

    const row = userData?.[0]
    if (!row?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Regua (substituicao decidida): com REGUA_ATIVA=1 e o E02 aberto, o E02
    // sai no lugar do welcome antigo. Chave desligada: welcome de sempre.
    const assumiu = await enviarE02Agora(user.id).catch((e) => {
      console.error('[email/welcome] E02 falhou, segue o welcome antigo:', e?.message)
      return false
    })
    if (!assumiu) await sendWelcomeEmail(row.email, row.name || '')
    console.debug(`[email/welcome] ${assumiu ? 'E02' : 'welcome'} para user ${user.id}`)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[email/welcome]', err.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
