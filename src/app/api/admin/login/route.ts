import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  makeAdminToken, verifyAdminPassword,
  ADMIN_COOKIE, ADMIN_MAX_AGE,
} from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const password = String(body.password || '')

    if (!process.env.ADMIN_PASSWORD) {
      console.error('[admin/login] ADMIN_PASSWORD não configurada nas env vars')
      return NextResponse.json({ error: 'Configuração do servidor inválida' }, { status: 500 })
    }

    if (!verifyAdminPassword(password)) {
      // Pequeno delay pra desacelerar brute force
      await new Promise(r => setTimeout(r, 400))
      return NextResponse.json({ error: 'Senha inválida' }, { status: 401 })
    }

    const token = await makeAdminToken()
    const store = await cookies()
    store.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   ADMIN_MAX_AGE,
      path:     '/',
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[admin/login]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}