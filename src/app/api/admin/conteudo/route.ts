// GET  /api/admin/conteudo  -> estado do checklist, publicacoes da semana, cadastros por canal
// POST /api/admin/conteudo  -> marca item do checklist, ou registra publicacao do dia
//
// Serve a tela /admin/conteudo. O estado mora no banco (e nao no localStorage)
// por dois motivos: o Du alterna entre celular e computador, e o historico de
// publicacao so vira informacao util quando da pra cruzar com o cadastro que
// entrou naquele dia — o que exige os dois lados no mesmo lugar.

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

/** Segunda-feira da semana corrente, em horario local do Brasil. */
function inicioDaSemana(): string {
  const agora = new Date()
  const diaDaSemana = (agora.getDay() + 6) % 7 // 0 = segunda
  const segunda = new Date(agora)
  segunda.setDate(agora.getDate() - diaDaSemana)
  return segunda.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const sb = supabaseAdmin()
    const desde = inicioDaSemana()

    // Em paralelo: nao dependem uma da outra.
    const [checkRes, postsRes, canaisRes, cfgRes] = await Promise.all([
      sb.from('conteudo_checklist').select('chave, feito'),
      sb.from('conteudo_posts').select('data, pilar, formato, gancho, observacao').gte('data', desde),
      sb
        .from('users')
        .select('signup_utm_source, signup_utm_medium')
        .gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString()),
      sb.from('conteudo_config').select('chave, valor'),
    ])

    if (checkRes.error) throw new Error(`checklist: ${checkRes.error.message}`)
    if (postsRes.error) throw new Error(`posts: ${postsRes.error.message}`)

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

    return NextResponse.json({
      checklist,
      config,
      posts: postsRes.data || [],
      canais: Object.entries(canais)
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total),
      totalCadastros: (canaisRes.data || []).length,
      semanaDesde: desde,
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

    // ─── Registrar a publicacao do dia ────────────────────────────────────
    if (body.acao === 'publicar') {
      const data =
        typeof body.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.data)
          ? body.data
          : new Date().toISOString().slice(0, 10)

      // `onConflict: data` porque o indice unico e por dia: marcar duas vezes
      // no mesmo dia atualiza em vez de duplicar.
      const { error } = await sb.from('conteudo_posts').upsert(
        {
          data,
          pilar: typeof body.pilar === 'string' ? body.pilar.slice(0, 40) : null,
          formato: typeof body.formato === 'string' ? body.formato.slice(0, 60) : null,
          gancho: typeof body.gancho === 'string' ? body.gancho.slice(0, 300) : null,
          observacao: typeof body.observacao === 'string' ? body.observacao.slice(0, 500) : null,
        },
        { onConflict: 'data' }
      )
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, data })
    }

    // ─── Desfazer a marcacao de um dia ────────────────────────────────────
    if (body.acao === 'desmarcar') {
      const data = typeof body.data === 'string' ? body.data : ''
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return NextResponse.json({ error: 'data invalida' }, { status: 400 })
      }
      const { error } = await sb.from('conteudo_posts').delete().eq('data', data)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'acao desconhecida' }, { status: 400 })
  } catch (err: any) {
    console.error('[admin/conteudo POST]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
