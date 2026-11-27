// src/app/api/admin/club-feed/route.ts
//
// Feed do Club no /admin (27/11/2026, pedido do Du). So o Du entra aqui. Le tudo com o cliente de
// servico (as tabelas do feed sao fechadas para o navegador) e modera pela mesma funcao que a
// organizacao usa no feed (club_feed_moderar_interno), sem a trava de "proprio post" (autor nulo).
//
// GET: posts do feed (estado da capa, apoios, denuncias abertas), cota de capas de hoje e freio por rede.
// POST {acao:'moderar', id, tipo, motivo?, nota?}  tipo = tirar | devolver | manter | arroba_ok
// POST {acao:'capa_de_novo', id}                   zera as tentativas: a Mia Servidor tenta de novo na proxima hora
// POST {acao:'liberar_freio', rede}                tira o freio da rede agora
// Toda acao vai para club_organizacao_log (papel 'admin').

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabaseServer'

const REDES = ['instagram', 'tiktok', 'youtube', 'twitch'] as const
const TIPOS = ['tirar', 'devolver', 'manter', 'arroba_ok'] as const
const MOTIVOS = ['cobra_apoio', 'nao_e_da_pessoa', 'spam', 'link_quebrado', 'ofensivo', 'fora_do_tema', 'outro'] as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const hojeBrasilia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const limparArroba = (v: string | null | undefined) => (v || '').trim().replace(/^@+/, '').toLowerCase() || null

export async function GET(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  const { data: posts, error } = await sb.from('club_conteudos')
    .select('id, user_id, rede, formato, tema, url, feed_em, feed_pergunta, feed_oculto_em, feed_oculto_motivo, feed_oculto_nota, feed_conferir_arroba, capa_path, capa_status, capa_tentativas, capa_tentou_em, capa_erro')
    .not('feed_em', 'is', null)
    .order('feed_em', { ascending: false })
    .limit(300)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (posts || []).map(p => p.id)
  const donos = Array.from(new Set((posts || []).map(p => p.user_id)))
  const [u, a, d, cota, freio] = await Promise.all([
    donos.length ? sb.from('users').select('id, instagram').in('id', donos) : Promise.resolve({ data: [], error: null }),
    ids.length ? sb.from('club_feed_apoios').select('conteudo_id, gestos').in('conteudo_id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? sb.from('club_feed_denuncias').select('conteudo_id, motivo').in('conteudo_id', ids).is('resolvida_em', null) : Promise.resolve({ data: [], error: null }),
    sb.from('club_feed_capa_cota').select('rede, usadas').eq('dia', hojeBrasilia()),
    sb.from('club_feed_capa_freio').select('rede, bloqueado_ate, motivo, ocorrencias'),
  ])
  const falha = [u, a, d, cota, freio].find(r => r.error)
  if (falha?.error) return NextResponse.json({ error: falha.error.message }, { status: 500 })

  const arroba = new Map((u.data || []).map((x: { id: string; instagram: string | null }) => [x.id, limparArroba(x.instagram)]))
  const apoios = new Map<string, number>()
  for (const x of (a.data || []) as { conteudo_id: string; gestos: string[] }[]) {
    if (x.gestos.some(g => g !== 'segui')) apoios.set(x.conteudo_id, (apoios.get(x.conteudo_id) || 0) + 1)
  }
  const denuncias = new Map<string, Record<string, number>>()
  for (const x of (d.data || []) as { conteudo_id: string; motivo: string }[]) {
    const m = denuncias.get(x.conteudo_id) || {}
    m[x.motivo] = (m[x.motivo] || 0) + 1
    denuncias.set(x.conteudo_id, m)
  }

  const lista = (posts || []).map(p => ({
    id: p.id, arroba: arroba.get(p.user_id) || null, rede: p.rede, formato: p.formato, tema: p.tema, url: p.url,
    feed_em: p.feed_em, pergunta: p.feed_pergunta,
    oculto: !!p.feed_oculto_em, oculto_motivo: p.feed_oculto_motivo, oculto_nota: p.feed_oculto_nota,
    conferir_arroba: p.feed_conferir_arroba,
    capa: { path: p.capa_path, status: p.capa_status, tentativas: p.capa_tentativas, tentou_em: p.capa_tentou_em, erro: p.capa_erro },
    apoiaram: apoios.get(p.id) || 0,
    denuncias: denuncias.get(p.id) || null,
  }))

  return NextResponse.json({
    lista,
    cota: Object.fromEntries((cota.data || []).map((c: { rede: string; usadas: number }) => [c.rede, c.usadas])),
    freio: freio.data || [],
    tetos: { rede: 150, total: 300 },
  })
}

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  const body = await req.json().catch(() => ({})) as { acao?: string; id?: string; tipo?: string; motivo?: string; nota?: string; rede?: string }
  const log = (acao: string, alvo: string, detalhe: object) =>
    sb.from('club_organizacao_log').insert({ user_id: null, papel: 'admin', acao, alvo, detalhe })

  if (body.acao === 'moderar') {
    if (!body.id || !UUID.test(body.id)) return NextResponse.json({ error: 'Post inválido.' }, { status: 400 })
    if (!(TIPOS as readonly string[]).includes(body.tipo || '')) return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    if (body.tipo === 'tirar' && !(MOTIVOS as readonly string[]).includes(body.motivo || '')) return NextResponse.json({ error: 'Escolha o motivo.' }, { status: 400 })
    const nota = (body.nota || '').trim().slice(0, 300) || null
    // Autor nulo: o log da funcao registra user_id nulo, e esta rota soma a linha do admin.
    const { error } = await sb.rpc('club_feed_moderar_interno', {
      p_id: body.id, p_acao: body.tipo, p_motivo: body.tipo === 'tirar' ? body.motivo : null, p_nota: nota, p_autor: null,
    })
    if (error) return NextResponse.json({ error: error.message.includes('post_nao_encontrado') ? 'Esse post não está mais no feed.' : error.message }, { status: 400 })
    await log(`feed_${body.tipo}`, body.id, { motivo: body.motivo ?? null, nota })
    return NextResponse.json({ ok: true })
  }

  if (body.acao === 'capa_de_novo') {
    if (!body.id || !UUID.test(body.id)) return NextResponse.json({ error: 'Post inválido.' }, { status: 400 })
    const { data, error } = await sb.from('club_conteudos')
      .update({ capa_status: 'pendente', capa_tentativas: 0, capa_tentou_em: null, capa_erro: null })
      .eq('id', body.id).not('feed_em', 'is', null).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data?.length) return NextResponse.json({ error: 'Esse post não está mais no feed.' }, { status: 400 })
    await log('feed_capa_de_novo', body.id, {})
    return NextResponse.json({ ok: true })
  }

  if (body.acao === 'liberar_freio') {
    if (!(REDES as readonly string[]).includes(body.rede || '')) return NextResponse.json({ error: 'Rede inválida.' }, { status: 400 })
    const { error } = await sb.from('club_feed_capa_freio').update({ bloqueado_ate: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('rede', body.rede)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await log('feed_liberar_freio', body.rede!, {})
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 })
}
