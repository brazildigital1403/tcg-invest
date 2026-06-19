import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com a SERVICE ROLE key - SOMENTE servidor.
 *
 * NUNCA importar em componente 'use client': a service key vazaria no bundle do
 * browser. Usar so em Route Handlers, Server Components e libs server-side.
 *
 * S42 (fecha o firehose): paginas/rotas de catalogo liam pokemon_cards com a
 * ANON key (exposta no browser); um scraper batia direto no PostgREST e baixava
 * as ~69k cartas driblando o Vercel. Com as leituras server-side em service
 * role, da pra revogar o SELECT anon em pokemon_cards (Fase C) sem quebrar nada.
 *
 * Lazy + singleton: createClient so roda na 1a CHAMADA (runtime), nunca no
 * module-scope - evita tambem a classe de build-break do "Collecting page data".
 */

let _client: SupabaseClient | null = null

export function getServiceSupabase(): SupabaseClient | null {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _client
}
