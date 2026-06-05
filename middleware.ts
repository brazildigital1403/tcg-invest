import { NextResponse, type NextRequest } from 'next/server'
import { verifyAdminToken, ADMIN_COOKIE } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'

// ─── Rotas protegidas do ADMIN ──────────────────────────────────────────────
//
//   /admin/*           → redireciona pra /admin/login se não autenticado
//   /api/admin/*       → retorna 401 JSON se não autenticado
//   Exceto /admin/login, /api/admin/login, /api/admin/logout

// ─── Rotas protegidas do APP (áreas logadas) ────────────────────────────────
//
//   /dashboard-financeiro, /minha-colecao, /minha-conta, /minha-loja,
//   /marketplace, /pokedex, /separadores, /pro-ativado, /suporte*
//   → bloqueia usuários com suspended_at preenchido

const ADMIN_PUBLIC = ['/admin/login', '/api/admin/login', '/api/admin/logout']

const APP_PROTECTED = [
  '/dashboard-financeiro',
  '/minha-colecao',
  '/minha-conta',
  '/minha-loja',
  '/marketplace',
  '/pokedex',
  '/separadores',
  '/pro-ativado',
  '/suporte',
]

function isAppProtected(pathname: string) {
  return APP_PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// ─── Heartbeat de "ultima atividade" ────────────────────────────────────────
// Grava users.last_seen_at quando o usuario navega numa area logada, com
// throttle via cookie (escreve no maximo 1x a cada SEEN_TTL_SEC por navegador)
// pra nao bater no banco a cada request. Distinto de last_sign_in_at (login).
const SEEN_COOKIE  = 'bynx_seen'
const SEEN_TTL_SEC = 600 // 10 min

// ─── Bloqueia request admin sem cookie (ou com cookie inválido) ─────────────
// Centralizada pra ser chamada em condições normais E no fallback do try/catch
// (fail-closed: se algo der errado, NUNCA libera passagem — bloqueia).

function blockAdmin(req: NextRequest, pathname: string): NextResponse {
  if (pathname.startsWith('/api/admin')) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const url = req.nextUrl.clone()
  url.pathname = '/admin/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ─── ADMIN ─────────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (ADMIN_PUBLIC.includes(pathname)) return NextResponse.next()

    // Fail-closed: se verifyAdminToken jogar exceção (env ADMIN_SECRET ausente,
    // crypto.subtle indisponível, etc), bloqueia ao invés de crashar 500.
    try {
      const token = req.cookies.get(ADMIN_COOKIE)?.value
      const ok    = await verifyAdminToken(token)
      if (ok) return NextResponse.next()
    } catch (err) {
      console.error('[middleware] admin auth check failed:', err)
      // Cai pro blockAdmin abaixo
    }

    return blockAdmin(req, pathname)
  }

  // ─── BLOQUEIO DE USUÁRIO SUSPENSO NO APP ──────────────────────────────
  if (isAppProtected(pathname)) {
    // Procura cookie de sessão do Supabase (ex: sb-hvkcwfcvizrvhkerupfc-auth-token)
    const allCookies = req.cookies.getAll()
    const authCookie = allCookies.find(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))
    if (!authCookie) return NextResponse.next()

    try {
      // O cookie contém JSON com access_token
      let parsed: any = null
      const val = authCookie.value
      if (val.startsWith('base64-')) {
        // Formato novo com prefixo base64-
        const decoded = atob(val.slice('base64-'.length))
        parsed = JSON.parse(decoded)
      } else if (val.startsWith('[') || val.startsWith('{')) {
        parsed = JSON.parse(val)
      }

      const accessToken = Array.isArray(parsed) ? parsed[0] : parsed?.access_token
      if (!accessToken) return NextResponse.next()

      // Decodifica JWT (só lê o payload, não valida — o Supabase já faz isso)
      const payload = JSON.parse(atob(accessToken.split('.')[1]))
      const userId = payload.sub
      if (!userId) return NextResponse.next()

      // Checa suspensão no banco (service role)
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      )
      const { data } = await supabase
        .from('users')
        .select('suspended_at')
        .eq('id', userId)
        .limit(1)

      if (data?.[0]?.suspended_at) {
        // Redireciona pra landing com flag de suspensão
        const url = req.nextUrl.clone()
        url.pathname = '/'
        url.searchParams.set('suspended', '1')
        // Também limpa o cookie de auth
        const response = NextResponse.redirect(url)
        response.cookies.delete(authCookie.name)
        return response
      }

      // ─── Heartbeat: marca ultima atividade (throttle 10min via cookie) ────
      // So escreve quando o cookie de throttle nao existe. Reusa o client
      // service role ja criado acima. Falha de update nunca quebra navegacao.
      if (!req.cookies.get(SEEN_COOKIE)) {
        try {
          await supabase
            .from('users')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', userId)
        } catch (e) {
          console.error('[middleware] last_seen update failed:', e)
        }
        // Seta o cookie independente do resultado (evita martelar o banco em
        // caso de falha persistente — re-tenta no maximo a cada 10min).
        const res = NextResponse.next()
        res.cookies.set(SEEN_COOKIE, '1', {
          maxAge: SEEN_TTL_SEC,
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        })
        return res
      }
    } catch (err) {
      // Em caso de qualquer erro no parsing, deixa passar (não queremos quebrar login)
      console.error('[middleware] suspended check failed:', err)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Admin: literal + path* (defesa contra mudanças futuras no path-to-regexp)
    '/admin',
    '/admin/:path*',
    '/api/admin',
    '/api/admin/:path*',
    // App protegido: padrão já era literal + path*
    '/dashboard-financeiro/:path*',
    '/dashboard-financeiro',
    '/minha-colecao/:path*',
    '/minha-colecao',
    '/minha-conta/:path*',
    '/minha-conta',
    '/minha-loja/:path*',
    '/minha-loja',
    '/marketplace/:path*',
    '/marketplace',
    '/pokedex/:path*',
    '/pokedex',
    '/separadores/:path*',
    '/separadores',
    '/pro-ativado/:path*',
    '/pro-ativado',
    '/suporte/:path*',
    '/suporte',
  ],
}
