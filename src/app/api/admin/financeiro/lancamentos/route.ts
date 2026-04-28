import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

const CATEGORIAS_TODAS = ['infra', 'marketing', 'dominio', 'pagamentos', 'impostos', 'assinatura', 'outros']
const CATEGORIAS_DESPESA = ['infra', 'marketing', 'dominio', 'pagamentos', 'impostos', 'outros']

// ─── Tipo do sub-item ─────────────────────────────────────────────────
// detalhes: [{ descricao: string, valor: number }, ...]

function validarDetalhes(detalhes: any): { ok: true; lista: { descricao: string; valor: number }[] } | { ok: false; error: string } {
  if (detalhes === null || detalhes === undefined) return { ok: true, lista: [] }
  if (!Array.isArray(detalhes)) return { ok: false, error: 'detalhes deve ser um array' }

  const lista: { descricao: string; valor: number }[] = []
  for (let i = 0; i < detalhes.length; i++) {
    const d = detalhes[i]
    if (!d || typeof d !== 'object') return { ok: false, error: `Item ${i + 1}: formato inválido` }
    const descricao = String(d.descricao || '').trim()
    if (!descricao) return { ok: false, error: `Item ${i + 1}: descrição obrigatória` }
    const valor = Number(d.valor)
    if (!Number.isFinite(valor) || valor < 0) {
      return { ok: false, error: `Item ${i + 1}: valor inválido` }
    }
    lista.push({ descricao, valor: Math.round(valor * 100) / 100 })
  }
  return { ok: true, lista }
}

// GET /api/admin/financeiro/lancamentos?tipo=&categoria=&status=&from=&to=&page=&perPage=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tipo      = searchParams.get('tipo')
    const categoria = searchParams.get('categoria')
    const status    = searchParams.get('status')
    const from      = searchParams.get('from')
    const to        = searchParams.get('to')
    const page      = Math.max(1, Number(searchParams.get('page') || 1))
    const perPage   = Math.min(100, Number(searchParams.get('perPage') || 30))

    const sb = supabaseAdmin()
    const fromIdx = (page - 1) * perPage
    const toIdx   = fromIdx + perPage - 1

    let q = sb.from('lancamentos').select('*, user:users!lancamentos_user_id_fkey(email, name)', { count: 'exact' })

    if (tipo === 'despesa' || tipo === 'receita') q = q.eq('tipo', tipo)
    if (categoria && CATEGORIAS_TODAS.includes(categoria)) q = q.eq('categoria', categoria)
    if (status === 'pago')      q = q.or('pago.eq.true,recebido.eq.true')
    if (status === 'pendente')  q = q.or('and(tipo.eq.despesa,pago.eq.false),and(tipo.eq.receita,recebido.eq.false)')
    if (from) q = q.gte('data_competencia', from)
    if (to)   q = q.lte('data_competencia', to)

    q = q.order('data_competencia', { ascending: false })
         .order('created_at',       { ascending: false })
         .range(fromIdx, toIdx)

    const { data, error, count } = await q
    if (error) {
      console.error('[financeiro/lancamentos GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Flatten do embed: { user: { email, name } } → { user_email, user_name }
    // pra UI consumir como campos diretos do lançamento (mais simples).
    const lancamentos = (data || []).map((l: any) => {
      const { user, ...rest } = l
      return {
        ...rest,
        user_email: user?.email || null,
        user_name:  user?.name  || null,
      }
    })

    return NextResponse.json({
      lancamentos,
      total: count || 0,
      page,
      perPage,
      totalPages: count ? Math.ceil(count / perPage) : 1,
    })
  } catch (err: any) {
    console.error('[financeiro/lancamentos GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST /api/admin/financeiro/lancamentos
// Body: { tipo, valor_bruto?, taxa?, descricao, categoria, data_competencia, data_liquidacao?, pago?, recebido?, fonte?, observacao?, detalhes? }
//
// Regra de soma:
//   - Se `detalhes` for um array com 1+ itens, valor_bruto vem da SOMA dos itens (ignora valor_bruto enviado)
//   - Se `detalhes` for vazio/null, valor_bruto é obrigatório no body
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    const tipo = String(body.tipo || '')
    if (tipo !== 'despesa' && tipo !== 'receita') {
      return NextResponse.json({ error: 'Tipo inválido (despesa|receita)' }, { status: 400 })
    }

    // ─── Valida detalhes ───────────────────────────────────────────
    const det = validarDetalhes(body.detalhes)
    if (!det.ok) return NextResponse.json({ error: det.error }, { status: 400 })

    // ─── Calcula valor_bruto ──────────────────────────────────────
    let valorBruto: number
    if (det.lista.length > 0) {
      valorBruto = Math.round(det.lista.reduce((s, i) => s + i.valor, 0) * 100) / 100
    } else {
      valorBruto = Number(body.valor_bruto)
      if (!Number.isFinite(valorBruto) || valorBruto < 0) {
        return NextResponse.json({ error: 'Valor bruto inválido' }, { status: 400 })
      }
    }

    const taxa = body.taxa !== undefined ? Number(body.taxa) : 0
    if (!Number.isFinite(taxa) || taxa < 0) {
      return NextResponse.json({ error: 'Taxa inválida' }, { status: 400 })
    }

    const descricao = String(body.descricao || '').trim()
    if (!descricao) {
      return NextResponse.json({ error: 'Descrição obrigatória' }, { status: 400 })
    }

    const categoria = String(body.categoria || '')
    if (tipo === 'despesa' && !CATEGORIAS_DESPESA.includes(categoria)) {
      return NextResponse.json({ error: 'Categoria inválida pra despesa' }, { status: 400 })
    }
    if (tipo === 'receita' && !CATEGORIAS_TODAS.includes(categoria)) {
      return NextResponse.json({ error: 'Categoria inválida' }, { status: 400 })
    }

    const dataCompetencia = String(body.data_competencia || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataCompetencia)) {
      return NextResponse.json({ error: 'Data de competência inválida (YYYY-MM-DD)' }, { status: 400 })
    }

    const valorLiquido = valorBruto - taxa

    const insert: any = {
      tipo,
      valor_bruto: valorBruto,
      taxa,
      valor_liquido: valorLiquido,
      descricao,
      categoria,
      data_competencia: dataCompetencia,
      data_liquidacao: body.data_liquidacao || null,
      pago:     tipo === 'despesa' ? !!body.pago     : false,
      recebido: tipo === 'receita' ? !!body.recebido : false,
      fonte: body.fonte && ['manual','stripe','outro'].includes(body.fonte) ? body.fonte : 'manual',
      despesa_recorrente_id: body.despesa_recorrente_id || null,
      observacao: body.observacao ? String(body.observacao).trim() : null,
      detalhes:   det.lista.length > 0 ? det.lista : null,
    }

    const sb = supabaseAdmin()
    const { data, error } = await sb.from('lancamentos').insert(insert).select().limit(1)

    if (error) {
      console.error('[financeiro/lancamentos POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ lancamento: data?.[0] }, { status: 201 })
  } catch (err: any) {
    console.error('[financeiro/lancamentos POST]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
