import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

const CATEGORIAS_DESPESA = ['infra', 'marketing', 'dominio', 'pagamentos', 'impostos', 'outros']

// GET /api/admin/financeiro/despesas-recorrentes
export async function GET(_req: NextRequest) {
  try {
    const sb = supabaseAdmin()
    const { data, error } = await sb
      .from('despesas_recorrentes')
      .select('*')
      .order('ativa',          { ascending: false })
      .order('valor_mensal',   { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const total_mensal = (data || [])
      .filter(d => d.ativa)
      .reduce((acc, d) => acc + Number(d.valor_mensal), 0)

    return NextResponse.json({ despesas: data || [], total_mensal })
  } catch (err: any) {
    console.error('[financeiro/despesas-recorrentes GET]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST /api/admin/financeiro/despesas-recorrentes
// Body: { nome, categoria, valor_mensal, dia_vencimento, observacao? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const nome           = String(body.nome || '').trim()
    const categoria      = String(body.categoria || '').trim()
    const valor_mensal   = Number(body.valor_mensal)
    const dia_vencimento = Number(body.dia_vencimento)
    const observacao     = body.observacao ? String(body.observacao).trim() : null

    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }
    if (!CATEGORIAS_DESPESA.includes(categoria)) {
      return NextResponse.json({ error: 'Categoria inválida' }, { status: 400 })
    }
    if (!Number.isFinite(valor_mensal) || valor_mensal < 0) {
      return NextResponse.json({ error: 'Valor mensal inválido' }, { status: 400 })
    }
    if (!Number.isInteger(dia_vencimento) || dia_vencimento < 1 || dia_vencimento > 31) {
      return NextResponse.json({ error: 'Dia de vencimento deve estar entre 1 e 31' }, { status: 400 })
    }

    const sb = supabaseAdmin()
    const { data, error } = await sb
      .from('despesas_recorrentes')
      .insert({ nome, categoria, valor_mensal, dia_vencimento, observacao })
      .select()
      .limit(1)

    if (error) {
      console.error('[financeiro/despesas-recorrentes POST]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ despesa: data?.[0] }, { status: 201 })
  } catch (err: any) {
    console.error('[financeiro/despesas-recorrentes POST]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
