import { supabase } from './supabaseClient'

/**
 * Wrapper do fetch que injeta automaticamente o token de autenticação
 * do usuário logado no cabeçalho Authorization.
 * Use no lugar do fetch normal para chamar as rotas protegidas da API.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()

  const token = session?.access_token

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
