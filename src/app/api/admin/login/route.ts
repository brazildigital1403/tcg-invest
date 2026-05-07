import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  makeAdminToken, verifyAdminPassword,
  ADMIN_COOKIE, ADMIN_MAX_AGE,
  checkLoginRateLimit, recordLoginAttempt,
} from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  try {
    // S29 FIX (auditoria admin): rate limit anti brute force.
    // /admin/login está fora do middleware (public), então é exposto
    // direto à internet. Sem rate limit, atacante tenta milhares de
    // senhas por segundo. Limite: 5 tentativas em 15 min por IP.
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
              || req.headers.get('x-real-ip')
              || 'unknown'

    const limit = checkLoginRateLimit(ip)
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${limit.retryAfterSec}s.` },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
      )
    }

    const body = await req.json().catch(() => ({}))
    const password = String(body.password || '')

    if (!process.env.ADMIN_PASSWORD) {
      console.error('[admin/login] ADMIN_PASSWORD não configurada nas env vars')
      return NextResponse.json({ error: 'Configuração do servidor inválida' }, { status: 500 })
    }

    if (!verifyAdminPassword(password)) {
      // Pequeno delay pra desacelerar brute force
      await new Promise(r => setTimeout(r, 400))
      // Registra tentativa fracassada (incrementa contador do IP)
      recordLoginAttempt(ip, false)
      return NextResponse.json({ error: 'Senha inválida' }, { status: 401 })
    }

    // Sucesso → reseta o contador desse IP (não punir admin legítimo)
    recordLoginAttempt(ip, true)

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
