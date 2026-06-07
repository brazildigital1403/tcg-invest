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

// ─── Decode base64 (inclui base64url) -> JSON, UTF-8-safe ────────────────────
// O cookie de sessao do Supabase vem em base64 (prefixo "base64-") e pode ter
// nomes com acento (user_metadata). atob sozinho corrompe UTF-8; aqui passamos
// pelos bytes + TextDecoder. Tambem normaliza base64url (-/_) e padding (JWT).
function b64ToJson(b64: string): any {
  let s = b64.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4
  if (pad) s += '='.repeat(4 - pad)
  const bin = atob(s)
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

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

  // ─── BLOQUEIO DE USUÁRIO SUSPENSO + HEARTBEAT NO APP ──────────────────
  if (isAppProtected(pathname)) {
    // Reune cookies de auth do Supabase. O @supabase/ssr DIVIDE o cookie em
    // pedacos quando passa do limite (~3.6KB): sb-<ref>-auth-token.0, .1, ...
    // BUG ANTIGO: so achava o nome exato terminando em '-auth-token' e ignorava
    // os chunked, entao o bloco nunca rodava (heartbeat e suspensao off em
    // silencio). Agora aceita unico OU fatiado e remonta na ordem.
    const allCookies = req.cookies.getAll()
    const authParts = allCookies
      .filter(c => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
      .sort((a, b) => {
        const ai = Number(a.name.split('.').pop())
        const bi = Number(b.name.split('.').pop())
        return (Number.isNaN(ai) ? -1 : ai) - (Number.isNaN(bi) ? -1 : bi)
      })
    if (authParts.length === 0) return NextResponse.next()

    try {
      const rawValue = authParts.map(c => c.value).join('')

      let parsed: any = null
      if (rawValue.startsWith('base64-')) {
        parsed = b64ToJson(rawValue.slice('base64-'.length))
      } else if (rawValue.startsWith('[') || rawValue.startsWith('{')) {
        parsed = JSON.parse(rawValue)
      }

      const accessToken = Array.isArray(parsed) ? parsed[0] : parsed?.access_token
      if (!accessToken) return NextResponse.next()

      // Decodifica payload do JWT (so le o sub; o Supabase ja valida o token)
      const payload = b64ToJson(accessToken.split('.')[1])
      const userId = payload.sub
      if (!userId) return NextResponse.next()

      // Client service role (bypassa RLS)
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      )

      // ─── Checa suspensão ────────────────────────────────────────────────
      const { data } = await supabase
        .from('users')
        .select('suspended_at')
        .eq('id', userId)
        .limit(1)

      if (data?.[0]?.suspended_at) {
        const url = req.nextUrl.clone()
        url.pathname = '/'
        url.searchParams.set('suspended', '1')
        const response = NextResponse.redirect(url)
        // Limpa TODOS os chunks do cookie de auth
        for (const c of authParts) response.cookies.delete(c.name)
        return response
      }

      // ─── Heartbeat: marca ultima atividade (throttle 10min via cookie) ────
      // Reusa o client service role. Verifica o resultado: erro OU 0 linhas
      // afetadas viram log (antes era cego). Falha nunca quebra navegacao.
      if (!req.cookies.get(SEEN_COOKIE)) {
        const { data: upData, error: upErr } = await supabase
          .from('users')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', userId)
          .select('id')

        if (upErr) {
          console.error('[middleware] last_seen update error:', upErr.message)
        } else if (!upData || upData.length === 0) {
          console.error('[middleware] last_seen afetou 0 linhas para', userId)
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
      // Qualquer erro no parsing/checagem: deixa passar (nao quebrar navegacao)
      console.error('[middleware] app protected check failed:', err)
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