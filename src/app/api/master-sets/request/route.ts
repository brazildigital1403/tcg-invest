// src/app/api/master-sets/request/route.ts
// Pedido do modal "quer um master set especifico?". Bearer obrigatorio.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

    const auth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user } } = await auth.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Sessao invalida' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const texto = (body?.texto || '').toString().trim()
    if (texto.length < 2)   return NextResponse.json({ error: 'Escreva qual set voce quer' }, { status: 400 })
    if (texto.length > 500)  return NextResponse.json({ error: 'Texto muito longo' }, { status: 400 })

    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
    const { error } = await svc.from('master_set_requests').insert({ user_id: user.id, texto })
    if (error) {
      console.error('[master-sets/request]', error.message)
      return NextResponse.json({ error: 'Erro ao enviar pedido' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[master-sets/request] CRITICAL:', err.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
