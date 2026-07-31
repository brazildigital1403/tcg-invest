// GET  /api/admin/conteudo  -> checklist, fila de conteudo, historico recente, cadastros por canal
// POST /api/admin/conteudo  -> marca checklist, mexe na fila (criar/editar/postar/reordenar/remover)
//
// Serve a tela /admin/conteudo. O estado mora no banco (nao no localStorage)
// por dois motivos: o Du alterna entre celular e computador, e o historico de
// publicacao so vira informacao util quando da pra cruzar com o cadastro que
// entrou naquele dia — o que exige os dois lados no mesmo lugar.
//
// ★ FILA (31/07/2026): trocou de "um post = um dia" (conteudo_posts, indice
// unico por data) pra fila com status (rascunho -> pronto -> postado). O
// motivo: o Du produz em lote, adiantado, e o modelo antigo nao tinha onde
// guardar "3 prontos esperando a vez" — so existia "o de hoje". conteudo_posts
// continua intacta (historico antigo), so paramos de escrever nela; a fila
// nova mora em conteudo_fila, com o historico ja migrado pra la.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function GET(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const sb = supabaseAdmin()

    const [checkRes, filaRes, historicoRes, canaisRes, cfgRes] = await Promise.all([
      sb.from('conteudo_checklist').select('chave, feito'),
      sb.from('conteudo_fila')
        .select('id, pilar, formato, gancho, observacao, status, ordem, criado_em')
        .in('status', ['pronto', 'rascunho'])
        .order('ordem', { ascending: true, nullsFirst: false })
        .order('criado_em', { ascending: true }),
      sb.from('conteudo_fila')
        .select('id, pilar, formato, gancho, observacao, postado_em')
        .eq('status', 'postado')
        .order('postado_em', { ascending: false })
        .limit(10),
      sb
        .from('users')
        .select('signup_utm_source, signup_utm_medium')
        .gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString()),
      sb.from('conteudo_config').select('chave, valor'),
    ])

    if (checkRes.error) throw new Error(`checklist: ${checkRes.error.message}`)
    if (filaRes.error) throw new Error(`fila: ${filaRes.error.message}`)
    if (historicoRes.error) throw new Error(`historico: ${historicoRes.error.message}`)

    const checklist: Record<string, boolean> = {}
    for (const r of checkRes.data || []) checklist[r.chave] = r.feito

    const config: Record<string, string> = {}
    for (const r of cfgRes.data || []) config[r.chave] = r.valor

    // Cadastros por canal nos ultimos 30 dias. A atribuicao comecou a coletar em
    // 29/07/2026, entao no comeco quase tudo cai em "(sem origem)" — e correto,
    // nao e bug: sao cadastros anteriores a captura existir.
    const canais: Record<string, number> = {}
    for (const u of (canaisRes.data || []) as { signup_utm_source: string | null; signup_utm_medium: string | null }[]) {
      const nome = u.signup_utm_source
        ? `${u.signup_utm_source}${u.signup_utm_medium ? ' / ' + u.signup_utm_medium : ''}`
        : '(sem origem)'
      canais[nome] = (canais[nome] || 0) + 1
    }

    // Ordena pronto antes de rascunho (mesmo com o .order duplo do select,
    // ordem=null dos rascunhos intercala mal com nullsFirst:false) -- fica
    // explicito aqui em vez de depender de nuance do Postgrest.
    const fila = (filaRes.data || []).slice().sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pronto' ? -1 : 1
      return 0
    })

    return NextResponse.json({
      checklist,
      config,
      fila,
      historico: historicoRes.data || [],
      canais: Object.entries(canais)
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total),
      totalCadastros: (canaisRes.data || []).length,
    })
  } catch (err: any) {
    console.error('[admin/conteudo GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const body = await req.json().catch(() => null)
    if (!body?.acao) return NextResponse.json({ error: 'acao ausente' }, { status: 400 })

    const sb = supabaseAdmin()

    // ─── Marcar / desmarcar um item do checklist ──────────────────────────
    if (body.acao === 'checklist') {
      const chave = typeof body.chave === 'string' ? body.chave.trim().slice(0, 80) : ''
      if (!chave) return NextResponse.json({ error: 'chave invalida' }, { status: 400 })

      const { error } = await sb
        .from('conteudo_checklist')
        .upsert(
          { chave, feito: Boolean(body.feito), atualizado_em: new Date().toISOString() },
          { onConflict: 'chave' }
        )
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    // ─── Guardar um valor avulso (ex: os campos da calculadora de metas) ──
    if (body.acao === 'config') {
      const chave = typeof body.chave === 'string' ? body.chave.trim().slice(0, 60) : ''
      const valor = body.valor == null ? '' : String(body.valor).slice(0, 200)
      if (!chave) return NextResponse.json({ error: 'chave invalida' }, { status: 400 })

      const { error } = await sb
        .from('conteudo_config')
        .upsert({ chave, valor, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    // ─── Criar 1 item na fila (rascunho ou ja pronto) ─────────────────────
    if (body.acao === 'fila_criar') {
      const status = body.status === 'pronto' ? 'pronto' : 'rascunho'
      let ordem: number | null = null
      if (status === 'pronto') {
        const { data: max } = await sb.from('conteudo_fila').select('ordem').eq('status', 'pronto')
          .order('ordem', { ascending: false }).limit(1).maybeSingle()
        ordem = (max?.ordem ?? 0) + 1
      }
      const { data, error } = await sb.from('conteudo_fila').insert({
        pilar: typeof body.pilar === 'string' ? body.pilar.slice(0, 40) : null,
        formato: typeof body.formato === 'string' ? body.formato.slice(0, 60) : null,
        gancho: typeof body.gancho === 'string' ? body.gancho.slice(0, 300) : null,
        observacao: typeof body.observacao === 'string' ? body.observacao.slice(0, 500) : null,
        status,
        ordem,
      }).select('id').single()
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, id: data.id })
    }

    // ─── Criar varios rascunhos de uma vez ("Preencher a semana") ─────────
    if (body.acao === 'fila_criar_lote') {
      const itens = Array.isArray(body.itens) ? body.itens.slice(0, 14) : []
      if (itens.length === 0) return NextResponse.json({ error: 'lista vazia' }, { status: 400 })
      const linhas = itens.map((it: any) => ({
        pilar: typeof it.pilar === 'string' ? it.pilar.slice(0, 40) : null,
        formato: typeof it.formato === 'string' ? it.formato.slice(0, 60) : null,
        gancho: typeof it.gancho === 'string' ? it.gancho.slice(0, 300) : null,
        status: 'rascunho',
      }))
      const { error } = await sb.from('conteudo_fila').insert(linhas)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, criados: linhas.length })
    }

    // ─── Editar um item (texto e/ou promover rascunho -> pronto) ──────────
    if (body.acao === 'fila_atualizar') {
      const id = typeof body.id === 'string' ? body.id : ''
      if (!id) return NextResponse.json({ error: 'id ausente' }, { status: 400 })

      const patch: Record<string, any> = { atualizado_em: new Date().toISOString() }
      if (typeof body.pilar === 'string') patch.pilar = body.pilar.slice(0, 40)
      if (typeof body.formato === 'string') patch.formato = body.formato.slice(0, 60)
      if (typeof body.gancho === 'string') patch.gancho = body.gancho.slice(0, 300)
      if (typeof body.observacao === 'string') patch.observacao = body.observacao.slice(0, 500)

      // rascunho -> pronto: entra no fim da fila de prontos.
      if (body.marcarPronto) {
        const { data: max } = await sb.from('conteudo_fila').select('ordem').eq('status', 'pronto')
          .order('ordem', { ascending: false }).limit(1).maybeSingle()
        patch.status = 'pronto'
        patch.ordem = (max?.ordem ?? 0) + 1
      }

      const { error } = await sb.from('conteudo_fila').update(patch).eq('id', id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    // ─── Postar o item (fecha o ciclo, vira historico) ────────────────────
    if (body.acao === 'fila_postar') {
      const id = typeof body.id === 'string' ? body.id : ''
      if (!id) return NextResponse.json({ error: 'id ausente' }, { status: 400 })

      const { error } = await sb.from('conteudo_fila').update({
        status: 'postado',
        postado_em: new Date().toISOString(),
        ordem: null,
        atualizado_em: new Date().toISOString(),
      }).eq('id', id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    // ─── Desfazer um "postado" recente (volta pro topo da fila) ───────────
    if (body.acao === 'fila_despostar') {
      const id = typeof body.id === 'string' ? body.id : ''
      if (!id) return NextResponse.json({ error: 'id ausente' }, { status: 400 })

      const { data: min } = await sb.from('conteudo_fila').select('ordem').eq('status', 'pronto')
        .order('ordem', { ascending: true }).limit(1).maybeSingle()
      const { error } = await sb.from('conteudo_fila').update({
        status: 'pronto',
        postado_em: null,
        ordem: (min?.ordem ?? 1) - 1,
        atualizado_em: new Date().toISOString(),
      }).eq('id', id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    // ─── Reordenar a fila (drag) ───────────────────────────────────────────
    if (body.acao === 'fila_reordenar') {
      const itens = Array.isArray(body.itens) ? body.itens : []
      for (const it of itens) {
        if (typeof it?.id !== 'string' || typeof it?.ordem !== 'number') continue
        await sb.from('conteudo_fila').update({ ordem: it.ordem }).eq('id', it.id)
      }
      return NextResponse.json({ ok: true })
    }

    // ─── Remover um rascunho (nao mexe em pronto/postado por engano) ──────
    if (body.acao === 'fila_remover') {
      const id = typeof body.id === 'string' ? body.id : ''
      if (!id) return NextResponse.json({ error: 'id ausente' }, { status: 400 })

      const { error } = await sb.from('conteudo_fila').delete().eq('id', id).eq('status', 'rascunho')
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'acao desconhecida' }, { status: 400 })
  } catch (err: any) {
    console.error('[admin/conteudo POST]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
