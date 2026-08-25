import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/stats/publico
//
// Numeros agregados seguros pra expor em pagina publica (landing, marketing)
// -- so contagem, zero PII. Cache de 1h: nao precisa ser em tempo real pra
// uma linha de confianca, e poupa uma query por visita numa pagina de
// trafego pago.
export const revalidate = 3600

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function GET() {
  try {
    const sb = supabaseAdmin()
    const { count } = await sb.from('users').select('id', { count: 'exact', head: true })
    return NextResponse.json(
      { usuarios: count || 0 },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
    )
  } catch (err: any) {
    console.error('[stats/publico]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
