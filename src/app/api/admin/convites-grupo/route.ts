// src/app/api/admin/convites-grupo/route.ts
//
// Admin dos convites de grupo (link /criadores?c=<codigo> com N dias de Pro).
// GET lista convites com o funil e quem resgatou; POST cria; PATCH liga,
// desliga, muda teto ou prazo. Revogar o Pro de alguem e caso a caso, no banco.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { normalizarCodigo } from '@/lib/convitesGrupo'

export async function GET(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  const [{ data: convites, error: e1 }, { data: eventos, error: e2 }, { data: resgates, error: e3 }] = await Promise.all([
    sb.from('convites_grupo').select('id, codigo, nome, campanha, dias_pro, max_usos, usos, expira_em, ativo, criado_em').order('criado_em', { ascending: false }),
    sb.from('convite_grupo_eventos').select('convite_id, etapa'),
    sb.from('convite_grupo_resgates')
      .select('convite_id, user_id, conta_nova, pro_ate, instagram, quer_parceria, parceria_pedida_em, resgatado_em, users(name, email, perfil_publico)')
      .order('resgatado_em', { ascending: false }),
  ])
  const erro = e1 || e2 || e3
  if (erro) return NextResponse.json({ error: erro.message }, { status: 500 })

  // Cartas na colecao de quem resgatou: a metrica de ativacao do convite.
  const ids = (resgates || []).map(r => r.user_id)
  const cartas = new Map<string, number>()
  // Contagem por pessoa (head): um select das linhas bateria no teto de 1000
  // do PostgREST e contaria menos. O teto do convite segura o numero de idas.
  await Promise.all(ids.map(async id => {
    const { count } = await sb.from('user_cards').select('*', { count: 'exact', head: true }).eq('user_id', id)
    cartas.set(id, count || 0)
  }))

  const funil = new Map<string, Record<string, number>>()
  for (const ev of eventos || []) {
    const f = funil.get(ev.convite_id) || {}
    f[ev.etapa] = (f[ev.etapa] || 0) + 1
    funil.set(ev.convite_id, f)
  }

  return NextResponse.json({
    convites: (convites || []).map(c => ({ ...c, funil: funil.get(c.id) || {} })),
    resgates: (resgates || []).map(r => {
      const u = (Array.isArray(r.users) ? r.users[0] : r.users) as { name?: string; email?: string; perfil_publico?: boolean } | null
      return {
      convite_id: r.convite_id,
      user_id: r.user_id,
      nome: u?.name || '',
      email: u?.email || '',
      perfil_publico: !!u?.perfil_publico,
      conta_nova: r.conta_nova,
      pro_ate: r.pro_ate,
      instagram: r.instagram,
      quer_parceria: r.quer_parceria,
      parceria_pedida_em: r.parceria_pedida_em,
      resgatado_em: r.resgatado_em,
      cartas: cartas.get(r.user_id) || 0,
    }}),
  })
}

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  const b = (await req.json().catch(() => ({}))) as { codigo?: string; nome?: string; campanha?: string; max_usos?: number; dias_validade?: number; dias_pro?: number }
  const codigo = normalizarCodigo(b.codigo)
  if (!codigo) return NextResponse.json({ error: 'Código com 4 a 40 caracteres: letras minúsculas, números e hífen.' }, { status: 400 })
  const nome = (b.nome || '').trim()
  if (!nome) return NextResponse.json({ error: 'Dê um nome ao convite.' }, { status: 400 })
  const maxUsos = Math.floor(Number(b.max_usos))
  const diasValidade = Math.floor(Number(b.dias_validade))
  const diasPro = Math.floor(Number(b.dias_pro ?? 365))
  if (!(maxUsos > 0 && maxUsos <= 1000)) return NextResponse.json({ error: 'Vagas entre 1 e 1000.' }, { status: 400 })
  if (!(diasValidade > 0 && diasValidade <= 90)) return NextResponse.json({ error: 'Prazo do link entre 1 e 90 dias.' }, { status: 400 })
  if (!(diasPro > 0 && diasPro <= 730)) return NextResponse.json({ error: 'Dias de Pro entre 1 e 730.' }, { status: 400 })

  const { data, error } = await sb.from('convites_grupo').insert({
    codigo, nome,
    campanha: (b.campanha || '').trim() || codigo,
    max_usos: maxUsos,
    dias_pro: diasPro,
    expira_em: new Date(Date.now() + diasValidade * 86_400_000).toISOString(),
  }).select('id, codigo').single()
  if (error) {
    const dup = /duplicate|unique/i.test(error.message)
    return NextResponse.json({ error: dup ? 'Já existe um convite com esse código.' : error.message }, { status: dup ? 409 : 500 })
  }
  return NextResponse.json({ ok: true, convite: data })
}

export async function PATCH(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  const b = (await req.json().catch(() => ({}))) as { id?: string; ativo?: boolean; max_usos?: number; mais_dias?: number }
  if (!b.id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const mud: Record<string, unknown> = {}
  if (typeof b.ativo === 'boolean') mud.ativo = b.ativo
  if (b.max_usos !== undefined) {
    const m = Math.floor(Number(b.max_usos))
    if (!(m > 0 && m <= 1000)) return NextResponse.json({ error: 'Vagas entre 1 e 1000.' }, { status: 400 })
    mud.max_usos = m
  }
  if (b.mais_dias !== undefined) {
    const d = Math.floor(Number(b.mais_dias))
    if (!(d > 0 && d <= 90)) return NextResponse.json({ error: 'Estender entre 1 e 90 dias.' }, { status: 400 })
    const { data: atual } = await sb.from('convites_grupo').select('expira_em').eq('id', b.id).single()
    const base = Math.max(Date.now(), atual ? Date.parse(atual.expira_em) : Date.now())
    mud.expira_em = new Date(base + d * 86_400_000).toISOString()
  }
  if (!Object.keys(mud).length) return NextResponse.json({ error: 'Nada para mudar.' }, { status: 400 })

  const { error } = await sb.from('convites_grupo').update(mud).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
