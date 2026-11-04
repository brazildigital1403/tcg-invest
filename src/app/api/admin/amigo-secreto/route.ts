// src/app/api/admin/amigo-secreto/route.ts
//
// Admin do Amigo Secreto. GET: a edicao em curso, os participantes (sem o
// par: o admin nao ve quem tirou quem pela tela) e quem esta com o perfil
// incompleto. POST {acao:'sortear'}: dispara amigo_secreto_sortear, que so o
// service_role pode chamar. POST {acao:'estado', estado}: avanca a fase
// (entregas, encerrado). As datas mudam direto no banco.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { AMIGO_SECRETO_SLUG } from '@/lib/amigoSecreto'

export async function GET(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  const [{ data: edicao, error: e1 }, { data: parts, error: e2 }, { count: nMsgs, error: e3 }] = await Promise.all([
    sb.from('amigo_secreto_edicoes').select('*').eq('slug', AMIGO_SECRETO_SLUG).maybeSingle(),
    sb.from('amigo_secreto_participantes')
      .select('id, instagram, whatsapp, nome_completo, pokemon, cep, numero, cidade, uf, desejo, me_surpreenda, tirou_id, rastreio, postado_em, recebido_em, quer_revelar, created_at, users(email)')
      .order('created_at', { ascending: false }),
    sb.from('amigo_secreto_mensagens').select('id', { count: 'exact', head: true }),
  ])
  const erro = e1 || e2 || e3
  if (erro) return NextResponse.json({ error: erro.message }, { status: 500 })

  const participantes = (parts || []).map(p => ({
      id: p.id, instagram: p.instagram, whatsapp: p.whatsapp, nome_completo: p.nome_completo, pokemon: p.pokemon,
      cidade: p.cidade, uf: p.uf, created_at: p.created_at,
      email: (p.users as unknown as { email?: string } | null)?.email || null,
      completo: !!(p.cep && p.numero && (p.me_surpreenda || (p.desejo && p.desejo.trim()))),
      tem_par: !!p.tirou_id, postado_em: p.postado_em, rastreio: p.rastreio, recebido_em: p.recebido_em, quer_revelar: p.quer_revelar,
    }))

  return NextResponse.json({ edicao, participantes, mensagens: nMsgs ?? null })
}

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  const body = await req.json().catch(() => ({})) as { acao?: string; estado?: string }

  if (body.acao === 'sortear') {
    const { data, error } = await sb.rpc('amigo_secreto_sortear', { p_slug: AMIGO_SECRETO_SLUG })
    if (error) {
      const m = error.message || ''
      const msg = m.includes('perfis_incompletos') ? `Ainda há perfis incompletos (${m.split(':').pop()?.trim()}). Todo mundo precisa de endereço e desejo.`
        : m.includes('minimo_nao_atingido') ? `Mínimo não atingido (${m.split(':').pop()?.trim()}).`
        : m.includes('ja_sorteado') ? 'O sorteio já foi feito.'
        : m
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json({ ok: true, resultado: data })
  }

  if (body.acao === 'estado' && body.estado && ['entregas', 'encerrado'].includes(body.estado)) {
    const { error } = await sb.from('amigo_secreto_edicoes').update({ estado: body.estado }).eq('slug', AMIGO_SECRETO_SLUG)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
