// src/app/api/admin/club-avisos/route.ts
//
// Avisos do Club no /admin (08/11/2026). O admin e cookie de senha, sem conta
// no Supabase: usa as funcoes *_interno pela chave de servico, com autor nulo
// ("Admin Bynx"). As regras sao as mesmas do organizador e ficam no banco.
//
// GET: todos os avisos + eventos da Agenda para vincular.
// POST multipart {imagem}                    -> sobe para club-fotos/avisos/
// POST {acao:'salvar', id?, dados, como}     -> club_aviso_salvar_interno
// POST {acao:'estado', id, como}             -> club_aviso_estado_interno
// POST {acao:'atualizar', id, texto}         -> club_aviso_atualizar_interno
// POST {acao:'votos', id}                    -> club_aviso_votos_interno

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
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const [l, e] = await Promise.all([
    sb.rpc('club_avisos_admin_lista'),
    sb.from('club_eventos').select('id, titulo, inicio_data').in('status', ['publicado', 'adiado']).gte('fim_data', hoje).order('inicio_data').limit(100),
  ])
  if (l.error) return NextResponse.json({ error: l.error.message }, { status: 500 })
  return NextResponse.json({ lista: l.data || [], eventos: e.data || [] })
}

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  if ((req.headers.get('content-type') || '').startsWith('multipart/form-data')) {
    const form = await req.formData().catch(() => null)
    const f = form?.get('imagem')
    if (!(f instanceof File) || !TIPOS_IMG[f.type] || f.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'imagem_invalida' }, { status: 400 })
    }
    const path = `avisos/${crypto.randomUUID()}.${TIPOS_IMG[f.type]}`
    const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type, cacheControl: '31536000' })
    if (error) return NextResponse.json({ error: 'imagem_invalida' }, { status: 500 })
    return NextResponse.json({ path })
  }

  const body = await req.json().catch(() => ({})) as { acao?: string; id?: string | null; dados?: Record<string, unknown>; como?: string; texto?: string }

  if (body.acao === 'salvar') {
    const id = body.id || null
    let antigas: string[] = []
    if (id) {
      const { data: velho } = await sb.from('club_avisos').select('imagens').eq('id', id).maybeSingle()
      antigas = (velho?.imagens as string[] | undefined) || []
    }
    const { data, error } = await sb.rpc('club_aviso_salvar_interno', { p_id: id, p: body.dados || {}, p_acao: body.como, p_autor: null })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    // Imagem tirada do aviso: sai do armazenamento depois de salvar.
    const novas = (data as { imagens: string[] }).imagens || []
    const fora = antigas.filter(p => !novas.includes(p))
    if (fora.length) await sb.storage.from(BUCKET).remove(fora)
    return NextResponse.json({ aviso: data })
  }

  if (body.acao === 'estado' && body.id) {
    const { data, error } = await sb.rpc('club_aviso_estado_interno', { p_id: body.id, p_acao: body.como, p_autor: null })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    const imgs = (data as { imagens?: string[] }).imagens
    if (body.como === 'excluir' && imgs?.length) await sb.storage.from(BUCKET).remove(imgs)
    return NextResponse.json({ resultado: data })
  }

  if (body.acao === 'atualizar' && body.id) {
    const { data, error } = await sb.rpc('club_aviso_atualizar_interno', { p_id: body.id, p_texto: body.texto ?? '', p_autor: null })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ aviso: data })
  }

  if (body.acao === 'votos' && body.id) {
    const { data, error } = await sb.rpc('club_aviso_votos_interno', { p_id: body.id })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ votos: data })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
