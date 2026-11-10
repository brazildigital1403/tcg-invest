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
import { enviarLoteEmails } from '@/lib/email'
import { FROM_CLUB, renderEmailSorteio, type EdicaoSorteio } from '@/lib/emailAmigoSecreto'

export async function GET(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  const { data: edicao, error: e1 } = await sb.from('amigo_secreto_edicoes').select('*').eq('slug', AMIGO_SECRETO_SLUG).maybeSingle()
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  if (!edicao) return NextResponse.json({ edicao: null, participantes: [], mensagens: null })

  // So a edicao em curso: a 2a edicao nao pode listar WhatsApp e cidade da 1a.
  const [{ data: parts, error: e2 }, { count: nMsgs, error: e3 }] = await Promise.all([
    sb.from('amigo_secreto_participantes')
      .select('id, instagram, whatsapp, nome_completo, pokemon, cep, numero, cidade, uf, desejo, me_surpreenda, tirou_id, rastreio, postado_em, recebido_em, quer_revelar, created_at, users(email)')
      .eq('edicao_id', edicao.id)
      .order('created_at', { ascending: false }),
    sb.from('amigo_secreto_mensagens').select('id', { count: 'exact', head: true }).eq('edicao_id', edicao.id),
  ])
  const erro = e2 || e3
  if (erro) return NextResponse.json({ error: erro.message }, { status: 500 })

  // Sem o id da linha: com o id e a semente, o admin recomporia os pares.
  const participantes = (parts || []).map(p => ({
      instagram: p.instagram, whatsapp: p.whatsapp, nome_completo: p.nome_completo, pokemon: p.pokemon,
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

  const body = await req.json().catch(() => ({})) as { acao?: string; estado?: string; instagram?: string; para?: string }

  // Remover participante antes do sorteio (analise de 04/11): quem entrou
  // pelo link sem ser do grupo sai daqui. Depois do sorteio nao: desfaria um par.
  if (body.acao === 'remover' && typeof body.instagram === 'string') {
    const { data: ed } = await sb.from('amigo_secreto_edicoes').select('id, estado').eq('slug', AMIGO_SECRETO_SLUG).maybeSingle()
    if (!ed) return NextResponse.json({ error: 'Edição não encontrada' }, { status: 404 })
    if (ed.estado !== 'inscricoes') return NextResponse.json({ error: 'O sorteio já aconteceu: remover agora desfaria um par.' }, { status: 400 })
    const { data: del, error } = await sb.from('amigo_secreto_participantes')
      .delete().eq('edicao_id', ed.id).eq('instagram', body.instagram.toLowerCase()).is('tirou_id', null).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!del || del.length === 0) return NextResponse.json({ error: 'Participante não encontrado.' }, { status: 404 })
    return NextResponse.json({ ok: true })
  }

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
    // Sorteio feito: cada participante recebe o e-mail "A pokebola abriu".
    // O e-mail nao diz quem a pessoa tirou; falha no envio nao desfaz o sorteio.
    const emails = await enviarEmailSorteio(sb).catch((e: unknown) => {
      console.error('[amigo-secreto] e-mail do sorteio falhou:', e)
      return { enviados: 0, falhas: -1 }
    })
    return NextResponse.json({ ok: true, n: (data as { n?: number } | null)?.n ?? null, emails })
  }

  // Reenvio manual (so depois do sorteio). Com `para`, manda UM e-mail de teste
  // com nome de exemplo para esse endereco, em qualquer fase.
  if (body.acao === 'email_sorteio') {
    if (typeof body.para === 'string' && body.para.includes('@')) {
      const { data: ed } = await sb.from('amigo_secreto_edicoes').select('postar_ate, revelacao_em, teto_cents').eq('slug', AMIGO_SECRETO_SLUG).single()
      if (!ed) return NextResponse.json({ error: 'Edição não encontrada.' }, { status: 404 })
      const { subject, html } = renderEmailSorteio({ nome: 'Du', instagram: 'bynx.gg', edicao: ed as EdicaoSorteio })
      const r = await enviarLoteEmails([{ to: body.para.trim(), subject: `[Teste] ${subject}`, html }], { from: FROM_CLUB })
      return NextResponse.json({ ok: r[0]?.ok ?? false, resultado: r[0] })
    }
    const { data: ed } = await sb.from('amigo_secreto_edicoes').select('estado').eq('slug', AMIGO_SECRETO_SLUG).single()
    if (!ed || ed.estado === 'inscricoes') return NextResponse.json({ error: 'O sorteio ainda não foi feito.' }, { status: 400 })
    const emails = await enviarEmailSorteio(sb)
    return NextResponse.json({ ok: true, emails })
  }

  if (body.acao === 'estado' && body.estado && ['entregas', 'encerrado'].includes(body.estado)) {
    const { error } = await sb.from('amigo_secreto_edicoes').update({ estado: body.estado }).eq('slug', AMIGO_SECRETO_SLUG)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}

type Sb = NonNullable<ReturnType<typeof getServiceSupabase>>

/** Manda "A pokebola abriu" para todos os participantes da edicao, em lote. */
async function enviarEmailSorteio(sb: Sb): Promise<{ enviados: number; falhas: number }> {
  const { data: ed, error: e1 } = await sb.from('amigo_secreto_edicoes').select('id, postar_ate, revelacao_em, teto_cents').eq('slug', AMIGO_SECRETO_SLUG).single()
  if (e1 || !ed) throw new Error(e1?.message || 'edicao_nao_encontrada')
  const { data: ps, error: e2 } = await sb.from('amigo_secreto_participantes').select('id, instagram, nome_completo, users(email)').eq('edicao_id', ed.id)
  if (e2) throw new Error(e2.message)
  const itens = (ps || []).flatMap(p => {
    const to = (p.users as unknown as { email?: string } | null)?.email
    if (!to) return []
    const { subject, html } = renderEmailSorteio({ nome: p.nome_completo, instagram: p.instagram, edicao: ed as EdicaoSorteio })
    return [{ to, subject, html, chave: `amigo-secreto-sorteio-${p.id}` }]
  })
  const res = await enviarLoteEmails(itens, { from: FROM_CLUB })
  const enviados = res.filter(r => r.ok).length
  console.log(`[amigo-secreto] e-mail do sorteio: ${enviados} de ${itens.length} enviados`)
  return { enviados, falhas: itens.length - enviados }
}
