import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'

/**
 * /api/leiloes/aviso: "Quero ser avisado do proximo leilao".
 * GET: esta conta ja pediu? POST: pede. So a propria conta, pelo Bearer. O envio
 * sai quando uma loja agenda (src/lib/leilaoAvisoInteresse.ts).
 */
const SEM_CACHE = { 'Cache-Control': 'no-store, max-age=0' }
const json = (status: number, corpo: Record<string, unknown>) => NextResponse.json(corpo, { status, headers: SEM_CACHE })

async function contexto(req: NextRequest) {
  const sb = getServiceSupabase()
  if (!sb) return null
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { sb, userId: null }
  const { data } = await sb.auth.getUser(token)
  return { sb, userId: data?.user?.id ?? null }
}

export async function GET(req: NextRequest) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  const c = await contexto(req)
  if (!c) return json(500, { error: 'Configuração ausente' })
  if (!c.userId) return json(401, { error: 'Entre na sua conta.' })
  const { data, error } = await c.sb.from('leilao_aviso_interesse').select('avisado_em').eq('user_id', c.userId).maybeSingle()
  if (error) return json(500, { error: 'Não foi possível consultar agora.' })
  return json(200, { ativo: !!data && !data.avisado_em })
}

export async function POST(req: NextRequest) {
  if (!LEILAO_ATIVO) return new NextResponse(null, { status: 404 })
  const c = await contexto(req)
  if (!c) return json(500, { error: 'Configuração ausente' })
  if (!c.userId) return json(401, { error: 'Entre na sua conta.' })
  const { error } = await c.sb
    .from('leilao_aviso_interesse')
    .upsert({ user_id: c.userId, created_at: new Date().toISOString(), avisado_em: null }, { onConflict: 'user_id' })
  if (error) {
    console.error('[leiloes/aviso]', error.code, error.message)
    return json(500, { error: 'Não foi possível salvar agora.' })
  }
  return json(200, { ativo: true })
}
