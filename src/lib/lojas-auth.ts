import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { verifyAdminToken, ADMIN_COOKIE } from '@/lib/admin-auth'

/**
 * Helper de autenticação dual para as APIs de loja.
 *
 * Aceita 2 caminhos:
 *
 *   1. ADMIN — cookie `bynx_admin` (HMAC-SHA256) válido
 *      → bypass de ownership: admin pode operar em qualquer loja
 *
 *   2. OWNER — Bearer token do Supabase auth + ownership da loja
 *      → user.id deve bater com loja.owner_user_id
 *
 * Se ambos falharem: retorna 401/403 conforme o caso.
 *
 * Uso típico:
 *
 *   const auth = await autenticarOwnerOuAdmin(req, lojaId, 'id, owner_user_id, nome')
 *   if ('error' in auth) return auth.error
 *   const { loja, sb, isAdmin, user } = auth
 *
 *   if (!isAdmin) {
 *     // só owner pode fazer X
 *   }
 */

export interface AuthSucesso {
  isAdmin: boolean
  user: { id: string } | null  // null quando admin sem Bearer
  loja: any                     // tipo depende do select
  sb: SupabaseClient
}

export interface AuthErro {
  error: NextResponse
}

export type AuthResultado = AuthSucesso | AuthErro

function supabaseAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

/**
 * Autentica a requisição como admin OU como owner da loja.
 *
 * @param req       NextRequest da rota
 * @param lojaId    ID da loja a operar
 * @param lojaSelect Colunas a buscar da tabela lojas (ex: 'id, owner_user_id, nome, fotos')
 * @returns AuthSucesso (isAdmin, user, loja, sb) ou AuthErro (response pronto)
 */
export async function autenticarOwnerOuAdmin(
  req: NextRequest,
  lojaId: string,
  lojaSelect: string
): Promise<AuthResultado> {
  const sb = supabaseAdmin()

  // ─── Verifica admin (cookie HMAC) ───────────────────────────
  const adminToken = req.cookies.get(ADMIN_COOKIE)?.value
  const isAdmin = await verifyAdminToken(adminToken)

  // ─── Verifica owner (Bearer) ────────────────────────────────
  const authHeader  = req.headers.get('authorization')
  const bearerToken = authHeader?.replace('Bearer ', '')

  // Se não é admin nem tem Bearer, recusa
  if (!isAdmin && !bearerToken) {
    return {
      error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }),
    }
  }

  // Resolve user via Bearer (necessário se NÃO for admin)
  let user: { id: string } | null = null
  if (bearerToken) {
    const { data, error: authErr } = await sb.auth.getUser(bearerToken)
    if (authErr || !data?.user) {
      // Se também não é admin, falha
      if (!isAdmin) {
        return {
          error: NextResponse.json({ error: 'Token inválido' }, { status: 401 }),
        }
      }
      // Se é admin, ignoramos Bearer ruim
    } else {
      user = { id: data.user.id }
    }
  }

  // ─── Busca loja ─────────────────────────────────────────────
  const { data: lojas, error: lojaErr } = await sb
    .from('lojas')
    .select(lojaSelect)
    .eq('id', lojaId)
    .limit(1)

  if (lojaErr) {
    console.error('[lojas-auth] erro ao buscar loja', lojaErr)
    return {
      error: NextResponse.json({ error: 'Erro ao buscar loja' }, { status: 500 }),
    }
  }

  const loja = lojas?.[0]
  if (!loja) {
    return {
      error: NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 }),
    }
  }

  // ─── Valida ownership SE não for admin ──────────────────────
  if (!isAdmin) {
    if (!user || (loja as any).owner_user_id !== user.id) {
      return {
        error: NextResponse.json({ error: 'Você não é o dono desta loja' }, { status: 403 }),
      }
    }
  }

  return { isAdmin, user, loja, sb }
}
