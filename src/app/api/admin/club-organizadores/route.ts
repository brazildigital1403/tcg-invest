// src/app/api/admin/club-organizadores/route.ts
//
// Organizadores do Club no /admin (08/11/2026, quadro AD0). So o Du entra aqui.
// Organizador e uma conta da Bynx com papeis; o navegador nunca escreve em
// club_organizadores. Papeis da v1: agenda e aniversariantes. Amigo Secreto
// nao e papel: fica so com o Du.
//
// GET: organizadores com o @ e o e-mail da conta.
// POST {acao:'adicionar', conta, papeis}  conta = @ do perfil ou e-mail
// POST {acao:'papeis', user_id, papeis}   troca os papeis (lista vazia = remover)
// POST {acao:'remover', user_id}

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabaseServer'

const PAPEIS = ['agenda', 'aniversariantes'] as const

const limparPapeis = (p: unknown): string[] =>
  Array.isArray(p) ? Array.from(new Set(p.filter((x): x is string => typeof x === 'string' && (PAPEIS as readonly string[]).includes(x)))) : []

export async function GET(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  const { data, error } = await sb.from('club_organizadores')
    .select('user_id, papeis, created_at, updated_at, conta:users!club_organizadores_user_id_fkey(instagram, username, name, email)')
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lista: data || [] })
}

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  const body = await req.json().catch(() => ({})) as { acao?: string; conta?: string; user_id?: string; papeis?: unknown }
  const log = (acao: string, alvo: string, detalhe: object) =>
    sb.from('club_organizacao_log').insert({ user_id: null, papel: 'admin', acao, alvo, detalhe })

  if (body.acao === 'adicionar') {
    const papeis = limparPapeis(body.papeis)
    if (papeis.length === 0) return NextResponse.json({ error: 'Marque pelo menos um papel.' }, { status: 400 })
    const termo = (body.conta || '').trim().replace(/^@/, '').toLowerCase()
    if (!termo) return NextResponse.json({ error: 'Coloque o @ ou o e-mail da conta.' }, { status: 400 })
    // O PostgREST trata * como curinga no ilike: um termo com * poderia pegar outra conta.
    if (termo.includes('*')) return NextResponse.json({ error: 'Use o @ ou o e-mail exato, sem *.' }, { status: 400 })

    // ilike sem curinga: _ e % do @ viram literais. Ponto no @ quebraria o .or()
    // do PostgREST, por isso uma busca por campo.
    const exato = termo.replace(/[\\%_]/g, m => `\\${m}`)
    const buscar = async (campo: 'email' | 'instagram' | 'username') =>
      sb.from('users').select('id, instagram, username, email').ilike(campo, exato).limit(2)
    let r = await buscar(termo.includes('@') ? 'email' : 'instagram')
    if (!r.error && (r.data?.length ?? 0) === 0 && !termo.includes('@')) r = await buscar('username')
    const { data: achados, error } = r
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!achados || achados.length === 0) return NextResponse.json({ error: 'Não achamos uma conta da Bynx com esse @ ou e-mail.' }, { status: 404 })
    if (achados.length > 1) return NextResponse.json({ error: 'Mais de uma conta com esse @. Use o e-mail.' }, { status: 409 })

    const u = achados[0]
    const { error: e2 } = await sb.from('club_organizadores')
      .upsert({ user_id: u.id, papeis, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    const nome = u.instagram ? `@${u.instagram}` : u.username ? `@${u.username}` : u.email
    await log('adicionar_organizador', u.instagram || u.username || u.email, { papeis })
    return NextResponse.json({ ok: true, nome })
  }

  if ((body.acao === 'papeis' || body.acao === 'remover') && typeof body.user_id === 'string') {
    const papeis = body.acao === 'remover' ? [] : limparPapeis(body.papeis)
    const { data: u } = await sb.from('users').select('instagram, username, email').eq('id', body.user_id).maybeSingle()
    const alvo = u?.instagram || u?.username || u?.email || body.user_id
    if (papeis.length === 0) {
      const { error } = await sb.from('club_organizadores').delete().eq('user_id', body.user_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await log('remover_organizador', alvo, {})
    } else {
      const { error } = await sb.from('club_organizadores').update({ papeis, updated_at: new Date().toISOString() }).eq('user_id', body.user_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await log('trocar_papeis', alvo, { papeis })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
