import { NextResponse, type NextRequest } from 'next/server'
import { verifyAdminToken, ADMIN_COOKIE } from '@/lib/admin-auth'

// Protege:
//   /admin/*           → redireciona pra /admin/login se não autenticado
//   /api/admin/*       → retorna 401 JSON se não autenticado
//
// Excluídos:
//   /admin/login       → a página de login em si
//   /api/admin/login   → endpoint de login
//   /api/admin/logout  → endpoint de logout (pra conseguir deslogar sempre)

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rotas públicas dentro do escopo admin
  if (
    pathname === '/admin/login' ||
    pathname === '/api/admin/login' ||
    pathname === '/api/admin/logout'
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get(ADMIN_COOKIE)?.value
  const ok    = await verifyAdminToken(token)
  if (ok) return NextResponse.next()

  // API → 401 JSON
  if (pathname.startsWith('/api/admin')) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Página → redireciona pra login preservando o destino
  const url = req.nextUrl.clone()
  url.pathname = '/admin/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  // Aplica middleware só nessas rotas
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}