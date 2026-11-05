// src/app/api/admin/aniversariantes/route.ts
//
// Admin dos Aniversariantes do Poke Creators Club (05/11/2026). GET: a lista
// com a URL publica de cada foto. POST {acao:'remover_foto', instagram}: apaga
// a foto do bucket club-fotos e limpa foto_path. A pessoa continua na lista,
// com o Pokemon ou a inicial do @ no lugar da foto.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabaseServer'

const BUCKET = 'club-fotos'

export async function GET(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  const { data, error } = await sb.from('club_aniversarios')
    .select('instagram, dia, mes, foto_path, created_at, updated_at')
    .order('mes').order('dia')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lista = (data || []).map(a => ({
    ...a,
    foto_url: a.foto_path ? sb.storage.from(BUCKET).getPublicUrl(a.foto_path).data.publicUrl : null,
  }))
  return NextResponse.json({ lista })
}

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  const body = await req.json().catch(() => ({})) as { acao?: string; instagram?: string }
  if (body.acao !== 'remover_foto' || typeof body.instagram !== 'string') {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }

  const instagram = body.instagram.toLowerCase()
  const { data: linha, error: e1 } = await sb.from('club_aniversarios').select('foto_path').eq('instagram', instagram).maybeSingle()
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  if (!linha) return NextResponse.json({ error: 'Pessoa não encontrada na lista.' }, { status: 404 })
  if (!linha.foto_path) return NextResponse.json({ error: 'Essa pessoa não tem foto.' }, { status: 404 })

  // Limpa o banco antes de apagar o arquivo: se o storage falhar, a tela ja
  // nao mostra a foto, e o arquivo orfao some na proxima limpeza manual.
  const { error: e2 } = await sb.from('club_aniversarios').update({ foto_path: null, updated_at: new Date().toISOString() }).eq('instagram', instagram)
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  const { error: e3 } = await sb.storage.from(BUCKET).remove([linha.foto_path])
  if (e3) console.error('[admin/aniversariantes] foto ficou no bucket:', linha.foto_path, e3.message)

  return NextResponse.json({ ok: true, arquivo_apagado: !e3 })
}
