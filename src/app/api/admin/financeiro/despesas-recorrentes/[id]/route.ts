import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

const CATEGORIAS = ['infra', 'marketing', 'dominio', 'pagamentos', 'impostos', 'outros']

// PATCH /api/admin/financeiro/despesas-recorrentes/[id]
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))

    const patch: any = { updated_at: new Date().toISOString() }

    if (body.nome !== undefined) {
      const v = String(body.nome).trim()
      if (!v) return NextResponse.json({ error: 'Nome não pode ser vazio' }, { status: 400 })
      patch.nome = v
    }
    if (body.categoria !== undefined) {
      if (!CATEGORIAS.includes(body.categoria)) {
        return NextResponse.json({ error: 'Categoria inválida' }, { status: 400 })
      }
      patch.categoria = body.categoria
    }
    if (body.valor_mensal !== undefined) {
      const v = Number(body.valor_mensal)
      if (!Number.isFinite(v) || v < 0) {
        return NextResponse.json({ error: 'Valor mensal inválido' }, { status: 400 })
      }
      patch.valor_mensal = v
    }
    if (body.dia_vencimento !== undefined) {
      const v = Number(body.dia_vencimento)
      if (!Number.isInteger(v) || v < 1 || v > 31) {
        return NextResponse.json({ error: 'Dia inválido' }, { status: 400 })
      }
      patch.dia_vencimento = v
    }
    if (body.ativa !== undefined) {
      patch.ativa = !!body.ativa
    }
    if (body.observacao !== undefined) {
      patch.observacao = body.observacao ? String(body.observacao).trim() : null
    }

    const sb = supabaseAdmin()
    const { data, error } = await sb
      .from('despesas_recorrentes')
      .update(patch)
      .eq('id', id)
      .select()
      .limit(1)

    if (error) {
      console.error('[financeiro/despesas-recorrentes PATCH]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data?.[0]) {
      return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 })
    }

    return NextResponse.json({ despesa: data[0] })
  } catch (err: any) {
    console.error('[financeiro/despesas-recorrentes PATCH]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE /api/admin/financeiro/despesas-recorrentes/[id]
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const sb = supabaseAdmin()

    const { error } = await sb
      .from('despesas_recorrentes')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[financeiro/despesas-recorrentes DELETE]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[financeiro/despesas-recorrentes DELETE]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
