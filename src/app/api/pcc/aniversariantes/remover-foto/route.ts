// src/app/api/pcc/aniversariantes/remover-foto/route.ts
//
// Organizador do Club (papel "aniversariantes") remove a foto impropria de
// alguem da lista (08/11/2026). A policy do bucket so deixa cada pessoa apagar a
// propria pasta, entao o arquivo sai daqui, com a chave de servico, depois de a
// conta ser conferida. A funcao interna limpa a lista e registra quem removeu.

import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'

const BUCKET = 'club-fotos'

export async function POST(req: NextRequest) {
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'indisponivel' }, { status: 503 })
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'nao_logado' }, { status: 401 })
  const { data: { user } } = await sb.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'nao_logado' }, { status: 401 })

  const { data: org } = await sb.from('club_organizadores').select('papeis').eq('user_id', user.id).maybeSingle()
  if (!org || !(org.papeis as string[]).includes('aniversariantes')) return NextResponse.json({ error: 'sem_papel' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { instagram?: string }
  if (typeof body.instagram !== 'string') return NextResponse.json({ error: 'pessoa_nao_encontrada' }, { status: 400 })

  const { data, error } = await sb.rpc('club_aniversario_remover_foto_interno', { p_instagram: body.instagram, p_autor: user.id })
  if (error) {
    const st = /pessoa_nao_encontrada|sem_foto/.test(error.message) ? 404 : 500
    return NextResponse.json({ error: error.message }, { status: st })
  }
  // Caminho fora do formato esperado volta nulo: a foto sai da lista e o arquivo fica.
  const path = (data as { foto_path: string | null }).foto_path
  if (!path) return NextResponse.json({ ok: true, arquivo_apagado: false })
  const { error: e2 } = await sb.storage.from(BUCKET).remove([path])
  if (e2) console.error('[pcc/remover-foto] foto ficou no bucket:', path, e2.message)
  return NextResponse.json({ ok: true, arquivo_apagado: !e2 })
}
