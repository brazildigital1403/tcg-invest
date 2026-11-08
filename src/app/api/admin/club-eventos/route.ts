// src/app/api/admin/club-eventos/route.ts
//
// Agenda do Club no /admin (08/11/2026). O admin e cookie de senha, sem conta
// no Supabase, entao usa as funcoes *_interno pela chave de servico, com autor
// nulo ("Admin Bynx"). As regras sao as mesmas do organizador: ficam no banco.
//
// GET: todos os eventos, com quem criou e editou.
// POST {acao:'salvar', id?, dados, como}          -> club_agenda_salvar_interno
// POST {acao:'estado', id, como, nota?}            -> club_agenda_estado_interno
// POST multipart {imagem}                          -> sobe para club-fotos/eventos/

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabaseServer'

const BUCKET = 'club-fotos'
const TIPOS_IMG: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }

export async function GET(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  const { data, error } = await sb.from('club_eventos')
    .select('*, criador:users!club_eventos_criado_por_fkey(instagram, username), editor:users!club_eventos_editado_por_fkey(instagram, username)')
    .order('inicio_data', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type U = { instagram: string | null; username: string | null } | null
  const lista = (data || []).map(({ criador, editor, ...e }) => ({
    ...e,
    hora_inicio: e.hora_inicio ? String(e.hora_inicio).slice(0, 5) : null,
    hora_fim: e.hora_fim ? String(e.hora_fim).slice(0, 5) : null,
    criado_por: (criador as U)?.instagram || (criador as U)?.username || null,
    editado_por: (editor as U)?.instagram || (editor as U)?.username || null,
  }))
  return NextResponse.json({ lista })
}

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  // Imagem: multipart, valida tipo e tamanho antes de subir.
  if ((req.headers.get('content-type') || '').startsWith('multipart/form-data')) {
    const form = await req.formData().catch(() => null)
    const f = form?.get('imagem')
    if (!(f instanceof File) || !TIPOS_IMG[f.type] || f.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'imagem_invalida' }, { status: 400 })
    }
    const path = `eventos/${crypto.randomUUID()}.${TIPOS_IMG[f.type]}`
    const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type, cacheControl: '31536000' })
    if (error) return NextResponse.json({ error: 'imagem_invalida' }, { status: 500 })
    return NextResponse.json({ path })
  }

  const body = await req.json().catch(() => ({})) as {
    acao?: string; id?: string | null; dados?: Record<string, unknown>; como?: string; nota?: string
  }

  if (body.acao === 'salvar') {
    const id = body.id || null
    let imagemAntiga: string | null = null
    if (id) {
      const { data: velho } = await sb.from('club_eventos').select('imagem_path').eq('id', id).maybeSingle()
      imagemAntiga = velho?.imagem_path ?? null
    }
    const { data, error } = await sb.rpc('club_agenda_salvar_interno', { p_id: id, p: body.dados || {}, p_acao: body.como, p_autor: null })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    // Imagem trocada ou tirada: a antiga sai depois de salvar.
    const nova = (data as { imagem_path: string | null }).imagem_path
    if (imagemAntiga && imagemAntiga !== nova) await sb.storage.from(BUCKET).remove([imagemAntiga])
    return NextResponse.json({ evento: data })
  }

  if (body.acao === 'estado' && body.id) {
    const { data, error } = await sb.rpc('club_agenda_estado_interno', { p_id: body.id, p_acao: body.como, p_nota: body.nota ?? null, p_autor: null })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    const img = (data as { imagem_path?: string | null }).imagem_path
    if (body.como === 'excluir' && img) await sb.storage.from(BUCKET).remove([img])
    return NextResponse.json({ resultado: data })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
